"use client";

import React, { useState, useEffect, useRef } from "react";

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
  repoPath: string;
  customDataUrl: string | null;
}

// ============================================================================
// 2. ХРАНИЛИЩЕ INDEXEDDB ДЛЯ СОХРАНЕНИЯ КАРТИНОК В БРАУЗЕРЕ
// ============================================================================

const DB_NAME = "DiscoCdiArtworksDB";
const STORE_NAME = "slots";

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
// 4. ПРОФИЛИ НАКОПИТЕЛЕЙ И РЕПЛИКИ НАВЫКОВ DISCO ELYSIUM
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
// 5. ГЛАВНЫЙ КОМПОНЕНТ (ЧИСТАЯ ВИТРИНА ПОД ВАШИ 4 ИЛЛЮСТРАЦИИ)
// ============================================================================

const INITIAL_SLOTS: ArtworkSlot[] = [
  { id: "slot_1", title: "Холст I", repoPath: "/art1.jpg", customDataUrl: null },
  { id: "slot_2", title: "Холст II", repoPath: "/art2.jpg", customDataUrl: null },
  { id: "slot_3", title: "Холст III", repoPath: "/art3.jpg", customDataUrl: null },
  { id: "slot_4", title: "Холст IV", repoPath: "/art4.jpg", customDataUrl: null },
];

export default function CrystalDiskElysiumEdition() {
  const [drives, setDrives] = useState<DriveProfile[]>(INITIAL_DRIVES);
  const [activeDriveIdx, setActiveDriveIdx] = useState<number>(0);

  const [artSlots, setArtSlots] = useState<ArtworkSlot[]>(INITIAL_SLOTS);
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const [missingRepoFiles, setMissingRepoFiles] = useState<Record<string, boolean>>({});

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
      text: "Кликни по любой строке S.M.A.R.T. для чтения регистра. Чтобы поставить свои 4 арта — перетащи их сюда мышкой, нажми Ctrl + V или положи в папку public/ репозитория как art1.jpg – art4.jpg.",
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

  // Вставка картинки по Ctrl + V прямо в активный слот
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
  const activeArtSrc =
    currentArtSlot.customDataUrl ||
    (!missingRepoFiles[currentArtSlot.repoPath] ? currentArtSlot.repoPath : null);

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
          padding: 14px;
          background: #090807;
        }

        /* ОКНО НАТИВНОЙ УТИЛИТЫ (БЕЗ ОБРЕЗКИ НИЖНЕГО КРАЯ) */
        .cdi-window-frame {
          width: 100%;
          max-width: 1180px;
          min-height: 760px;
          position: relative;
          display: flex;
          flex-direction: column;
          background: #141210;
          border: 1px solid #3a342d;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.92);
          overflow: hidden;
        }

        /* Мягкая подсветка правой стеклянной панели цветами активного арта */
        .ambient-backdrop-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: blur(34px) saturate(1.35) brightness(0.32);
          transform: scale(1.08);
          pointer-events: none;
          z-index: 0;
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
          gap: 4px;
        }
        .slot-btn {
          background: transparent;
          border: 1px solid transparent;
          color: #9e9383;
          padding: 2px 9px;
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
        }
        @media (max-width: 1024px) {
          .cdi-main-split {
            grid-template-columns: 1fr;
          }
        }

        /* Левая витрина под иллюстрацию */
        .left-artwork-pane {
          position: relative;
          border-right: 1px solid rgba(255, 255, 255, 0.12);
          background: #0e0c0a;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Правая панель данных CrystalDiskInfo */
        .right-data-pane {
          background: rgba(18, 16, 14, 0.76);
          backdrop-filter: blur(14px);
          padding: 10px 16px 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
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
          background: rgba(10, 9, 8, 0.68);
          border: 1px solid rgba(255, 255, 255, 0.16);
        }
        .cdi-smart-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .cdi-smart-table th {
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
          margin-top: auto;
          background: rgba(14, 12, 10, 0.92);
          border: 1px solid rgba(212, 163, 89, 0.28);
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .zaum-paragraph {
          margin: 0;
          font-size: 15px;
          line-height: 1.42;
          color: #ede6d6;
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
          color: #9e9383;
          font-size: 13.5px;
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
            Отпустите ваши иллюстрации (можно сразу все 4 файла)
          </div>
        </div>
      )}

      {/* ОКНО CRYSTALDISKINFO SPECIAL EDITION */}
      <div className="cdi-window-frame">
        {/* Размытая цветовая проекция текущего арта под правой стеклянной панелью */}
        {activeArtSrc && <img src={activeArtSrc} alt="" className="ambient-backdrop-img" />}

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
              Холст (Выбрать 4 файла...)
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
          {/* ЛЕВАЯ КОЛОНКА: ТОЛЬКО ОРИГИНАЛЬНЫЙ АРТ (БЕЗ ПРОЦЕДУРНОЙ МАЗНИ) */}
          <aside className="left-artwork-pane">
            {activeArtSrc ? (
              <img
                src={activeArtSrc}
                alt={currentArtSlot.title}
                onClick={() => fileInputRef.current?.click()}
                onError={() =>
                  setMissingRepoFiles((prev) => ({
                    ...prev,
                    [currentArtSlot.repoPath]: true,
                  }))
                }
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  display: "block",
                  cursor: "pointer",
                }}
                title="Кликните, чтобы заменить иллюстрацию"
              />
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "32px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  background:
                    "radial-gradient(circle at 50% 40%, rgba(42, 34, 28, 0.55), #0e0c0a 80%)",
                }}
              >
                <div
                  className="serif-zaum"
                  style={{
                    fontSize: "20px",
                    color: "#d4a359",
                    marginBottom: "10px",
                    letterSpacing: "0.02em",
                  }}
                >
                  {currentArtSlot.title}
                </div>
                <p
                  style={{
                    fontSize: "12.5px",
                    color: "#a89f91",
                    lineHeight: 1.55,
                    margin: "0 0 18px 0",
                  }}
                >
                  Нажмите сюда, чтобы выбрать ваши 4 иллюстрации, перетащите их мышкой в окно или
                  нажмите <strong className="mono">Ctrl + V</strong>.
                  <br />
                  <br />
                  Для постоянной прошивки в GitHub положите файл в папку{" "}
                  <span className="mono" style={{ color: "#e8e2d5" }}>
                    public{currentArtSlot.repoPath}
                  </span>
                </p>
                <span
                  style={{
                    padding: "6px 14px",
                    border: "1px solid rgba(212, 163, 89, 0.5)",
                    color: "#f3ead8",
                    fontSize: "12px",
                  }}
                >
                  Загрузить иллюстрации...
                </span>
              </div>
            )}
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
                  1. [ИНТЕРФЕЙС: Белая проверка 2d6] Прослушать контроллер накопителя{" "}
                  {activeDrive.letter}
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
