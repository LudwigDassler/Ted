"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// 1. ТИПЫ ДАННЫХ CRYSTALDISKINFO // DISCO ELYSIUM EDITION
// ============================================================================

type HealthState = "GOOD" | "CAUTION" | "BAD";
type PaintingId = "finger_gun_harry" | "mind_eruption" | "dolores_pieta" | "kim_church";

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

interface CanvasSlot {
  id: string;
  title: string;
  painting: PaintingId;
  palette: [string, string, string, string];
  customDataUrl: string | null;
}

// ============================================================================
// 2. INDEXEDDB ДЛЯ СОХРАНЕНИЯ ПОЛЬЗОВАТЕЛЬСКИХ ФАЙЛОВ (CTRL+V / DRAG & DROP)
// ============================================================================

const DB_NAME = "DiscoCdiLocalArtDB";
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

async function saveCustomArtToDB(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openArtDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, key);
  } catch {}
}

async function loadCustomArtsFromDB(): Promise<Record<string, string>> {
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
      osc.frequency.exponentialRampToValueAtTime(62, t + 0.032);
      g.gain.setValueAtTime(0.055, t);
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
        g.gain.exponentialRampToValueAtTime(0.0005, t + 1.25);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t + idx * 0.035);
        osc.stop(t + 1.3);
      });
    } catch {}
  }
}

const soundFX = new ElysiumAudio();

// ============================================================================
// 4. ЛОКАЛЬНЫЙ ЖИВОПИСНЫЙ ДВИЖОК РОСТОВА (4000+ МАЗКОВ ЩЕТИНЫ И МАСТИХИНА)
// Полностью автономный: 0 внешних запросов, 0 лимитов, фактура сухой кисти
// ============================================================================

function paintDiscoMasterpiece(canvas: HTMLCanvasElement, painting: PaintingId) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  let seed =
    painting === "finger_gun_harry"
      ? 1951
      : painting === "mind_eruption"
      ? 4102
      : painting === "dolores_pieta"
      ? 7309
      : 8821;

  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Многоволосковый мазок сухой щетинной кисти (без мультяшных обводок, с живым следом ворса)
  const dryBrush = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    color: string,
    alpha = 0.82,
    ridgeColor?: string
  ) => {
    ctx.save();
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const hairs = Math.max(4, Math.floor(width * 0.65));

    for (let i = 0; i < hairs; i++) {
      const t = i / (hairs - 1) - 0.5;
      const spread = t * width + (rand() - 0.5) * 1.8;
      const curve = (rand() - 0.5) * (len * 0.14);
      ctx.globalAlpha = alpha * (0.45 + rand() * 0.55);
      ctx.strokeStyle = i === 0 && ridgeColor ? ridgeColor : color;
      ctx.lineWidth = Math.max(0.9, (width / hairs) * (1.1 + rand() * 0.8));
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(x1 + nx * spread, y1 + ny * spread);
      ctx.quadraticCurveTo(
        (x1 + x2) * 0.5 + nx * (spread + curve),
        (y1 + y2) * 0.5 + ny * (spread + curve),
        x2 + nx * spread * 0.85,
        y2 + ny * spread * 0.85
      );
      ctx.stroke();
    }
    ctx.restore();
  };

  // Густой пастозный мазок мастихином со скошенным краем
  const knifeBlock = (
    cx: number,
    cy: number,
    w: number,
    h: number,
    angle: number,
    color: string,
    alpha = 0.88
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.48);
    ctx.lineTo(w * 0.52, -h * 0.5);
    ctx.lineTo(w * 0.47, h * 0.52);
    ctx.lineTo(-w * 0.51, h * 0.46);
    ctx.closePath();
    ctx.fill();

    // Текстурный срыв краски на шлейфе мастихина
    for (let k = 0; k < 5; k++) {
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillRect(
        -w * 0.45 + rand() * w * 0.6,
        h * 0.35 + rand() * h * 0.25,
        w * (0.15 + rand() * 0.2),
        2.5
      );
    }
    ctx.restore();
  };

  // Быстрый угольный/карандашный росчерк поверх масла (фирменная графика Ростова)
  const charcoalLine = (
    x1: number,
    y1: number,
    cx: number,
    cy: number,
    x2: number,
    y2: number,
    width = 1.6,
    color = "#1c1614",
    alpha = 0.78
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  if (painting === "finger_gun_harry") {
    // ========================================================================
    // ХОЛСТ I: ПОРТРЕТ ГАРРИ «УХМЫЛКА КУСТО И ПАЛЕЦ-ПИСТОЛЕТ» (по референсу)
    // ========================================================================

    // 1. Светлый алебастрово-пергаментный загрунтованный холст
    ctx.fillStyle = "#f2efe9";
    ctx.fillRect(0, 0, W, H);

    // Крупные фоновые мазки плоским флейцем (тёплый крем, охра и серо-голубой воздух)
    for (let i = 0; i < 45; i++) {
      const bx = rand() * W;
      const by = rand() * H;
      const col =
        i % 5 === 0 ? "#e6e0d4" : i % 3 === 0 ? "#ece7dc" : "#f7f5f0";
      knifeBlock(bx, by, 90 + rand() * 110, 50 + rand() * 80, (rand() - 0.5) * 0.8, col, 0.9);
    }
    // Экспрессионистские охристые и бирюзово-серые мазки на фоне в углах
    dryBrush(-20, 95, 130, -20, 55, "#d89228", 0.35);
    dryBrush(310, 140, 460, 10, 48, "#6c8c88", 0.28);

    // 2. Плечи, тёмно-коричневый/оливковый пиджак и распахнутый бело-голубой воротник рубашки
    // Правое плечо пиджака (справа внизу)
    for (let i = 0; i < 24; i++) {
      dryBrush(
        285 + (rand() - 0.5) * 35,
        420 + i * 14,
        435,
        455 + i * 16,
        36,
        i % 3 === 0 ? "#3d352e" : "#26201c",
        0.92,
        "#574c42"
      );
    }
    // Левое плечо пиджака
    for (let i = 0; i < 18; i++) {
      dryBrush(
        115 - i * 4,
        515 + i * 12,
        245,
        680 + i * 8,
        34,
        "#29231e",
        0.9
      );
    }

    // Шея в холодной серо-голубоватой и оливковой тени
    for (let i = 0; i < 28; i++) {
      const nx = 175 + rand() * 145;
      const ny = 425 + rand() * 195;
      dryBrush(
        nx,
        ny,
        nx + 18 + (rand() - 0.5) * 25,
        ny + 55,
        24,
        i % 3 === 0 ? "#697075" : i % 2 === 0 ? "#7c7d75" : "#4f5459",
        0.88,
        "#9ba3a8"
      );
    }

    // Белый с голубыми тенями распахнутый воротник рубашки
    const collarStrokes: [number, number, number, number, number, string][] = [
      [158, 520, 198, 695, 34, "#8a99ad"],
      [172, 540, 218, 720, 28, "#b0bfd1"],
      [288, 515, 255, 720, 44, "#9aa6b5"],
      [305, 505, 395, 575, 42, "#e8ece6"],
      [295, 535, 355, 735, 38, "#cdd4d9"],
      [335, 565, 430, 605, 48, "#29231f"], // Лацкан пиджака поверх воротника
    ];
    collarStrokes.forEach(([x1, y1, x2, y2, w, col]) => {
      dryBrush(x1, y1, x2, y2, w, col, 0.94, "#ffffff");
    });

    // 3. ПОДМАЛЁВОК И ЛЕПКА ГОЛОВЫ (СЛОЖНАЯ ЦВЕТОВАЯ ТЕМПЕРАТУРА КОЖИ ПО РЕФЕРЕНСУ)
    // А) Верхняя часть лба — светло-серо-перламутровая слева, ярко-белая в центре, тёпло-розоватая справа
    for (let i = 0; i < 45; i++) {
      const fx = 65 + rand() * 235;
      const fy = 45 + rand() * 165;
      const isHighlight = fx > 135 && fx < 245 && fy < 165;
      const isLeftShadow = fx < 135;
      const col = isHighlight
        ? "#ebe7e0"
        : isLeftShadow
        ? "#8c8f94"
        : "#cbbab0";
      dryBrush(
        fx,
        fy,
        fx + (rand() - 0.3) * 42,
        fy + 28 + rand() * 25,
        26,
        col,
        0.88,
        isHighlight ? "#ffffff" : undefined
      );
    }
    // Яркий пастозный белый удар мастихином на правой части лба (как на референсе image_6bfa42)
    knifeBlock(192, 68, 72, 54, 0.25, "#f7f5f0", 0.96);
    knifeBlock(218, 122, 64, 48, 0.12, "#f2efe9", 0.94);

    // Б) Средняя зона лица (скулы, щёки, мешки под глазами, нос) — тёплая терракота, охра и кармин
    for (let i = 0; i < 55; i++) {
      const mx = 68 + rand() * 228;
      const my = 185 + rand() * 145;
      const isLeftCheek = mx < 118 && my > 240;
      const isWarmCenter = mx >= 115 && mx <= 245;
      const col = isLeftCheek
        ? "#7d848a" // Холодный серо-голубой рефлекс на левой скуле
        : isWarmCenter
        ? i % 3 === 0
          ? "#b86b58"
          : i % 2 === 0
          ? "#c98a76"
          : "#a35242"
        : "#d8c6ba";
      dryBrush(
        mx,
        my,
        mx + (rand() - 0.5) * 34,
        my + 22 + (rand() - 0.5) * 20,
        22,
        col,
        0.86,
        "#e6d5c8"
      );
    }

    // В) Анатомия носа (плоскости спинки, боковой скат в терракотовой тени, кончик и крыло носа)
    dryBrush(136, 215, 118, 322, 26, "#9e4f3f", 0.92); // Левый теневой скат носа
    dryBrush(154, 218, 148, 325, 22, "#b86350", 0.92, "#ebb8a6"); // Центральная плоскость носа
    dryBrush(168, 225, 178, 315, 16, "#cfa08e", 0.9, "#f5e1d3"); // Правый освещённый скат
    dryBrush(122, 318, 168, 328, 22, "#8f3d2e", 0.94); // Нижняя площадка и ноздря
    // Белый мазок блика на переносице и кончике носа
    dryBrush(134, 202, 148, 224, 9, "#f5f0eb", 0.95);
    dryBrush(132, 295, 138, 322, 7, "#f0dcd4", 0.92);

    // Г) Бритый подбородок под нижней губой в характерном серо-сизо-зелёном тоне щетины (x: 130..255, y: 365..475)
    for (let i = 0; i < 38; i++) {
      const cx = 135 + rand() * 118;
      const cy = 372 + rand() * 98;
      const col =
        i % 4 === 0
          ? "#8c968e"
          : i % 3 === 0
          ? "#646e73"
          : i % 2 === 0
          ? "#4f585e"
          : "#788078";
      dryBrush(
        cx,
        cy,
        cx + (rand() - 0.5) * 28,
        cy + (rand() - 0.5) * 24,
        18,
        col,
        0.9,
        "#a8b2ab"
      );
    }

    // Д) Ухо справа (x: 315..385, y: 155..295) — тёплая охра, терракота и глубокая умбра внутри раковины
    dryBrush(332, 162, 368, 225, 28, "#b87456", 0.92, "#e0a98b");
    dryBrush(355, 205, 342, 285, 26, "#9e563c", 0.92);
    dryBrush(336, 188, 348, 252, 14, "#2b1914", 0.95); // Углубление ушной раковины
    dryBrush(342, 198, 356, 222, 10, "#d98a4e", 0.9);

    // 4. ПРИЩУРЕННЫЕ ТЕПЛЫЕ ГЛАЗА, БРОВИ И МОРЩИНЫ УГЛЁМ (1:1 КАК НА РЕФЕРЕНСЕ)
    // Левая бровь и глаз (в ракурсе слева)
    dryBrush(48, 212, 108, 208, 14, "#381c16", 0.95);
    dryBrush(62, 248, 114, 228, 16, "#7a362b", 0.9); // Верхнее веко
    dryBrush(64, 256, 112, 236, 8, "#240e0b", 0.96); // Линия ресниц в прищуре
    dryBrush(68, 266, 116, 248, 12, "#9e5446", 0.88); // Нижнее веко и мешок

    // Правая бровь и прищуренный глаз (шире и выразительнее)
    dryBrush(136, 178, 224, 164, 15, "#3b1e17", 0.95);
    dryBrush(156, 212, 238, 198, 18, "#7d3b2e", 0.9);
    dryBrush(162, 218, 235, 204, 9, "#1f0c09", 0.97); // Тёмная щель прищуренного глаза
    dryBrush(166, 232, 242, 218, 15, "#b06858", 0.88, "#dfb8ab"); // Освещённый валик нижнего века

    // Тонкие морщинки вокруг глаз («гусиные лапки») и складки век
    charcoalLine(232, 202, 248, 198, 262, 192, 1.8, "#4a241c");
    charcoalLine(235, 208, 252, 208, 266, 206, 1.6, "#4a241c");
    charcoalLine(168, 242, 205, 246, 238, 232, 1.5, "#6e382c");
    charcoalLine(62, 268, 88, 262, 112, 252, 1.6, "#59281e");

    // 5. АСИММЕТРИЧНАЯ УХМЫЛКА С ПОЛОСКОЙ ЗУБОВ И ВЛАЖНОЙ НИЖНЕЙ ГУБОЙ
    // Полость рта и белые зубы под усами
    dryBrush(142, 382, 204, 355, 16, "#240d0b", 0.96);
    dryBrush(154, 382, 196, 362, 9, "#e2e6e8", 0.96, "#ffffff"); // Белый отблеск зубов
    // Пухлая нижняя губа в тёплом терракотово-розовом свете
    dryBrush(146, 396, 212, 368, 16, "#9e5246", 0.94, "#d98c7e");
    dryBrush(155, 404, 208, 378, 10, "#59261f", 0.9); // Тень под нижней губой

    // 6. МОЩНЫЕ БАКЕНБАРДЫ И ГУСТЫЕ УСЫ КУСТО (СОТНИ ОТДЕЛЬНЫХ ЩЕТИНИСТЫХ ВОЛОСКОВ)
    // А) Усы, нависающие над верхней губой и уходящие в бакенбарды
    for (let i = 0; i < 65; i++) {
      const t = i / 65;
      const startX = 95 + t * 185;
      const startY = 328 - Math.sin(t * Math.PI) * 24 + (rand() - 0.5) * 12;
      const angle = t < 0.42 ? 2.35 + (rand() - 0.5) * 0.35 : 0.45 + (rand() - 0.5) * 0.35;
      const len = 32 + rand() * 38;
      const col =
        i % 5 === 0
          ? "#594d42" // Седовато-оливковый блик в усах
          : i % 3 === 0
          ? "#382a22"
          : "#1f1815";
      dryBrush(
        startX,
        startY,
        startX + Math.cos(angle) * len,
        startY + Math.sin(angle) * len,
        7 + rand() * 6,
        col,
        0.92
      );
    }

    // Б) Правая густая бакенбарда (x: 235..345, y: 240..445), срастающаяся с усами и виском
    for (let i = 0; i < 75; i++) {
      const bx = 242 + rand() * 88;
      const by = 225 + rand() * 205;
      const ang = 1.15 + (rand() - 0.5) * 0.6;
      const len = 28 + rand() * 36;
      const col =
        i % 6 === 0 ? "#665c4e" : i % 2 === 0 ? "#2b231e" : "#1a1513";
      dryBrush(
        bx,
        by,
        bx + Math.cos(ang) * len,
        by + Math.sin(ang) * len,
        8 + rand() * 7,
        col,
        0.9
      );
    }

    // В) Левая бакенбарда в ракурсе (x: 52..135, y: 335..505) с торчащими вовне прядями
    for (let i = 0; i < 55; i++) {
      const lx = 58 + rand() * 76;
      const ly = 335 + rand() * 155;
      const ang = 1.85 + (rand() - 0.5) * 0.7;
      const len = 26 + rand() * 34;
      dryBrush(
        lx,
        ly,
        lx + Math.cos(ang) * len,
        ly + Math.sin(ang) * len,
        7 + rand() * 6,
        i % 3 === 0 ? "#382e27" : "#1c1714",
        0.9
      );
    }

    // 7. ЗАЛЫСИНЫ, ШЕВЕЛЮРА НА ВИСКАХ И ФИРМЕННАЯ ПРЯДЬ НА ЛБУ
    // Волосы справа над ухом и на затылке
    for (let i = 0; i < 60; i++) {
      const hx = 215 + rand() * 165;
      const hy = 15 + rand() * 265;
      if (hx < 265 && hy > 95) continue; // Оставляем лоб открытым
      const ang = 0.65 + (rand() - 0.5) * 0.5;
      const len = 35 + rand() * 45;
      dryBrush(
        hx,
        hy,
        hx + Math.cos(ang) * len,
        hy + Math.sin(ang) * len,
        10 + rand() * 8,
        i % 4 === 0 ? "#574f49" : i % 2 === 0 ? "#2e2825" : "#1a1615",
        0.92
      );
    }
    // Редкие торчащие пряди слева сверху
    for (let i = 0; i < 22; i++) {
      dryBrush(
        95 - i * 2,
        18 + (i % 5) * 6,
        15 + (rand() - 0.5) * 25,
        85 + i * 5,
        6,
        "#241f1c",
        0.85
      );
    }
    // Знаменитая одиночная волнистая прядь волос, падающая посреди светлого лба (как на image_6bfa42)
    charcoalLine(162, 10, 152, 52, 188, 76, 3.8, "#3b3a38", 0.88);
    charcoalLine(188, 76, 216, 98, 202, 138, 2.6, "#3b3a38", 0.85);

    // 8. ПЕРЕДНИЙ ПЛАН СЛЕВА ВНИЗУ: КИСТЬ РУКИ С ПАЛЬЦЕМ-ПИСТОЛЕТОМ В РАКУРСЕ (КАК НА РЕФЕРЕНСЕ)
    // Большой палец, поднятый вверх (x: 0..108, y: 440..615)
    for (let i = 0; i < 26; i++) {
      dryBrush(
        -10 + i * 2.5,
        448 + i * 4,
        88 + (rand() - 0.5) * 18,
        595 + (rand() - 0.5) * 15,
        24,
        i % 3 === 0 ? "#c49682" : "#a87966",
        0.94,
        "#e0b8a6"
      );
    }
    // Указательный палец и согнутые средние пальцы, направленные на зрителя (x: 0..235, y: 585..760)
    dryBrush(-15, 635, 165, 595, 58, "#cbb2a3", 0.96, "#f2eae4"); // Верхняя освещённая фаланга
    dryBrush(25, 695, 212, 655, 62, "#9e7d6c", 0.96, "#e8dfd8"); // Согнутый средний палец
    dryBrush(55, 745, 232, 715, 55, "#785c4e", 0.96); // Тень на нижних пальцах
    // Яркие белые пастозные блики на костяшках и ногтях пальцев
    knifeBlock(142, 598, 42, 26, -0.2, "#f5f0eb", 0.95);
    knifeBlock(192, 668, 46, 32, -0.15, "#f0ebe4", 0.95);
    // Контурные угольные штрихи на складках фаланг
    charcoalLine(45, 615, 62, 648, 52, 682, 2.0, "#4a3329");
    charcoalLine(112, 595, 128, 632, 115, 668, 2.0, "#4a3329");
  } else if (painting === "mind_eruption") {
    // ========================================================================
    // ХОЛСТ II: ПСИХОДЕЛИЧЕСКИЙ ВЗРЫВ СОЗНАНИЯ ИЗ ВИСКА (БЕЗ БУКВ B' B'')
    // ========================================================================
    ctx.fillStyle = "#0b0714";
    ctx.fillRect(0, 0, W, H);

    // 1. Тёмно-индиговый воздух справа вверху
    for (let i = 0; i < 35; i++) {
      knifeBlock(
        rand() * W,
        rand() * H,
        90 + rand() * 90,
        60 + rand() * 70,
        (rand() - 0.5) * 0.7,
        i % 2 === 0 ? "#140c24" : "#0d0818",
        0.9
      );
    }

    // 2. Буйство мазков неоновой фуксии, кадмия, золота и бирюзы, вырывающихся из виска (215, 315)
    const ox = 212;
    const oy = 315;
    const burstColors = [
      "#ff006e",
      "#fb5607",
      "#ffbe0b",
      "#8338ec",
      "#00f5d4",
      "#ff4d8d",
      "#fff3b0",
    ];
    for (let i = 0; i < 165; i++) {
      const ang = -Math.PI * 0.88 + (i / 165) * (Math.PI * 0.82) + (rand() - 0.5) * 0.08;
      const dist = 45 + rand() * 380;
      const xStart = ox + Math.cos(ang) * (8 + rand() * 25);
      const yStart = oy + Math.sin(ang) * (8 + rand() * 25);
      const xEnd = ox + Math.cos(ang) * dist;
      const yEnd = oy + Math.sin(ang) * dist;
      const col = burstColors[i % burstColors.length];
      dryBrush(
        xStart,
        yStart,
        xEnd,
        yEnd,
        10 + rand() * 18,
        col,
        0.85,
        "#fff8d6"
      );
    }

    // Тонкие меловые дуги (абстрактные линии распада памяти без компьютерных шрифтов)
    charcoalLine(ox, oy, 290, 140, 430, 25, 1.8, "rgba(186, 230, 253, 0.48)");
    charcoalLine(ox, oy, 330, 185, 440, 95, 1.5, "rgba(186, 230, 253, 0.38)");
    charcoalLine(ox, oy, 350, 240, 440, 185, 1.2, "rgba(186, 230, 253, 0.28)");

    // 3. Пиджак, шея и запрокинутая голова Гарри в драматическом пурпурно-золотом контровом свете
    for (let i = 0; i < 32; i++) {
      dryBrush(
        40 + i * 10,
        510 + (rand() - 0.5) * 30,
        20 + i * 12,
        760,
        36,
        i % 3 === 0 ? "#2d123b" : "#160921",
        0.95
      );
    }
    // Освещённый левый лацкан и шея
    dryBrush(95, 525, 158, 448, 32, "#6a2473", 0.92, "#d870a8");
    dryBrush(162, 385, 238, 495, 58, "#521957", 0.94);
    dryBrush(164, 385, 188, 468, 24, "#f78ca2", 0.92, "#ffe5ec"); // Блик на гортани

    // Запрокинутая голова мазками кисти
    for (let i = 0; i < 42; i++) {
      const hx = 155 + rand() * 125;
      const hy = 268 + rand() * 135;
      const isLit = hx < 245 && hy < 355;
      dryBrush(
        hx,
        hy,
        hx + (rand() - 0.5) * 32,
        hy + (rand() - 0.5) * 28,
        22,
        isLit ? (i % 2 === 0 ? "#f794a8" : "#ffcad4") : "#7a2866",
        0.9,
        isLit ? "#fff0f3" : undefined
      );
    }
    // Закатившиеся глаза, ноздри в ракурсе снизу и густые усы
    dryBrush(172, 308, 202, 306, 12, "#fff0f3", 0.96);
    dryBrush(232, 316, 258, 322, 12, "#ffd6e0", 0.95);
    dryBrush(196, 336, 224, 340, 14, "#380d30", 0.95); // Ноздри снизу
    for (let i = 0; i < 28; i++) {
      dryBrush(
        152 + i * 4.5,
        352 + Math.sin(i * 0.2) * 10,
        148 + i * 4.8,
        396,
        14,
        "#210929",
        0.95
      );
    }
    // Пальцы правой руки у виска
    dryBrush(276, 334, 348, 368, 22, "#9e3b78", 0.94, "#f294b8");
    dryBrush(282, 352, 342, 388, 20, "#75245e", 0.94);
    dryBrush(325, 372, 368, 465, 38, "#471442", 0.95);
  } else if (painting === "dolores_pieta") {
    // ========================================================================
    // ХОЛСТ III: ПЬЕТА ДОЛОРЕС // ЗОЛОТЫЕ ЛЁГКИЕ И БЕРЛИНСКАЯ ЛАЗУРЬ
    // ========================================================================
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, W, H);

    // 1. Глубокие масляные облака лазури, кармина и золота на фоне
    for (let i = 0; i < 55; i++) {
      const col =
        i % 3 === 0 ? "#59161e" : i % 3 === 1 ? "#1b3352" : "#6e471b";
      knifeBlock(
        rand() * W,
        rand() * H,
        85 + rand() * 95,
        55 + rand() * 65,
        rand() * Math.PI,
        col,
        0.55
      );
    }

    // 2. Золотое сияние и два детальных лёгких Долорес Дей с бронхиальным деревом
    const glow = ctx.createRadialGradient(225, 185, 10, 225, 185, 210);
    glow.addColorStop(0, "rgba(255, 250, 205, 0.95)");
    glow.addColorStop(0.35, "rgba(245, 158, 11, 0.65)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 450);

    // Лик Долорес вверху
    dryBrush(215, 25, 255, 92, 48, "#d99f72", 0.9, "#fde68a");
    // Левое и правое светящееся лёгкое мазками кисти
    for (let i = 0; i < 28; i++) {
      dryBrush(
        182 + (rand() - 0.5) * 28,
        135 + i * 4,
        196 + (rand() - 0.5) * 32,
        155 + i * 4,
        16,
        "#fef08a",
        0.92,
        "#ffffff"
      );
      dryBrush(
        252 + (rand() - 0.5) * 28,
        138 + i * 4,
        242 + (rand() - 0.5) * 32,
        158 + i * 4,
        16,
        "#fef08a",
        0.92,
        "#ffffff"
      );
    }
    // Ветвящиеся бронхи внутри лёгких
    charcoalLine(224, 112, 224, 148, 192, 185, 2.2, "#d97706", 0.85);
    charcoalLine(224, 148, 245, 168, 256, 192, 2.2, "#d97706", 0.85);

    // 3. Багрово-красные вертикальные потёки масла слева
    for (let i = 0; i < 36; i++) {
      const dx = 12 + i * 3.4;
      dryBrush(
        dx,
        285 + (rand() - 0.5) * 65,
        dx + (rand() - 0.5) * 4,
        540 + rand() * 220,
        4 + rand() * 5,
        i % 3 === 0 ? "#ef4444" : "#991b1b",
        0.88
      );
    }

    // 4. Павший детектив: золотой свет на груди и лице, глубокая берлинская лазурь в тенях спины и руки
    // Голова в профиль (запрокинута на грудь Долорес)
    dryBrush(95, 265, 175, 238, 44, "#d6a889", 0.94, "#fef3c7");
    dryBrush(82, 275, 148, 308, 36, "#1e293b", 0.95); // Борода и волосы в синей тени
    // Освещённая грудь и живот
    for (let i = 0; i < 24; i++) {
      dryBrush(
        165 + i * 7,
        305 + i * 3.5,
        215 + i * 8,
        345 + i * 4,
        28,
        i < 10 ? "#f3d5a8" : "#4b6b8a",
        0.92,
        "#fef3c7"
      );
    }
    // Плечо, спина и свисающая рука в холодных синих мазках
    for (let i = 0; i < 38; i++) {
      dryBrush(
        138 + (i % 5) * 14,
        345 + i * 9,
        185 + (i % 6) * 18,
        395 + i * 10,
        26,
        i % 3 === 0 ? "#254670" : "#11223d",
        0.94,
        "#4873a6"
      );
    }
  } else {
    // ========================================================================
    // ХОЛСТ IV: ДОЗОР КИМА КИЦУРАГИ // ОРАНЖЕВЫЙ БОМБЕР И ЛАЗЕРЫ В ЦЕРКВИ
    // ========================================================================
    ctx.fillStyle = "#121a22";
    ctx.fillRect(0, 0, W, H);

    // 1. Золотой витраж позади Кима
    for (let i = 0; i < 35; i++) {
      knifeBlock(
        160 + rand() * 240,
        rand() * 440,
        65 + rand() * 65,
        45 + rand() * 55,
        0.2,
        i % 2 === 0 ? "#d4a359" : "#8f6528",
        0.75
      );
    }

    // 2. Ярко-оранжевая куртка-бомбер Кима широкими пастозными мазками кадмия
    for (let i = 0; i < 48; i++) {
      const jx = 45 + rand() * 175;
      const jy = 215 + rand() * 215;
      dryBrush(
        jx,
        jy,
        jx + (rand() - 0.5) * 45,
        jy + 35,
        28,
        jx < 135 ? "#ff6b1a" : "#b83e0c",
        0.94,
        "#ff9e44"
      );
    }
    // Тёмный воротник и белая футболка
    dryBrush(88, 198, 148, 255, 28, "#18181b", 0.96);
    dryBrush(104, 228, 142, 365, 26, "#e2e8f0", 0.94);

    // Голова Кима и круглые очки с ярким голубым бликом
    dryBrush(84, 138, 136, 215, 46, "#cfa07a", 0.95, "#ebcfb2");
    dryBrush(78, 142, 138, 152, 26, "#141417", 0.98); // Причёска
    knifeBlock(96, 178, 20, 16, -0.1, "#a5f3fc", 0.98); // Левая линза очков
    knifeBlock(122, 175, 20, 16, -0.1, "#a5f3fc", 0.98); // Правая линза очков
    charcoalLine(82, 178, 110, 176, 136, 174, 2.5, "#111111", 0.95);

    // 3. Голубые лазерные лучи, рассекающие холст
    dryBrush(0, 88, W, 335, 14, "#00e5ff", 0.85, "#ffffff");
    dryBrush(75, 0, W, 560, 10, "#00e5ff", 0.75, "#ffffff");
    dryBrush(0, 580, W, 240, 12, "#00e5ff", 0.8, "#ffffff");
  }

  // Финальная зернистость льняного холста поверх всей картины
  ctx.save();
  ctx.strokeStyle = "rgba(24, 20, 16, 0.045)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================================
// 5. ПАНОРАМНЫЙ ЗАДНИК ПРАВОЙ ПАНЕЛИ (МАСТИХИН, СЕТКА РГМ И ДОЖДЬ МАРТИНЕЗА)
// ============================================================================

function AtmosphericWindowBackdrop({
  palette,
  health,
}: {
  palette: [string, string, string, string];
  health: HealthState;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const strokes = Array.from({ length: 55 }, (_, i) => ({
      x: 360 + ((i * 173) % 880),
      y: (i * 97) % 780,
      w: 140 + ((i * 61) % 220),
      h: 26 + ((i * 29) % 48),
      angle: -0.45 + ((i % 7) - 3) * 0.08,
      color: palette[i % palette.length],
      alpha: 0.09 + (i % 4) * 0.025,
    }));

    const raindrops = Array.from({ length: 42 }, (_, i) => ({
      x: 385 + ((i * 139) % 840),
      y: (i * 83) % 780,
      len: 32 + (i % 6) * 16,
      speed: 1.3 + (i % 5) * 0.5,
      alpha: 0.07 + (i % 4) * 0.03,
    }));

    const render = () => {
      frame += 1;
      const W = canvas.width;
      const H = canvas.height;

      const baseGrad = ctx.createLinearGradient(0, 0, W, H);
      baseGrad.addColorStop(0, "#151318");
      baseGrad.addColorStop(0.5, "#100e13");
      baseGrad.addColorStop(1, "#09080b");
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      strokes.forEach((s) => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.fillRect(-s.w * 0.5, -s.h * 0.5, s.w, s.h);
        ctx.restore();
      });
      ctx.restore();

      // Радиолокационная сетка РГМ-41 под таблицей S.M.A.R.T.
      ctx.save();
      ctx.strokeStyle = "rgba(216, 195, 165, 0.06)";
      ctx.lineWidth = 1;
      [160, 290, 430, 580].forEach((r, idx) => {
        ctx.beginPath();
        if (idx % 2 === 0) ctx.setLineDash([8, 6]);
        else ctx.setLineDash([]);
        ctx.arc(810, 380, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();

      // Капли дождя по стеклу
      ctx.save();
      ctx.strokeStyle = palette[1] || "#94a3b8";
      ctx.lineWidth = 1.1;
      raindrops.forEach((d) => {
        const curY = ((d.y + frame * d.speed) % (H + 80)) - 40;
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.moveTo(d.x, curY);
        ctx.lineTo(d.x - 5, curY + d.len);
        ctx.stroke();
      });
      ctx.restore();

      if (health === "BAD") {
        const pulse = 0.07 + Math.sin(frame * 0.05) * 0.035;
        ctx.fillStyle = `rgba(220, 38, 38, ${pulse})`;
        ctx.fillRect(0, 0, W, H);
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [palette, health]);

  return (
    <canvas
      ref={canvasRef}
      width={1220}
      height={780}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

// ============================================================================
// 6. БАЗА ДАННЫХ НАКОПИТЕЛЕЙ И РЕПЛИК НАВЫКОВ
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
    features: "S.M.A.R.T., TRIM, NCQ, GPL",
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
    features: "S.M.A.R.T., NCQ, TRIM, GPL",
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
// 7. ГЛАВНЫЙ КОМПОНЕНТ «CRYSTALDISKINFO // DISCO ELYSIUM EDITION»
// ============================================================================

const INITIAL_SLOTS: CanvasSlot[] = [
  {
    id: "slot_1",
    title: "I. Ухмылка Кусто",
    painting: "finger_gun_harry",
    palette: ["#d89228", "#697075", "#b86b58", "#e8ebd5"],
    customDataUrl: null,
  },
  {
    id: "slot_2",
    title: "II. Нейрошторм",
    painting: "mind_eruption",
    palette: ["#ff006e", "#fb5607", "#00f5d4", "#7209b7"],
    customDataUrl: null,
  },
  {
    id: "slot_3",
    title: "III. Пьета Долорес",
    painting: "dolores_pieta",
    palette: ["#f59e0b", "#1b3352", "#dc2626", "#fef08a"],
    customDataUrl: null,
  },
  {
    id: "slot_4",
    title: "IV. Дозор Кима",
    painting: "kim_church",
    palette: ["#ff6b1a", "#00e5ff", "#d4a359", "#1e293b"],
    customDataUrl: null,
  },
];

export default function CrystalDiskElysiumEdition() {
  const [drives, setDrives] = useState<DriveProfile[]>(INITIAL_DRIVES);
  const [activeDriveIdx, setActiveDriveIdx] = useState<number>(0);

  const [slots, setSlots] = useState<CanvasSlot[]>(INITIAL_SLOTS);
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
      skill: "ЭНЦИКЛОПЕДИЯ",
      category: "INT",
      difficulty: "Легко: Успех",
      text: "Регистр 01h стандарта NVM Express хранит битовую маску аварийных флагов: деградацию резервных блоков, тепловой пробой и аварийную блокировку записи. Все биты равны нулю.",
    },
    {
      id: "init_2",
      skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
      category: "PSY",
      difficulty: "Средне: Успех",
      text: "Никаких внешних нейросетей с лимитами. Холст слева написан локальным движком сухой щетинной кисти, а по нажатию Ctrl + V мгновенно принимает любой твой референс из буфера обмена.",
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const portraitCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeDrive = drives[activeDriveIdx] || drives[0];
  const currentSlot = slots[activeSlotIdx] || slots[0];

  // Восстановление пользовательских референсов из IndexedDB
  useEffect(() => {
    loadCustomArtsFromDB().then((savedMap) => {
      setSlots((prev) =>
        prev.map((slot, i) => {
          const saved = savedMap[`slot_${i + 1}`];
          return saved ? { ...slot, customDataUrl: saved } : slot;
        })
      );
    });
  }, []);

  // Отрисовка локального живописного портрета при смене слота
  useEffect(() => {
    if (currentSlot.customDataUrl) return;
    if (portraitCanvasRef.current) {
      paintDiscoMasterpiece(portraitCanvasRef.current, currentSlot.painting);
    }
  }, [currentSlot.painting, currentSlot.customDataUrl, activeSlotIdx]);

  // Мгновенная вставка любого скопированного референса по Ctrl + V
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
            saveCustomArtToDB(slotKey, dataUrl);
            setSlots((prev) =>
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
        saveCustomArtToDB(slotKey, dataUrl);
        setSlots((prev) =>
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

  const resetCustomSlot = () => {
    const slotKey = `slot_${activeSlotIdx + 1}`;
    saveCustomArtToDB(slotKey, "");
    setSlots((prev) =>
      prev.map((s, idx) => (idx === activeSlotIdx ? { ...s, customDataUrl: null } : s))
    );
    soundFX.playRelayClick();
  };

  const handleSelectDrive = (idx: number) => {
    const drv = drives[idx];
    setActiveDriveIdx(idx);
    soundFX.playRelayClick();

    if (drv.healthStatus === "BAD") setActiveSlotIdx(2);
    else if (drv.healthStatus === "CAUTION") setActiveSlotIdx(1);
    else setActiveSlotIdx(0);

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
      style={{
        background: `radial-gradient(circle at 18% 30%, ${currentSlot.palette[0]}33, transparent 55%), radial-gradient(circle at 82% 75%, ${currentSlot.palette[1]}33, transparent 55%), #070609`,
      }}
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
          background: #070609;
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
          padding: 14px;
          position: relative;
          transition: background 0.4s ease;
        }

        .cdi-window-frame {
          width: 100%;
          max-width: 1220px;
          min-height: 775px;
          position: relative;
          z-index: 5;
          display: flex;
          flex-direction: column;
          background: #100e14;
          border: 1px solid rgba(212, 163, 89, 0.38);
          box-shadow:
            0 32px 95px rgba(0, 0, 0, 0.95),
            0 0 60px rgba(0, 0, 0, 0.8);
          overflow: hidden;
        }

        .win-titlebar {
          position: relative;
          z-index: 20;
          height: 28px;
          background: rgba(14, 12, 18, 0.94);
          border-bottom: 1px solid rgba(212, 163, 89, 0.18);
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #d4cbbd;
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
          min-height: 29px;
          background: rgba(20, 17, 25, 0.92);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(212, 163, 89, 0.25);
          padding: 2px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
        }
        .menu-left {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-wrap: wrap;
        }
        .menu-link {
          background: transparent;
          border: 1px solid transparent;
          color: #dfd7c8;
          padding: 3px 9px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.14s;
        }
        .menu-link:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .canvas-slots {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }
        .slot-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(212, 163, 89, 0.2);
          color: #b8ae9e;
          padding: 2px 10px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .slot-btn:hover {
          color: #fff;
          border-color: rgba(212, 163, 89, 0.5);
        }
        .slot-btn.active {
          background: rgba(212, 163, 89, 0.22);
          border-color: #d4a359;
          color: #fff;
          font-weight: 600;
        }

        .cdi-main-split {
          position: relative;
          z-index: 10;
          flex: 1;
          display: grid;
          grid-template-columns: 385px 1fr;
        }
        @media (max-width: 1024px) {
          .cdi-main-split {
            grid-template-columns: 1fr;
          }
        }

        .left-artwork-pane {
          position: relative;
          min-height: 715px;
          border-right: 1px solid rgba(212, 163, 89, 0.26);
          background: #0e0c10;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .left-art-toolbar {
          position: relative;
          z-index: 5;
          padding: 8px 12px;
          background: linear-gradient(0deg, rgba(10, 8, 12, 0.9) 0%, rgba(10, 8, 12, 0.45) 70%, transparent 100%);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #dfd7c8;
        }

        .right-data-pane {
          position: relative;
          padding: 10px 18px 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cdi-drive-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(212, 163, 89, 0.2);
          padding-bottom: 6px;
        }
        .drive-tabs-group {
          display: flex;
          gap: 5px;
        }
        .cdi-drive-tab {
          padding: 4px 14px;
          background: rgba(14, 12, 18, 0.72);
          border: 1px solid rgba(212, 163, 89, 0.24);
          color: #d4cbbd;
          cursor: pointer;
          text-align: center;
          line-height: 1.25;
          font-size: 11.5px;
          min-width: 96px;
          backdrop-filter: blur(6px);
          transition: all 0.14s;
        }
        .cdi-drive-tab:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .cdi-drive-tab.active {
          background: linear-gradient(180deg, rgba(212, 163, 89, 0.28), rgba(20, 17, 24, 0.88));
          border-color: #d4a359;
          color: #ffffff;
          font-weight: 600;
        }

        .cdi-model-row {
          text-align: center;
          padding: 3px 0 6px 0;
          border-bottom: 1px solid rgba(212, 163, 89, 0.2);
        }
        .cdi-model-name {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: 0.015em;
          color: #ffffff;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.95);
        }

        .cdi-specs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 18px;
          padding: 2px 0;
        }
        @media (max-width: 680px) {
          .cdi-specs-grid { grid-template-columns: 1fr; }
        }
        .cdi-spec-item {
          display: grid;
          grid-template-columns: 128px 1fr;
          align-items: center;
          gap: 8px;
        }
        .cdi-spec-label {
          text-align: right;
          font-size: 12px;
          color: #e2d9c8;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
          white-space: nowrap;
        }
        .cdi-spec-box {
          height: 23px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          background: rgba(10, 9, 14, 0.68);
          border: 1px solid rgba(212, 163, 89, 0.24);
          backdrop-filter: blur(4px);
          color: #ffffff;
          font-size: 11.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cdi-health-temp-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          padding: 2px 0 4px 0;
        }
        .cdi-status-badge {
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13.5px;
          font-weight: 700;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.36);
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
        }
        .status-good {
          background: linear-gradient(180deg, rgba(42, 118, 138, 0.86), rgba(22, 68, 84, 0.92));
        }
        .status-caution {
          background: linear-gradient(180deg, rgba(196, 112, 26, 0.88), rgba(128, 66, 12, 0.94));
        }
        .status-bad {
          background: linear-gradient(180deg, rgba(185, 32, 46, 0.9), rgba(112, 16, 26, 0.95));
        }

        .cdi-table-wrapper {
          max-height: 280px;
          overflow-y: auto;
          background: rgba(9, 8, 12, 0.72);
          border: 1px solid rgba(212, 163, 89, 0.24);
          backdrop-filter: blur(8px);
        }
        .cdi-smart-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .cdi-smart-table th {
          position: sticky;
          top: 0;
          background: rgba(20, 17, 25, 0.95);
          color: #d8cfc2;
          font-weight: 500;
          padding: 5px 8px;
          text-align: left;
          border-bottom: 1px solid rgba(212, 163, 89, 0.25);
          white-space: nowrap;
        }
        .cdi-smart-table td {
          padding: 4.5px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          color: #f2ece1;
        }
        .cdi-smart-table tr {
          cursor: pointer;
          transition: background 0.1s;
        }
        .cdi-smart-table tr:hover td {
          background: rgba(212, 163, 89, 0.12);
        }
        .cdi-smart-table tr.selected-row td {
          background: rgba(212, 163, 89, 0.26);
        }
        .cdi-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
          border: 1px solid rgba(0, 0, 0, 0.65);
        }
        .dot-good { background: #4ea8de; box-shadow: 0 0 6px #4ea8de; }
        .dot-caution { background: #e09f3e; box-shadow: 0 0 6px #e09f3e; }
        .dot-bad { background: #d1495b; box-shadow: 0 0 6px #d1495b; }

        .zaum-dialogue-strip {
          margin-top: auto;
          background: rgba(11, 9, 14, 0.9);
          border: 1px solid rgba(212, 163, 89, 0.34);
          backdrop-filter: blur(10px);
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .zaum-paragraph {
          margin: 0;
          font-size: 15px;
          line-height: 1.4;
          color: #f2ece1;
        }
        .zaum-skill-name {
          font-family: 'Inter', sans-serif;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .zaum-check-meta {
          font-style: italic;
          color: #a89f91;
          font-size: 13.5px;
          margin: 0 6px;
        }
        .zaum-red-prompt {
          margin-top: 2px;
          padding-top: 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .zaum-choice-link {
          background: none;
          border: none;
          padding: 0;
          color: #e05a3c;
          font-size: 14.5px;
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
            Отпустите ваши иллюстрации для установки на холст
          </div>
        </div>
      )}

      {/* ОКНО CRYSTALDISKINFO SPECIAL EDITION */}
      <div className="cdi-window-frame">
        {/* ПАНОРАМНЫЙ ЖИВОПИСНЫЙ ЗАДНИК ПОД ПРАВОЙ ПАНЕЛЬЮ (МАСТИХИН + ДОЖДЬ + ЧЕРТЁЖ РГМ) */}
        <AtmosphericWindowBackdrop
          palette={currentSlot.palette}
          health={activeDrive.healthStatus}
        />

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
              Свой арт (Ctrl+V)
            </button>
            {currentSlot.customDataUrl && (
              <button onClick={resetCustomSlot} className="menu-link">
                Сбросить слот
              </button>
            )}
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
            {slots.map((slot, idx) => (
              <button
                key={slot.id}
                onClick={() => {
                  setActiveSlotIdx(idx);
                  soundFX.playRelayClick();
                }}
                className={`slot-btn ${idx === activeSlotIdx ? "active" : ""}`}
              >
                {slot.title}
              </button>
            ))}
          </div>
        </nav>

        <div className="cdi-main-split">
          {/* ЛЕВАЯ КОЛОНКА: ЛОКАЛЬНОЕ ПОЛОТНО СУХОЙ КИСТЬЮ ИЛИ ВСТАВЛЕННЫЙ РЕФЕРЕНС */}
          <aside className="left-artwork-pane">
            {currentSlot.customDataUrl ? (
              <img
                src={currentSlot.customDataUrl}
                alt={currentSlot.title}
                data-pin-nopin="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  display: "block",
                }}
              />
            ) : (
              <canvas
                ref={portraitCanvasRef}
                width={420}
                height={740}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            )}

            <div className="left-art-toolbar">
              <span>{currentSlot.title}</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "rgba(18, 15, 22, 0.85)",
                  border: "1px solid rgba(212, 163, 89, 0.45)",
                  color: "#e8e2d5",
                  padding: "2px 8px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Файл / Ctrl+V
              </button>
            </div>
          </aside>

          {/* ПРАВАЯ КОЛОНКА: ДАННЫЕ CRYSTALDISKINFO ПОВЕРХ ЖИВОПИСНОГО ЗАДНИКА */}
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

              <div className="mono" style={{ fontSize: "11px", color: "#d4cbbd" }}>
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
                  1. [ИНТЕРФЕЙС: Белая проверка 2d6] Прослушать контроллер накопителя{" "}
                  {activeDrive.letter}
                </button>
                <span className="mono" style={{ fontSize: "11px", color: "#a89f91" }}>
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
            background: "rgba(8, 7, 10, 0.85)",
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
              background: "#16131c",
              border: "1px solid #d4a359",
              padding: "20px",
            }}
          >
            <h3
              className="serif-zaum"
              style={{ margin: "0 0 8px 0", fontSize: "20px", color: "#f3ead8" }}
            >
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
                background: "#0c0a10",
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
