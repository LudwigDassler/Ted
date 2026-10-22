"use client";

import React, { useState, useEffect, useRef } from "react";
import { DISCO_THEMES, DiscoThemeConfig } from "./artworks";

// ============================================================================
// 1. ТИПЫ ДАННЫХ CRYSTALDISKINFO // DISCO ELYSIUM EDITION
// ============================================================================

type HealthState = "GOOD" | "CAUTION" | "BAD";

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
  isRealHardware?: boolean;
  attributes: SmartAttribute[];
}

interface DialogueMessage {
  id: string;
  skill: string;
  category: "INT" | "PSY" | "FYS" | "MOT" | "TIE";
  difficulty?: string;
  text: string;
}

interface ElectronSmartBridge {
  getRealDrives: () => Promise<DriveProfile[]>;
  windowControl: (action: "minimize" | "maximize" | "close") => void;
}

// ============================================================================
// 2. ЛОКАЛЬНАЯ БАЗА INDEXEDDB ДЛЯ ПОЛЬЗОВАТЕЛЬСКИХ ХОЛСТОВ
// ============================================================================

const DB_NAME = "DiscoCdiGitVault";
const STORE_NAME = "custom_slots";

function openVaultDB(): Promise<IDBDatabase> {
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

async function saveSlotToDB(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openVaultDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, key);
  } catch {}
}

async function loadSlotsFromDB(): Promise<Record<string, string>> {
  try {
    const db = await openVaultDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const out: Record<string, string> = {};
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          out[String(cursor.key)] = String(cursor.value);
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

function convertFileToOptimizedWebP(file: File | Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawUrl = String(ev.target?.result || "");
      const img = new Image();
      img.onload = () => {
        const maxW = 540;
        const maxH = 900;
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.86));
      };
      img.onerror = () => resolve(rawUrl);
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
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

  playClick() {
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

  playChord(success: boolean) {
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
// 4. АТМОСФЕРНЫЙ ЗАДНИК ОКНА (ПРОЕКЦИЯ АКТИВНОГО АРТА + МАСТИХИН + ДОЖДЬ)
// ============================================================================

function WindowArtBackdrop({
  activeArtSrc,
  palette,
  health,
}: {
  activeArtSrc: string | null;
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

    const blocks = Array.from({ length: 50 }, (_, i) => ({
      x: 340 + ((i * 179) % 900),
      y: (i * 103) % 780,
      w: 160 + ((i * 67) % 240),
      h: 34 + ((i * 31) % 60),
      angle: -0.42 + ((i % 7) - 3) * 0.07,
      color: palette[i % 3],
      alpha: 0.08 + (i % 4) * 0.025,
    }));

    const rain = Array.from({ length: 45 }, (_, i) => ({
      x: 380 + ((i * 137) % 850),
      y: (i * 89) % 780,
      len: 32 + (i % 5) * 18,
      speed: 1.35 + (i % 4) * 0.45,
      alpha: 0.065 + (i % 3) * 0.03,
    }));

    const render = () => {
      frame += 1;
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      ctx.save();
      blocks.forEach((b) => {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.globalAlpha = b.alpha;
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.w * 0.5, -b.h * 0.5, b.w, b.h);
        ctx.restore();
      });
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "rgba(226, 212, 190, 0.055)";
      ctx.lineWidth = 1;
      [170, 310, 460, 620].forEach((r, idx) => {
        ctx.beginPath();
        if (idx % 2 === 0) ctx.setLineDash([8, 6]);
        else ctx.setLineDash([]);
        ctx.arc(810, 380, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(385, 380);
      ctx.lineTo(W, 380);
      ctx.moveTo(810, 0);
      ctx.lineTo(810, H);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = palette[0];
      ctx.lineWidth = 1.15;
      rain.forEach((d) => {
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
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 28% 35%, ${palette[0]}44 0%, ${palette[1]}33 45%, ${palette[3]} 95%)`,
        }}
      />

      {activeArtSrc && (
        <img
          src={activeArtSrc}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(36px) saturate(1.45) brightness(0.36)",
            transform: "scale(1.12)",
          }}
        />
      )}

      <canvas
        ref={canvasRef}
        width={1220}
        height={780}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}

// ============================================================================
// 5. БАЗА ДАННЫХ НАКОПИТЕЛЕЙ И РЕПЛИК S.M.A.R.T.
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
    isRealHardware: true,
    attributes: parsedAttrs.length > 0 ? parsedAttrs : INITIAL_DRIVES[0].attributes,
  };
}

// ============================================================================
// 6. ГЛАВНЫЙ КОМПОНЕНТ «CRYSTALDISKINFO // DISCO ELYSIUM EDITION»
// ============================================================================

export default function CrystalDiskElysiumEdition() {
  const [drives, setDrives] = useState<DriveProfile[]>(INITIAL_DRIVES);
  const [activeDriveIdx, setActiveDriveIdx] = useState<number>(0);

  const [themes, setThemes] = useState<DiscoThemeConfig[]>(DISCO_THEMES);
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const [missingRepoImg, setMissingRepoImg] = useState<Record<string, boolean>>({});

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
      text: "Кремний помнит всё, детектив. Выбери любую строку в ведомости S.M.A.R.T. или брось кости Белой проверки внизу, чтобы прослушать пульс накопителя.",
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeDrive = drives[activeDriveIdx] || drives[0];
  const currentTheme = themes[activeSlotIdx] || themes[0];

  useEffect(() => {
    loadSlotsFromDB().then((savedMap) => {
      setThemes((prev) =>
        prev.map((t, idx) => {
          const saved = savedMap[`slot_${idx + 1}`];
          return saved ? { ...t, embeddedDataUrl: saved } : t;
        })
      );
    });
  }, []);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const blob = items[i].getAsFile();
          if (!blob) continue;
          const webpUrl = await convertFileToOptimizedWebP(blob);
          const slotKey = `slot_${activeSlotIdx + 1}`;
          await saveSlotToDB(slotKey, webpUrl);
          setThemes((prev) =>
            prev.map((t, idx) => (idx === activeSlotIdx ? { ...t, embeddedDataUrl: webpUrl } : t))
          );
          soundFX.playChord(true);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeSlotIdx]);

  // Функция опроса физических дисков в десктопной сборке Electron
  const pollHardwareDrives = () => {
    const win = window as unknown as { electronSMART?: ElectronSmartBridge };
    if (win.electronSMART && typeof win.electronSMART.getRealDrives === "function") {
      win.electronSMART
        .getRealDrives()
        .then((realDrives) => {
          if (Array.isArray(realDrives) && realDrives.length > 0) {
            setDrives([...realDrives, ...INITIAL_DRIVES]);
            setActiveDriveIdx(0);
            soundFX.playClick();
          }
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    pollHardwareDrives();
  }, []);

  const handleWindowControl = (action: "minimize" | "maximize" | "close") => {
    const win = window as unknown as { electronSMART?: ElectronSmartBridge };
    if (win.electronSMART && typeof win.electronSMART.windowControl === "function") {
      win.electronSMART.windowControl(action);
    }
  };

  const handleArtFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 4);

    for (let i = 0; i < list.length; i++) {
      const targetIdx = list.length === 1 ? activeSlotIdx : i;
      const slotKey = `slot_${targetIdx + 1}`;
      const webpUrl = await convertFileToOptimizedWebP(list[i]);
      await saveSlotToDB(slotKey, webpUrl);
      setThemes((prev) =>
        prev.map((t, sIdx) => (sIdx === targetIdx ? { ...t, embeddedDataUrl: webpUrl } : t))
      );
      if (i === 0) setActiveSlotIdx(targetIdx);
    }
    soundFX.playChord(true);
  };

  const activeArtSrc =
    currentTheme.embeddedDataUrl ||
    (!missingRepoImg[currentTheme.repoPath] ? currentTheme.repoPath : null);

  const handleSelectDrive = (idx: number) => {
    const drv = drives[idx];
    setActiveDriveIdx(idx);
    soundFX.playClick();

    if (drv.healthStatus === "BAD") setActiveSlotIdx(3);
    else if (drv.healthStatus === "CAUTION") setActiveSlotIdx(2);

    setThoughts([
      {
        id: `drv_${Date.now()}`,
        skill: drv.healthStatus === "BAD" ? "ВНУТРЕННЯЯ ИМПЕРИЯ" : "ИНТЕРФЕЙС",
        category: drv.healthStatus === "BAD" ? "PSY" : "MOT",
        difficulty: "Средне: Успех",
        text:
          drv.healthStatus === "GOOD"
            ? `Подключён накопитель [${drv.letter}] ${drv.model}. Линии PCIe 4.0 работают штатно, остаточный ресурс ${drv.healthPercent}%.`
            : drv.healthStatus === "CAUTION"
            ? `На накопителе [${drv.letter}] зафиксированы переназначенные сектора и нестабильные блоки.`
            : `Критический износ магнитной поверхности [${drv.letter}]: здоровье ${drv.healthPercent}%, таблица дефектов G-List переполнена.`,
      },
    ]);
  };

  const handleSelectAttribute = (attr: SmartAttribute) => {
    setSelectedAttrId(attr.id);
    soundFX.playClick();
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
    soundFX.playChord(success);

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
    soundFX.playClick();
  };

  const handleImportSubmit = () => {
    const parsed = parseRealSmartReport(importText);
    if (!parsed) return;
    setDrives([parsed, ...drives]);
    setActiveDriveIdx(0);
    setShowImportModal(false);
    setImportText("");
    soundFX.playChord(true);
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
        background: `radial-gradient(circle at 18% 30%, ${currentTheme.palette[0]}33, transparent 55%), radial-gradient(circle at 82% 75%, ${currentTheme.palette[1]}33, transparent 55%), #070609`,
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
          padding: 10px;
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
          -webkit-app-region: drag;
        }
        .win-controls {
          display: flex;
          gap: 4px;
          -webkit-app-region: no-drag;
        }
        .win-ctrl-btn {
          background: transparent;
          border: none;
          color: #9e9484;
          width: 26px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 12px;
        }
        .win-ctrl-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .win-ctrl-close:hover {
          background: #c83232;
          color: #fff;
        }

        .win-menubar {
          position: relative;
          z-index: 20;
          height: 29px;
          background: rgba(20, 17, 25, 0.92);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(212, 163, 89, 0.25);
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .menu-left {
          display: flex;
          align-items: center;
          gap: 2px;
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
          background: linear-gradient(0deg, rgba(10, 8, 12, 0.92) 0%, rgba(10, 8, 12, 0.5) 70%, transparent 100%);
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
          flex-wrap: wrap;
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
        <WindowArtBackdrop
          activeArtSrc={activeArtSrc}
          palette={currentTheme.palette}
          health={activeDrive.healthStatus}
        />

        <div className="win-titlebar">
          <span>CrystalDiskInfo 9.8.0 Disco Elysium Edition x64</span>
          <div className="win-controls mono">
            <button
              onClick={() => handleWindowControl("minimize")}
              className="win-ctrl-btn"
              title="Свернуть"
            >
              ─
            </button>
            <button
              onClick={() => handleWindowControl("maximize")}
              className="win-ctrl-btn"
              title="Развернуть"
            >
              □
            </button>
            <button
              onClick={() => handleWindowControl("close")}
              className="win-ctrl-btn win-ctrl-close"
              title="Закрыть"
            >
              ×
            </button>
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
            <button onClick={pollHardwareDrives} className="menu-link" title="Переопросить физические диски системы">
              Диск (Обновить)
            </button>
            <button
              onClick={() => setRawFormat((p) => (p === "HEX16" ? "DEC10" : "HEX16"))}
              className="menu-link"
            >
              Вид ({rawFormat === "HEX16" ? "HEX" : "DEC"})
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="menu-link">
              Холст
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
            {themes.map((slot, idx) => (
              <button
                key={slot.id}
                onClick={() => {
                  setActiveSlotIdx(idx);
                  soundFX.playClick();
                }}
                className={`slot-btn ${idx === activeSlotIdx ? "active" : ""}`}
              >
                {slot.title}
              </button>
            ))}
          </div>
        </nav>

        <div className="cdi-main-split">
          <aside className="left-artwork-pane">
            {activeArtSrc ? (
              <img
                src={activeArtSrc}
                alt={currentTheme.title}
                data-pin-nopin="true"
                onClick={() => fileInputRef.current?.click()}
                onError={() =>
                  setMissingRepoImg((prev) => ({
                    ...prev,
                    [currentTheme.repoPath]: true,
                  }))
                }
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  display: "block",
                  cursor: "pointer",
                }}
                title="Нажмите, чтобы сменить иллюстрацию"
              />
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "28px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: `radial-gradient(circle at 50% 35%, ${currentTheme.palette[0]}38, #0e0c10 82%)`,
                }}
              >
                <div
                  className="serif-zaum"
                  style={{ fontSize: "22px", color: "#f4d38a", marginBottom: "8px" }}
                >
                  {currentTheme.title}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#cbbba0",
                    marginBottom: "18px",
                    fontStyle: "italic",
                  }}
                >
                  {currentTheme.subtitle}
                </div>
                <span
                  style={{
                    padding: "6px 14px",
                    border: "1px solid rgba(212, 163, 89, 0.55)",
                    color: "#f4d38a",
                    fontSize: "12px",
                  }}
                >
                  Выбрать иллюстрацию (или Ctrl+V)...
                </span>
              </div>
            )}

            <div className="left-art-toolbar">
              <span>{currentTheme.title}</span>
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
                Сменить арт...
              </button>
            </div>
          </aside>

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
