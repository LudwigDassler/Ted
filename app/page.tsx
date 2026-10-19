"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

// ============================================================================
// 1. ТИПЫ ДАННЫХ S.M.A.R.T. И СИСТЕМЫ НАВЫКОВ DISCO ELYSIUM
// ============================================================================

type HealthState = "GOOD" | "CAUTION" | "BAD";
type ArtPieceId = "tequila" | "interfacing" | "inland" | "kim";

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
    category: "INT" | "PSY" | "FYS" | "MOT";
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
  moralePercent: number;
  temperature: number;
  totalReadsGB: number;
  totalWritesGB: number;
  powerOnCount: number;
  powerOnHours: number;
  rotationRate: string;
  introQuote: string;
  isRealHardware?: boolean;
  attributes: SmartAttribute[];
}

interface DialogueEntry {
  id: string;
  skill: string;
  category: "INT" | "PSY" | "FYS" | "MOT" | "SYS" | "YOU";
  difficulty?: string;
  checkResult?: "SUCCESS" | "FAILURE" | "INFO";
  text: string;
}

// ============================================================================
// 2. ЗВУКОВОЙ СИНТЕЗАТОР WEB AUDIO (ЩЕЛЧКИ HDD, КУБИКИ 2D6 И АККОРДЫ ПРОВЕРОК)
// ============================================================================

class DiscoAudioEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  /** Короткий механический щелчок позиционирования магнитной головки HDD */
  playActuatorClick(status: HealthState = "GOOD") {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = status === "BAD" ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(status === "BAD" ? 190 : 620, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.045);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }

  /** Звук переката двух костей и атмосферный аккорд в стиле British Sea Power */
  playDiceRoll(success: boolean) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Серия щелчков кубиков о сукно
      [0, 0.06, 0.13, 0.22].forEach((offset) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(800 + Math.random() * 500, now + offset);
        osc.frequency.exponentialRampToValueAtTime(120, now + offset + 0.025);
        g.gain.setValueAtTime(0.08, now + offset);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.025);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.03);
      });

      // Финальный аккорд (высокий духовой при успехе, вязкий низкий при провале)
      const chordFreqs = success ? [261.63, 329.63, 392.0, 523.25] : [110.0, 130.81, 155.56];
      chordFreqs.forEach((f) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = success ? "sine" : "sawtooth";
        osc.frequency.setValueAtTime(f, now + 0.28);
        g.gain.setValueAtTime(0.001, now + 0.28);
        g.gain.linearRampToValueAtTime(success ? 0.06 : 0.045, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 1.4);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now + 0.28);
        osc.stop(now + 1.45);
      });
    } catch {}
  }
}

const audioEngine = new DiscoAudioEngine();

// ============================================================================
// 3. ПРОЦЕДУРНЫЙ ХУДОЖНИК МАСЛЯНОЙ ЖИВОПИСИ НА HTML5 CANVAS (СТИЛЬ РОСТОВА)
// ============================================================================

function ImpastoOilPortrait({
  artId,
  health,
  temp,
}: {
  artId: ArtPieceId;
  health: HealthState;
  temp: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Детерминированный генератор для стабильных мазков мастихина
    let seed =
      (artId === "tequila" ? 101 : artId === "interfacing" ? 202 : artId === "inland" ? 303 : 404) +
      (health === "GOOD" ? 1 : health === "CAUTION" ? 2 : 3);
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // Вспомогательная функция: густой текстурный мазок кисти / мастихина
    const paintStroke = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      width: number,
      color: string,
      alpha = 0.85
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(
        (x1 + x2) / 2 + (rand() - 0.5) * 14,
        (y1 + y2) / 2 + (rand() - 0.5) * 14,
        x2,
        y2
      );
      ctx.stroke();

      // Светлый гребень масляной краски по краю мазка (импасто)
      ctx.globalAlpha = alpha * 0.35;
      ctx.lineWidth = Math.max(1, width * 0.22);
      ctx.strokeStyle = "#fff5e4";
      ctx.stroke();
      ctx.restore();
    };

    // 1. Грунтовка холста (глубокий умбристый подмалёвок)
    ctx.fillStyle = "#0e0c0a";
    ctx.fillRect(0, 0, W, H);

    // Палитра фона в зависимости от состояния диска и температуры
    const bgPalette =
      health === "GOOD"
        ? ["#132a28", "#1f4e48", "#2d6e66", "#c47d2b", "#241c18"]
        : health === "CAUTION"
        ? ["#2b1911", "#613214", "#b85d19", "#d99326", "#1c1613"]
        : ["#260b0e", "#591119", "#9e1f28", "#e03c31", "#140b0d"];

    // 2. Экспрессионистские фоновые плоскости мастихином
    for (let i = 0; i < 65; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const angle = -0.65 + (rand() - 0.5) * 0.8;
      const len = 45 + rand() * 90;
      const col = bgPalette[Math.floor(rand() * bgPalette.length)];
      paintStroke(
        x,
        y,
        x + Math.cos(angle) * len,
        y + Math.sin(angle) * len,
        14 + rand() * 24,
        col,
        0.65
      );
    }

    // 3. Светящийся нимб (Корона мыслей Disco Elysium позади головы)
    const haloColor =
      temp >= 55 || health === "BAD"
        ? "#ff3b28"
        : health === "CAUTION"
        ? "#f2a93b"
        : "#68c7b7";

    ctx.save();
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.42, 12, W * 0.5, H * 0.42, 118);
    grad.addColorStop(0, haloColor + "66");
    grad.addColorStop(0.6, haloColor + "22");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Рваная золотая дуга нимба
    ctx.strokeStyle = haloColor;
    ctx.lineWidth = 3.5;
    ctx.globalAlpha = 0.85;
    for (let a = 0; a < Math.PI * 2; a += 0.32) {
      if (rand() > 0.2) {
        ctx.beginPath();
        ctx.arc(W * 0.5, H * 0.42, 78 + (rand() - 0.5) * 5, a, a + 0.22);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ========================================================================
    // СЮЖЕТ 1: «ТЕКИЛА САНСЕТ» (Экспрессионистский портрет Гарри Дюбуа)
    // ========================================================================
    if (artId === "tequila") {
      // Мазки пиджака и поднятого воротника
      paintStroke(35, 290, 82, 185, 44, "#1b2824", 0.95);
      paintStroke(205, 290, 158, 185, 44, "#141f1c", 0.95);
      paintStroke(65, 290, 175, 290, 55, "#23332e", 0.95);

      // Белая рубашка ипылающий Ужасающий Галстук
      paintStroke(120, 182, 120, 265, 26, "#d8cbb8", 0.9);
      paintStroke(118, 192, 124, 285, 16, "#e04825", 0.95);
      paintStroke(122, 205, 114, 260, 9, "#f5b82e", 0.9);
      paintStroke(114, 225, 128, 245, 6, "#38bdf8", 0.85);

      // Шея в глубокой тени
      paintStroke(105, 148, 118, 192, 34, "#6e3b2c", 0.92);
      paintStroke(132, 148, 124, 192, 28, "#47231b", 0.92);

      // Лепка лица грубыми цветными плоскостями (охра, кадмий красный, синеватые тени)
      paintStroke(88, 72, 92, 152, 38, "#c98a63", 0.95);
      paintStroke(148, 72, 144, 152, 38, "#9c5c42", 0.95);
      paintStroke(118, 65, 118, 158, 42, "#d99f76", 0.95);

      // Алкогольный румянец и прожилки на скулах и переносице (фирменный красный мазок Ростова)
      paintStroke(78, 114, 112, 122, 22, "#c84638", 0.82);
      paintStroke(162, 114, 128, 122, 22, "#a33227", 0.82);
      paintStroke(118, 88, 121, 128, 15, "#d1493b", 0.9);
      paintStroke(108, 72, 134, 76, 16, "#e8b88a", 0.85); // Блик на лбу

      // Бакенбарды и густые усы «Выражения»
      paintStroke(72, 102, 78, 162, 24, "#2e1d14", 0.95);
      paintStroke(168, 102, 160, 162, 24, "#24160e", 0.95);
      paintStroke(82, 138, 120, 132, 18, "#382318", 0.96);
      paintStroke(158, 138, 120, 132, 18, "#291911", 0.96);

      // Безумная ухмылка «Выражения»
      paintStroke(98, 149, 142, 147, 8, "#170f0b", 0.95);
      paintStroke(104, 148, 134, 147, 4, "#e8dec8", 0.88);

      // Глубокие глазницы и лихорадочный взгляд
      paintStroke(84, 96, 108, 98, 12, "#1c1311", 0.95);
      paintStroke(132, 98, 156, 96, 12, "#1c1311", 0.95);
      paintStroke(92, 97, 99, 97, 5, health === "BAD" ? "#ff3b28" : "#7dd3fc", 0.98);
      paintStroke(140, 97, 147, 97, 5, health === "BAD" ? "#ff3b28" : "#7dd3fc", 0.98);

      // Растрёпанные вихри волос
      paintStroke(68, 82, 95, 42, 24, "#2b1c13", 0.94);
      paintStroke(95, 44, 148, 42, 26, "#3b271b", 0.94);
      paintStroke(145, 44, 174, 86, 22, "#1f140d", 0.94);
    }

    // ========================================================================
    // СЮЖЕТ 2: НАВЫК «ИНТЕРФЕЙС» (Сюрреалистичный многорукий бог машин)
    // ========================================================================
    if (artId === "interfacing") {
      // Золотые магнитные диски и концентрические дорожки
      ctx.save();
      ctx.strokeStyle = "#f2b441";
      ctx.lineWidth = 4;
      for (let r = 24; r <= 88; r += 16) {
        ctx.beginPath();
        ctx.arc(120, 112, r, 0.2, Math.PI * 1.75);
        ctx.stroke();
      }
      ctx.restore();

      // Абстрактная золотая голова-призма
      paintStroke(120, 48, 92, 125, 26, "#d99326", 0.92);
      paintStroke(120, 48, 148, 125, 26, "#9c6214", 0.92);
      paintStroke(96, 125, 144, 125, 28, "#f5c76b", 0.92);
      paintStroke(120, 75, 120, 155, 14, "#14100c", 0.95);

      // Веер механических пальцев/рук, считывающих дорожки диска
      const handAngles = [-0.9, -0.5, -0.15, 0.2, 0.55, 0.95];
      handAngles.forEach((ang, idx) => {
        const xStart = 120 + Math.sin(ang) * 25;
        const yStart = 240;
        const xMid = 120 + Math.sin(ang) * 75;
        const yMid = 165 - Math.cos(ang) * 25;
        const xTip = 120 + Math.sin(ang) * 95;
        const yTip = 115 - Math.cos(ang) * 55;
        paintStroke(
          xStart,
          yStart,
          xMid,
          yMid,
          12,
          idx % 2 === 0 ? "#e09f3e" : "#b87324",
          0.92
        );
        paintStroke(xMid, yMid, xTip, yTip, 6, "#fff0c2", 0.95);
      });
    }

    // ========================================================================
    // СЮЖЕТ 3: «ВНУТРЕННЯЯ ИМПЕРИЯ» (Сюрреалистическая туманность Сероты вместо головы)
    // ========================================================================
    if (artId === "inland") {
      // Строгий тёмный пиджак без головы
      paintStroke(38, 290, 82, 182, 46, "#1a1423", 0.96);
      paintStroke(202, 290, 158, 182, 46, "#120d18", 0.96);
      paintStroke(85, 185, 155, 185, 32, "#2a1e38", 0.95);

      // Взрыв фиолетово-бирюзовой Сероты и осколков памяти вместо лица
      const nebulaColors = ["#7b52ab", "#a67ce0", "#e0533c", "#48bfe3", "#f7d08a"];
      for (let i = 0; i < 38; i++) {
        const ang = (i / 38) * Math.PI * 2;
        const r1 = 8 + rand() * 25;
        const r2 = 45 + rand() * 58;
        paintStroke(
          120 + Math.cos(ang) * r1,
          108 + Math.sin(ang) * r1,
          120 + Math.cos(ang + 0.25) * r2,
          108 + Math.sin(ang + 0.25) * r2,
          8 + rand() * 14,
          nebulaColors[i % nebulaColors.length],
          0.85
        );
      }
      // Тёмное ядро пустоты в центре
      paintStroke(105, 95, 135, 118, 28, "#0d0912", 0.95);
      paintStroke(112, 104, 128, 104, 6, "#fff5e4", 0.98);
    }

    // ========================================================================
    // СЮЖЕТ 4: «КИМ КИЦУРАГИ» (Оранжевый бомбер и белые блики очков)
    // ========================================================================
    if (artId === "kim") {
      // Ярко-оранжевая куртка-бомбер мазками кадмия
      paintStroke(32, 290, 78, 178, 48, "#d95326", 0.96);
      paintStroke(208, 290, 162, 178, 48, "#9e3614", 0.96);
      paintStroke(65, 240, 175, 255, 42, "#e86838", 0.92);
      paintStroke(92, 172, 148, 172, 26, "#1f1d1b", 0.96); // Тёмный воротник

      // Скулы и лицо в полутени
      paintStroke(90, 72, 96, 154, 34, "#cfa07e", 0.95);
      paintStroke(150, 72, 144, 154, 34, "#8f6247", 0.95);
      paintStroke(120, 68, 120, 158, 36, "#deb392", 0.95);

      // Чёрные волосы и чёткий силуэт
      paintStroke(82, 66, 158, 64, 26, "#141312", 0.98);

      // Культовые очки Кима — два резких белых мазка мастихином
      paintStroke(82, 98, 114, 100, 16, "#f0f9ff", 0.98);
      paintStroke(126, 100, 158, 98, 16, "#bae6fd", 0.98);
      paintStroke(78, 98, 162, 98, 3, "#111111", 0.95);

      // Спокойная линия рта и поднятая бровь
      paintStroke(104, 142, 136, 141, 5, "#2b1b14", 0.95);
    }

    // 4. Финальные экспрессионистские брызги и царапины холста поверх портрета
    for (let s = 0; s < 18; s++) {
      const sx = rand() * W;
      const sy = rand() * H;
      paintStroke(
        sx,
        sy,
        sx + (rand() - 0.5) * 35,
        sy + (rand() - 0.5) * 35,
        2 + rand() * 3,
        s % 3 === 0 ? "#f4d35e" : s % 3 === 1 ? "#e0533c" : "#48bfe3",
        0.55
      );
    }
  }, [artId, health, temp]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={290}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        filter: "contrast(1.15) saturate(1.18)",
      }}
    />
  );
}

// ============================================================================
// 4. БАЗА ДАННЫХ ДИСКОВ (ДЕМО-ПРОФИЛИ + ПАРСЕР РЕАЛЬНОГО ЖЕЛЕЗА)
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
    moralePercent: 92,
    temperature: 41,
    totalReadsGB: 14820,
    totalWritesGB: 19450,
    powerOnCount: 1412,
    powerOnHours: 4890,
    rotationRate: "---- (Твердотельный NVMe)",
    introQuote:
      "Кремниевый кристалл тихо пульсирует на частоте четырёх линий PCIe 4.0. Память свежа, дорожки чисты, ни одного потерянного воспоминания.",
    attributes: [
      {
        id: "01",
        name: "Critical Warning",
        ruName: "Аварийный регистр флагов NVMe",
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
            text: "Байт 01h в спецификации NVM Express — это битовая маска катастроф: износ резервных ячеек, перегрев свыше порога или блокировка записи. Сейчас все биты хранят ледяное молчание (00h).",
          },
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Средне: Успех",
            text: "Внутри кристалла темно и спокойно. Никаких призраков удалённых системных папок.",
          },
        ],
      },
      {
        id: "02",
        name: "Composite Temperature",
        ruName: "Составная температура кристалла",
        current: 100,
        worst: 82,
        threshold: 85,
        rawDec: 41,
        unit: "°C",
        status: "GOOD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Легко: Успех",
            text: "41 °C — тёплая пульсация контроллера Elpis под медной пластиной радиатора. До теплового троттлинга ещё целых тридцать градусов запаса.",
          },
        ],
      },
      {
        id: "03",
        name: "Available Spare",
        ruName: "Доступный резерв запасных блоков",
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
            text: "Скрытый заводской пул резервных ячеек (Over-Provisioning) цел на 100%. Ни один блок флеш-памяти ещё не вышел из строя.",
          },
        ],
      },
      {
        id: "05",
        name: "Percentage Used",
        ruName: "Выработка гарантированного ресурса (TBW)",
        current: 96,
        worst: 96,
        threshold: 0,
        rawDec: 4,
        unit: "%",
        status: "GOOD",
        voices: [
          {
            skill: "ВОЛЯ",
            category: "PSY",
            difficulty: "Легко: Успех",
            text: "Израсходовано всего 4% ресурса затворов. Этот накопитель переживёт и это расследование, и следующую зиму в Ревашоле.",
          },
        ],
      },
      {
        id: "06",
        name: "Data Units Read",
        ruName: "Прочитано единиц данных (по 512 КБ)",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 29640120,
        status: "GOOD",
        voices: [
          {
            skill: "ВИЗУАЛЬНЫЙ АНАЛИЗ",
            category: "INT",
            difficulty: "Средне: Успех",
            text: "Чтение не истощает оксидный слой транзисторов. 14.8 терабайт прочитанных протоколов прошли без единого пробоя.",
          },
        ],
      },
      {
        id: "07",
        name: "Data Units Written",
        ruName: "Записано единиц данных (Хост-запись)",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 38900450,
        status: "GOOD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Средне: Успех",
            text: "19.4 ТБ записанных данных при гарантированном пороге 600 ТБ. Контроллер равномерно распределяет износ по всем банкам памяти.",
          },
        ],
      },
      {
        id: "0D",
        name: "Unsafe Shutdowns",
        ruName: "Аварийные отключения питания",
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
            text: "19 раз питание обрывалось без предупреждения. Короткие микроудары тока по таблице трансляции адресов, после которых прошивка каждый раз собирала себя заново.",
          },
        ],
      },
    ],
  },
  {
    id: "hdd_d",
    letter: "D:",
    name: "АРХИВ УЧАСТКА №41 (HDD)",
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
    moralePercent: 54,
    temperature: 52,
    totalReadsGB: 84120,
    totalWritesGB: 61390,
    powerOnCount: 5340,
    powerOnHours: 34820,
    rotationRate: "7200 RPM",
    introQuote:
      "Из глубины гермоблока доносится глухой металлический рокот. Шпиндель вращает магнитные блины уже четыре года подряд. В секторах завелась ржавчина.",
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
            text: "Сорок восемь выжженных кратеров на магнитном слое! Контроллер вывел их из обращения и перенаправил чтение в резервную зону, но головкам приходится судорожно метаться через весь радиус пластины.",
          },
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Средне: Успех",
            text: "Именно так умирает человеческая память. Сначала выпадают имена и даты, потом — целые годы жизни.",
          },
        ],
      },
      {
        id: "09",
        name: "Power-On Hours",
        ruName: "Общее время наработки во включённом состоянии",
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
            text: "Тридцать четыре тысячи восемьсот двадцать часов под гул кулеров в прокуренном подвале участка. За окном сменилось шестнадцать сезонов дождей, а шпиндель ни разу не остановился.",
          },
        ],
      },
      {
        id: "C5",
        name: "Current Pending Sector Count",
        ruName: "Нестабильные сектора (кандидаты на замену)",
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
            text: "Регистр C5h (14 секторов) — предвестник беды. Эти блоки уже не отдают контрольную сумму ECC при чтении. Любой файл, попавший в эти 14 секторов, намертво повесит поток ввода-вывода.",
          },
          {
            skill: "АВТОРИТЕТ",
            category: "PSY",
            difficulty: "Легко: Успех",
            text: "Немедленно эвакуируй отсюда ценные данные, детектив. Не жди, пока 14 нестабильных секторов превратятся в 1400.",
          },
        ],
      },
      {
        id: "C7",
        name: "UltraDMA CRC Error Count",
        ruName: "Ошибки контрольной суммы шлейфа SATA",
        current: 200,
        worst: 199,
        threshold: 0,
        rawDec: 7,
        status: "GOOD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Легко: Успех",
            text: "7 битых пакетов на физическом уровне SATA-кабеля. Подоткни разъём плотнее до щелчка металлической защёлки.",
          },
        ],
      },
    ],
  },
  {
    id: "pale_e",
    letter: "E:",
    name: "КАТУШКА «ФОРТ-МОРАЛЬ» (СЕРОТА)",
    model: "SEAGATE ST1000DM003-9YN162 1000.2 GB",
    capacityGB: 1000.2,
    firmware: "CC4B",
    serial: "Z1D4PALE0091",
    interfaceType: "Serial ATA",
    transferMode: "SATA/150 | SATA/600 (Аварийный сброс)",
    standard: "ATA8-ACS",
    features: "S.M.A.R.T. (КРИТИЧЕСКИЙ ОТКАЗ)",
    healthStatus: "BAD",
    healthPercent: 11,
    moralePercent: 18,
    temperature: 63,
    totalReadsGB: 192400,
    totalWritesGB: 144800,
    powerOnCount: 11204,
    powerOnHours: 68410,
    rotationRate: "7200 RPM (Биение вала)",
    introQuote:
      "Ритмичное «клац... клац... клац» режет тишину. Магнитный слой осыпается в бурую пыль. Серота уже внутри гермокамеры — она пожирает таблицу разделов.",
    attributes: [
      {
        id: "05",
        name: "Reallocated Sectors Count",
        ruName: "Переназначенные сектора (Таблица G-List переполнена)",
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
            text: "Нормализованное здоровье атрибута (12) рухнуло ниже заводского порога смерти (Threshold = 36). Резервная таблица G-List переполнена (2418 секторов) — диску больше некуда прятать дыры.",
          },
          {
            skill: "СУМРАЧНЫЙ",
            category: "FYS",
            difficulty: "Легко: Успех",
            text: "Он мёртв, братан. Он просто ещё по инерции крутит блины, потому что ты не выдернул из него разъём питания.",
          },
        ],
      },
      {
        id: "0A",
        name: "Spin Retry Count",
        ruName: "Неудачные попытки раскрутки шпинделя",
        current: 68,
        worst: 60,
        threshold: 97,
        rawDec: 43,
        status: "BAD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Средне: Успех",
            text: "43 срыва старта мотора. Загустевшая смазка клинит подшипник, а пусковой ток выжигает мосфеты на плате контроллера.",
          },
        ],
      },
      {
        id: "C6",
        name: "Uncorrectable Sector Count",
        ruName: "Неисправимые ошибки чтения (Потеря данных)",
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
            text: "Шестьсот двенадцать фрагментов реальности растворились в белом шуме Сероты. Там были фотографии, старые курсовые и чьи-то голоса. Теперь там только нули.",
          },
        ],
      },
    ],
  },
];

// Парсер отчёта CrystalDiskInfo / smartctl
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
        ruName: `Аппаратный регистр ${id}h (${name})`,
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
            text: `Считан живой регистр ${id}h (${name}) вашего диска: нормализованное здоровье ${cur} при пороге ${thr}, счётчик событий RAW = ${rawDec}.`,
          },
        ],
      });
    }
  }

  return {
    id: `real_${Date.now()}`,
    letter: "R:",
    name: `РЕАЛЬНЫЙ ДИСК ПК (${model.slice(0, 18)})`,
    model,
    capacityGB: 1000.0,
    firmware,
    serial,
    interfaceType,
    transferMode,
    standard: "Реальный дамп S.M.A.R.T.",
    features: "S.M.A.R.T., Аппаратная телеметрия",
    healthStatus,
    healthPercent,
    moralePercent: 90,
    temperature,
    totalReadsGB,
    totalWritesGB,
    powerOnCount,
    powerOnHours,
    rotationRate: "Аппаратный дамп",
    isRealHardware: true,
    introQuote: "Прямое подключение к контроллеру вашего компьютера установлено.",
    attributes: parsedAttrs.length > 0 ? parsedAttrs : INITIAL_DRIVES[0].attributes,
  };
}

// ============================================================================
// 5. ГЛАВНЫЙ КОМПОНЕНТ «DISCO DISK ELYSIUM»
// ============================================================================

export default function DiscoDiskElysium() {
  const [drives, setDrives] = useState<DriveProfile[]>(INITIAL_DRIVES);
  const [activeDriveIdx, setActiveDriveIdx] = useState<number>(0);
  const [artPiece, setArtPiece] = useState<ArtPieceId>("tequila");
  const [rawFormat, setRawFormat] = useState<"HEX16" | "DEC10">("HEX16");
  const [selectedAttrId, setSelectedAttrId] = useState<string>("01");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [tempOffset, setTempOffset] = useState<number>(0);

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [lastDice, setLastDice] = useState<[number, number] | null>(null);

  const [dialogueLog, setDialogueLog] = useState<DialogueEntry[]>([
    {
      id: "d1",
      skill: "ДРЕВНИЙ РЕПТИЛЬНЫЙ МОЗГ",
      category: "SYS",
      text: "Нет ничего. Только тёплая тьма внутри алюминиевого корпуса и мерное шуршание электронов по шине PCI Express. А потом — разряд конденсатора. Подача +12 Вольт.",
    },
    {
      id: "d2",
      skill: "ИНТЕРФЕЙС",
      category: "MOT",
      difficulty: "Легко: Успех",
      text: "Радиокомпьютер участка №41 завершил опрос шины S.M.A.R.T. Перед тобой три катушки памяти. Нажми на любую строчку регистра в центре или брось кубики внизу, чтобы начать допрос.",
    },
    {
      id: "d3",
      skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
      category: "PSY",
      difficulty: "Средне: Успех",
      text: "Осторожнее с диском [E:], детектив. От него веет Серотой и осыпавшимся оксидом железа.",
    },
  ]);

  const logBottomRef = useRef<HTMLDivElement | null>(null);

  // Автоподхват реальных дисков, если запущено внутри Electron-приложения (.exe / .deb / .dmg)
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

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dialogueLog]);

  const activeDrive = drives[activeDriveIdx] || drives[0];
  const effectiveTemp = activeDrive.temperature + tempOffset;

  const effectiveHealth: HealthState = useMemo(() => {
    if (activeDrive.healthStatus === "BAD" || effectiveTemp >= 60) return "BAD";
    if (activeDrive.healthStatus === "CAUTION" || effectiveTemp >= 50) return "CAUTION";
    return "GOOD";
  }, [activeDrive.healthStatus, effectiveTemp]);

  const toggleSound = () => {
    audioEngine.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
  };

  const handleSelectDrive = (idx: number) => {
    const drv = drives[idx];
    setActiveDriveIdx(idx);
    setTempOffset(0);
    audioEngine.playActuatorClick(drv.healthStatus);

    if (drv.healthStatus === "BAD") setArtPiece("inland");
    else if (drv.healthStatus === "CAUTION") setArtPiece("interfacing");

    setDialogueLog((prev) => [
      ...prev,
      {
        id: `sel_${Date.now()}`,
        skill: `КОММУТАТОР КАНАЛОВ // ТОМ [${drv.letter}]`,
        category: "SYS",
        text: `${drv.model} (${drv.capacityGB} ГБ). ${drv.introQuote}`,
      },
    ]);
  };

  const handleInspectAttribute = (attr: SmartAttribute) => {
    setSelectedAttrId(attr.id);
    audioEngine.playActuatorClick(attr.status);

    const newLines: DialogueEntry[] = [
      {
        id: `you_${Date.now()}`,
        skill: "ТЫ",
        category: "YOU",
        text: `«Проверить регистр [${attr.id}h] — ${attr.name} (${attr.ruName})»`,
      },
      ...attr.voices.map((v, idx) => ({
        id: `v_${Date.now()}_${idx}`,
        skill: v.skill,
        category: v.category,
        difficulty: v.difficulty,
        checkResult: "SUCCESS" as const,
        text: v.text,
      })),
    ];

    setDialogueLog((prev) => [...prev, ...newLines]);
  };

  const handleRollWhiteCheck = () => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setLastDice([d1, d2]);

    const mod = effectiveHealth === "GOOD" ? 3 : effectiveHealth === "CAUTION" ? 1 : -1;
    const sum = d1 + d2 + mod;
    const success = (d1 === 6 && d2 === 6) || (!(d1 === 1 && d2 === 1) && sum >= 8);

    audioEngine.playDiceRoll(success);

    setDialogueLog((prev) => [
      ...prev,
      {
        id: `you_roll_${Date.now()}`,
        skill: "ТЫ",
        category: "YOU",
        text: `🎲 [ИНТЕРФЕЙС: Белая проверка — Сложность 8] Приложить ладонь к корпусу ${activeDrive.letter} и прослушать резонанс дорожек.`,
      },
      {
        id: `res_roll_${Date.now()}`,
        skill: `ИНТЕРФЕЙС [Бросок: ${d1} + ${d2} ${mod >= 0 ? `+ ${mod}` : `- ${Math.abs(mod)}`} = ${sum}]`,
        category: "MOT",
        difficulty: success ? "УСПЕХ" : "ПРОВАЛ",
        checkResult: success ? "SUCCESS" : "FAILURE",
        text: success
          ? effectiveHealth === "GOOD"
            ? "Ты закрываешь глаза и сливаешься с шиной данных. Поток команд NVMe чист, как горный воздух над Инсулиндией: ни одной задержки чтения свыше 50 микросекунд."
            : "Пальцы улавливают предательскую дрожь шагового актуатора на дорожке 0x004F1A! Ты вовремя посылаешь команду принудительного сброса кэша (Flush Cache) — таблица разделов спасена от разрушения."
          : "Шум кулеров и гул трансформатора сливаются в неразборчивую какофонию. Твоя рука соскальзывает со стальной крышки корпуса, оставляя жирный след на заводской пломбе.",
      },
    ]);
  };

  const handleImportSubmit = () => {
    const parsed = parseRealSmartReport(importText);
    if (!parsed) return;
    const updated = [parsed, ...drives];
    setDrives(updated);
    setActiveDriveIdx(0);
    setShowImportModal(false);
    setImportText("");
    audioEngine.playDiceRoll(true);

    setDialogueLog((prev) => [
      ...prev,
      {
        id: `imp_${Date.now()}`,
        skill: "ЭНЦИКЛОПЕДИЯ",
        category: "INT",
        difficulty: "Легко: Успех",
        text: `Свежая перфокарта принята! Накопитель «${parsed.model}» (${parsed.temperature} °C, здоровье ${parsed.healthPercent}%) подключён к каналу [R:].`,
      },
    ]);
  };

  const formatRaw = (dec: number) =>
    rawFormat === "DEC10" ? dec.toLocaleString("ru-RU") : dec.toString(16).toUpperCase().padStart(12, "0");

  const getSkillColor = (cat: DialogueEntry["category"]) => {
    switch (cat) {
      case "INT":
        return "#48bfe3"; // Интеллект (Церулеум)
      case "PSY":
        return "#9d65c9"; // Психика (Аметист)
      case "FYS":
        return "#e0485a"; // Физика (Красный кармин)
      case "MOT":
        return "#f2a93b"; // Моторика (Кадмий жёлто-охристый)
      case "YOU":
        return "#e8dec8";
      default:
        return "#c29b61";
    }
  };

  // Расчёт сегментов Здоровья (10 делений) и Морали (10 делений) как в HUD Disco Elysium
  const healthPips = Math.max(1, Math.round(activeDrive.healthPercent / 10));
  const moralePips = Math.max(1, Math.round(activeDrive.moralePercent / 10));

  return (
    <div className="elysium-viewport">
      {/* SVG-ФИЛЬТР ФАКТУРЫ МАСЛЯНОГО ХОЛСТА И КРАКЕЛЮРА */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <filter id="canvas-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.045 0"
          />
          <feComposite in2="SourceGraphic" in="noise" operator="in" />
        </filter>
      </svg>

      {/* АВТОНОМНЫЕ СТИЛИ И ПОДГРУЗКА ШРИФТОВ OSWALD + CORMORANT GARAMOND */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,400;1,600&family=JetBrains+Mono:wght@400;600;700&family=Oswald:wght@500;600;700&display=swap');

        * { box-sizing: border-box; }
        body, html {
          margin: 0;
          padding: 0;
          background-color: #0d0b09;
          color: #e8dec8;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 16px;
          -webkit-font-smoothing: antialiased;
        }
        .font-oswald {
          font-family: 'Oswald', Impact, sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .font-mono {
          font-family: 'JetBrains Mono', Consolas, monospace;
          font-variant-numeric: tabular-nums;
        }
        .elysium-viewport {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          background:
            radial-gradient(circle at 14% 22%, rgba(217, 83, 38, 0.22), transparent 38%),
            radial-gradient(circle at 48% 10%, rgba(43, 110, 104, 0.24), transparent 42%),
            radial-gradient(circle at 82% 78%, rgba(123, 82, 171, 0.16), transparent 45%),
            linear-gradient(180deg, #16120e 0%, #0d0b09 100%);
        }
        /* Зернистая масляная плёнка поверх всего экрана */
        .elysium-viewport::after {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 40;
          background-image: radial-gradient(rgba(232, 222, 200, 0.04) 1px, transparent 0);
          background-size: 3px 3px;
        }

        /* ВЕРХНЯЯ ШАПКА В СТИЛЕ ДОСЬЕ МАРТИНЕЗА */
        .martinaise-topbar {
          background: linear-gradient(90deg, #171310 0%, #241b15 50%, #14110e 100%);
          border-bottom: 2px solid #8c6d46;
          padding: 10px 24px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.85);
          z-index: 20;
        }
        .brand-cluster {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .insulindian-seal {
          padding: 5px 12px;
          background: linear-gradient(135deg, #d95326, #9e2a1b);
          color: #fff5e4;
          font-weight: 700;
          font-size: 13px;
          border: 1px solid #f2b441;
          box-shadow: 3px 3px 0px #090706;
        }
        .main-heading {
          font-size: 22px;
          font-weight: 700;
          color: #f5ebd6;
          margin: 0;
          text-shadow: 2px 2px 0px #000;
        }

        /* Карточки выбора дисков (как потрёпанные кассеты/дела) */
        .cassette-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .cassette-tab {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          background: #1c1713;
          border: 1px solid #57442e;
          color: #c7b69e;
          cursor: pointer;
          transition: all 0.16s ease;
          box-shadow: 3px 3px 0px rgba(0,0,0,0.6);
        }
        .cassette-tab:hover {
          border-color: #d99326;
          transform: translateY(-1px);
        }
        .cassette-tab.active {
          background: linear-gradient(135deg, #3d2417 0%, #1f2b28 100%);
          border: 1.5px solid #f2b441;
          color: #fff;
          box-shadow: 0 0 18px rgba(242, 180, 65, 0.28), 3px 3px 0px #000;
        }

        /* Кнопки с экспрессионистской жёсткой тенью */
        . painterly-btn {
          padding: 7px 14px;
          background: #241d17;
          border: 1.5px solid #8c6d46;
          color: #f0e6d2;
          font-family: 'Oswald', sans-serif;
          font-size: 12.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 3px 3px 0px #090806;
          transition: all 0.14s ease;
        }
        .painterly-btn:hover {
          background: #d95326;
          color: #fff;
          border-color: #f5ebd6;
          transform: translate(-1px, -1px);
          box-shadow: 4px 4px 0px #090806;
        }

        /* ГЛАВНАЯ ТРЁХКОЛОНОЧНАЯ СЦЕНА DISCO ELYSIUM:
           1. Левый столб: Портрет маслом + Шкалы Здоровья/Морали + Навыки-индикаторы
           2. Центр: Паспорт диска и таблица регистров S.M.A.R.T.
           3. Правый столб: Классическая тёмная лента диалога Disco Elysium */
        .stage-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 280px 1fr 430px;
          min-height: calc(100vh - 68px);
        }
        @media (max-width: 1280px) {
          .stage-grid {
            grid-template-columns: 260px 1fr 370px;
          }
        }
        @media (max-width: 1024px) {
          .stage-grid {
            grid-template-columns: 1fr;
          }
        }

        /* 1. ЛЕВЫЙ СТОЛБ (HUD ПОРТРЕТА И MORALE/HEALTH BARS) */
        .left-hud {
          background: linear-gradient(180deg, rgba(24, 19, 15, 0.94), rgba(14, 11, 9, 0.98));
          border-right: 2px solid #57442e;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        /* Шкалы ЗДОРОВЬЕ (Красная) и МОРАЛЬ (Синяя) из Disco Elysium */
        .vital-bars {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px 12px;
          background: #14100d;
          border: 1px solid #57442e;
          box-shadow: inset 0 0 12px rgba(0,0,0,0.8);
        }
        .pip-row {
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          gap: 3px;
          height: 10px;
        }
        .pip-cell {
          background: #26201b;
          border: 1px solid #000;
        }
        .pip-health-on {
          background: linear-gradient(180deg, #ff5c4d, #b8252f);
          box-shadow: 0 0 6px rgba(224, 72, 90, 0.6);
        }
        .pip-morale-on {
          background: linear-gradient(180deg, #6ec1e4, #2b6ca3);
          box-shadow: 0 0 6px rgba(72, 191, 227, 0.6);
        }

        /* Рама картины маслом */
        .oil-frame {
          position: relative;
          height: 290px;
          border: 3px solid #a68253;
          outline: 1px solid #2b2117;
          box-shadow: 6px 8px 0px #080605, 0 0 28px rgba(0,0,0,0.85);
          background: #0e0c0a;
          overflow: hidden;
        }
        .oil-caption {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 6px 10px;
          background: linear-gradient(0deg, rgba(10,8,6,0.95) 0%, rgba(10,8,6,0.6) 75%, transparent 100%);
          text-align: center;
          font-size: 12px;
          color: #f2b441;
        }

        /* Две карточки-печати (ТЕХСОСТОЯНИЕ и ТЕМПЕРАТУРА) в стиле ромбов навыков */
        .tarot-card {
          padding: 12px 14px;
          border: 2px solid #8c6d46;
          box-shadow: 4px 4px 0px #080605;
          position: relative;
          overflow: hidden;
        }
        .tarot-good {
          background: linear-gradient(135deg, #173632 0%, #1f4e48 60%, #122422 100%);
          border-color: #68c7b7;
        }
        .tarot-caution {
          background: linear-gradient(135deg, #422310 0%, #7d4018 60%, #261409 100%);
          border-color: #f2a93b;
        }
        .tarot-bad {
          background: linear-gradient(135deg, #470f16 0%, #8a1c27 60%, #24070b 100%);
          border-color: #ff4d5e;
        }

        /* 2. ЦЕНТРАЛЬНАЯ ЧАСТЬ (ДОСЬЕ ПАСПОРТА + S.M.A.R.T.) */
        .center-dossier {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          overflow-y: auto;
        }
        .dossier-card {
          background:
            linear-gradient(135deg, rgba(33, 27, 22, 0.94), rgba(20, 17, 14, 0.96));
          border: 1.5px solid #6e5536;
          box-shadow: 6px 6px 0px #080705;
          padding: 18px 20px;
        }
        .passport-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 24px;
          margin-top: 12px;
        }
        @media (max-width: 720px) {
          .passport-grid { grid-template-columns: 1fr; }
        }
        .passport-line {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          border-bottom: 1px dotted rgba(166, 130, 83, 0.35);
          padding: 4px 0;
        }

        /* Таблица регистров S.M.A.R.T. с полосами износа */
        .smart-table-wrap {
          background: rgba(20, 16, 13, 0.95);
          border: 1.5px solid #6e5536;
          box-shadow: 6px 6px 0px #080705;
          flex: 1;
        }
        .disco-table {
          width: 100%;
          border-collapse: collapse;
        }
        .disco-table th {
          background: #241c16;
          color: #d4b88c;
          font-family: 'Oswald', sans-serif;
          font-size: 12px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 2px solid #6e5536;
        }
        .disco-table td {
          padding: 9px 12px;
          border-bottom: 1px solid rgba(110, 85, 54, 0.28);
        }
        .disco-table tr {
          cursor: pointer;
          transition: background 0.12s;
        }
        .disco-table tr:hover td {
          background: rgba(217, 83, 38, 0.18);
        }
        .disco-table tr.active-attr td {
          background: linear-gradient(90deg, rgba(217, 83, 38, 0.28), rgba(242, 180, 65, 0.14));
          border-top: 1px solid #f2b441;
          border-bottom: 1px solid #f2b441;
        }

        /* 3. ПРАВЫЙ СТОЛБ — КАНОНИЧНАЯ ТЁМНАЯ ЛЕНТА ДИАЛОГА DISCO ELYSIUM */
        .right-tape {
          background:
            radial-gradient(circle at 50% 0%, rgba(217, 83, 38, 0.12), transparent 35%),
            linear-gradient(180deg, #120f0c 0%, #0b0908 100%);
          border-left: 2px solid #6e5536;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 68px);
          position: sticky;
          top: 68px;
          box-shadow: -12px 0 36px rgba(0,0,0,0.85);
        }
        @media (max-width: 1024px) {
          .right-tape {
            height: 620px;
            position: static;
          }
        }
        .tape-header {
          padding: 12px 20px;
          background: #1b1511;
          border-bottom: 1.5px solid #57442e;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tape-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .dialogue-block {
          padding-left: 14px;
          border-left: 3px solid #d95326;
          animation: slideUp 0.22s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dialogue-actor {
          font-family: 'Oswald', sans-serif;
          font-size: 13.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .dialogue-check-tag {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          font-size: 14px;
          color: #a89984;
          margin-left: 8px;
        }
        .dialogue-prose {
          margin-top: 4px;
          font-size: 17.5px;
          line-height: 1.48;
          color: #f2ead8;
        }
        /* Красная полоса выбора действия внизу ленты (как в Disco Elysium) */
        .red-choice-box {
          padding: 16px 20px;
          background: #17120e;
          border-top: 2px solid #6e5536;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .red-dialogue-option {
          width: 100%;
          text-align: left;
          padding: 11px 14px;
          background: linear-gradient(90deg, #7a1c18 0%, #4a110e 100%);
          border: 1.5px solid #f2b441;
          color: #fff5e4;
          font-family: 'Cormorant Garamond', serif;
          font-size: 16.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 4px 4px 0px #060504;
          transition: all 0.15s ease;
        }
        .red-dialogue-option:hover {
          background: linear-gradient(90deg, #b82b24 0%, #7a1c18 100%);
          transform: translateX(3px);
        }
      `,
        }}
      />

      {/* ВЕРХНЯЯ ПАНЕЛЬ КАССЕТ ПАМЯТИ */}
      <header className="martinaise-topbar">
        <div className="brand-cluster">
          <span className="insulindian-seal font-oswald">РГМ // СЕКТОР 41</span>
          <h1 className="main-heading font-oswald">
            CrystalDisk // Elysium
          </h1>
        </div>

        <div className="cassette-strip">
          {drives.map((drv, idx) => {
            const color =
              drv.healthStatus === "GOOD"
                ? "#68c7b7"
                : drv.healthStatus === "CAUTION"
                ? "#f2a93b"
                : "#ff4d5e";
            return (
              <button
                key={drv.id}
                onClick={() => handleSelectDrive(idx)}
                className={`cassette-tab ${idx === activeDriveIdx ? "active" : ""}`}
              >
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    background: color,
                    boxShadow: `0 0 10px ${color}`,
                    transform: "rotate(45deg)",
                    display: "inline-block",
                  }}
                />
                <div style={{ textAlign: "left" }}>
                  <div className="font-oswald" style={{ fontSize: "13px", color: "#fff5e4" }}>
                    [{drv.letter}] {drv.healthPercent}% • {drv.temperature} °C
                  </div>
                  <div style={{ fontSize: "12px", color: "#b5a48b" }}>
                    {drv.name}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => setShowImportModal(true)} className="painterly-btn">
            + Загрузить дамп своего диска
          </button>
          <button
            onClick={() => setRawFormat((p) => (p === "HEX16" ? "DEC10" : "HEX16"))}
            className="painterly-btn font-mono"
          >
            {rawFormat === "HEX16" ? "RAW: 16 [HEX]" : "RAW: 10 [DEC]"}
          </button>
          <button onClick={toggleSound} className="painterly-btn">
            {soundEnabled ? "🔊 Звук: ВКЛ" : "🔇 Звук: ВЫКЛ"}
          </button>
        </div>
      </header>

      {/* ТРЁХКОЛОНОЧНАЯ СЦЕНА */}
      <div className="stage-grid">
        {/* 1. ЛЕВЫЙ СТОЛБ: ШКАЛЫ ЗДОРОВЬЯ/МОРАЛИ + ХОЛСТ МАСЛОМ + ТАРО-ИНДИКАТОРЫ */}
        <aside className="left-hud">
          {/* Каноничные шкалы Здоровья и Морали */}
          <div className="vital-bars">
            <div>
              <div
                className="font-oswald"
                style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#ff756b", marginBottom: "3px" }}
              >
                <span>Здоровье кремния (TBW)</span>
                <span className="font-mono">{activeDrive.healthPercent}%</span>
              </div>
              <div className="pip-row">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className={`pip-cell ${i < healthPips ? "pip-health-on" : ""}`} />
                ))}
              </div>
            </div>

            <div>
              <div
                className="font-oswald"
                style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6ec1e4", marginBottom: "3px" }}
              >
                <span>Мораль контроллера</span>
                <span className="font-mono">{activeDrive.moralePercent}%</span>
              </div>
              <div className="pip-row">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className={`pip-cell ${i < moralePips ? "pip-morale-on" : ""}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Живописный холст маслом (<canvas>) */}
          <div className="oil-frame">
            <ImpastoOilPortrait artId={artPiece} health={effectiveHealth} temp={effectiveTemp} />
            <div className="oil-caption font-oswald">
              {artPiece === "tequila"
                ? "Гарри «Текила Сансет»"
                : artPiece === "interfacing"
                ? "Навык: Интерфейс"
                : artPiece === "inland"
                ? "Внутренняя Империя"
                : "Лейтенант Ким Кицураги"}
            </div>
          </div>

          {/* Переключатель картин маслом */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {[
              { id: "tequila", label: "Текила Сансет" },
              { id: "interfacing", label: "Интерфейс" },
              { id: "inland", label: "Империя" },
              { id: "kim", label: "Ким Кицураги" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setArtPiece(p.id as ArtPieceId)}
                className="painterly-btn"
                style={{
                  padding: "5px 6px",
                  fontSize: "11px",
                  background: artPiece === p.id ? "#d95326" : "#241d17",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Крупная печать Техсостояния */}
          <div
            className={`tarot-card ${
              effectiveHealth === "GOOD"
                ? "tarot-good"
                : effectiveHealth === "CAUTION"
                ? "tarot-caution"
                : "tarot-bad"
            }`}
          >
            <div className="font-oswald" style={{ fontSize: "11px", color: "#e8dec8", opacity: 0.8 }}>
              Вердикт техсостояния
            </div>
            <div className="font-oswald" style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>
              {effectiveHealth === "GOOD"
                ? "БЕЗУПРЕЧНО"
                : effectiveHealth === "CAUTION"
                ? "ТРЕВОГА (ИЗНОС)"
                : "РАСПАД В СЕРОТУ"}
            </div>
            <div className="font-mono" style={{ fontSize: "18px", color: "#f2b441", fontWeight: 700 }}>
              Ресурс: {activeDrive.healthPercent} %
            </div>
          </div>

          {/* Крупная печать Температуры */}
          <div
            className={`tarot-card ${
              effectiveTemp < 50 ? "tarot-good" : effectiveTemp < 60 ? "tarot-caution" : "tarot-bad"
            }`}
          >
            <div className="font-oswald" style={{ fontSize: "11px", color: "#e8dec8", opacity: 0.8 }}>
              Термодинамика корпуса
            </div>
            <div className="font-mono" style={{ fontSize: "26px", fontWeight: 700, color: "#fff" }}>
              {effectiveTemp} °C
            </div>
            <input
              type="range"
              min={-10}
              max={28}
              value={tempOffset}
              onChange={(e) => setTempOffset(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#d95326", marginTop: "6px", cursor: "pointer" }}
            />
            <div style={{ fontSize: "12px", color: "#d4b88c", fontStyle: "italic" }}>
              Ползунок теплового стресса ({tempOffset >= 0 ? `+${tempOffset}` : tempOffset} °C)
            </div>
          </div>
        </aside>

        {/* 2. ЦЕНТРАЛЬНАЯ ЧАСТЬ: ПАСПОРТ НАКОПИТЕЛЯ + ТАБЛИЦА S.M.A.R.T. */}
        <main className="center-dossier">
          <div className="dossier-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", borderBottom: "2px solid #6e5536", paddingBottom: "8px" }}>
              <h2 className="font-oswald" style={{ margin: 0, fontSize: "22px", color: "#f2b441" }}>
                {activeDrive.model} ({activeDrive.capacityGB} ГБ)
              </h2>
              <span className="font-mono" style={{ fontSize: "12px", color: "#68c7b7" }}>
                {activeDrive.isRealHardware ? "● РЕАЛЬНОЕ ОБОРУДОВАНИЕ ПК" : "● КАССЕТА ПРОТОКОЛА РГМ"}
              </span>
            </div>

            <p style={{ margin: "10px 0 6px 0", fontSize: "17px", fontStyle: "italic", color: "#e8dec8" }}>
              «{activeDrive.introQuote}»
            </p>

            <div className="passport-grid">
              <div className="passport-line">
                <span style={{ color: "#b5a48b" }}>Прошивка (Firmware):</span>
                <span className="font-mono" style={{ fontWeight: 700 }}>{activeDrive.firmware}</span>
              </div>
              <div className="passport-line">
                <span style={{ color: "#b5a48b" }}>Хост-чтение (Всего):</span>
                <span className="font-mono" style={{ fontWeight: 700 }}>{activeDrive.totalReadsGB.toLocaleString("ru-RU")} ГБ</span>
              </div>
              <div className="passport-line">
                <span style={{ color: "#b5a48b" }}>Серийный номер:</span>
                <span className="font-mono" style={{ fontWeight: 700 }}>{activeDrive.serial}</span>
              </div>
              <div className="passport-line">
                <span style={{ color: "#b5a48b" }}>Хост-запись (Всего):</span>
                <span className="font-mono" style={{ fontWeight: 700 }}>{activeDrive.totalWritesGB.toLocaleString("ru-RU")} ГБ</span>
              </div>
              <div className="passport-line">
                <span style={{ color: "#b5a48b" }}>Шина / Интерфейс:</span>
                <span className="font-mono" style={{ fontWeight: 700 }}>{activeDrive.interfaceType}</span>
              </div>
              <div className="passport-line">
                <span style={{ color: "#b5a48b" }}>Циклов включения:</span>
                <span className="font-mono" style={{ fontWeight: 700 }}>{activeDrive.powerOnCount.toLocaleString("ru-RU")} раз</span>
              </div>
              <div className="passport-line">
                <span style={{ color: "#b5a48b" }}>Режим передачи:</span>
                <span className="font-mono" style={{ fontWeight: 700 }}>{activeDrive.transferMode}</span>
              </div>
              <div className="passport-line">
                <span style={{ color: "#b5a48b" }}>Часов под напряжением:</span>
                <span className="font-mono" style={{ fontWeight: 700 }}>
                  {activeDrive.powerOnHours.toLocaleString("ru-RU")} ч ({Math.round(activeDrive.powerOnHours / 24)} сут.)
                </span>
              </div>
            </div>
          </div>

          {/* ТАБЛИЦА АТРИБУТОВ S.M.A.R.T. */}
          <div className="smart-table-wrap">
            <div style={{ padding: "10px 16px", background: "#241c16", borderBottom: "1.5px solid #6e5536", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="font-oswald" style={{ fontSize: "14px", color: "#f5ebd6" }}>
                Ведомость регистров самодиагностики S.M.A.R.T. (кликните по строке для допроса)
              </span>
              <span className="font-mono" style={{ fontSize: "12px", color: "#f2b441" }}>
                Регистр: {selectedAttrId}h
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="disco-table">
                <thead>
                  <tr>
                    <th style={{ width: "42px" }}>Печать</th>
                    <th style={{ width: "50px" }}>ID</th>
                    <th>Атрибут / Физический смысл регистра</th>
                    <th style={{ width: "130px" }}>Запас прочности</th>
                    <th style={{ textAlign: "right" }}>Тек.</th>
                    <th style={{ textAlign: "right" }}>Худш.</th>
                    <th style={{ textAlign: "right" }}>Порог</th>
                    <th style={{ textAlign: "right" }}>Счётчик RAW</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDrive.attributes.map((attr) => {
                    const color =
                      attr.status === "GOOD"
                        ? "#68c7b7"
                        : attr.status === "CAUTION"
                        ? "#f2a93b"
                        : "#ff4d5e";
                    const pct = Math.min(100, Math.max(8, attr.current));
                    return (
                      <tr
                        key={attr.id}
                        onClick={() => handleInspectAttribute(attr)}
                        className={selectedAttrId === attr.id ? "active-attr" : ""}
                      >
                        <td style={{ textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: "11px",
                              height: "11px",
                              background: color,
                              transform: "rotate(45deg)",
                              boxShadow: `0 0 8px ${color}`,
                            }}
                          />
                        </td>
                        <td className="font-mono" style={{ fontWeight: 700, color: "#f2b441" }}>
                          {attr.id}
                        </td>
                        <td>
                          <div className="font-oswald" style={{ fontSize: "14px", color: "#fff5e4" }}>
                            {attr.name}
                          </div>
                          <div style={{ fontSize: "14px", color: "#b5a48b", fontStyle: "italic" }}>
                            {attr.ruName}
                          </div>
                        </td>
                        <td>
                          <div style={{ height: "8px", background: "#120e0b", border: "1px solid #4a3a28" }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: color,
                              }}
                            />
                          </div>
                        </td>
                        <td className="font-mono" style={{ textAlign: "right", fontSize: "13px" }}>
                          {attr.current}
                        </td>
                        <td className="font-mono" style={{ textAlign: "right", fontSize: "13px", color: "#a89984" }}>
                          {attr.worst}
                        </td>
                        <td className="font-mono" style={{ textAlign: "right", fontSize: "13px", color: "#8c7b65" }}>
                          {attr.threshold}
                        </td>
                        <td
                          className="font-mono"
                          style={{
                            textAlign: "right",
                            fontSize: "13px",
                            fontWeight: 700,
                            color,
                          }}
                        >
                          {formatRaw(attr.rawDec)}
                          {attr.unit && rawFormat === "DEC10" ? ` ${attr.unit}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* 3. ПРАВЫЙ СТОЛБ: КАНОНИЧНАЯ ЛЕНТА ГОЛОСОВ DISCO ELYSIUM */}
        <aside className="right-tape">
          <div className="tape-header">
            <div>
              <div className="font-oswald" style={{ fontSize: "14px", color: "#f2b441" }}>
                Лента внутреннего диалога
              </div>
              <div style={{ fontSize: "13px", color: "#a89984", fontStyle: "italic" }}>
                Голоса навыков препарируют телеметрию диска
              </div>
            </div>
            <button
              onClick={() => setDialogueLog((p) => p.slice(-1))}
              className="painterly-btn"
              style={{ padding: "4px 10px", fontSize: "11px" }}
            >
              Очистить
            </button>
          </div>

          <div className="tape-scroll">
            {dialogueLog.map((entry) => (
              <div
                key={entry.id}
                className="dialogue-block"
                style={{ borderLeftColor: getSkillColor(entry.category) }}
              >
                <div>
                  <span
                    className="dialogue-actor"
                    style={{ color: getSkillColor(entry.category) }}
                  >
                    {entry.skill}
                  </span>
                  {entry.difficulty && (
                    <span className="dialogue-check-tag">[{entry.difficulty}]</span>
                  )}
                </div>
                <div className="dialogue-prose">— {entry.text}</div>
              </div>
            ))}
            <div ref={logBottomRef} />
          </div>

          {/* Нижняя панель выбора реплики и Белой проверки 2d6 */}
          <div className="red-choice-box">
            <button onClick={handleRollWhiteCheck} className="red-dialogue-option">
              1. 🎲 [ИНТЕРФЕЙС — Средне 8] Приложить ладонь к корпусу [{activeDrive.letter}] и прослушать биение секторов.
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: "#b5a48b" }}>
              <span>Модификатор зависит от здоровья носителя</span>
              {lastDice && (
                <span className="font-mono" style={{ color: "#f2b441", fontWeight: 700 }}>
                  Кости: [{lastDice[0]}] [{lastDice[1]}]
                </span>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ИМПОРТА НАСТОЯЩЕГО ОТЧЁТА С ВАШЕГО ПК */}
      {showImportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.82)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "680px",
              background: "#1a1511",
              border: "2px solid #d99326",
              boxShadow: "10px 10px 0px #000",
              padding: "24px",
            }}
          >
            <h3 className="font-oswald" style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#f2b441" }}>
              Загрузка реальной перфоленты S.M.A.R.T. с вашего ПК
            </h3>
            <p style={{ margin: "0 0 12px 0", fontSize: "15px", color: "#e8dec8" }}>
              Чтобы загрузить данные своего диска прямо в браузере, откройте обычный CrystalDiskInfo, нажмите `Ctrl + C` (или выполните в терминале `smartctl -a /dev/nvme0`) и вставьте текст ниже:
            </p>
            <textarea
              rows={9}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                "Model : Samsung SSD 980 1TB\nFirmware : 3B4QFXO7\nTemperature : 39 C\nHealth Status : Good (99 %)\n01 100 100 0 000000000000 Raw Read Error Rate\n05 100 100 10 000000000002 Reallocated Sectors Count"
              }
              className="font-mono"
              style={{
                width: "100%",
                background: "#0d0b09",
                border: "1px solid #6e5536",
                color: "#f5ebd6",
                padding: "10px",
                fontSize: "12.5px",
                marginBottom: "14px",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setShowImportModal(false)} className="painterly-btn">
                Отмена
              </button>
              <button onClick={handleImportSubmit} className="painterly-btn">
                Считать перфоленту
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
