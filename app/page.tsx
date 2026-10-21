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

interface ArtworkPreset {
  id: string;
  title: string;
  subtitle: string;
  seed: number;
  prompt: string;
  palette: [string, string, string, string];
  customDataUrl: string | null;
}

// ============================================================================
// 2. INDEXEDDB КЭШ ДЛЯ СОХРАНЕНИЯ СГЕНЕРИРОВАННЫХ И ВСТАВЛЕННЫХ ПОЛОТЕН
// ============================================================================

const DB_NAME = "DiscoCdiMasterCanvasDB";
const STORE_NAME = "paintings";

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

async function savePaintingToDB(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openArtDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dataUrl, key);
  } catch {}
}

async function loadPaintingsFromDB(): Promise<Record<string, string>> {
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
// 3. ЗВУКОВОЙ СИНТЕЗАТОР (WEB AUDIO API)
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
// 4. ЖИВОПИСНЫЙ ЗАДНИК ОКНА (<CANVAS>): МАСТИХИН, КАПЛИ ДОЖДЯ И СВЕЧЕНИЕ ХОЛСТА
// ============================================================================

function AtmosphericWindowBackdrop({
  artImgElement,
  palette,
  health,
}: {
  artImgElement: HTMLImageElement | null;
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

    // Генерируем 60 диагональных мазков мастихина для фактурного задника под правой панелью
    const strokes = Array.from({ length: 60 }, (_, i) => ({
      x: 340 + ((i * 173) % 940),
      y: (i * 97) % 820,
      w: 140 + ((i * 61) % 240),
      h: 28 + ((i * 29) % 55),
      angle: -0.48 + ((i % 7) - 3) * 0.08,
      color: palette[i % palette.length],
      alpha: 0.09 + (i % 5) * 0.025,
    }));

    // Капли ночного дождя Мартинеза, стекающие по стеклу на заднем плане
    const raindrops = Array.from({ length: 48 }, (_, i) => ({
      x: 380 + ((i * 139) % 880),
      y: (i * 83) % 800,
      len: 35 + (i % 6) * 18,
      speed: 1.4 + (i % 5) * 0.55,
      alpha: 0.08 + (i % 4) * 0.035,
    }));

    const render = () => {
      frame += 1;
      const W = canvas.width;
      const H = canvas.height;

      // 1. Базовый глубокий тон ночного Ревашоля
      const baseGrad = ctx.createLinearGradient(0, 0, W, H);
      baseGrad.addColorStop(0, "#141218");
      baseGrad.addColorStop(0.45, "#100e14");
      baseGrad.addColorStop(1, "#09080c");
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. Если портрет слева загружен — мягко проецируем его цветовую ауру на правую часть окна
      if (artImgElement && artImgElement.complete && artImgElement.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.filter = "blur(38px) saturate(1.45)";
        ctx.drawImage(artImgElement, 320, -40, W - 260, H + 80);
        ctx.restore();
      }

      // 3. Фактурные диагональные удары мастихином на заднике под таблицей S.M.A.R.T.
      ctx.save();
      strokes.forEach((s) => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.fillRect(-s.w * 0.5, -s.h * 0.5, s.w, s.h);
        // Тонкий светлый гребень масляной краски по верхнему краю мазка
        ctx.globalAlpha = s.alpha * 0.55;
        ctx.fillStyle = "#fff5e4";
        ctx.fillRect(-s.w * 0.5, -s.h * 0.5, s.w, 1.5);
        ctx.restore();
      });
      ctx.restore();

      // 4. Чертёжная радиолокационная сетка РГМ-41 и изолинии Сероты на заднем плане справа
      ctx.save();
      ctx.strokeStyle = "rgba(216, 195, 165, 0.065)";
      ctx.lineWidth = 1;
      // Концентрические дуги радиокомпьютера
      [160, 290, 430, 580].forEach((r, idx) => {
        ctx.beginPath();
        if (idx % 2 === 0) ctx.setLineDash([8, 6]);
        else ctx.setLineDash([]);
        ctx.arc(820, 390, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      // Координатные оси и засечки
      ctx.beginPath();
      ctx.moveTo(390, 390);
      ctx.lineTo(W, 390);
      ctx.moveTo(820, 0);
      ctx.lineTo(820, H);
      ctx.stroke();
      ctx.restore();

      // 5. Анимированные струи дождя по тёмному стеклу позади интерфейса
      ctx.save();
      ctx.strokeStyle = palette[2] || "#94a3b8";
      ctx.lineWidth = 1.2;
      raindrops.forEach((d) => {
        const curY = (d.y + frame * d.speed) % (H + 80) - 40;
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.moveTo(d.x, curY);
        ctx.lineTo(d.x - 6, curY + d.len);
        ctx.stroke();
      });
      ctx.restore();

      // 6. Глубокая виньетка по краям правого отсека для идеальной читаемости цифр
      const vignette = ctx.createRadialGradient(810, 390, 180, 810, 390, 620);
      vignette.addColorStop(0, "rgba(12, 10, 15, 0.25)");
      vignette.addColorStop(1, "rgba(8, 7, 10, 0.82)");
      ctx.fillStyle = vignette;
      ctx.fillRect(380, 0, W - 380, H);

      // Тревожный багровый отсвет при критическом состоянии диска
      if (health === "BAD") {
        const pulse = 0.08 + Math.sin(frame * 0.05) * 0.04;
        ctx.fillStyle = `rgba(220, 38, 38, ${pulse})`;
        ctx.fillRect(0, 0, W, H);
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [artImgElement, palette, health]);

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
// 5. ПРЕДУСТАНОВЛЕННЫЕ ПРОМПТЫ ИЛЛЮСТРАЦИЙ (РАСТРОВАЯ МАСЛЯНАЯ ЖИВОПИСЬ FLUX)
// ============================================================================

const INITIAL_ART_PRESETS: ArtworkPreset[] = [
  {
    id: "slot_1",
    title: "I. Ухмылка Кусто",
    subtitle: "Масляный портрет в духе референса с пальцем-пистолетом",
    seed: 41082,
    prompt:
      "expressive impasto digital oil painting portrait of a disheveled middle-aged detective with thick mutton chops beard connected to mustache, receding hairline, squinting tired warm eyes, asymmetric smirk, pointing finger gun at viewer, grey-green and reddish-ochre skin tones, white collar shirt and olive jacket, off-white painterly background with bold ochre brushwork, Aleksander Rostov Disco Elysium art style, thick palette knife strokes, no text, masterpiece",
    palette: ["#d9822b", "#4a6b5d", "#c77d6b", "#e8ebd5"],
    customDataUrl: null,
  },
  {
    id: "slot_2",
    title: "II. Нейрошторм",
    subtitle: "Психоделический протуберанец памяти из виска",
    seed: 77419,
    prompt:
      "expressive impasto oil painting of a disheveled bearded detective with head tilted back in agony, two fingers pressed to temple, dramatic explosion of neon magenta fiery orange golden yellow and cyan oil paint brushstrokes bursting from his forehead into dark indigo void, purple rim lighting on face, Aleksander Rostov Disco Elysium style, heavy brush texture, no text, no letters",
    palette: ["#ff007f", "#ff5400", "#00f5d4", "#7209b7"],
    customDataUrl: null,
  },
  {
    id: "slot_3",
    title: "III. Пьета Долорес",
    subtitle: "Светящиеся золотые лёгкие и лазурные тени",
    seed: 91205,
    prompt:
      "dark romantic impasto oil painting, ethereal glowing golden woman figure with luminous golden lungs inside her chest, holding a fallen bearded detective painted in deep Prussian blue and cold indigo shadows, warm golden light illuminating his face, crimson red oil paint drips on left side, Aleksander Rostov Disco Elysium oil painting style, no text, museum masterpiece",
    palette: ["#f59e0b", "#1e3a8a", "#dc2626", "#fef08a"],
    customDataUrl: null,
  },
  {
    id: "slot_4",
    title: "IV. Дозор Кима",
    subtitle: "Оранжевый бомбер и голубые лучи в церкви",
    seed: 33814,
    prompt:
      "expressive impasto oil painting portrait of a stoic East Asian detective wearing a bright orange bomber jacket with upturned collar and round glasses, dramatic cyan neon laser beams cutting through a dark wooden church with a golden stained glass window behind him, Aleksander Rostov Disco Elysium concept art style, bold brushwork, no text",
    palette: ["#e85d1a", "#00e5ff", "#eab308", "#1e293b"],
    customDataUrl: null,
  },
];

function buildPollinationsUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=640&height=960&seed=${seed}&nologo=true&model=flux`;
}

// ============================================================================
// 6. БАЗА НАКОПИТЕЛЕЙ И РЕПЛИК S.M.A.R.T.
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
    features: "S.M.A.R.T., TRIM, NCQ, VolatileWriteCache",
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
// 7. ГЛАВНЫЙ КОМПОНЕНТ «CRYSTALDISKINFO // DISCO ELYSIUM EDITION»
// ============================================================================

export default function CrystalDiskElysiumEdition() {
  const [drives, setDrives] = useState<DriveProfile[]>(INITIAL_DRIVES);
  const [activeDriveIdx, setActiveDriveIdx] = useState<number>(0);

  const [presets, setPresets] = useState<ArtworkPreset[]>(INITIAL_ART_PRESETS);
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const [imgLoading, setImgLoading] = useState<boolean>(true);
  const [loadedImgEl, setLoadedImgEl] = useState<HTMLImageElement | null>(null);

  const [showGenModal, setShowGenModal] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>(INITIAL_ART_PRESETS[0].prompt);

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
      skill: "КОНЦЕПТУАЛИЗАЦИЯ",
      category: "INT",
      difficulty: "Сложно: Успех",
      text: "Никаких детских треугольников и букв B'. Холст слева пишет растровые портреты маслом через нейросеть Flux, либо принимает любой твой оригинал по нажатию Ctrl + V.",
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const portraitImgRef = useRef<HTMLImageElement | null>(null);

  // Восстановление сохранённых полотен из IndexedDB
  useEffect(() => {
    loadPaintingsFromDB().then((savedMap) => {
      setPresets((prev) =>
        prev.map((slot, i) => {
          const saved = savedMap[`slot_${i + 1}`];
          return saved ? { ...slot, customDataUrl: saved } : slot;
        })
      );
    });
  }, []);

  // Вставка любого скопированного арта по Ctrl + V прямо в активный холст
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
            savePaintingToDB(slotKey, dataUrl);
            setPresets((prev) =>
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
  const currentPreset = presets[activeSlotIdx] || presets[0];

  const activeArtworkUrl =
    currentPreset.customDataUrl ||
    buildPollinationsUrl(currentPreset.prompt, currentPreset.seed);

  const handleSelectSlot = (idx: number) => {
    setActiveSlotIdx(idx);
    setCustomPrompt(presets[idx].prompt);
    setImgLoading(true);
    soundFX.playRelayClick();
  };

  // Перегенерация нового масляного полотна ИИ в текущем слоте
  const handleRegenerateAI = (newPrompt?: string) => {
    const nextSeed = Math.floor(Math.random() * 900000) + 10000;
    const slotKey = `slot_${activeSlotIdx + 1}`;
    savePaintingToDB(slotKey, "");
    setImgLoading(true);
    setPresets((prev) =>
      prev.map((s, idx) =>
        idx === activeSlotIdx
          ? {
              ...s,
              seed: nextSeed,
              prompt: newPrompt !== undefined ? newPrompt : s.prompt,
              customDataUrl: null,
            }
          : s
      )
    );
    setShowGenModal(false);
    soundFX.playCheckChord(true);
  };

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
        savePaintingToDB(slotKey, dataUrl);
        setPresets((prev) =>
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

    if (drv.healthStatus === "BAD") handleSelectSlot(2);
    else if (drv.healthStatus === "CAUTION") handleSelectSlot(1);

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
        background: `radial-gradient(circle at 18% 30%, ${currentPreset.palette[0]}33, transparent 55%), radial-gradient(circle at 82% 75%, ${currentPreset.palette[1]}33, transparent 55%), #070609`,
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
          transition: background 0.5s ease;
        }

        /* ОКНО УТИЛИТЫ CRYSTALDISKINFO SPECIAL EDITION */
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
        .menu-link-ai {
          background: rgba(212, 163, 89, 0.15);
          border: 1px solid rgba(212, 163, 89, 0.45);
          color: #f4d38a;
          font-weight: 600;
        }
        .menu-link-ai:hover {
          background: rgba(212, 163, 89, 0.28);
          border-color: #f4d38a;
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

        /* СЕТКА: СЛЕВА — ПОРТРЕТ МАСЛОМ ВО ВЕСЬ РОСТ, СПРАВА — ПРОЗРАЧНЫЙ СТЕНД НА ФОНЕ ЖИВОПИСНОГО ЗАДНИКА */
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

        /* Левая витрина с растровым полотном и текстурой кракелюра */
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
        .portrait-raster-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          display: block;
          filter: contrast(1.06) saturate(1.08);
          transition: opacity 0.35s ease;
        }
        /* Тонкая плёнка масляного холста поверх портрета */
        .oil-varnish-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 35%, transparent 55%, rgba(8, 7, 10, 0.65) 100%),
            repeating-linear-gradient(0deg, rgba(255,248,231,0.014) 0px, rgba(255,248,231,0.014) 1px, transparent 1px, transparent 3px);
        }
        .left-art-toolbar {
          position: relative;
          z-index: 5;
          padding: 8px 12px;
          background: linear-gradient(0deg, rgba(10, 8, 12, 0.92) 0%, rgba(10, 8, 12, 0.55) 70%, transparent 100%);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #dfd7c8;
        }

        /* Правая панель поверх живописного задника с дождём и мастихином */
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

        /* Двухколоночный паспорт диска на полупрозрачных дымчатых пластинах */
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

        /* Полупрозрачная таблица S.M.A.R.T. (фиксированная высота, чтобы никогда не резался низ!) */
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

        /* Нижняя каноничная текстовая панель навыков ZA/UM */
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
        {/* МНОГОСЛОЙНЫЙ ЖИВОПИСНЫЙ ЗАДНИК НА ВСЁ ОКНО (МАСТИХИН + ДОЖДЬ + ЧЕРТЁЖ РГМ) */}
        <AtmosphericWindowBackdrop
          artImgElement={loadedImgEl}
          palette={currentPreset.palette}
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
            <button onClick={() => handleRegenerateAI()} className="menu-link menu-link-ai">
              ✦ Сгенерировать новый мазок ИИ
            </button>
            <button onClick={() => setShowGenModal(true)} className="menu-link">
              Промпт холста...
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="menu-link">
              Свой файл (Ctrl+V)
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
            {presets.map((slot, idx) => (
              <button
                key={slot.id}
                onClick={() => handleSelectSlot(idx)}
                className={`slot-btn ${idx === activeSlotIdx ? "active" : ""}`}
              >
                {slot.title}
              </button>
            ))}
          </div>
        </nav>

        <div className="cdi-main-split">
          {/* ЛЕВАЯ КОЛОНКА: РАСТРОВАЯ МАСЛЯНАЯ ЖИВОПИСЬ ВЫСОКОГО РАЗРЕШЕНИЯ */}
          <aside className="left-artwork-pane">
            {/* Фактурный подмалёвок мастихином, пока проявляется растровый слой */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${currentPreset.palette[0]}55 0%, ${currentPreset.palette[1]}66 50%, #0e0c10 100%)`,
              }}
            />

            <img
              ref={portraitImgRef}
              key={activeArtworkUrl}
              src={activeArtworkUrl}
              alt={currentPreset.title}
              crossOrigin="anonymous"
              className="portrait-raster-img"
              style={{ opacity: imgLoading ? 0.15 : 1 }}
              onLoad={(e) => {
                setImgLoading(false);
                setLoadedImgEl(e.currentTarget);
              }}
              onError={() => setImgLoading(false)}
            />

            <div className="oil-varnish-layer" />

            {imgLoading && (
              <div
                className="serif-zaum"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px",
                  textAlign: "center",
                  color: "#f4d38a",
                  fontSize: "17px",
                  fontStyle: "italic",
                }}
              >
                <span>Проявление масляного слоя на холсте...</span>
              </div>
            )}

            <div className="left-art-toolbar">
              <span>{currentPreset.title}</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => handleRegenerateAI()}
                  style={{
                    background: "rgba(212, 163, 89, 0.2)",
                    border: "1px solid rgba(212, 163, 89, 0.55)",
                    color: "#f4d38a",
                    padding: "2px 8px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  ↻ Новый вариант
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: "rgba(18, 15, 22, 0.85)",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    color: "#e8e2d5",
                    padding: "2px 8px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  Файл / Ctrl+V
                </button>
              </div>
            </div>
          </aside>

          {/* ПРАВАЯ КОЛОНКА: ПРОЗРАЧНЫЙ ТЕХНИЧЕСКИЙ СТЕНД ПОВЕРХ ЖИВОПИСНОГО ЗАДНИКА */}
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

      {/* МОДАЛЬНОЕ ОКНО НАСТРОЙКИ ИИ-ГЕНЕРАТОРА ХОЛСТА */}
      {showGenModal && (
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
              maxWidth: "620px",
              background: "#16131c",
              border: "1px solid #d4a359",
              padding: "20px",
            }}
          >
            <h3
              className="serif-zaum"
              style={{ margin: "0 0 8px 0", fontSize: "20px", color: "#f4d38a" }}
            >
              Нейросетевой генератор масляного холста ({currentPreset.title})
            </h3>
            <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#ccc2b2" }}>
              Опишите портрет или сцену (на английском или русском) — генератор напишет новое полотно в технике мастихина Александра Ростова:
            </p>
            <textarea
              rows={5}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
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
              <button onClick={() => setShowGenModal(false)} className="menu-link">
                Отмена
              </button>
              <button
                onClick={() => handleRegenerateAI(customPrompt)}
                className="menu-link menu-link-ai"
              >
                ✦ Написать картину маслом
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО ИМПОРТА ОТЧЁТА СВОЕГО ПК */}
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
