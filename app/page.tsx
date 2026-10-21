"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// 1. ТИПЫ ДАННЫХ CRYSTALDISKINFO // DISCO ELYSIUM EDITION
// ============================================================================

type HealthState = "GOOD" | "CAUTION" | "BAD";
type ShaderSceneId = "mind_burst" | "dolores_lungs" | "cousteau_grin" | "church_beams";

interface SmartAttribute {
  id: string;
  name: string;
  ruName: string;
  current: number;
  worst: number;
  threshold: number;
  rawDec: number;
  status: HealthState;
  unit?: string;
  voices: {
    skill: string;
    category: "INT" | "PSY" | "FYS" | "MOT" | "TIE";
    difficulty: string;
    text: string;
  }[];
}

interface DriveProfile {
  id: string;
  letter: string;
  name: string;
  model: string;
  capacityGB: number;
  firmware: string;
  serial: string;
  interfaceType: string;
  transferMode: string;
  standard: string;
  features: string;
  healthStatus: HealthState;
  healthPercent: number;
  temperature: number;
  totalReadsGB: number;
  totalWritesGB: number;
  powerOnCount: number;
  powerOnHours: number;
  rotationRate: string;
  attributes: SmartAttribute[];
}

interface DialogueMessage {
  id: string;
  skill: string;
  category: "INT" | "PSY" | "FYS" | "MOT" | "TIE";
  difficulty?: string;
  text: string;
}

interface ArtworkSlot {
  id: string;
  title: string;
  scene: ShaderSceneId;
  repoPath: string;
  customDataUrl: string | null;
}

// ============================================================================
// 2. ХРАНИЛИЩЕ INDEXEDDB ДЛЯ ПОЛЬЗОВАТЕЛЬСКИХ ХОЛСТОВ (CTRL+V / DRAG & DROP)
// ============================================================================

const DB_NAME = "DiscoCdiMasterpieceDB";
const STORE_NAME = "canvases";

function openArtDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveArtToDB(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openArtDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, key);
  } catch {}
}

async function loadArtsFromDB(): Promise<Record<string, string>> {
  try {
    const db = await openArtDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const out: Record<string, string> = {};
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          out[String(cursor.key)] = String(cursor.value);
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      cursorReq.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

// ============================================================================
// 3. ЗВУКОВОЙ ДВИЖОК (WEB AUDIO API)
// ============================================================================

class ElysiumAudio {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  playRelayClick() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(310, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.032);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.035);
    } catch {}
  }

  playCheckChord(success: boolean) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const freqs = success ? [196.0, 246.94, 293.66, 392.0] : [110.0, 116.54, 164.81];
      freqs.forEach((f, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = success ? "sine" : "sawtooth";
        osc.frequency.setValueAtTime(f, t + idx * 0.035);
        g.gain.setValueAtTime(0.001, t + idx * 0.035);
        g.gain.linearRampToValueAtTime(0.035, t + idx * 0.035 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 1.2);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t + idx * 0.035);
        osc.stop(t + 1.25);
      });
    } catch {}
  }
}

const soundFX = new ElysiumAudio();

// ============================================================================
// 4. ПОПИКСЕЛЬНЫЙ ШЕЙДЕР МАСЛЯНОЙ ЖИВОПИСИ (3D SDF + FBM + ФИЛЬТР КУВАХАРЫ)
// ============================================================================

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const mix = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

// Гладкий минимум для органического слияния 3D-скульптуры лица без углов и швов
const smin = (a: number, b: number, k: number) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
};

// Расстояние до отрезка (капсулы) для анатомии шеи, пальцев, бронхов и лучей
const sdSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay + 1e-6), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
};

// Расстояние до наклонного эллипса
const sdEllipse = (
  px: number,
  py: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ang: number
) => {
  const dx = px - cx;
  const dy = py - cy;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const ux = (dx * c + dy * s) / rx;
  const uy = (-dx * s + dy * c) / ry;
  return (Math.hypot(ux, uy) - 1.0) * Math.min(rx, ry);
};

// Быстрый двумерный градиентный шум и 4-октавный фрактальный шум (fBM)
const hash2 = (x: number, y: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
};

const noise2D = (x: number, y: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
};

const fbm = (x: number, y: number) => {
  let v = 0.0;
  let amp = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < 4; i++) {
    v += amp * noise2D(px, py);
    const nx = px * 1.6 - py * 1.2 + 17.3;
    const ny = px * 1.2 + py * 1.6 + 31.7;
    px = nx;
    py = ny;
    amp *= 0.5;
  }
  return v;
};

/**
 * Рендерит высокодетализированное живописное полотно попиксельно
 * и пропускает его через анизотропный масляный фильтр с рельефом мазка (Impasto)
 */
function renderOilShaderToCanvas(canvas: HTMLCanvasElement, scene: ShaderSceneId) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rawBuf = new Float32Array(W * H * 3);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 3;
      const n1 = fbm(x * 0.015, y * 0.015);
      const n2 = fbm(x * 0.04 + n1 * 2.2, y * 0.04 - n1 * 1.8);

      let r = 14;
      let g = 12;
      let b = 18;

      if (scene === "mind_burst") {
        // ====================================================================
        // ХОЛСТ I: ПСИХОДЕЛИЧЕСКИЙ ВЗРЫВ СОЗНАНИЯ (по мотивам @AstriaNabla)
        // ====================================================================
        r = mix(10, 28, 1 - y / H);
        g = mix(7, 12, 1 - y / H);
        b = mix(18, 46, 1 - y / H);

        // Эпицентр взрыва из правого виска/лба (205, 310) влево-вверх
        const ox = 205;
        const oy = 310;
        const dx = x - ox;
        const dy = y - oy;
        const dist = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);

        // Направленный конус психоделического протуберанца (угол от -175° до -55°)
        const cone = smoothstep(1.15, 0.15, Math.abs(ang + 2.15));
        const rayNoise = fbm(ang * 9.5 + n1 * 1.4, dist * 0.018 - n2 * 1.2);
        const streaks = smoothstep(0.32, 0.78, rayNoise) * cone * smoothstep(490, 20, dist);

        // Цветовая призма: золото в ядре -> огненный оранжевый -> неоновая фуксия -> циан и ультрафиолет
        const pGold = smoothstep(190, 10, dist) * cone;
        const pMagenta = smoothstep(0.35, 0.8, fbm(ang * 12.0, dist * 0.025)) * cone;
        const pCyan = smoothstep(0.55, 0.88, fbm(ang * 16.0 + 4.2, dist * 0.02)) * cone;

        r += streaks * 235 + pGold * 255 + pMagenta * 210 - pCyan * 40;
        g += streaks * 65 + pGold * 195 - pMagenta * 35 + pCyan * 210;
        b += streaks * 145 + pGold * 40 + pMagenta * 160 + pCyan * 245;

        // Органическая 3D-скульптура запрокинутой головы, шеи, плеч и руки у виска (через гладкий smin)
        const dCranium = sdEllipse(x, y, 222, 342, 62, 54, 0.28);
        const dJaw = sdEllipse(x, y, 205, 382, 48, 42, -0.15);
        const dSnout = sdEllipse(x, y, 198, 336, 26, 22, -0.25);
        const dHead = smin(smin(dCranium, dJaw, 18), dSnout, 14);

        const dNeck = sdSegment(x, y, 198, 392, 182, 485) - 36;
        const dShoulders = sdEllipse(x, y, 195, 595, 165, 130, 0.08);
        const dHand = smin(
          sdSegment(x, y, 268, 335, 322, 378) - 14,
          sdSegment(x, y, 322, 378, 342, 465) - 24,
          12
        );

        const dBody = smin(smin(dHead, dNeck, 20), smin(dShoulders, dHand, 16), 14);

        if (dBody < 2.0) {
          // Внутри силуэта фигуры: считаем 3D-нормали и рельеф мышц/лица
          const edgeMask = smoothstep(2.0, -3.0, dBody);
          // Освещение от точки взрыва (ox, oy)
          const lightIntensity =
            smoothstep(210, 15, dist) *
            smoothstep(265, 155, x) *
            smoothstep(465, 265, y);

          // Глазницы и закатившиеся белки глаз
          const dEyeL = sdEllipse(x, y, 182, 315, 12, 6.5, -0.25);
          const dEyeR = sdEllipse(x, y, 236, 325, 13, 7.0, 0.2);
          // Густые усы и бакенбарды
          const dMustache = smin(
            sdSegment(x, y, 162, 368, 202, 352) - 14,
            sdSegment(x, y, 202, 352, 254, 388) - 16,
            10
          );
          const dHair = sdEllipse(x, y, 268, 345, 42, 68, -0.25);

          // Базовый фиолетово-индиговый тон фигуры в контровом свете
          let fr = mix(24, 138, lightIntensity * 0.8 + n2 * 0.25);
          let fg = mix(11, 48, lightIntensity * 0.7 + n2 * 0.15);
          let fb = mix(36, 128, lightIntensity * 0.75 + n2 * 0.3);

          // Яркий персиково-розовый и золотой рефлекс на лбу, переносице и скуле
          const faceHighlight =
            smoothstep(42, -8, dHead) *
            smoothstep(255, 165, x) *
            smoothstep(375, 275, y);
          fr = mix(fr, 255, faceHighlight * 0.88);
          fg = mix(fg, 168, faceHighlight * 0.78);
          fb = mix(fb, 182, faceHighlight * 0.75);

          // Тёмные глазницы и светящиеся белки закатившихся глаз
          if (dEyeL < 4 || dEyeR < 4) {
            const eyeCore = smoothstep(1.5, -3.0, Math.min(dEyeL, dEyeR));
            fr = mix(58, 255, eyeCore);
            fg = mix(18, 230, eyeCore);
            fb = mix(52, 240, eyeCore);
          }

          // Тёмный объём усов, бакенбардов, волос и пиджака
          const darkHairMask = smoothstep(6, -6, Math.min(dMustache, dHair));
          fr = mix(fr, 28, darkHairMask * 0.88);
          fg = mix(fg, 10, darkHairMask * 0.9);
          fb = mix(fb, 34, darkHairMask * 0.85);

          if (y > 455) {
            // Пиджак и воротник рубашки
            const collar = smoothstep(14, -2, sdSegment(x, y, 162, 445, 148, 515));
            fr = mix(fr * 0.45, 225, collar * 0.8);
            fg = mix(fg * 0.42, 145, collar * 0.7);
            fb = mix(fb * 0.5, 185, collar * 0.8);
          }

          r = mix(r, fr, edgeMask);
          g = mix(g, fg, edgeMask);
          b = mix(b, fb, edgeMask);
        }
      } else if (scene === "dolores_lungs") {
        // ====================================================================
        // ХОЛСТ II: ПЬЕТА ДОЛОРЕС // СВЕТЯЩИЕСЯ ЛЁГКИЕ (по мотивам Flora Henderson)
        // ====================================================================
        r = mix(18, 38, n1);
        g = mix(16, 32, n1);
        b = mix(28, 56, 1 - y / H);

        // Багрово-красные живописные потёки масла вдоль левого края (x < 135)
        const dripNoise = fbm(x * 0.14, y * 0.008 - n1 * 0.5);
        const dripMask =
          smoothstep(145, 15, x) *
          smoothstep(180, 320, y) *
          smoothstep(0.38, 0.74, dripNoise);
        r = mix(r, 195, dripMask);
        g = mix(g, 22, dripMask);
        b = mix(b, 28, dripMask);

        // Склонённый лик Долорес Дей вверху (225, 72)
        const dDoloresHead = sdEllipse(x, y, 225, 72, 34, 42, 0.22);
        if (dDoloresHead < 8) {
          const m = smoothstep(8, -6, dDoloresHead);
          r = mix(r, 218, m * 0.85);
          g = mix(g, 152, m * 0.8);
          b = mix(b, 108, m * 0.7);
        }

        // Два светящихся золотых лёгких в груди Долорес (190, 182) и (246, 186)
        const dLungL = sdEllipse(x, y, 188, 184, 28, 48, 0.18);
        const dLungR = sdEllipse(x, y, 244, 188, 28, 48, -0.18);
        const dLungs = Math.min(dLungL, dLungR);

        // Мягкое золотое свечение вокруг лёгких
        const glow = Math.exp(-Math.max(0, dLungs) * 0.018);
        r += glow * 235;
        g += glow * 165;
        b += glow * 55;

        if (dLungs < 2) {
          // Внутри лёгких: древовидные золотисто-белые бронхиолы
          const bronchi = fbm(x * 0.09, y * 0.09 + n2 * 1.5);
          const m = smoothstep(2, -5, dLungs);
          r = mix(r, 255, m);
          g = mix(g, mix(215, 250, bronchi), m);
          b = mix(b, mix(115, 210, bronchi), m);
        }

        // Павший детектив на руках Долорес: запрокинутая голова (132, 262) и обнажённый торс в сине-золотых тонах
        const dFallenHead = sdEllipse(x, y, 134, 266, 42, 32, -0.35);
        const dTorso = sdSegment(x, y, 158, 315, 315, 425) - 52;
        const dArm = sdSegment(x, y, 155, 342, 265, 595) - 28;
        const dFallen = smin(dFallenHead, smin(dTorso, dArm, 22), 18);

        if (dFallen < 3) {
          const m = smoothstep(3, -4, dFallen);
          // Верхний край тела ярко освещён золотым светом лёгких, нижний уходит в глубокую берлинскую лазурь
          const topLight = smoothstep(420, 235, y) * smoothstep(105, 245, x);
          const prussianBlueR = mix(18, 242, topLight * 0.9 + n2 * 0.15);
          const prussianBlueG = mix(34, 205, topLight * 0.85 + n2 * 0.15);
          const prussianBlueB = mix(78, 165, topLight * 0.65 + (1 - topLight) * 0.45);

          r = mix(r, prussianBlueR, m);
          g = mix(g, prussianBlueG, m);
          b = mix(b, prussianBlueB, m);
        }
      } else if (scene === "cousteau_grin") {
        // ====================================================================
        // ХОЛСТ III: УХМЫЛКА КУСТО / THE EXPRESSION (по мотивам портрета Гарри)
        // ====================================================================
        // Светлый кремово-зелёный импасто-фон с диагональными охристыми полосами
        const diag = Math.sin((x + y) * 0.028 + n1 * 1.2);
        r = mix(198, 228, smoothstep(-0.4, 0.6, diag));
        g = mix(154, 226, smoothstep(-0.2, 0.7, diag));
        b = mix(82, 195, smoothstep(0.0, 0.8, diag));

        // Скульптура головы, бакенбардов и оливково-зелёного пиджака
        const dFace = sdEllipse(x, y, 192, 305, 68, 86, 0.04);
        const dMuttonL = sdEllipse(x, y, 132, 348, 28, 48, -0.18);
        const dMuttonR = sdEllipse(x, y, 252, 355, 26, 46, 0.18);
        const dMustache = sdEllipse(x, y, 194, 368, 46, 18, 0.04);
        const dHairTop = sdEllipse(x, y, 194, 212, 74, 44, -0.05);
        const dCoat = sdEllipse(x, y, 192, 565, 165, 145, 0);

        if (dCoat < 2) {
          const m = smoothstep(2, -4, dCoat);
          // Оливково-зелёный пиджак и острый белый диско-воротник
          const dCollar = Math.min(
            sdSegment(x, y, 148, 445, 118, 545) - 18,
            sdSegment(x, y, 236, 445, 262, 545) - 18
          );
          if (dCollar < 2) {
            r = mix(r, 218, m);
            g = mix(g, 224, m);
            b = mix(b, 214, m);
          } else {
            r = mix(r, 44 + n2 * 22, m);
            g = mix(g, 64 + n2 * 28, m);
            b = mix(b, 32 + n2 * 14, m);
          }
        }

        const dFullHead = smin(dFace, smin(dMuttonL, dMuttonR, 16), 12);
        if (dFullHead < 2) {
          const m = smoothstep(2, -4, dFullHead);
          // Базовый серо-телесный тон с похмельным румянцем в центре лица (нос и щёки)
          const rosacea = Math.exp(-Math.hypot(x - 194, y - 325) * 0.025);
          // Фирменный чисто-белый блик мастихином на лбу (188, 248)
          const foreheadSpec = smoothstep(32, 4, Math.hypot(x - 188, y - 248));

          let fr = mix(178, 192, rosacea) + foreheadSpec * 75;
          let fg = mix(164, 78, rosacea * 0.75) + foreheadSpec * 85;
          let fb = mix(154, 64, rosacea * 0.8) + foreheadSpec * 88;

          // Прищуренные глаза
          const dEyeL = sdEllipse(x, y, 164, 302, 16, 6, 0.12);
          const dEyeR = sdEllipse(x, y, 226, 308, 15, 6, -0.1);
          if (dEyeL < 3 || dEyeR < 3) {
            fr *= 0.28;
            fg *= 0.22;
            fb *= 0.22;
          }

          // Ухмылка с полоской зубов
          const dSmile = sdEllipse(x, y, 194, 388, 24, 9, 0.06);
          if (dSmile < 1) {
            fr = 235;
            fg = 230;
            fb = 220;
          }

          // Тёмно-каштановые бакенбарды, усы и растрёпанная шевелюра
          const hairDist = Math.min(
            Math.min(dMuttonL, dMuttonR),
            Math.min(dMustache, dHairTop)
          );
          if (hairDist < 3) {
            const hm = smoothstep(3, -4, hairDist);
            fr = mix(fr, 38 + n2 * 25, hm);
            fg = mix(fg, 24 + n2 * 16, hm);
            fb = mix(fb, 19 + n2 * 12, hm);
          }

          r = mix(r, fr, m);
          g = mix(g, fg, m);
          b = mix(b, fb, m);
        }
      } else {
        // ====================================================================
        // ХОЛСТ IV: ХАРДКОР В ЦЕРКВИ // КИМ, ВИТРАЖ И ЛАЗЕРЫ (image_54817e)
        // ====================================================================
        r = mix(22, 45, n1);
        g = mix(28, 38, n1);
        b = mix(38, 24, n1);

        // Золотой витраж Долорес Дей в верхней правой части холста
        const dWindow = sdEllipse(x, y, 245, 175, 95, 165, 0.12);
        if (dWindow < 15) {
          const wm = smoothstep(15, -10, dWindow);
          r = mix(r, 228, wm * 0.85);
          g = mix(g, 178, wm * 0.8);
          b = mix(b, 92, wm * 0.65);
        }

        // Силуэт Кима Кицураги на переднем плане в ярко-оранжевом бомбере
        const dKimJacket = sdEllipse(x, y, 128, 335, 76, 95, -0.15);
        const dKimHead = sdEllipse(x, y, 108, 202, 32, 38, -0.1);
        const dKimPants = sdEllipse(x, y, 138, 535, 68, 135, 0.08);

        if (dKimPants < 3) {
          const m = smoothstep(3, -4, dKimPants);
          r = mix(r, 24, m);
          g = mix(g, 28, m);
          b = mix(b, 34, m);
        }
        if (dKimJacket < 3) {
          const m = smoothstep(3, -4, dKimJacket);
          r = mix(r, 228 + n2 * 25, m);
          g = mix(g, 88 + n2 * 20, m);
          b = mix(b, 28, m);
        }
        if (dKimHead < 3) {
          const m = smoothstep(3, -4, dKimHead);
          r = mix(r, 198, m);
          g = mix(g, 142, m);
          b = mix(b, 102, m);
          // Светящиеся круглые очки Кима
          const dGlasses = Math.min(
            Math.hypot(x - 98, y - 204) - 9,
            Math.hypot(x - 120, y - 200) - 9
          );
          if (dGlasses < 1.5) {
            r = 215;
            g = 248;
            b = 255;
          }
        }

        // Неоново-голубые лазерные лучи, рассекающие церковь по диагоналям
        const dLaser1 = sdSegment(x, y, 0, 85, W, 345);
        const dLaser2 = sdSegment(x, y, 85, 0, W, 540);
        const dLaser3 = sdSegment(x, y, 0, 495, W, 245);
        const dMinLaser = Math.min(dLaser1, Math.min(dLaser2, dLaser3));
        const laserGlow = Math.exp(-dMinLaser * 0.14);
        r += laserGlow * 65;
        g += laserGlow * 225;
        b += laserGlow * 255;
      }

      rawBuf[idx] = clamp(r, 0, 255);
      rawBuf[idx + 1] = clamp(g, 0, 255);
      rawBuf[idx + 2] = clamp(b, 0, 255);
    }
  }

  // ==========================================================================
  // ПРОХОД 2: АНИЗОТРОПНЫЙ ФИЛЬТР МАСЛЯНОГО МАЗКА КУВАХАРЫ + РЕЛЬЕФ КРАСКИ (IMPASTO)
  // Превращает гладкие градиенты в настоящие густые мазки кисти с бликом на гребне!
  // ==========================================================================
  const imgData = ctx.createImageData(W, H);
  const out = imgData.data;

  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      // Направление мазка кисти следует за вихревым полем картины
      const flowAngle = fbm(x * 0.025, y * 0.025) * Math.PI * 2.0;
      const dx = Math.round(Math.cos(flowAngle) * 2);
      const dy = Math.round(Math.sin(flowAngle) * 2);

      const cIdx = (y * W + x) * 3;
      const fIdx = ((y + dy) * W + (x + dx)) * 3;
      const bIdx = ((y - dy) * W + (x - dx)) * 3;

      // Усреднение вдоль волокон кисти + расчёт рельефа краски (Impasto specular ridge)
      const mr = (rawBuf[cIdx] * 2 + rawBuf[fIdx] + rawBuf[bIdx]) * 0.25;
      const mg = (rawBuf[cIdx + 1] * 2 + rawBuf[fIdx + 1] + rawBuf[bIdx + 1]) * 0.25;
      const mb = (rawBuf[cIdx + 2] * 2 + rawBuf[fIdx + 2] + rawBuf[bIdx + 2]) * 0.25;

      // Гребень мазка мастихина (производная яркости поперёк мазка)
      const ridge = (rawBuf[fIdx] - rawBuf[bIdx]) * 0.18;
      // Текстура переплетения нитей льняного холста
      const weave = ((x % 3 === 0 ? 1 : -1) + (y % 3 === 0 ? 1 : -1)) * 1.8;

      const outIdx = (y * W + x) * 4;
      out[outIdx] = clamp(mr + ridge + weave, 0, 255);
      out[outIdx + 1] = clamp(mg + ridge + weave, 0, 255);
      out[outIdx + 2] = clamp(mb + ridge + weave, 0, 255);
      out[outIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// Компонент витрины: показывает ваш оригинал (если загружен через Ctrl+V / public), иначе — масляный шейдер
function ArtworkShowcase({
  slot,
  onPastePrompt,
}: {
  slot: ArtworkSlot;
  onPastePrompt: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [repoImgValid, setRepoImgValid] = useState<boolean>(false);

  // Проверяем, положил ли пользователь файл /art1.jpg..art4.jpg в папку public/
  useEffect(() => {
    if (slot.customDataUrl) return;
    let active = true;
    const testImg = new Image();
    testImg.onload = () => {
      if (active) setRepoImgValid(true);
    };
    testImg.onerror = () => {
      if (active) setRepoImgValid(false);
    };
    testImg.src = slot.repoPath;
    return () => {
      active = false;
    };
  }, [slot.repoPath, slot.customDataUrl]);

  useEffect(() => {
    if (slot.customDataUrl || repoImgValid) return;
    if (canvasRef.current) {
      renderOilShaderToCanvas(canvasRef.current, slot.scene);
    }
  }, [slot.scene, slot.customDataUrl, repoImgValid]);

  const activeImageSrc = slot.customDataUrl || (repoImgValid ? slot.repoPath : null);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0e0c0a" }}>
      {activeImageSrc ? (
        <img
          src={activeImageSrc}
          alt={slot.title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            display: "block",
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={380}
          height={736}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "8px 10px",
          background: "linear-gradient(0deg, rgba(10, 9, 8, 0.92) 0%, transparent 100%)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          color: "#cbbba0",
        }}
      >
        <span>{slot.title} (Ctrl+V — вставить арт)</span>
        <button
          onClick={onPastePrompt}
          style={{
            background: "rgba(24, 20, 17, 0.85)",
            border: "1px solid rgba(212, 163, 89, 0.45)",
            color: "#f3ead8",
            padding: "2px 8px",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          Выбрать файл...
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 5. БАЗА ДАННЫХ НАКОПИТЕЛЕЙ И РЕПЛИК DISCO ELYSIUM
// ============================================================================

const INITIAL_DRIVES: DriveProfile[] = [
  {
    id: "nvme_c",
    letter: "C:",
    name: "РАДИОКОМПЬЮТЕР РГМ-41",
    model: "Samsung SSD 980 PRO 1TB",
    capacityGB: 1000.2,
    firmware: "5B2QGXA7",
    serial: "S69ENF0R841951K",
    interfaceType: "NVM Express",
    transferMode: "PCIe 4.0 x4 | PCIe 4.0 x4",
    standard: "NVM Express 1.4",
    features: "S.M.A.R.T., TRIM, VolatileWriteCache",
    healthStatus: "GOOD",
    healthPercent: 96,
    temperature: 41,
    totalReadsGB: 14820,
    totalWritesGB: 19450,
    powerOnCount: 1412,
    powerOnHours: 4890,
    rotationRate: "---- (SSD)",
    attributes: [
      {
        id: "01",
        name: "Critical Warning",
        ruName: "Критические предупреждения контроллера",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 0,
        status: "GOOD",
        voices: [
          {
            skill: "ЭНЦИКЛОПЕДИЯ",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "Регистр 01h стандарта NVM Express хранит битовую маску аварийных флагов: деградацию резервных блоков, тепловой пробой и аварийную блокировку записи. Все биты равны нулю.",
          },
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Средне: Успех",
            text: "Хоть что-то в этом проклятом мире ещё не развалилось на куски. Внутри чёрного кремниевого прямоугольника царит хрупкий, звенящий покой.",
          },
        ],
      },
      {
        id: "02",
        name: "Composite Temperature",
        ruName: "Температура кристалла памяти",
        current: 100,
        worst: 82,
        threshold: 85,
        rawDec: 41,
        unit: "°C",
        status: "GOOD",
        voices: [
          {
            skill: "ЭЛЕКТРОХИМИЯ",
            category: "FYS",
            difficulty: "Легко: Успех",
            text: "41 градус Цельсия — температура горячечного бреда после трёх бутылок «Комодор Ред», но для кремниевого кристалла под медной пластиной это тёплая утренняя нега.",
          },
        ],
      },
      {
        id: "03",
        name: "Available Spare",
        ruName: "Резервный пул запасных ячеек",
        current: 100,
        worst: 100,
        threshold: 10,
        rawDec: 100,
        unit: "%",
        status: "GOOD",
        voices: [
          {
            skill: "ЛОГИКА",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "100% резервной области Over-Provisioning при критическом пороге 10%. Ни одна ячейка 128-слойной памяти V-NAND ещё не выведена из обращения.",
          },
        ],
      },
      {
        id: "05",
        name: "Percentage Used",
        ruName: "Степень износа оксидного слоя (TBW)",
        current: 96,
        worst: 96,
        threshold: 0,
        rawDec: 4,
        unit: "%",
        status: "GOOD",
        voices: [
          {
            skill: "КОНЦЕПТУАЛИЗАЦИЯ",
            category: "INT",
            difficulty: "Средне: Успех",
            text: "Каждый записанный гигабайт — это импульс напряжения, пробивающий туннельный диэлектрик. Кристалл медленно стирается от того, что вынужден помнить твою жизнь.",
          },
        ],
      },
      {
        id: "06",
        name: "Data Units Read",
        ruName: "Всего прочитано блоков (Хост-чтение)",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 29640120,
        status: "GOOD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Легко: Успех",
            text: "14 820 гигабайт пронеслись по четырём линиям PCIe 4.0 со скоростью 7000 МБ/с. Контроллер отдаёт данные быстрее, чем формируется человеческая мысль.",
          },
        ],
      },
      {
        id: "07",
        name: "Data Units Written",
        ruName: "Всего записано блоков (Хост-запись)",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 38900450,
        status: "GOOD",
        voices: [
          {
            skill: "УЖАСАЮЩИЙ ГАЛСТУК",
            category: "TIE",
            difficulty: "Безумно: Успех",
            text: "Девятнадцать с половиной терабайт улик, старой музыки и недописанных протоколов, братишка!",
          },
        ],
      },
      {
        id: "0C",
        name: "Power Cycles",
        ruName: "Включения / отключения питания",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 1412,
        status: "GOOD",
        voices: [
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Легко: Успех",
            text: "1412 маленьких воскрешений из темноты. Каждый раз при подаче тока этот диск собирает твою реальность заново.",
          },
        ],
      },
      {
        id: "0D",
        name: "Unsafe Shutdowns",
        ruName: "Неожиданные потери питания",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 19,
        status: "GOOD",
        voices: [
          {
            skill: "БОЛЕВОЙ ПОРОГ",
            category: "FYS",
            difficulty: "Средне: Успех",
            text: "19 раз питание обрывалось наживую — как удар трубой по затылку в переулке за «Танцами в тряпье». Но таблица трансляции FTL устояла.",
          },
        ],
      },
      {
        id: "0E",
        name: "Media and Data Integrity Errors",
        ruName: "Неисправимые ошибки целостности данных",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 0,
        status: "GOOD",
        voices: [
          {
            skill: "ЛОГИКА",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "Ноль ошибок декодера LDPC. Все контрольные суммы сходятся.",
          },
        ],
      },
    ],
  },
  {
    id: "hdd_d",
    letter: "D:",
    name: "АРХИВ УЧАСТКА №41",
    model: "WDC WD20EZBX-00AYRA0 2000.3 GB",
    capacityGB: 2000.3,
    firmware: "01.01A01",
    serial: "WD-WCC4M8192041",
    interfaceType: "Serial ATA",
    transferMode: "SATA/600 | SATA/600",
    standard: "ACS-3 | ATA8-ACS",
    features: "S.M.A.R.T., NCQ, GPL",
    healthStatus: "CAUTION",
    healthPercent: 58,
    temperature: 52,
    totalReadsGB: 84120,
    totalWritesGB: 61390,
    powerOnCount: 5340,
    powerOnHours: 34820,
    rotationRate: "7200 RPM",
    attributes: [
      {
        id: "05",
        name: "Reallocated Sectors Count",
        ruName: "Переназначенные сектора (Bad Blocks)",
        current: 140,
        worst: 140,
        threshold: 140,
        rawDec: 48,
        status: "CAUTION",
        voices: [
          {
            skill: "БОЛЕВОЙ ПОРОГ",
            category: "FYS",
            difficulty: "Сложно: Успех",
            text: "Сорок восемь выжженных микрократеров на зеркале магнитного диска. Контроллер пометил их как мёртвую зону и перенёс чтение в конец пластины.",
          },
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Средне: Успех",
            text: "Твоя собственная память устроена точно так же, Гарри. Сорок восемь выжженных секторов — и вот ты уже не помнишь лица женщины с запахом абрикосовой жвачки.",
          },
        ],
      },
      {
        id: "09",
        name: "Power-On Hours",
        ruName: "Часы работы",
        current: 53,
        worst: 53,
        threshold: 0,
        rawDec: 34820,
        unit: "ч",
        status: "GOOD",
        voices: [
          {
            skill: "ТРЕПЕТ",
            category: "FYS",
            difficulty: "Средне: Успех",
            text: "Четыре года непрерывного вращения со скоростью 120 оборотов в секунду под гул дождей над Мартинезом.",
          },
        ],
      },
      {
        id: "C5",
        name: "Current Pending Sector Count",
        ruName: "Нестабильные сектора (ожидают замены)",
        current: 198,
        worst: 198,
        threshold: 0,
        rawDec: 14,
        status: "CAUTION",
        voices: [
          {
            skill: "ЭНЦИКЛОПЕДИЯ",
            category: "INT",
            difficulty: "Сложно: Успех",
            text: "14 нестабильных секторов в регистре C5h. Контрольная сумма ECC в них уже не сходится. При следующем обращении система зависнет.",
          },
        ],
      },
    ],
  },
  {
    id: "pale_e",
    letter: "E:",
    name: "КАТУШКА «ДОЛОРЕС»",
    model: "SEAGATE ST1000DM003-9YN162 1000.2 GB",
    capacityGB: 1000.2,
    firmware: "CC4B",
    serial: "Z1D4PALE0091",
    interfaceType: "Serial ATA",
    transferMode: "SATA/150 | SATA/600",
    standard: "ATA8-ACS",
    features: "S.M.A.R.T. (АВАРИЯ)",
    healthStatus: "BAD",
    healthPercent: 11,
    temperature: 63,
    totalReadsGB: 192400,
    totalWritesGB: 144800,
    powerOnCount: 11204,
    powerOnHours: 68410,
    rotationRate: "7200 RPM",
    attributes: [
      {
        id: "05",
        name: "Reallocated Sectors Count",
        ruName: "Переназначенные сектора (Крах G-List)",
        current: 12,
        worst: 12,
        threshold: 36,
        rawDec: 2418,
        status: "BAD",
        voices: [
          {
            skill: "ЛОГИКА",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "Нормализованное значение (12) пробило порог отказа (Threshold = 36). 2418 мёртвых секторов переполнили заводскую таблицу дефектов G-List.",
          },
        ],
      },
      {
        id: "C6",
        name: "Uncorrectable Sector Count",
        ruName: "Неисправимые ошибки секторов",
        current: 41,
        worst: 41,
        threshold: 0,
        rawDec: 612,
        status: "BAD",
        voices: [
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Невозможно: Успех",
            text: "Серота просочилась сквозь гермопрокладку. 612 секторов больше не принадлежат материальному миру — там лишь энтропия и радиошум чужих забытых писем.",
          },
        ],
      },
    ],
  },
];

function parseRealSmartReport(rawText: string): DriveProfile | null {
  const lines = rawText.split(/\r?\n/);
  if (lines.length < 3) return null;

  let model = "Полевой накопитель РГМ";
  let firmware = "1.00";
  let serial = "REV-0041";
  let interfaceType = "NVM Express / SATA";
  let transferMode = "PCIe / SATA-600";
  let temperature = 40;
  let healthPercent = 98;
  let healthStatus: HealthState = "GOOD";
  let powerOnHours = 950;
  let powerOnCount = 210;
  let totalReadsGB = 4200;
  let totalWritesGB = 3800;

  for (const line of lines) {
    const l = line.trim();
    if (/^(Model|Device Model|Model Number)\s*:/i.test(l)) model = l.split(":")[1]?.trim() || model;
    else if (/^Firmware(\s+Version)?\s*:/i.test(l)) firmware = l.split(":")[1]?.trim() || firmware;
    else if (/^Serial\s*Number\s*:/i.test(l)) serial = l.split(":")[1]?.trim() || serial;
    else if (/^Interface\s*:/i.test(l)) interfaceType = l.split(":")[1]?.trim() || interfaceType;
    else if (/^Transfer\s*Mode\s*:/i.test(l)) transferMode = l.split(":")[1]?.trim() || transferMode;
    else if (/^Temperature\s*:/i.test(l)) {
      const m = l.match(/(\d+)\s*C/i);
      if (m) temperature = parseInt(m[1], 10);
    } else if (/^Health\s*Status\s*:/i.test(l)) {
      if (/bad|плох|крит/i.test(l)) healthStatus = "BAD";
      else if (/caution|тревог/i.test(l)) healthStatus = "CAUTION";
      const pm = l.match(/(\d+)\s*%/);
      if (pm) healthPercent = parseInt(pm[1], 10);
    } else if (/^Power\s*On\s*Hours\s*:/i.test(l)) {
      const m = l.match(/(\d+)/);
      if (m) powerOnHours = parseInt(m[1], 10);
    } else if (/^Power\s*On\s*Count\s*:/i.test(l)) {
      const m = l.match(/(\d+)/);
      if (m) powerOnCount = parseInt(m[1], 10);
    }
  }

  const parsedAttrs: SmartAttribute[] = [];
  for (const line of lines) {
    const cdiAta = line
      .trim()
      .match(/^([0-9A-Fa-f]{2})\s+(\d+)\s+(\d+)\s+(\d+)\s+([0-9A-Fa-f]{8,16})\s+(.+)$/);
    if (cdiAta) {
      const id = cdiAta[1].toUpperCase();
      const cur = parseInt(cdiAta[2], 10);
      const wor = parseInt(cdiAta[3], 10);
      const thr = parseInt(cdiAta[4], 10);
      const rawDec = parseInt(cdiAta[5], 16) || 0;
      const name = cdiAta[6].trim();
      let st: HealthState = "GOOD";
      if (thr > 0 && cur <= thr) st = "BAD";
      else if ((id === "05" || id === "C5" || id === "C6") && rawDec > 0) st = "CAUTION";

      parsedAttrs.push({
        id,
        name,
        ruName: name,
        current: cur,
        worst: wor,
        threshold: thr,
        rawDec,
        status: st,
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Средне: Успех",
            text: `Считан аппаратный регистр ${id}h (${name}): нормализованный показатель ${cur} при пороге ${thr}, необработанное значение = ${rawDec}.`,
          },
        ],
      });
    }
  }

  return {
    id: `real_${Date.now()}`,
    letter: "R:",
    name: "ЛОКАЛЬНЫЙ ДИСК",
    model,
    capacityGB: 1000.0,
    firmware,
    serial,
    interfaceType,
    transferMode,
    standard: "ACS-3 | NVM Express",
    features: "S.M.A.R.T., NCQ, TRIM",
    healthStatus,
    healthPercent,
    temperature,
    totalReadsGB,
    totalWritesGB,
    powerOnCount,
    powerOnHours,
    rotationRate: "---- (SSD)",
    attributes: parsedAttrs.length > 0 ? parsedAttrs : INITIAL_DRIVES[0].attributes,
  };
}

// ============================================================================
// 6. ГЛАВНЫЙ КОМПОНЕНТ (КАНОНИЧНАЯ РАСКЛАДКА + ВСТАВКА АРТОВ ПО CTRL+V)
// ============================================================================

const INITIAL_SLOTS: ArtworkSlot[] = [
  {
    id: "slot_1",
    title: "Холст I: Взрыв (B' B'')",
    scene: "mind_burst",
    repoPath: "/art1.jpg",
    customDataUrl: null,
  },
  {
    id: "slot_2",
    title: "Холст II: Пьета Долорес",
    scene: "dolores_lungs",
    repoPath: "/art2.jpg",
    customDataUrl: null,
  },
  {
    id: "slot_3",
    title: "Холст III: Ухмылка Кусто",
    scene: "cousteau_grin",
    repoPath: "/art3.jpg",
    customDataUrl: null,
  },
  {
    id: "slot_4",
    title: "Холст IV: Церковь и лазеры",
    scene: "church_beams",
    repoPath: "/art4.jpg",
    customDataUrl: null,
  },
];

export default function CrystalDiskElysiumEdition() {
  const [drives, setDrives] = useState<DriveProfile[]>(INITIAL_DRIVES);
  const [activeDriveIdx, setActiveDriveIdx] = useState<number>(0);

  const [artSlots, setArtSlots] = useState<ArtworkSlot[]>(INITIAL_SLOTS);
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);

  const [rawFormat, setRawFormat] = useState<"HEX16" | "DEC10">("HEX16");
  const [selectedAttrId, setSelectedAttrId] = useState<string>("01");
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [lastDice, setLastDice] = useState<[number, number]>([5, 6]);

  const [thoughts, setThoughts] = useState<DialogueMessage[]>([
    {
      id: "init_1",
      skill: "КОНЦЕПТУАЛИЗАЦИЯ",
      category: "INT",
      difficulty: "Сложно: Успех",
      text: "Никаких чужих обложек с логотипами. Холст слева написан попиксельным масляным шейдером с рельефом мастихина, а если нажать Ctrl + V (или перетащить файлы), программа навсегда впитает твои собственные полотна.",
    },
    {
      id: "init_2",
      skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
      category: "PSY",
      difficulty: "Средне: Успех",
      text: "Выбери любую строку в ведомости S.M.A.R.T., чтобы услышать голоса внутри контроллера.",
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Восстановление пользовательских артов из IndexedDB
  useEffect(() => {
    loadArtsFromDB().then((savedMap) => {
      setArtSlots((prev) =>
        prev.map((slot, i) => {
          const saved = savedMap[`slot_${i + 1}`];
          return saved ? { ...slot, customDataUrl: saved } : slot;
        })
      );
    });
  }, []);

  // Поддержка вставки картинки прямо из буфера обмена по Ctrl + V в любом месте окна!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const blob = items[i].getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = String(ev.target?.result || "");
            if (!dataUrl) return;
            const slotKey = `slot_${activeSlotIdx + 1}`;
            saveArtToDB(slotKey, dataUrl);
            setArtSlots((prev) =>
              prev.map((s, idx) => (idx === activeSlotIdx ? { ...s, customDataUrl: dataUrl } : s))
            );
            soundFX.playCheckChord(true);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeSlotIdx]);

  // Автоподхват реальных дисков в Electron (.exe / .deb / .dmg)
  useEffect(() => {
    const win = window as unknown as {
      electronSMART?: { getRealDrives: () => Promise<DriveProfile[]> };
    };
    if (win.electronSMART && typeof win.electronSMART.getRealDrives === "function") {
      win.electronSMART
        .getRealDrives()
        .then((realDrives) => {
          if (Array.isArray(realDrives) && realDrives.length > 0) {
            setDrives([...realDrives, ...INITIAL_DRIVES]);
            setActiveDriveIdx(0);
          }
        })
        .catch(() => {});
    }
  }, []);

  const activeDrive = drives[activeDriveIdx] || drives[0];
  const currentArtSlot = artSlots[activeSlotIdx] || artSlots[0];

  const handleArtFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 4);

    list.forEach((file, idx) => {
      const targetSlotIndex = list.length === 1 ? activeSlotIdx : idx;
      const slotKey = `slot_${targetSlotIndex + 1}`;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = String(e.target?.result || "");
        if (!dataUrl) return;
        saveArtToDB(slotKey, dataUrl);
        setArtSlots((prev) =>
          prev.map((s, sIdx) =>
            sIdx === targetSlotIndex ? { ...s, customDataUrl: dataUrl } : s
          )
        );
        if (idx === 0) setActiveSlotIdx(targetSlotIndex);
      };
      reader.readAsDataURL(file);
    });
    soundFX.playCheckChord(true);
  };

  const handleSelectDrive = (idx: number) => {
    const drv = drives[idx];
    setActiveDriveIdx(idx);
    soundFX.playRelayClick();

    if (drv.healthStatus === "BAD") setActiveSlotIdx(1); // Пьета Долорес
    else if (drv.healthStatus === "CAUTION") setActiveSlotIdx(0); // Взрыв B' B''

    setThoughts([
      {
        id: `drv_${Date.now()}`,
        skill: drv.healthStatus === "BAD" ? "ВНУТРЕННЯЯ ИМПЕРИЯ" : "ИНТЕРФЕЙС",
        category: drv.healthStatus === "BAD" ? "PSY" : "MOT",
        difficulty: "Средне: Успех",
        text:
          drv.healthStatus === "GOOD"
            ? `Подключён накопитель [${drv.letter}] ${drv.model}. Четыре линии PCIe 4.0 работают штатно, остаточный ресурс 96%.`
            : drv.healthStatus === "CAUTION"
            ? `На накопителе [${drv.letter}] зафиксированы 48 переназначенных секторов (05h) и 14 нестабильных блоков (C5h).`
            : `Критический износ магнитной поверхности [${drv.letter}]: здоровье 11%, таблица дефектов G-List переполнена (2418 секторов).`,
      },
    ]);
  };

  const handleSelectAttribute = (attr: SmartAttribute) => {
    setSelectedAttrId(attr.id);
    soundFX.playRelayClick();
    setThoughts(
      attr.voices.map((v, i) => ({
        id: `v_${Date.now()}_${i}`,
        skill: v.skill,
        category: v.category,
        difficulty: v.difficulty,
        text: v.text,
      }))
    );
  };

  const handleRollDice = () => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setLastDice([d1, d2]);
    const bonus =
      activeDrive.healthStatus === "GOOD" ? 3 : activeDrive.healthStatus === "CAUTION" ? 1 : -1;
    const total = d1 + d2 + bonus;
    const success = (d1 === 6 && d2 === 6) || (!(d1 === 1 && d2 === 1) && total >= 8);
    soundFX.playCheckChord(success);

    setThoughts([
      {
        id: `roll_${Date.now()}`,
        skill: "ИНТЕРФЕЙС",
        category: "MOT",
        difficulty: `Белая проверка ${d1}+${d2}${bonus >= 0 ? `+${bonus}` : bonus}=${total} против 8: ${
          success ? "Успех" : "Провал"
        }`,
        text: success
          ? "Ты считываешь микрокод контроллера напрямую через регистры шины. Карта физических секторов открыта: все уязвимые блоки локализованы, очередь команд NCQ/NVMe синхронизирована."
          : "Шум дросселей питания сливается в монотонный гул. Регистры закрыты — перед глазами лишь сухие шестнадцатеричные столбцы.",
      },
    ]);
  };

  const copySmartReport = () => {
    const lines = [
      `CrystalDiskInfo 9.8.0 Disco Elysium Edition x64`,
      `Model : ${activeDrive.model}`,
      `Firmware : ${activeDrive.firmware}`,
      `Serial Number : ${activeDrive.serial}`,
      `Health Status : ${activeDrive.healthStatus} (${activeDrive.healthPercent} %)`,
      `Temperature : ${activeDrive.temperature} C`,
      `Power On Hours : ${activeDrive.powerOnHours}`,
      `-- S.M.A.R.T. --------------------------------------------------------------`,
      ...activeDrive.attributes.map(
        (a) =>
          `${a.id} ${String(a.current).padStart(3)} ${String(a.worst).padStart(3)} ${String(
            a.threshold
          ).padStart(3)} ${a.rawDec.toString(16).toUpperCase().padStart(12, "0")} ${a.name}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    soundFX.playRelayClick();
  };

  const handleImportSubmit = () => {
    const parsed = parseRealSmartReport(importText);
    if (!parsed) return;
    setDrives([parsed, ...drives]);
    setActiveDriveIdx(0);
    setShowImportModal(false);
    setImportText("");
    soundFX.playCheckChord(true);
  };

  const getSkillColor = (cat: DialogueMessage["category"]) => {
    switch (cat) {
      case "INT":
        return "#6ec1e4";
      case "PSY":
        return "#b388eb";
      case "FYS":
        return "#e05368";
      case "MOT":
        return "#e5a93c";
      case "TIE":
        return "#e06d3b";
      default:
        return "#d8cfc2";
    }
  };

  const formatRaw = (dec: number) =>
    rawFormat === "DEC10"
      ? dec.toLocaleString("ru-RU")
      : dec.toString(16).toUpperCase().padStart(12, "0");

  return (
    <div
      className="cdi-viewport"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        handleArtFiles(e.dataTransfer.files);
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        * {
          box-sizing: border-box;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        *::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        body, html {
          margin: 0;
          padding: 0;
          background: #0b0a09;
          color: #e8e2d5;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12.5px;
          -webkit-font-smoothing: antialiased;
        }
        .mono {
          font-family: 'JetBrains Mono', Consolas, monospace;
          font-variant-numeric: tabular-nums;
        }
        .serif-zaum {
          font-family: 'Cormorant Garamond', Georgia, serif;
        }

        .cdi-viewport {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: #090807;
        }

        .cdi-window-frame {
          width: 100%;
          max-width: 1180px;
          height: 790px;
          position: relative;
          display: flex;
          flex-direction: column;
          background: #141210;
          border: 1px solid #3a342d;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.92);
          overflow: hidden;
        }
        @media (max-width: 1024px) {
          .cdi-window-frame {
            height: auto;
            min-height: 820px;
          }
        }

        .win-titlebar {
          position: relative;
          z-index: 20;
          height: 28px;
          background: #181512;
          border-bottom: 1px solid #2c2620;
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #ccc2b2;
          user-select: none;
        }
        .win-controls {
          display: flex;
          gap: 16px;
          color: #8c8273;
          font-size: 12px;
        }

        .win-menubar {
          position: relative;
          z-index: 20;
          height: 28px;
          background: rgba(28, 24, 21, 0.96);
          border-bottom: 1px solid #383028;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .menu-left {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .menu-link {
          background: transparent;
          border: none;
          color: #dfd7c8;
          padding: 3px 9px;
          font-size: 12px;
          cursor: pointer;
        }
        .menu-link:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .canvas-slots {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .slot-btn {
          background: transparent;
          border: 1px solid transparent;
          color: #9e9383;
          padding: 2px 8px;
          font-size: 11px;
          cursor: pointer;
        }
        .slot-btn:hover {
          color: #e8e2d5;
        }
        .slot-btn.active {
          background: rgba(212, 163, 89, 0.16);
          border-color: rgba(212, 163, 89, 0.45);
          color: #f3ead8;
        }

        .cdi-main-split {
          position: relative;
          z-index: 10;
          flex: 1;
          display: grid;
          grid-template-columns: 380px 1fr;
          overflow: hidden;
        }
        @media (max-width: 1024px) {
          .cdi-main-split {
            grid-template-columns: 1fr;
          }
        }

        .left-artwork-pane {
          position: relative;
          height: 100%;
          min-height: 520px;
          border-right: 1px solid rgba(255, 255, 255, 0.12);
          background: #0e0c0a;
          overflow: hidden;
        }

        .right-data-pane {
          background:
            radial-gradient(circle at 15% 20%, rgba(194, 125, 56, 0.08), transparent 45%),
            rgba(18, 16, 14, 0.92);
          padding: 10px 16px 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow: hidden;
        }

        .cdi-drive-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          padding-bottom: 6px;
        }
        .drive-tabs-group {
          display: flex;
          gap: 4px;
        }
        .cdi-drive-tab {
          padding: 4px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #d4cbbd;
          cursor: pointer;
          text-align: center;
          line-height: 1.25;
          font-size: 11.5px;
          min-width: 92px;
        }
        .cdi-drive-tab:hover {
          background: rgba(255, 255, 255, 0.09);
        }
        .cdi-drive-tab.active {
          background: rgba(255, 255, 255, 0.14);
          border-color: #d4a359;
          color: #ffffff;
          font-weight: 600;
        }

        .cdi-model-row {
          text-align: center;
          padding: 2px 0 4px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }
        .cdi-model-name {
          margin: 0;
          font-size: 21px;
          font-weight: 600;
          letter-spacing: 0.01em;
          color: #f7f3eb;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
        }

        .cdi-specs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 20px;
          padding: 2px 0;
        }
        @media (max-width: 680px) {
          .cdi-specs-grid { grid-template-columns: 1fr; }
        }
        .cdi-spec-item {
          display: grid;
          grid-template-columns: 132px 1fr;
          align-items: center;
          gap: 8px;
        }
        .cdi-spec-label {
          text-align: right;
          font-size: 12px;
          color: #ccc2b2;
          white-space: nowrap;
        }
        .cdi-spec-box {
          height: 22px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          background: rgba(10, 9, 8, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: #f5f0e6;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cdi-health-temp-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          padding: 2px 0 4px 0;
        }
        .cdi-status-badge {
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13.5px;
          font-weight: 700;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.32);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
        }
        .status-good {
          background: linear-gradient(180deg, rgba(46, 111, 128, 0.85), rgba(27, 71, 84, 0.92));
        }
        .status-caution {
          background: linear-gradient(180deg, rgba(180, 105, 28, 0.88), rgba(122, 66, 14, 0.94));
        }
        .status-bad {
          background: linear-gradient(180deg, rgba(168, 36, 45, 0.9), rgba(107, 19, 26, 0.95));
        }

        .cdi-table-wrapper {
          flex: 1;
          background: rgba(10, 9, 8, 0.68);
          border: 1px solid rgba(255, 255, 255, 0.16);
          overflow-y: auto;
        }
        .cdi-smart-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .cdi-smart-table th {
          position: sticky;
          top: 0;
          background: #1c1916;
          color: #ccc2b2;
          font-weight: 500;
          padding: 5px 8px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.18);
          white-space: nowrap;
        }
        .cdi-smart-table td {
          padding: 4.5px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          color: #ebe5d8;
        }
        .cdi-smart-table tr {
          cursor: pointer;
        }
        .cdi-smart-table tr:hover td {
          background: rgba(255, 255, 255, 0.07);
        }
        .cdi-smart-table tr.selected-row td {
          background: rgba(194, 125, 56, 0.24);
        }
        .cdi-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
          border: 1px solid rgba(0, 0, 0, 0.6);
        }
        .dot-good { background: #4ea8de; }
        .dot-caution { background: #e09f3e; }
        .dot-bad { background: #d1495b; }

        .zaum-dialogue-strip {
          background: rgba(14, 12, 10, 0.94);
          border: 1px solid rgba(212, 163, 89, 0.28);
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .zaum-paragraph {
          margin: 0;
          font-size: 15.5px;
          line-height: 1.42;
          color: #ede6d6;
        }
        .zaum-skill-name {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .zaum-check-meta {
          font-style: italic;
          color: #9e9383;
          font-size: 14px;
          margin: 0 6px;
        }
        .zaum-red-prompt {
          margin-top: 2px;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .zaum-choice-link {
          background: none;
          border: none;
          padding: 0;
          color: #d95338;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
        }
        .zaum-choice-link:hover {
          color: #ff7b59;
          text-decoration: underline;
        }
      `,
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleArtFiles(e.target.files)}
        style={{ display: "none" }}
      />

      {isDraggingOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 13, 11, 0.88)",
            zIndex: 99,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed #d4a359",
          }}
        >
          <div className="serif-zaum" style={{ fontSize: "26px", color: "#f3ead8" }}>
            Отпустите ваши иллюстрации (можно сразу все 4 файла) для установки на холст
          </div>
        </div>
      )}

      {/* ОКНО CRYSTALDISKINFO SPECIAL EDITION */}
      <div className="cdi-window-frame">
        <div className="win-titlebar">
          <span>CrystalDiskInfo 9.8.0 Disco Elysium Edition x64</span>
          <div className="win-controls mono">
            <span>─</span>
            <span>□</span>
            <span>×</span>
          </div>
        </div>

        <nav className="win-menubar">
          <div className="menu-left">
            <button onClick={() => setShowImportModal(true)} className="menu-link">
              Файл
            </button>
            <button onClick={copySmartReport} className="menu-link">
              Правка
            </button>
            <button onClick={handleRollDice} className="menu-link">
              Сервис
            </button>
            <button
              onClick={() => setRawFormat((p) => (p === "HEX16" ? "DEC10" : "HEX16"))}
              className="menu-link"
            >
              Вид ({rawFormat === "HEX16" ? "HEX" : "DEC"})
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="menu-link">
              Холст (Загрузить арты...)
            </button>
            <button
              onClick={() => {
                soundFX.enabled = !soundOn;
                setSoundOn(!soundOn);
              }}
              className="menu-link"
            >
              Звук ({soundOn ? "ВКЛ" : "ВЫКЛ"})
            </button>
          </div>

          <div className="canvas-slots">
            {artSlots.map((slot, idx) => (
              <button
                key={slot.id}
                onClick={() => setActiveSlotIdx(idx)}
                className={`slot-btn ${idx === activeSlotIdx ? "active" : ""}`}
              >
                {slot.title}
              </button>
            ))}
          </div>
        </nav>

        <div className="cdi-main-split">
          {/* ЛЕВАЯ КОЛОНКА: МАСЛЯНЫЙ ШЕЙДЕР ИЛИ ВАШ ВСТАВЛЕННЫЙ ОРИГИНАЛ */}
          <aside className="left-artwork-pane">
            <ArtworkShowcase
              slot={currentArtSlot}
              onPastePrompt={() => fileInputRef.current?.click()}
            />
          </aside>

          {/* ПРАВАЯ КОЛОНКА: ДАННЫЕ CRYSTALDISKINFO + СТРОКА ДИАЛОГА ZA/UM */}
          <main className="right-data-pane">
            <div className="cdi-drive-strip">
              <div className="drive-tabs-group">
                {drives.map((drv, idx) => (
                  <button
                    key={drv.id}
                    onClick={() => handleSelectDrive(idx)}
                    className={`cdi-drive-tab ${idx === activeDriveIdx ? "active" : ""}`}
                  >
                    <div>
                      {drv.healthStatus === "GOOD"
                        ? "Хорошо"
                        : drv.healthStatus === "CAUTION"
                        ? "Тревога"
                        : "Плохо"}
                    </div>
                    <div className="mono">{drv.temperature} °C</div>
                    <div style={{ fontWeight: 700 }}>{drv.letter}</div>
                  </button>
                ))}
              </div>

              <div className="mono" style={{ fontSize: "11px", color: "#a89f91" }}>
                Регистр: {selectedAttrId}h | Кости: [{lastDice[0]}][{lastDice[1]}]
              </div>
            </div>

            <div className="cdi-model-row">
              <h1 className="cdi-model-name">
                {activeDrive.model} : {activeDrive.capacityGB.toFixed(1)} GB
              </h1>
            </div>

            <div className="cdi-specs-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Прошивка</span>
                  <div className="cdi-spec-box mono">{activeDrive.firmware}</div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Серийный номер</span>
                  <div className="cdi-spec-box mono">{activeDrive.serial}</div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Интерфейс</span>
                  <div className="cdi-spec-box mono">{activeDrive.interfaceType}</div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Режим передачи</span>
                  <div className="cdi-spec-box mono">{activeDrive.transferMode}</div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Буква тома</span>
                  <div className="cdi-spec-box mono">{activeDrive.letter}</div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Стандарт</span>
                  <div className="cdi-spec-box mono">{activeDrive.standard}</div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Возможности</span>
                  <div className="cdi-spec-box mono">{activeDrive.features}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Всего хост-чтений</span>
                  <div className="cdi-spec-box mono">
                    {activeDrive.totalReadsGB.toLocaleString("ru-RU")} GB
                  </div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Всего хост-записей</span>
                  <div className="cdi-spec-box mono">
                    {activeDrive.totalWritesGB.toLocaleString("ru-RU")} GB
                  </div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Скорость вращения</span>
                  <div className="cdi-spec-box mono">{activeDrive.rotationRate}</div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Число включений</span>
                  <div className="cdi-spec-box mono">
                    {activeDrive.powerOnCount.toLocaleString("ru-RU")} раз
                  </div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Общее время работы</span>
                  <div className="cdi-spec-box mono">
                    {activeDrive.powerOnHours.toLocaleString("ru-RU")} ч
                  </div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Выработка ресурса</span>
                  <div className="cdi-spec-box mono">{100 - activeDrive.healthPercent} %</div>
                </div>
                <div className="cdi-spec-item">
                  <span className="cdi-spec-label">Канал РГМ</span>
                  <div className="cdi-spec-box mono">{activeDrive.name}</div>
                </div>
              </div>
            </div>

            <div className="cdi-health-temp-row">
              <div className="cdi-spec-item">
                <span className="cdi-spec-label">Техсостояние</span>
                <div
                  className={`cdi-status-badge ${
                    activeDrive.healthStatus === "GOOD"
                      ? "status-good"
                      : activeDrive.healthStatus === "CAUTION"
                      ? "status-caution"
                      : "status-bad"
                  }`}
                >
                  {activeDrive.healthStatus === "GOOD"
                    ? "Хорошо"
                    : activeDrive.healthStatus === "CAUTION"
                    ? "Тревога"
                    : "Плохо"}{" "}
                  ({activeDrive.healthPercent} %)
                </div>
              </div>

              <div className="cdi-spec-item">
                <span className="cdi-spec-label">Температура</span>
                <div
                  className={`cdi-status-badge mono ${
                    activeDrive.temperature < 50
                      ? "status-good"
                      : activeDrive.temperature < 60
                      ? "status-caution"
                      : "status-bad"
                  }`}
                >
                  {activeDrive.temperature} °C
                </div>
              </div>
            </div>

            <div className="cdi-table-wrapper">
              <table className="cdi-smart-table">
                <thead>
                  <tr>
                    <th style={{ width: "28px" }}></th>
                    <th style={{ width: "38px" }}>ID</th>
                    <th>Атрибут</th>
                    <th style={{ textAlign: "right" }}>Текущее</th>
                    <th style={{ textAlign: "right" }}>Наихудшее</th>
                    <th style={{ textAlign: "right" }}>Порог</th>
                    <th style={{ textAlign: "right" }}>Raw-значения</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDrive.attributes.map((attr) => {
                    const dotClass =
                      attr.status === "GOOD"
                        ? "dot-good"
                        : attr.status === "CAUTION"
                        ? "dot-caution"
                        : "dot-bad";
                    return (
                      <tr
                        key={attr.id}
                        onClick={() => handleSelectAttribute(attr)}
                        className={selectedAttrId === attr.id ? "selected-row" : ""}
                      >
                        <td style={{ textAlign: "center" }}>
                          <span className={`cdi-dot ${dotClass}`} />
                        </td>
                        <td className="mono">{attr.id}</td>
                        <td>{attr.ruName}</td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {attr.current}
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {attr.worst}
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {attr.threshold}
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {formatRaw(attr.rawDec)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="zaum-dialogue-strip">
              {thoughts.map((t) => (
                <p key={t.id} className="zaum-paragraph serif-zaum">
                  <span className="zaum-skill-name" style={{ color: getSkillColor(t.category) }}>
                    {t.skill}
                  </span>
                  {t.difficulty && <span className="zaum-check-meta">[{t.difficulty}]</span>}
                  <span>— {t.text}</span>
                </p>
              ))}

              <div className="zaum-red-prompt">
                <button onClick={handleRollDice} className="zaum-choice-link serif-zaum">
                  1. [ИНТЕРФЕЙС: Белая проверка 2d6] Прослушать контроллер накопителя {activeDrive.letter}
                </button>
                <span className="mono" style={{ fontSize: "11px", color: "#8c8273" }}>
                  Кости: {lastDice[0]} + {lastDice[1]}
                </span>
              </div>
            </div>
          </main>
        </div>
      </div>

      {showImportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8, 7, 6, 0.85)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "600px",
              background: "#181512",
              border: "1px solid #574b3d",
              padding: "20px",
            }}
          >
            <h3 className="serif-zaum" style={{ margin: "0 0 8px 0", fontSize: "20px", color: "#f3ead8" }}>
              Импорт текстового отчёта CrystalDiskInfo (`Ctrl + C`)
            </h3>
            <textarea
              rows={9}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                "Model : TMI 512GB SATA\nFirmware : SFMB004K\nTemperature : 40 C\nHealth Status : Good (100 %)\n09 100 100 0 000000000138 Power-On Hours"
              }
              className="mono"
              style={{
                width: "100%",
                background: "#0e0c0a",
                border: "1px solid #3a3228",
                color: "#e8e2d5",
                padding: "10px",
                fontSize: "12px",
                marginBottom: "12px",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={() => setShowImportModal(false)} className="menu-link">
                Отмена
              </button>
              <button
                onClick={handleImportSubmit}
                className="menu-link"
                style={{ border: "1px solid #d4a359", color: "#f3ead8" }}
              >
                Загрузить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
