"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// 1. ТИПЫ ДАННЫХ CRYSTALDISKINFO // DISCO ELYSIUM EDITION
// ============================================================================

type HealthState = "GOOD" | "CAUTION" | "BAD";
type CanvasThemeId = "mind_burst" | "church_lasers" | "dolores_pieta" | "cousteau_grin";

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
  theme: CanvasThemeId;
  accentColor: string;
  ambientGlow: string;
  customDataUrl: string | null;
}

// ============================================================================
// 2. INDEXEDDB ДЛЯ СОХРАНЕНИЯ ПОЛЬЗОВАТЕЛЬСКИХ ИЛЛЮСТРАЦИЙ (CTRL+V / DROP)
// ============================================================================

const DB_NAME = "DiscoCdiPanoramaDB";
const STORE_NAME = "artworks";

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
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(65, t + 0.032);
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
// 4. ЧЕТЫРЕ ПОЛНОЭКРАННЫЕ ПАНОРАМНЫЕ ИЛЛЮСТРАЦИИ (1260x800, ТУШЬ + ГУАШЬ/МАСЛО)
// Персонаж слева [0..390], художественный задник справа [390..1260] под таблицей
// ============================================================================

function PanoramicMasterpieceArtwork({
  theme,
  customUrl,
}: {
  theme: CanvasThemeId;
  customUrl: string | null;
}) {
  if (customUrl) {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {/* Панорамный атмосферный задник на всё окно под правую стеклянную часть */}
        <img
          src={customUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(24px) saturate(1.4) brightness(0.38)",
            transform: "scale(1.08)",
          }}
        />
        {/* Чёткая иллюстрация в левой витрине */}
        <img
          src={customUrl}
          alt="Custom Artwork"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "390px",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
          }}
        />
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 1260 800"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
      }}
    >
      <defs>
        {/* Фильтр живого масляного мазка для фоновых вспышек и облаков */}
        <filter id="oil-impasto" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.025 0.05"
            numOctaves="3"
            seed="14"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Мягкое неоновое свечение для лазеров, лёгких и протуберанцев памяти */}
        <filter id="neon-bloom" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Текстура старого холста и кракелюра поверх всей картины */}
        <pattern id="canvas-weave" width="6" height="6" patternUnits="userSpaceOnUse">
          <path
            d="M 0 3 L 6 3 M 3 0 L 3 6"
            stroke="rgba(255, 245, 228, 0.028)"
            strokeWidth="1"
          />
        </pattern>
      </defs>

      {/* ==================================================================== */}
      {/* ХОЛСТ I: ПСИХОДЕЛИЧЕСКИЙ ШТОРМ СОЗНАНИЯ (B' B'' B''')                 */}
      {/* ==================================================================== */}
      {theme === "mind_burst" && (
        <g>
          <defs>
            <radialGradient id="mb-bg" cx="22%" cy="38%" r="85%">
              <stop offset="0%" stopColor="#3b0d45" />
              <stop offset="32%" stopColor="#190a29" />
              <stop offset="70%" stopColor="#0b0714" />
              <stop offset="100%" stopColor="#06040a" />
            </radialGradient>
            <radialGradient id="mb-core" cx="20%" cy="38%" r="45%">
              <stop offset="0%" stopColor="#fff3b0" stopOpacity="0.95" />
              <stop offset="22%" stopColor="#ff5400" stopOpacity="0.82" />
              <stop offset="50%" stopColor="#ff007f" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#7209b7" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="mb-face-light" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd6e0" />
              <stop offset="40%" stopColor="#f27a94" />
              <stop offset="78%" stopColor="#8a2be2" />
              <stop offset="100%" stopColor="#3c096c" />
            </linearGradient>
          </defs>

          {/* 1. Глубокий индиго-фиолетовый задник на все 1260px */}
          <rect width="1260" height="800" fill="url(#mb-bg)" />

          {/* Архитектурная сетка изолятора Сероты и осциллограммы на заднике справа под таблицей */}
          <g stroke="rgba(186, 230, 253, 0.06)" strokeWidth="1" fill="none">
            <circle cx="820" cy="400" r="180" strokeDasharray="6 8" />
            <circle cx="820" cy="400" r="310" strokeDasharray="12 10" />
            <circle cx="820" cy="400" r="460" />
            <path d="M 390 140 L 1260 140 M 390 320 L 1260 320 M 390 520 L 1260 520 M 390 680 L 1260 680" />
            <path d="M 520 0 L 440 800 M 740 0 L 660 800 M 960 0 L 880 800 M 1180 0 L 1100 800" />
          </g>

          {/* 2. Ядро психоделического взрыва из виска Гарри */}
          <rect width="1260" height="800" fill="url(#mb-core)" />

          {/* Экспрессионистский веер острых живописных мазков, летящих из виска (215, 315) через левый и правый холст */}
          <g filter="url(#oil-impasto)" opacity="0.92">
            {/* Дальние широкие лучи, заходящие на задник под таблицу S.M.A.R.T. */}
            <polygon points="215,315 0,0 140,0" fill="#7209b7" opacity="0.7" />
            <polygon points="215,315 110,0 290,0" fill="#ff007f" opacity="0.75" />
            <polygon points="215,315 260,0 480,0" fill="#ff5400" opacity="0.65" />
            <polygon points="215,315 440,0 760,0" fill="#ffbe0b" opacity="0.32" />
            <polygon points="215,315 680,0 1120,0" fill="#00f5d4" opacity="0.18" />
            <polygon points="215,315 0,40 0,210" fill="#3a86ff" opacity="0.72" />
            <polygon points="215,315 0,180 0,360" fill="#ffbe0b" opacity="0.82" />
            <polygon points="215,315 0,320 0,490" fill="#ff007f" opacity="0.75" />

            {/* Острые графичные клинья кадмия, фуксии, циана и золота */}
            <polygon points="215,315 -20,10 45,-10" fill="#00f5d4" />
            <polygon points="215,315 35,-10 115,-10" fill="#ff0a6c" />
            <polygon points="215,315 95,-10 175,-10" fill="#ffbe0b" />
            <polygon points="215,315 155,-10 235,-10" fill="#ff4800" />
            <polygon points="215,315 215,-10 310,-10" fill="#f72585" />
            <polygon points="215,315 -20,85 -20,165" fill="#ff007f" />
            <polygon points="215,315 -20,150 -20,235" fill="#ffbe0b" />
            <polygon points="215,315 -20,220 -20,305" fill="#7209b7" />
            <polygon points="215,315 -20,295 -20,375" fill="#ff4800" />
            <polygon points="215,315 45,95 92,45" fill="#fff3b0" />
            <polygon points="215,315 110,65 162,25" fill="#fff3b0" />
            <polygon points="215,315 25,195 65,140" fill="#00f5d4" />
          </g>

          {/* 3. Меловые траектории и производные B', B'', B''' через весь задник */}
          <g fill="none" stroke="rgba(186, 230, 253, 0.45)" strokeWidth="2">
            <path d="M 218 302 Q 340 120 680 35" />
            <path d="M 225 310 Q 410 165 920 65" />
            <path d="M 232 320 Q 490 230 1190 135" />
            <path d="M 235 330 Q 560 340 1240 290" strokeDasharray="8 6" opacity="0.4" />
          </g>
          <g
            fontFamily="Georgia, 'Times New Roman', serif"
            fontStyle="italic"
            fontWeight="bold"
            fill="rgba(224, 242, 254, 0.82)"
          >
            <text x="278" y="138" fontSize="26">
              B&apos;
            </text>
            <text x="348" y="76" fontSize="22">
              B&apos;&apos;
            </text>
            <text x="332" y="192" fontSize="19">
              B&apos;&apos;&apos;
            </text>
            {/* Формулы и графики на заднике справа под стеклянной таблицей */}
            <text x="530" y="96" fontSize="18" fill="rgba(186, 230, 253, 0.22)">
              ∂²B / ∂t² + γ(∂B / ∂t) + ω₀²B = Λ(Pale)
            </text>
            <text x="780" y="218" fontSize="16" fill="rgba(255, 0, 127, 0.24)">
              0x004F1A // MEMORY FRAGMENTATION SECTOR 41
            </text>
          </g>

          {/* 4. ДЕТАЛЬНАЯ ИЛЛЮСТРАЦИЯ ГАРРИ С ЗАПРОКИНУТОЙ ГОЛОВОЙ И ПАЛЬЦАМИ У ВИСКА */}
          <g>
            {/* Тёмная масса развевающихся волос позади головы */}
            <path
              d="M 215 248 C 268 238, 318 268, 336 335 C 348 382, 335 445, 302 475 L 220 435 Z"
              fill="#11071a"
              stroke="#07030c"
              strokeWidth="2.5"
            />
            {/* Пряди волос */}
            <path
              d="M 252 255 Q 305 285 316 365 M 272 268 Q 322 308 325 395"
              stroke="#3c1654"
              strokeWidth="3.5"
              fill="none"
            />

            {/* Плечи и тёмный пиджак в фиолетово-пурпурном контровом свете */}
            <path
              d="M 12 800 L 46 535 Q 98 468 152 448 L 292 465 Q 355 495 398 800 Z"
              fill="#160a24"
              stroke="#09040f"
              strokeWidth="3"
            />
            {/* Освещённый розовый левый лацкан пиджака */}
            <path
              d="M 75 538 L 148 448 L 172 498 L 148 665 L 88 620 Z"
              fill="#591d66"
              stroke="#240b30"
              strokeWidth="2"
            />
            {/* Острый белый воротник рубашки с розовым рефлексом */}
            <polygon
              points="148,445 136,528 172,496 164,452"
              fill="#e598b8"
              stroke="#240b30"
              strokeWidth="2"
            />

            {/* Шея с рельефом гортани и грудино-ключичной мышцы */}
            <path
              d="M 154 378 L 254 395 L 246 512 L 148 462 Z"
              fill="#4d1954"
              stroke="#1b0824"
              strokeWidth="2.5"
            />
            {/* Яркий кораллово-розовый блик на гортани */}
            <path d="M 156 382 L 196 408 L 182 482 L 154 456 Z" fill="#f78ca2" />

            {/* Скульптурная основа запрокинутой головы */}
            <path
              d="M 152 342 C 158 296, 186 264, 214 262 C 248 260, 282 282, 286 338 C 288 382, 265 415, 222 418 C 178 412, 150 378, 152 342 Z"
              fill="url(#mb-face-light)"
              stroke="#1f0826"
              strokeWidth="2.8"
            />

            {/* Плоскости света на лбу, скулах и щеке */}
            <polygon points="188,268 238,266 246,294 192,290" fill="#ffe5ec" />
            <polygon points="222,324 258,332 246,368 216,352" fill="#ffb3c6" />
            {/* Складки на запрокинутом лбу */}
            <path
              d="M 192 275 Q 218 270 245 282 M 188 284 Q 215 279 242 290"
              stroke="#7a2058"
              strokeWidth="2"
              fill="none"
            />

            {/* Левая и правая глазницы с закатившимися светящимися глазами */}
            <path d="M 168 308 Q 186 296 204 308 Q 186 320 168 308 Z" fill="#47123e" />
            <ellipse
              cx="187"
              cy="309"
              rx="10"
              ry="4.8"
              transform="rotate(-12 187 309)"
              fill="#fff0f3"
            />
            <path d="M 226 316 Q 246 306 264 322 Q 245 332 226 316 Z" fill="#380d33" />
            <ellipse
              cx="244"
              cy="320"
              rx="11"
              ry="5.2"
              transform="rotate(12 244 320)"
              fill="#ffd6e0"
            />

            {/* Густые изломанные брови */}
            <path
              d="M 168 299 Q 186 289 205 300 M 225 304 Q 248 297 268 315"
              stroke="#1f0824"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Анатомический нос в ракурсе снизу (спинка, кончик, крылья и тёмные ноздри) */}
            <polygon
              points="212,296 192,328 202,344 232,342 224,304"
              fill="#ffcad4"
              stroke="#591842"
              strokeWidth="2"
            />
            <polygon points="194,328 202,344 232,342 220,328" fill="#802356" />
            <ellipse cx="202" cy="336" rx="5" ry="3.2" fill="#1f071e" />
            <ellipse cx="218" cy="337" rx="5.5" ry="3.5" fill="#1f071e" />

            {/* Густые усы и бакенбарды Кусто */}
            <path
              d="M 150 356 Q 178 335 208 342 Q 244 348 268 384 L 284 352 L 278 424 Q 248 426 230 398 Q 204 368 176 388 L 154 394 Z"
              fill="#240b2b"
              stroke="#0f0414"
              strokeWidth="2.5"
            />
            {/* Приоткрытый рот под усами */}
            <ellipse cx="204" cy="367" rx="15" ry="6.5" fill="#140417" />
            <path d="M 191 372 Q 204 379 217 372" stroke="#b54878" strokeWidth="3.5" fill="none" />

            {/* Кисть руки с двумя пальцами, приставленными к виску */}
            <path
              d="M 274 332 L 336 356 L 368 394 L 382 364 L 395 372 L 378 436 L 322 456 L 296 384 L 274 348 Z"
              fill="#6e2263"
              stroke="#1d0724"
              strokeWidth="2.5"
            />
            {/* Световые грани на фалангах пальцев */}
            <path
              d="M 278 336 L 334 360 M 282 349 L 328 373"
              stroke="#f28cb1"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Манжета рубашки на правом запястье */}
            <polygon
              points="320,452 380,432 386,448 325,468"
              fill="#9d6b99"
              stroke="#1d0724"
              strokeWidth="2"
            />
          </g>
        </g>
      )}

      {/* ==================================================================== */}
      {/* ХОЛСТ II: ХАРДКОР В ЦЕРКВИ // КИМ, ВИТРАЖ ДОЛОРЕС И ЛАЗЕРЫ           */}
      {/* ==================================================================== */}
      {theme === "church_lasers" && (
        <g>
          <defs>
            <linearGradient id="cl-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#162430" />
              <stop offset="45%" stopColor="#241c14" />
              <stop offset="100%" stopColor="#0e1318" />
            </linearGradient>
            <radialGradient id="cl-vitrage" cx="28%" cy="24%" r="48%">
              <stop offset="0%" stopColor="#fff3b0" stopOpacity="0.96" />
              <stop offset="38%" stopColor="#eab308" stopOpacity="0.68" />
              <stop offset="75%" stopColor="#9a5b13" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#162430" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 1. Фон деревянных сводов церкви на сваях на все 1260px */}
          <rect width="1260" height="800" fill="url(#cl-bg)" />
          <rect width="1260" height="800" fill="url(#cl-vitrage)" />

          {/* Деревянные стропила, колонны и ступени церкви через весь задник справа под таблицей */}
          <g stroke="#0d1116" strokeWidth="14" opacity="0.75">
            <line x1="120" y1="0" x2="-40" y2="800" />
            <line x1="440" y1="0" x2="590" y2="800" />
            <line x1="760" y1="0" x2="620" y2="800" />
            <line x1="1080" y1="0" x2="940" y2="800" />
          </g>
          {/* Горизонтальные ступени церковного помоста внизу на всю ширину */}
          <g stroke="#d4a359" strokeWidth="2" opacity="0.28">
            <line x1="0" y1="650" x2="1260" y2="610" />
            <line x1="0" y1="685" x2="1260" y2="645" />
            <line x1="0" y1="720" x2="1260" y2="680" />
            <line x1="0" y1="755" x2="1260" y2="715" />
          </g>

          {/* 2. Золотой витраж Долорес Дей со светящимися лёгкими вверху (x: 190..460) */}
          <g opacity="0.92">
            <polygon
              points="180,0 440,0 520,480 140,480"
              fill="rgba(212, 163, 89, 0.24)"
              stroke="#8c6d3b"
              strokeWidth="3"
            />
            {/* Силуэт и одеяние Долорес Дей в витраже */}
            <path
              d="M 265 135 L 365 135 L 395 420 L 235 420 Z"
              fill="#6e5227"
              stroke="#2b2010"
              strokeWidth="2.5"
            />
            <circle cx="315" cy="78" r="28" fill="#dfb46b" stroke="#2b2010" strokeWidth="2.5" />
            {/* Два ярко светящихся золотых лёгких в груди Долорес */}
            <ellipse
              cx="296"
              cy="178"
              rx="17"
              ry="28"
              transform="rotate(10 296 178)"
              fill="#fff8bd"
              filter="url(#neon-bloom)"
            />
            <ellipse
              cx="334"
              cy="178"
              rx="17"
              ry="28"
              transform="rotate(-10 334 178)"
              fill="#fff8bd"
              filter="url(#neon-bloom)"
            />
          </g>

          {/* 3. Силуэты танцующих под куполом на заднике справа (под таблицей S.M.A.R.T.) */}
          <g opacity="0.35" fill="#18222c" stroke="#eab308" strokeWidth="1.5">
            {/* Танцующий рейвер / Андре */}
            <path d="M 620 490 L 740 430 L 790 540 L 750 710 L 660 710 Z" />
            <circle cx="715" cy="405" r="22" />
          </g>

          {/* 4. ДЕТАЛЬНАЯ ФИГУРА КИМА КИЦУРАГИ НА ПЕРЕДНЕМ ПЛАНЕ СЛЕВА */}
          <g>
            {/* Тёмные брюки карго со складками */}
            <path
              d="M 68 425 L 210 420 L 238 795 L 165 795 L 145 585 L 125 795 L 72 795 Z"
              fill="#14181f"
              stroke="#080a0d"
              strokeWidth="3"
            />

            {/* Ярко-оранжевый бомбер Кима с графичными складками тушью */}
            <path
              d="M 38 242 L 92 205 L 188 198 L 235 318 L 195 435 L 55 425 Z"
              fill="#e85d1a"
              stroke="#120d0a"
              strokeWidth="3"
            />
            {/* Теневые плоскости на бомбере */}
            <polygon points="122,225 215,288 188,425 110,365" fill="#a83808" />
            {/* Чёрный отложной воротник бомбера и белая футболка */}
            <polygon points="84,195 148,195 156,255 76,255" fill="#1a1918" />
            <polygon points="96,225 138,225 152,375 102,375" fill="#d8e2dc" />
            {/* Белая круглая эмблема РГМ на груди куртки */}
            <circle
              cx="162"
              cy="275"
              r="13"
              fill="#2b3842"
              stroke="#e0f2fe"
              strokeWidth="2.5"
            />
            {/* Оранжевые перчатки Кима */}
            <polygon
              points="115,365 152,375 142,445 102,435"
              fill="#d94e14"
              stroke="#120d0a"
              strokeWidth="2.5"
            />
            <polygon
              points="22,385 56,392 48,458 14,445"
              fill="#d94e14"
              stroke="#120d0a"
              strokeWidth="2.5"
            />

            {/* Голова Кима, причёска и культовые круглые очки */}
            <path
              d="M 78 142 L 136 138 L 142 208 L 114 232 L 82 214 Z"
              fill="#d4966a"
              stroke="#120d0a"
              strokeWidth="2.8"
            />
            {/* Чёрные аккуратно зачёсанные волосы */}
            <path
              d="M 74 156 Q 104 114 142 142 L 136 162 L 78 164 Z"
              fill="#141416"
              stroke="#000"
              strokeWidth="2"
            />
            {/* Круглые очки Кима с ярким голубым лазерным бликом */}
            <circle
              cx="96"
              cy="182"
              r="11"
              fill="#bae6fd"
              stroke="#111"
              strokeWidth="2.8"
            />
            <circle
              cx="122"
              cy="178"
              r="11"
              fill="#bae6fd"
              stroke="#111"
              strokeWidth="2.8"
            />
            <line x1="107" y1="180" x2="111" y2="179" stroke="#111" strokeWidth="2.8" />
            {/* Тонкие усы и сдержанная линия рта */}
            <path d="M 98 206 L 122 204" stroke="#181512" strokeWidth="3" />
          </g>

          {/* 5. ПРОНЗИТЕЛЬНЫЕ ГОЛУБЫЕ ЛАЗЕРНЫЕ ЛУЧИ ЧЕРЕЗ ВЕСЬ ЭКРАН (И ПОД ТАБЛИЦЕЙ!) */}
          <g filter="url(#neon-bloom)">
            <line
              x1="0"
              y1="95"
              x2="1260"
              y2="465"
              stroke="#00e5ff"
              strokeWidth="12"
              opacity="0.65"
            />
            <line x1="0" y1="95" x2="1260" y2="465" stroke="#e0faff" strokeWidth="3.5" />

            <line
              x1="90"
              y1="0"
              x2="1260"
              y2="690"
              stroke="#00e5ff"
              strokeWidth="8"
              opacity="0.55"
            />
            <line x1="90" y1="0" x2="1260" y2="690" stroke="#e0faff" strokeWidth="2.5" />

            <line
              x1="340"
              y1="0"
              x2="0"
              y2="440"
              stroke="#00e5ff"
              strokeWidth="7"
              opacity="0.6"
            />
            <line x1="340" y1="0" x2="0" y2="440" stroke="#e0faff" strokeWidth="2" />

            <line
              x1="0"
              y1="620"
              x2="1260"
              y2="210"
              stroke="#00e5ff"
              strokeWidth="10"
              opacity="0.5"
            />
            <line x1="0" y1="620" x2="1260" y2="210" stroke="#e0faff" strokeWidth="3" />
          </g>
        </g>
      )}

      {/* ==================================================================== */}
      {/* ХОЛСТ III: ПЬЕТА ИНСУЛИНДИИ // СВЕТЯЩИЕСЯ ЛЁГКИЕ ДОЛОРЕС ДЕЙ         */}
      {/* ==================================================================== */}
      {theme === "dolores_pieta" && (
        <g>
          <defs>
            <radialGradient id="dp-bg" cx="24%" cy="26%" r="82%">
              <stop offset="0%" stopColor="#6e2b1c" />
              <stop offset="35%" stopColor="#1e293b" />
              <stop offset="72%" stopColor="#0f1420" />
              <stop offset="100%" stopColor="#06080e" />
            </radialGradient>
            <radialGradient id="dp-lungs-glow" cx="20%" cy="24%" r="36%">
              <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.98" />
              <stop offset="28%" stopColor="#f59e0b" stopOpacity="0.72" />
              <stop offset="65%" stopColor="#b91c1c" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0f1420" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="dp-body-grad" x1="0%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="28%" stopColor="#d6a889" />
              <stop offset="58%" stopColor="#3b5978" />
              <stop offset="100%" stopColor="#0f1e36" />
            </linearGradient>
          </defs>

          {/* 1. Глубокий живописный задник с берлинской лазурью и кармином на все 1260px */}
          <rect width="1260" height="800" fill="url(#dp-bg)" />

          {/* Живописные масляные облака на заднике справа под таблицей S.M.A.R.T. */}
          <g filter="url(#oil-impasto)" opacity="0.45">
            <ellipse cx="620" cy="180" rx="260" ry="120" fill="#7f1d1d" />
            <ellipse cx="940" cy="340" rx="310" ry="160" fill="#1e3a5f" />
            <ellipse cx="740" cy="580" rx="280" ry="140" fill="#78350f" />
          </g>

          {/* Золотое зарево от лёгких Долорес Дей */}
          <rect width="1260" height="800" fill="url(#dp-lungs-glow)" />

          {/* 2. Багрово-красные потёки масляной краски вдоль левого края (x: 10..135) */}
          <g filter="url(#oil-impasto)" opacity="0.88">
            <rect x="14" y="290" width="95" height="510" fill="#7f1d1d" />
            <rect x="28" y="340" width="14" height="440" fill="#dc2626" />
            <rect x="52" y="310" width="18" height="470" fill="#ef4444" />
            <rect x="82" y="360" width="12" height="420" fill="#b91c1c" />
            <rect x="104" y="390" width="10" height="390" fill="#dc2626" />
          </g>

          {/* 3. СКЛОНЁННЫЙ ЛИК ДОЛОРЕС ДЕЙ И СВЕЧЕНИЕ БРОНХИАЛЬНОГО ДЕРЕВА */}
          <g>
            {/* Плечи и вуаль Долорес */}
            <path
              d="M 115 95 Q 235 45 345 110 L 385 350 L 95 320 Z"
              fill="rgba(120, 53, 38, 0.65)"
              stroke="#451a14"
              strokeWidth="2"
            />
            {/* Лик Долорес в мягком золотом свете */}
            <path
              d="M 215 18 Q 258 12 282 42 Q 288 85 248 106 Q 210 98 205 55 Z"
              fill="#e6b891"
              stroke="#5c2c1d"
              strokeWidth="2"
            />
            {/* Опущенные ресницы и спокойная полуулыбка */}
            <path
              d="M 222 54 Q 234 62 246 56 M 258 60 Q 268 66 276 60 M 232 84 Q 246 90 258 84"
              stroke="#4a2216"
              strokeWidth="2.2"
              fill="none"
            />

            {/* Два детальных золотых лёгких с ветвящимися бронхами */}
            <g filter="url(#neon-bloom)">
              <path
                d="M 212 132 C 182 132, 162 168, 164 218 C 166 252, 195 268, 218 248 C 224 215, 222 155, 212 132 Z"
                fill="#fef08a"
              />
              <path
                d="M 244 134 C 274 134, 294 170, 292 222 C 290 256, 262 272, 238 250 C 232 215, 234 155, 244 134 Z"
                fill="#fef08a"
              />
            </g>
            {/* Трахея и тонкие сосуды бронхиального дерева внутри лёгких */}
            <path
              d="M 228 108 L 228 162 M 228 162 L 195 188 M 195 188 L 178 215 M 195 188 L 204 228 M 228 162 L 260 192 M 260 192 L 276 220 M 260 192 L 250 232"
              stroke="#d97706"
              strokeWidth="2.4"
              fill="none"
            />
          </g>

          {/* 4. ПАВШИЙ ДЕТЕКТИВ НА РУКАХ ДОЛОРЕС (КОНТРАСТ ЗОЛОТА И БЕРЛИНСКОЙ ЛАЗУРИ) */}
          <g>
            {/* Запрокинутая бородатая голова в профиль (x: 75..195, y: 215..315) */}
            <path
              d="M 78 272 Q 95 228 142 224 L 162 218 L 175 232 L 194 238 Q 202 265 182 292 L 145 318 L 82 308 Z"
              fill="url(#dp-body-grad)"
              stroke="#0f172a"
              strokeWidth="2.5"
            />
            {/* Волосы и густая борода в сине-фиолетовой тени */}
            <path
              d="M 74 268 Q 88 232 128 232 Q 112 265 128 295 L 188 242 Q 202 268 178 296 L 135 318 L 78 305 Z"
              fill="#1e293b"
            />
            {/* Золотой блик на переносице, скуле и груди от света лёгких */}
            <polygon points="138,225 162,218 172,235 145,248" fill="#fef3c7" />

            {/* Торс, рельеф рёбер и опущенная правая рука в глубоких синих мазках */}
            <path
              d="M 155 305 Q 255 315 365 395 L 385 520 L 245 535 L 142 395 Z"
              fill="url(#dp-body-grad)"
              stroke="#09111e"
              strokeWidth="2.5"
            />
            {/* Опущенная рука в берлинской лазури */}
            <path
              d="M 142 342 Q 185 345 208 425 L 285 615 L 335 725 L 285 745 L 235 635 L 145 455 Z"
              fill="#172c4c"
              stroke="#08101d"
              strokeWidth="2.8"
            />
            {/* Золотой контурный рефлекс вдоль верхнего края плеча и груди */}
            <path
              d="M 162 306 Q 258 318 358 392"
              stroke="#fde68a"
              strokeWidth="4"
              fill="none"
            />
          </g>
        </g>
      )}

      {/* ==================================================================== */}
      {/* ХОЛСТ IV: УХМЫЛКА КУСТО // ЗЕРКАЛО В «ТАНЦАХ В ТРЯПЬЕ»               */}
      {/* ==================================================================== */}
      {theme === "cousteau_grin" && (
        <g>
          <defs>
            <linearGradient id="cg-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#283834" />
              <stop offset="32%" stopColor="#1d2825" />
              <stop offset="70%" stopColor="#121817" />
              <stop offset="100%" stopColor="#0a0d0c" />
            </linearGradient>
          </defs>

          {/* 1. Ночной дождливый задник Мартинеза на все 1260px */}
          <rect width="1260" height="800" fill="url(#cg-bg)" />

          {/* Диагональные экспрессионистские мазки охры, бирюзы и кремового света слева */}
          <g opacity="0.9">
            <polygon points="-20,180 220,-20 310,-20 40,260" fill="#d9822b" />
            <polygon points="180,220 440,-20 540,-20 260,310" fill="#2d6a65" />
            <polygon points="280,380 620,40 690,110 340,460" fill="#d9822b" opacity="0.65" />
            {/* Кремово-пергаментный ореол мастихином позади головы Гарри */}
            <polygon points="45,145 335,75 375,445 85,495" fill="#e6ead2" />
          </g>

          {/* Огни ночного Мартинеза и капли дождя на заднике справа под таблицей S.M.A.R.T. */}
          <g filter="url(#neon-bloom)" opacity="0.32">
            <circle cx="640" cy="220" r="45" fill="#f59e0b" />
            <circle cx="920" cy="180" r="65" fill="#0ea5e9" />
            <circle cx="1080" cy="420" r="55" fill="#d97706" />
            <circle cx="780" cy="540" r="40" fill="#14b8a6" />
          </g>

          {/* 2. ПОРТРЕТ ГАРРИ С УХМЫЛКОЙ «ВЫРАЖЕНИЕ» (ТУШЬ + ПАСТОЗНАЯ ГУАШЬ) */}
          <g>
            {/* Оливково-зелёный пиджак */}
            <path
              d="M 10 800 L 52 485 L 155 445 L 265 455 L 365 510 L 405 800 Z"
              fill="#2d3e1e"
              stroke="#121a0c"
              strokeWidth="3.5"
            />
            {/* Огромный белый остроконечный диско-воротник рубашки */}
            <polygon
              points="136,442 98,625 168,548 176,800 228,800 234,555 292,612 252,452"
              fill="#d8dfd5"
              stroke="#1c2419"
              strokeWidth="3"
            />
            {/* Ужасающий галстук */}
            <polygon
              points="182,525 216,525 224,800 174,800"
              fill="#3b4d21"
              stroke="#141c0b"
              strokeWidth="2.5"
            />
            <polygon points="184,565 214,580 212,625 182,610" fill="#d98a26" />
            <polygon points="182,645 216,660 214,705 180,690" fill="#b84a28" />

            {/* Серо-пепельный подбородок и шея */}
            <polygon
              points="148,408 248,412 242,515 154,505"
              fill="#6e6d68"
              stroke="#1f1e1b"
              strokeWidth="3"
            />
            <polygon points="164,415 232,418 226,465 170,460" fill="#9c9b94" />

            {/* Основа лица и ухо */}
            <path
              d="M 102 275 L 124 275 L 128 345 L 100 335 Z"
              fill="#9e3f32"
              stroke="#24120e"
              strokeWidth="2.8"
            />
            <path
              d="M 122 205 L 278 212 L 284 378 L 238 432 L 158 428 L 118 368 Z"
              fill="#c7b2a3"
              stroke="#241511"
              strokeWidth="3"
            />

            {/* Похмельный багрово-терракотовый румянец на щеках, переносице и вокруг глаз */}
            <polygon points="132,292 272,302 262,375 138,365" fill="#b85646" />
            <polygon points="186,295 224,298 228,362 182,358" fill="#9e382b" />

            {/* Знаменитый чисто-белый блик мастихином посреди лба */}
            <polygon points="168,198 226,212 238,268 182,258" fill="#f7f9f4" />

            {/* Морщины на лбу, прищуренные глаза и мешки под глазами */}
            <path
              d="M 164 228 Q 208 242 254 232 M 172 244 Q 212 256 248 248"
              stroke="#2b1914"
              strokeWidth="2.4"
              fill="none"
            />
            {/* Брови */}
            <path
              d="M 142 276 Q 168 268 194 284 M 222 288 Q 248 278 272 288"
              stroke="#261611"
              strokeWidth="5.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Прищуренные глаза */}
            <ellipse cx="168" cy="300" rx="18" ry="7" fill="#591f18" />
            <ellipse cx="168" cy="300" rx="11" ry="3.5" fill="#170b09" />
            <circle cx="165" cy="299" r="2" fill="#fff" />

            <ellipse cx="242" cy="308" rx="17" ry="7" fill="#4a1913" />
            <ellipse cx="242" cy="308" rx="10" ry="3.5" fill="#170b09" />
            <circle cx="240" cy="307" r="2" fill="#fff" />

            {/* Густые бакенбарды и усы, соединённые воедино */}
            <path
              d="M 116 285 L 92 365 L 118 408 L 154 398 L 198 378 L 245 402 L 278 415 L 298 368 L 278 298 L 258 358 L 202 346 L 142 352 Z"
              fill="#291711"
              stroke="#120a07"
              strokeWidth="3"
            />

            {/* Кривая зубастая ухмылка «Выражения» (The Expression) */}
            <path
              d="M 166 382 Q 200 404 234 388 Q 200 422 166 382 Z"
              fill="#140907"
              stroke="#140907"
              strokeWidth="2"
            />
            <polygon points="174,386 224,390 220,398 176,395" fill="#f2efe9" />
            <path d="M 176 404 Q 200 414 224 404" stroke="#c96b5e" strokeWidth="4.5" fill="none" />

            {/* Растрёпанная шевелюра сверху с падающими на лоб волосками */}
            <path
              d="M 102 248 Q 108 158 178 152 Q 235 138 282 178 Q 308 212 284 265 L 265 212 L 195 198 L 132 218 Z"
              fill="#241915"
              stroke="#0f0a08"
              strokeWidth="2.8"
            />
            <path
              d="M 215 182 Q 238 218 218 246 M 234 188 Q 254 225 235 254"
              stroke="#1c1310"
              strokeWidth="2.5"
              fill="none"
            />
          </g>
        </g>
      )}

      {/* Финальный слой переплетения холста поверх всей панорамы */}
      <rect width="1260" height="800" fill="url(#canvas-weave)" />
    </svg>
  );
}

// ============================================================================
// 5. БАЗА ДАННЫХ НАКОПИТЕЛЕЙ И РЕПЛИК НАВЫКОВ
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
// 6. ГЛАВНЫЙ КОМПОНЕНТ (ПАНОРАМНОЕ ОКНО CRYSTALDISKINFO SPECIAL EDITION)
// ============================================================================

const INITIAL_SLOTS: ArtworkSlot[] = [
  {
    id: "slot_1",
    title: "I. Взрыв (B' B'')",
    theme: "mind_burst",
    accentColor: "#ff007f",
    ambientGlow: "rgba(255, 0, 127, 0.24)",
    customDataUrl: null,
  },
  {
    id: "slot_2",
    title: "II. Церковь и Долорес",
    theme: "church_lasers",
    accentColor: "#00e5ff",
    ambientGlow: "rgba(0, 229, 255, 0.22)",
    customDataUrl: null,
  },
  {
    id: "slot_3",
    title: "III. Пьета Инсулиндии",
    theme: "dolores_pieta",
    accentColor: "#f59e0b",
    ambientGlow: "rgba(245, 158, 11, 0.24)",
    customDataUrl: null,
  },
  {
    id: "slot_4",
    title: "IV. Ухмылка Кусто",
    theme: "cousteau_grin",
    accentColor: "#d9822b",
    ambientGlow: "rgba(45, 106, 101, 0.28)",
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
      text: "Переключай 4 панорамных полотна в правом верхнем углу окна или кликни по любой строке S.M.A.R.T., чтобы услышать голоса внутри контроллера.",
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const resetCustomSlot = () => {
    const slotKey = `slot_${activeSlotIdx + 1}`;
    saveArtToDB(slotKey, "");
    setArtSlots((prev) =>
      prev.map((s, idx) => (idx === activeSlotIdx ? { ...s, customDataUrl: null } : s))
    );
    soundFX.playRelayClick();
  };

  const handleSelectDrive = (idx: number) => {
    const drv = drives[idx];
    setActiveDriveIdx(idx);
    soundFX.playRelayClick();

    if (drv.healthStatus === "BAD") setActiveSlotIdx(2); // Пьета Долорес
    else if (drv.healthStatus === "CAUTION") setActiveSlotIdx(1); // Церковь и лазеры

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
        background: `radial-gradient(circle at 22% 35%, ${currentArtSlot.ambientGlow}, transparent 55%), radial-gradient(circle at 82% 75%, ${currentArtSlot.ambientGlow}, transparent 55%), #070609`,
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
      {/* АТМОСФЕРНЫЙ ВНЕШНИЙ ЗАДНИК ЭКРАНА: ТОПОГРАФИЧЕСКИЕ ИЗОЛИНИИ СЕРОТЫ */}
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.35,
        }}
      >
        <g fill="none" stroke="rgba(212, 163, 89, 0.18)" strokeWidth="1">
          <ellipse cx="320" cy="540" rx="480" ry="320" strokeDasharray="12 8" />
          <ellipse cx="320" cy="540" rx="640" ry="440" />
          <ellipse cx="320" cy="540" rx="820" ry="580" strokeDasharray="4 10" />
          <ellipse cx="1580" cy="480" rx="520" ry="360" />
          <ellipse cx="1580" cy="480" rx="720" ry="510" strokeDasharray="16 12" />
          <line x1="0" y1="180" x2="1920" y2="180" opacity="0.4" />
          <line x1="0" y1="900" x2="1920" y2="900" opacity="0.4" />
        </g>
      </svg>

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

        /* ГЛАВНОЕ ОКНО CRYSTALDISKINFO SPECIAL EDITION */
        .cdi-window-frame {
          width: 100%;
          max-width: 1220px;
          min-height: 768px;
          position: relative;
          z-index: 5;
          display: flex;
          flex-direction: column;
          background: #100d14;
          border: 1px solid rgba(212, 163, 89, 0.36);
          box-shadow:
            0 32px 95px rgba(0, 0, 0, 0.94),
            0 0 60px rgba(0, 0, 0, 0.8);
          overflow: hidden;
        }

        .win-titlebar {
          position: relative;
          z-index: 20;
          height: 28px;
          background: rgba(14, 11, 18, 0.92);
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
          height: 29px;
          background: rgba(20, 17, 26, 0.88);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(212, 163, 89, 0.24);
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
          gap: 4px;
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

        /* РАБОЧАЯ СЕТКА ПОВЕРХ ПАНОРАМНОГО ПОЛОТНА */
        .cdi-main-split {
          position: relative;
          z-index: 10;
          flex: 1;
          display: grid;
          grid-template-columns: 390px 1fr;
        }
        @media (max-width: 1024px) {
          .cdi-main-split {
            grid-template-columns: 1fr;
          }
        }

        /* Левая витрина полностью прозрачна, открывая персонажа на панорамном холсте */
        .left-artwork-pane {
          position: relative;
          min-height: 680px;
          border-right: 1px solid rgba(212, 163, 89, 0.22);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .left-art-caption {
          padding: 8px 12px;
          background: linear-gradient(0deg, rgba(10, 8, 14, 0.88) 0%, transparent 100%);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: rgba(232, 226, 213, 0.78);
        }

        /* Правая панель из дымчатого стекла: сквозь неё просвечивает правая часть картины! */
        .right-data-pane {
          background: rgba(12, 10, 17, 0.54);
          backdrop-filter: blur(7px);
          padding: 10px 18px 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cdi-drive-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.14);
          padding-bottom: 6px;
        }
        .drive-tabs-group {
          display: flex;
          gap: 5px;
        }
        .cdi-drive-tab {
          padding: 4px 13px;
          background: rgba(14, 12, 20, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #d4cbbd;
          cursor: pointer;
          text-align: center;
          line-height: 1.25;
          font-size: 11.5px;
          min-width: 96px;
          transition: all 0.14s;
        }
        .cdi-drive-tab:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .cdi-drive-tab.active {
          background: rgba(212, 163, 89, 0.22);
          border-color: #d4a359;
          color: #ffffff;
          font-weight: 600;
        }

        .cdi-model-row {
          text-align: center;
          padding: 2px 0 5px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.14);
        }
        .cdi-model-name {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: 0.01em;
          color: #ffffff;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
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
          color: #ded6c8;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
          white-space: nowrap;
        }
        .cdi-spec-box {
          height: 23px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          background: rgba(8, 7, 12, 0.62);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
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

        /* Полупрозрачная таблица S.M.A.R.T. */
        .cdi-table-wrapper {
          background: rgba(8, 7, 12, 0.64);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .cdi-smart-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .cdi-smart-table th {
          background: rgba(20, 17, 28, 0.88);
          color: #d8cfc2;
          font-weight: 500;
          padding: 5px 8px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          white-space: nowrap;
        }
        .cdi-smart-table td {
          padding: 4.5px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          color: #f2ece1;
        }
        .cdi-smart-table tr {
          cursor: pointer;
          transition: background 0.1s;
        }
        .cdi-smart-table tr:hover td {
          background: rgba(255, 255, 255, 0.09);
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
          background: rgba(11, 9, 15, 0.88);
          border: 1px solid rgba(212, 163, 89, 0.32);
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .zaum-paragraph {
          margin: 0;
          font-size: 15px;
          line-height: 1.42;
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
            Отпустите ваши иллюстрации для установки на панорамный холст
          </div>
        </div>
      )}

      {/* ОКНО CRYSTALDISKINFO SPECIAL EDITION */}
      <div className="cdi-window-frame">
        {/* ПАНОРАМНОЕ ХУДОЖЕСТВЕННОЕ ПОЛОТНО НА ВСЮ ШИРИНУ И ВЫСОТУ ОКНА */}
        <PanoramicMasterpieceArtwork
          theme={currentArtSlot.theme}
          customUrl={currentArtSlot.customDataUrl}
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
              Свой арт...
            </button>
            {currentArtSlot.customDataUrl && (
              <button onClick={resetCustomSlot} className="menu-link">
                Сбросить арт
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
          {/* ЛЕВАЯ КОЛОНКА: ОТКРЫТАЯ ВИТРИНА ПАНОРАМНОГО ХОЛСТА */}
          <aside
            className="left-artwork-pane"
            onClick={() => setActiveSlotIdx((prev) => (prev + 1) % artSlots.length)}
            title="Кликните по картине для переключения следующего полотна"
          >
            <div className="left-art-caption" onClick={(e) => e.stopPropagation()}>
              <span>{currentArtSlot.title}</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "rgba(18, 15, 22, 0.8)",
                  border: "1px solid rgba(212, 163, 89, 0.4)",
                  color: "#e8e2d5",
                  padding: "2px 8px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Ctrl+V / Файл
              </button>
            </div>
          </aside>

          {/* ПРАВАЯ КОЛОНКА: ДЫМЧАТОЕ СТЕКЛО ПОВЕРХ ПРАВОЙ ЧАСТИ КАРТИНЫ */}
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
