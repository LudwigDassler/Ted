"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

// ============================================================================
// 1. ТИПЫ ДАННЫХ CRYSTALDISKINFO + DISCO ELYSIUM
// ============================================================================

type HealthState = "GOOD" | "CAUTION" | "BAD";
type VisualThemeId = "mind_explosion" | "church_lasers" | "custom_1" | "custom_2";

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
  category: "INT" | "PSY" | "FYS" | "MOT" | "TIE" | "YOU";
  difficulty?: string;
  text: string;
}

// ============================================================================
// 2. АТМОСФЕРНЫЙ ЗВУКОВОЙ СИНТЕЗАТОР (WEB AUDIO API)
// ============================================================================

class ElysiumSound {
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

  playClick(status: HealthState = "GOOD") {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = status === "BAD" ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(status === "BAD" ? 160 : 540, t);
      osc.frequency.exponentialRampToValueAtTime(65, t + 0.05);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.055);
    } catch {}
  }

  playPrismChord(success: boolean) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const notes = success ? [220, 277.18, 329.63, 440, 554.37] : [110, 116.54, 164.81];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = success ? "triangle" : "sawtooth";
        osc.frequency.setValueAtTime(freq, t + i * 0.04);
        g.gain.setValueAtTime(0.001, t + i * 0.04);
        g.gain.linearRampToValueAtTime(success ? 0.055 : 0.04, t + i * 0.04 + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 1.6);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t + i * 0.04);
        osc.stop(t + 1.65);
      });
    } catch {}
  }
}

const soundFX = new ElysiumSound();

// ============================================================================
// 3. ПРОЦЕДУРНЫЙ 60-FPS ХОЛСТ: «ВЗРЫВ СОЗНАНИЯ» (image_542721) И «ЛАЗЕРЫ В ЦЕРКВИ» (image_54817e)
// ============================================================================

function PsychedelicArtworkCanvas({
  themeId,
  customUrl,
  health,
  temp,
}: {
  themeId: VisualThemeId;
  customUrl: string | null;
  health: HealthState;
  temp: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (customUrl) return; // Если пользователь загрузил свой арт, рендерим <img>
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    // Предварительно генерируем осколки психоделического взрыва из виска
    const shards = Array.from({ length: 85 }, (_, i) => {
      // Веер лучей бьёт из точки виска (x=245, y=310) влево-вверх, как на арте @AstriaNabla
      const baseAngle = -Math.PI * 0.72 + (i / 85) * (Math.PI * 0.62);
      const length = 110 + ((i * 73) % 340);
      const spread = 0.025 + ((i * 19) % 10) * 0.008;
      const palette = [
        "#ff007f", // Неоновая фуксия
        "#ff4d00", // Огненно-оранжевый
        "#ffbe0b", // Кислотно-золотой
        "#00f5d4", // Электрический циан
        "#8338ec", // Ультрафиолет
        "#ff5d8f", // Розовый кадмий
        "#3a86ff", // Кобальт
      ];
      return {
        angle: baseAngle,
        length,
        spread,
        color: palette[i % palette.length],
        speed: 0.008 + (i % 7) * 0.003,
        offset: i * 0.4,
      };
    });

    const render = () => {
      frame += 1;
      const W = canvas.width;
      const H = canvas.height;
      const t = frame * 0.02;

      if (themeId === "mind_explosion") {
        // ====================================================================
        // СЦЕНА 1: «ПСИХОДЕЛИЧЕСКИЙ ВЗРЫВ СОЗНАНИЯ (B' B'' B''')»
        // ====================================================================
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, "#120724");
        bgGrad.addColorStop(0.5, "#0b0716");
        bgGrad.addColorStop(1, "#06040a");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        const originX = 242;
        const originY = 305;

        // 1. Фоновое зарево взрыва
        const burstGlow = ctx.createRadialGradient(originX - 60, originY - 90, 10, originX - 60, originY - 90, 320);
        burstGlow.addColorStop(0, "rgba(255, 190, 11, 0.95)");
        burstGlow.addColorStop(0.25, "rgba(255, 0, 127, 0.65)");
        burstGlow.addColorStop(0.6, "rgba(131, 56, 236, 0.28)");
        burstGlow.addColorStop(1, "transparent");
        ctx.fillStyle = burstGlow;
        ctx.fillRect(0, 0, W, H);

        // 2. Острые живописные осколки-мазки, вылетающие из головы Гарри
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        shards.forEach((sh, idx) => {
          const pulse = Math.sin(t * 1.5 + sh.offset) * 14;
          const a = sh.angle + Math.sin(t * 0.7 + idx) * 0.018;
          const r = sh.length + pulse + (temp > 50 ? 35 : 0);

          const x1 = originX + Math.cos(a) * 12;
          const y1 = originY + Math.sin(a) * 12;
          const x2 = originX + Math.cos(a - sh.spread) * r;
          const y2 = originY + Math.sin(a - sh.spread) * r;
          const x3 = originX + Math.cos(a + sh.spread) * (r * 0.92);
          const y3 = originY + Math.sin(a + sh.spread) * (r * 0.92);

          ctx.fillStyle = sh.color;
          ctx.globalAlpha = 0.78;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x3, y3);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();

        // 3. Белые меловые дуги и математические символы B', B'', B''' справа вверху
        ctx.save();
        ctx.strokeStyle = "rgba(168, 218, 220, 0.42)";
        ctx.lineWidth = 2;
        [0, 1, 2].forEach((arcIdx) => {
          ctx.beginPath();
          ctx.moveTo(originX, originY - 10);
          ctx.quadraticCurveTo(
            originX + 60,
            150 - arcIdx * 35,
            W - 25,
            40 + arcIdx * 55
          );
          ctx.stroke();
        });
        ctx.font = "italic bold 26px Georgia, serif";
        ctx.fillStyle = "rgba(216, 243, 220, 0.78)";
        ctx.fillText("B'", 295, 130 + Math.sin(t) * 4);
        ctx.font = "italic bold 22px Georgia, serif";
        ctx.fillText("B''", 355, 82 + Math.cos(t) * 4);
        ctx.font = "italic bold 19px Georgia, serif";
        ctx.fillText("B'''", 338, 185 + Math.sin(t * 1.2) * 3);
        ctx.restore();

        // 4. Детальный экспрессионистский силуэт Гарри с запрокинутой головой и пальцами у виска
        ctx.save();
        // Плечи и пиджак в фиолетово-пурпурном контровом свете
        ctx.fillStyle = "#190e26";
        ctx.beginPath();
        ctx.moveTo(25, H);
        ctx.lineTo(68, 515);
        ctx.lineTo(155, 445);
        ctx.lineTo(295, 455);
        ctx.lineTo(395, H);
        ctx.closePath();
        ctx.fill();

        // Лацканы пиджака с розово-лиловым рефлексом от взрыва
        ctx.fillStyle = "#4a1c5c";
        ctx.beginPath();
        ctx.moveTo(95, 510);
        ctx.lineTo(165, 438);
        ctx.lineTo(195, 560);
        ctx.lineTo(118, 580);
        ctx.closePath();
        ctx.fill();

        // Запрокинутая шея с резкой светотенью
        ctx.fillStyle = "#5e2563";
        ctx.beginPath();
        ctx.moveTo(162, 375);
        ctx.lineTo(255, 390);
        ctx.lineTo(245, 495);
        ctx.lineTo(155, 465);
        ctx.closePath();
        ctx.fill();

        // Яркий розовый блик на гортани и скуле от вспышки мозга
        ctx.fillStyle = "#f77f8b";
        ctx.beginPath();
        ctx.moveTo(164, 382);
        ctx.lineTo(198, 405);
        ctx.lineTo(185, 472);
        ctx.lineTo(158, 450);
        ctx.closePath();
        ctx.fill();

        // Голова, запрокинутая назад (скулы, нос, надбровные дуги)
        ctx.fillStyle = "#8a387c";
        ctx.beginPath();
        ctx.moveTo(152, 338);
        ctx.lineTo(195, 272);
        ctx.lineTo(268, 268);
        ctx.lineTo(302, 335);
        ctx.lineTo(275, 412);
        ctx.lineTo(165, 392);
        ctx.closePath();
        ctx.fill();

        // Ослепительно-розовый и золотой свет на лбу, щеке и переносице
        ctx.fillStyle = "#ffb3ab";
        ctx.beginPath();
        ctx.moveTo(185, 278);
        ctx.lineTo(246, 275);
        ctx.lineTo(258, 345);
        ctx.lineTo(212, 365);
        ctx.lineTo(175, 325);
        ctx.closePath();
        ctx.fill();

        // Закатившиеся белки глаз, полные неонового света
        ctx.fillStyle = "#ffe5ec";
        ctx.beginPath();
        ctx.ellipse(202, 308, 12, 6, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(252, 316, 13, 6, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Густые усы и бакенбарды в драматическом фиолетовом полумраке
        ctx.fillStyle = "#2d1238";
        ctx.beginPath();
        ctx.moveTo(154, 348);
        ctx.quadraticCurveTo(198, 325, 248, 355);
        ctx.quadraticCurveTo(278, 378, 265, 412);
        ctx.lineTo(228, 395);
        ctx.quadraticCurveTo(195, 362, 158, 385);
        ctx.closePath();
        ctx.fill();

        // Развевающиеся тёмные волосы справа
        ctx.fillStyle = "#160a21";
        ctx.beginPath();
        ctx.moveTo(245, 265);
        ctx.quadraticCurveTo(315, 265, 345, 345);
        ctx.lineTo(315, 425);
        ctx.lineTo(275, 395);
        ctx.closePath();
        ctx.fill();

        // Рука с двумя пальцами, приставленными к виску ("пистолет у головы")
        ctx.fillStyle = "#6b286b";
        ctx.beginPath();
        ctx.moveTo(295, 338); // Кончики пальцев у виска
        ctx.lineTo(348, 355);
        ctx.lineTo(372, 435);
        ctx.lineTo(318, 445);
        ctx.lineTo(288, 365);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // ====================================================================
        // СЦЕНА 2: «ХАРДКОР В ЦЕРКВИ // ДОЛОРЕС ДЕЙ И ЛАЗЕРЫ» (image_54817e)
        // ====================================================================
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, "#1d2d3a");
        bgGrad.addColorStop(0.5, "#2b2118");
        bgGrad.addColorStop(1, "#0f1419");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 1. Золотое витражное окно Долорес Дей в центре
        ctx.save();
        ctx.fillStyle = "#d4a359";
        ctx.beginPath();
        ctx.moveTo(120, 0);
        ctx.lineTo(360, 0);
        ctx.lineTo(310, 420);
        ctx.lineTo(80, 420);
        ctx.closePath();
        ctx.fill();

        // Светящиеся лёгкие Долорес Дей (золотисто-жёлтое сердце витража)
        const lungsGlow = ctx.createRadialGradient(235, 145, 5, 235, 145, 95);
        lungsGlow.addColorStop(0, "#fff3b0");
        lungsGlow.addColorStop(0.5, "#f2b441");
        lungsGlow.addColorStop(1, "rgba(180, 115, 40, 0)");
        ctx.fillStyle = lungsGlow;
        ctx.fillRect(80, 20, 280, 320);

        // Силуэт Долорес Дей в витраже
        ctx.fillStyle = "#5c4728";
        ctx.beginPath();
        ctx.arc(235, 65, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(185, 115);
        ctx.lineTo(285, 115);
        ctx.lineTo(305, 310);
        ctx.lineTo(165, 310);
        ctx.closePath();
        ctx.fill();

        // Два золотых светящихся лёгких внутри груди Долорес
        ctx.fillStyle = "#ffe66d";
        ctx.beginPath();
        ctx.ellipse(220, 148, 14, 22, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(250, 148, 14, 22, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. Силуэт Кима Кицураги на переднем плане в ярко-оранжевом бомбере
        ctx.save();
        // Тёмные брюки
        ctx.fillStyle = "#14181d";
        ctx.beginPath();
        ctx.moveTo(55, 390);
        ctx.lineTo(195, 390);
        ctx.lineTo(225, H);
        ctx.lineTo(75, H);
        ctx.closePath();
        ctx.fill();

        // Знаменитая ярко-оранжевая куртка-бомбер Кима
        ctx.fillStyle = "#e85d1a";
        ctx.beginPath();
        ctx.moveTo(45, 235);
        ctx.lineTo(175, 205);
        ctx.lineTo(215, 315);
        ctx.lineTo(165, 395);
        ctx.lineTo(52, 375);
        ctx.closePath();
        ctx.fill();

        // Складки и тени на рукаве бомбера + белая эмблема РГМ
        ctx.fillStyle = "#9e360c";
        ctx.beginPath();
        ctx.moveTo(115, 235);
        ctx.lineTo(195, 295);
        ctx.lineTo(165, 385);
        ctx.lineTo(95, 345);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#e0f2fe";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(145, 265, 11, 0, Math.PI * 2);
        ctx.stroke();

        // Голова Кима и ярко светящиеся круглые очки
        ctx.fillStyle = "#c98a63";
        ctx.beginPath();
        ctx.arc(98, 185, 28, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e0f7ff";
        ctx.beginPath();
        ctx.arc(88, 188, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(110, 184, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3. ПРОНЗИТЕЛЬНЫЕ ЭЛЕКТРИЧЕСКИЕ ГОЛУБЫЕ ЛАЗЕРНЫЕ ЛУЧИ В ЦЕРКВИ
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const laserBeams = [
          { x1: 0, y1: 85, x2: W, y2: 360, w: 18 },
          { x1: 95, y1: 0, x2: W, y2: 520, w: 10 },
          { x1: 240, y1: 0, x2: 0, y2: 390, w: 8 },
          { x1: 0, y1: 540, x2: W, y2: 310, w: 14 },
          { x1: 0, y1: 480, x2: W, y2: 245, w: 6 },
        ];
        laserBeams.forEach((b, i) => {
          const shift = Math.sin(t * 1.4 + i) * 6;
          ctx.strokeStyle = "rgba(0, 229, 255, 0.35)";
          ctx.lineWidth = b.w * 2.2;
          ctx.beginPath();
          ctx.moveTo(b.x1, b.y1 + shift);
          ctx.lineTo(b.x2, b.y2 - shift);
          ctx.stroke();

          ctx.strokeStyle = "#80f5ff";
          ctx.lineWidth = b.w * 0.65;
          ctx.beginPath();
          ctx.moveTo(b.x1, b.y1 + shift);
          ctx.lineTo(b.x2, b.y2 - shift);
          ctx.stroke();
        });
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [themeId, customUrl, health, temp]);

  if (customUrl) {
    return (
      <img
        src={customUrl}
        alt="Disco Elysium Custom Artwork"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          display: "block",
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={420}
      height={640}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      }}
    />
  );
}

// ============================================================================
// 4. ПРОФИЛИ НАКОПИТЕЛЕЙ И РЕАЛЬНЫЕ DIALOGUE-РЕПЛИКИ В ДУХЕ DISCO ELYSIUM
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
    rotationRate: "---- (SSD NVMe)",
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
            text: "Регистр 01h стандарта NVM Express хранит битовую маску катастроф: деградацию резервных блоков, тепловой пробой и аварийную блокировку записи. Все биты равны нулю.",
          },
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Средне: Успех",
            text: "Хоть что-то в этом проклятом мире ещё не развалилось на куски, Гарри. Внутри чёрного кремниевого прямоугольника царит хрупкий, звенящий покой.",
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
            text: "41 градус Цельсия! Температура горячечного бреда после трёх бутылок «Комодор Ред», но для кремниевого чипа — это сладкая утренняя нега под медным радиатором. Поддай ещё напряжения на шину, детка!",
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
            text: "100% резервной области Over-Provisioning при критическом пороге 10%. Ни одна ячейка 128-слойной памяти V-NAND ещё не выведена из строя.",
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
            text: "Каждый записанный гигабайт — это тысячи вольт, пробивающих туннельный диэлектрик. Кристалл медленно умирает от того, что запоминает твою жизнь. Пока он истратил лишь 4% своей души.",
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
            text: "14 820 гигабайт пронеслись по четырём линиям PCIe 4.0 со скоростью 7000 МБ/с. Твои глаза даже не успевают моргнуть, когда контроллер выплевывает гигабайты в оперативную память.",
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
            text: "Девятнадцать с половиной терабайт компромата, старой музыки и недописанных отчётов, братишка! Запиши туда ещё пару гигабайт чистого диско!",
          },
        ],
      },
      {
        id: "0C",
        name: "Power Cycles",
        ruName: "Число циклов включения питания",
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
            text: "1412 маленьких воскрешений из абсолютного ничто. Каждый раз, когда ты нажимаешь кнопку на корпусе, этот диск собирает твою реальность заново.",
          },
        ],
      },
      {
        id: "0D",
        name: "Unsafe Shutdowns",
        ruName: "Аварийные обрывы питания",
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
            text: "19 раз питание отрубалось наживую — как удар трубой по затылку в тёмном переулке за «Танцами в тряпье». Но таблица трансляции FTL выдержала.",
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
            text: "Ноль ошибок декодера LDPC. Память абсолютно герметична.",
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
        ruName: "Число переназначенных секторов (Bad Blocks)",
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
            text: "Сорок восемь выжженных микрократеров на зеркале магнитного диска! Контроллер отметил их как мёртвую зону и перенёс данные в резервный конец пластины. Слышишь этот судорожный хруст? Это головка мечется через весь диск.",
          },
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Средне: Успех",
            text: "Твоя собственная голова устроена точно так же, Гарри. Сорок восемь выжженных секторов — и вот ты уже не помнишь ни своего имени, ни лица женщины с запахом абрикосовой жвачки.",
          },
        ],
      },
      {
        id: "09",
        name: "Power-On Hours",
        ruName: "Общее время работы шпинделя",
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
            text: "Четыре года непрерывного вращения со скоростью 120 оборотов в секунду. Подшипник устал, но продолжает петь свою монотонную индустриальную колыбельную.",
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
            text: "14 нестабильных секторов в регистре C5h. Контрольная сумма ECC в них уже не сходится. При следующем обращении к этим кластерам система зависнет в бесконечной попытке чтения.",
          },
          {
            skill: "АВТОРИТЕТ",
            category: "PSY",
            difficulty: "Легко: Успех",
            text: "Скопируй отсюда всё важное немедленно. Не торгуйся с физикой ферромагнетиков.",
          },
        ],
      },
    ],
  },
  {
    id: "pale_e",
    letter: "E:",
    name: "КАТУШКА «ДОЛОРЕС» (СЕРОТА)",
    model: "SEAGATE ST1000DM003-9YN162 1000.2 GB",
    capacityGB: 1000.2,
    firmware: "CC4B",
    serial: "Z1D4PALE0091",
    interfaceType: "Serial ATA",
    transferMode: "SATA/150 | SATA/600 (Деградация)",
    standard: "ATA8-ACS",
    features: "S.M.A.R.T. (АВАРИЯ)",
    healthStatus: "BAD",
    healthPercent: 11,
    temperature: 63,
    totalReadsGB: 192400,
    totalWritesGB: 144800,
    powerOnCount: 11204,
    powerOnHours: 68410,
    rotationRate: "7200 RPM (Клин шпинделя)",
    attributes: [
      {
        id: "05",
        name: "Reallocated Sectors Count",
        ruName: "Переназначенные сектора (Крах таблицы G-List)",
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
          {
            skill: "УЖАСАЮЩИЙ ГАЛСТУК",
            category: "TIE",
            difficulty: "Безумно: Успех",
            text: "Слышишь этот металлический скрежет, братан?! Это предсмертное диско на 7200 оборотов в минуту! Искры из-под магнитной головки!",
          },
        ],
      },
      {
        id: "C6",
        name: "Uncorrectable Sector Count",
        ruName: "Неисправимые ошибки секторов (Распад в Сероту)",
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

// Парсер отчёта CrystalDiskInfo
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
    name: `РЕАЛЬНЫЙ ДИСК ПК`,
    model,
    capacityGB: 1000.0,
    firmware,
    serial,
    interfaceType,
    transferMode,
    standard: "Аппаратный S.M.A.R.T.",
    features: "S.M.A.R.T., Телеметрия ядра",
    healthStatus,
    healthPercent,
    temperature,
    totalReadsGB,
    totalWritesGB,
    powerOnCount,
    powerOnHours,
    rotationRate: "Физический носитель",
    isRealHardware: true,
    attributes: parsedAttrs.length > 0 ? parsedAttrs : INITIAL_DRIVES[0].attributes,
  };
}

// ============================================================================
// 5. ГЛАВНЫЙ КОМПОНЕНТ «CRYSTALDISKINFO // DISCO ELYSIUM SPECIAL EDITION»
// ============================================================================

export default function CrystalDiskElysiumEdition() {
  const [drives, setDrives] = useState<DriveProfile[]>(INITIAL_DRIVES);
  const [activeDriveIdx, setActiveDriveIdx] = useState<number>(0);
  const [visualTheme, setVisualTheme] = useState<VisualThemeId>("mind_explosion");
  const [customArt1, setCustomArt1] = useState<string | null>(null);
  const [customArt2, setCustomArt2] = useState<string | null>(null);

  const [rawFormat, setRawFormat] = useState<"HEX16" | "DEC10">("HEX16");
  const [selectedAttrId, setSelectedAttrId] = useState<string>("01");
  const [tempOffset, setTempOffset] = useState<number>(0);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");
  const [lastDice, setLastDice] = useState<[number, number] | null>(null);

  const [thoughts, setThoughts] = useState<DialogueMessage[]>([
    {
      id: "init_1",
      skill: "КОНЦЕПТУАЛИЗАЦИЯ",
      category: "INT",
      difficulty: "Сложно: Успех",
      text: "Из твоего виска вырывается протуберанец неоновой фуксии, кадмия и ультрафиолета. Первая производная памяти B', вторая производная распада B''... Перед тобой — кремниевая душа машины.",
    },
    {
      id: "init_2",
      skill: "ИНТЕРФЕЙС",
      category: "MOT",
      difficulty: "Легко: Успех",
      text: "Кликни по любой строке S.M.A.R.T. в таблице или перетащи свои любимые арты Disco Elysium прямо в это окно — они станут живым скином программы!",
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Восстановление пользовательских артов из localStorage
  useEffect(() => {
    try {
      const saved1 = localStorage.getItem("disco_custom_art_1");
      const saved2 = localStorage.getItem("disco_custom_art_2");
      if (saved1) {
        setCustomArt1(saved1);
        setVisualTheme("custom_1");
      }
      if (saved2) setCustomArt2(saved2);
    } catch {}
  }, []);

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
  const effectiveTemp = activeDrive.temperature + tempOffset;

  const effectiveHealth: HealthState = useMemo(() => {
    if (activeDrive.healthStatus === "BAD" || effectiveTemp >= 60) return "BAD";
    if (activeDrive.healthStatus === "CAUTION" || effectiveTemp >= 50) return "CAUTION";
    return "GOOD";
  }, [activeDrive.healthStatus, effectiveTemp]);

  // Загрузка своих артов (например, image_542721.jpg и image_54817e.jpg) через кнопку или Drag & Drop
  const handleArtFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files)
      .slice(0, 2)
      .forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = String(e.target?.result || "");
          if (!dataUrl) return;
          if (idx === 0 && (!customArt1 || visualTheme !== "custom_1")) {
            setCustomArt1(dataUrl);
            setVisualTheme("custom_1");
            try {
              localStorage.setItem("disco_custom_art_1", dataUrl);
            } catch {}
          } else {
            setCustomArt2(dataUrl);
            setVisualTheme("custom_2");
            try {
              localStorage.setItem("disco_custom_art_2", dataUrl);
            } catch {}
          }
        };
        reader.readAsDataURL(file);
      });
    soundFX.playPrismChord(true);
  };

  const activeCustomUrl =
    visualTheme === "custom_1"
      ? customArt1
      : visualTheme === "custom_2"
      ? customArt2
      : null;

  const handleSelectDrive = (idx: number) => {
    const drv = drives[idx];
    setActiveDriveIdx(idx);
    setTempOffset(0);
    soundFX.playClick(drv.healthStatus);

    setThoughts([
      {
        id: `d_${Date.now()}`,
        skill: drv.healthStatus === "BAD" ? "ВНУТРЕННЯЯ ИМПЕРИЯ" : "ИНТЕРФЕЙС",
        category: drv.healthStatus === "BAD" ? "PSY" : "MOT",
        difficulty: "Средне: Успех",
        text:
          drv.healthStatus === "GOOD"
            ? `Канал переключён на [${drv.letter}] ${drv.model}. Четыре линии PCIe 4.0 поют в унисон, ресурс 96%.`
            : drv.healthStatus === "CAUTION"
            ? `Внимание, детектив: на диске [${drv.letter}] обнаружены 48 переназначенных секторов и 14 нестабильных кластеров!`
            : `ТРЕВОГА! Катушка [${drv.letter}] поглощена Серотой (здоровье 11%, 2418 битых секторов). Слышен предсмертный стук механики!`,
      },
    ]);
  };

  const handleSelectAttribute = (attr: SmartAttribute) => {
    setSelectedAttrId(attr.id);
    soundFX.playClick(attr.status);
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
    const bonus = effectiveHealth === "GOOD" ? 3 : effectiveHealth === "CAUTION" ? 1 : -1;
    const total = d1 + d2 + bonus;
    const success = (d1 === 6 && d2 === 6) || (!(d1 === 1 && d2 === 1) && total >= 8);
    soundFX.playPrismChord(success);

    setThoughts([
      {
        id: `r1_${Date.now()}`,
        skill: `БЕЛАЯ ПРОВЕРКА // ИНТЕРФЕЙС [Кубики: ${d1} + ${d2} (мод. ${
          bonus >= 0 ? `+${bonus}` : bonus
        }) = ${total} против 8]`,
        category: "MOT",
        difficulty: success ? "КРИТИЧЕСКИЙ УСПЕХ" : "ПРОВАЛ ПРОВЕРКИ",
        text: success
          ? "Твой разум пробивает оболочку операционной системы и ныряет прямо в микрокод контроллера! Ты видишь карту физических блоков как ночной Ревашоль с высоты птичьего полёта: все уязвимые сектора помечены и изолированы."
          : "Перед глазами взрываются пурпурно-золотые пятна. Ты забыл, что такое LBA-адресация, почему ты сидишь перед этим монитором и как зовут того парня в оранжевой куртке.",
      },
      {
        id: `r2_${Date.now()}`,
        skill: "УЖАСАЮЩИЙ ГАЛСТУК",
        category: "TIE",
        difficulty: "Безумно: Успех",
        text: success
          ? "ДА-А-А, БРАТАН! Семь тысяч мегабайт в секунду чистого электрического экстаза!"
          : "Забей на сектора, Гарри! Давай просто разгоним этот чип до 85 градусов и посмотрим, как красиво он задымится!",
      },
    ]);
  };

  const copySmartReport = () => {
    const lines = [
      `CrystalDiskInfo // Disco Elysium Edition`,
      `Model : ${activeDrive.model}`,
      `Firmware : ${activeDrive.firmware}`,
      `Serial Number : ${activeDrive.serial}`,
      `Health Status : ${activeDrive.healthStatus} (${activeDrive.healthPercent} %)`,
      `Temperature : ${effectiveTemp} C`,
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
    soundFX.playClick("GOOD");
  };

  const handleImportSubmit = () => {
    const parsed = parseRealSmartReport(importText);
    if (!parsed) return;
    setDrives([parsed, ...drives]);
    setActiveDriveIdx(0);
    setShowImportModal(false);
    setImportText("");
    soundFX.playPrismChord(true);
  };

  const getSkillColor = (cat: DialogueMessage["category"]) => {
    switch (cat) {
      case "INT":
        return "#38d9ff"; // Электрический голубой (Интеллект)
      case "PSY":
        return "#c77dff"; // Ультрафиолет (Психика)
      case "FYS":
        return "#ff2a85"; // Неоновая фуксия/кармин (Физика/Электрохимия)
      case "MOT":
        return "#ffbe0b"; // Золотой кадмий (Моторика)
      case "TIE":
        return "#ff5400"; // Огненно-оранжевый (Галстук)
      default:
        return "#f8f9fa";
    }
  };

  const formatRaw = (dec: number) =>
    rawFormat === "DEC10"
      ? dec.toLocaleString("ru-RU")
      : dec.toString(16).toUpperCase().padStart(12, "0");

  return (
    <div
      className="cdi-disco-shell"
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
      {/* СТИЛИ ТОЧНОЙ АРХИТЕКТУРЫ CRYSTALDISKINFO SPECIAL EDITION + ПСИХОДЕЛИКА DISCO ELYSIUM */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Oswald:wght@600;700&display=swap');

        * { box-sizing: border-box; }
        body, html {
          margin: 0;
          padding: 0;
          background: #07040d;
          color: #f8f5f0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 13px;
          -webkit-font-smoothing: antialiased;
        }
        .font-oswald {
          font-family: 'Oswald', sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .font-serif-disco {
          font-family: 'Cormorant Garamond', Georgia, serif;
        }
        .font-mono {
          font-family: 'JetBrains Mono', Consolas, monospace;
          font-variant-numeric: tabular-nums;
        }

        /* Внешний фон с атмосферным свечением */
        .cdi-disco-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          position: relative;
          overflow-x: hidden;
          background:
            radial-gradient(circle at 20% 25%, rgba(255, 0, 127, 0.25), transparent 45%),
            radial-gradient(circle at 80% 20%, rgba(0, 245, 212, 0.18), transparent 45%),
            radial-gradient(circle at 50% 85%, rgba(255, 93, 0, 0.2), transparent 50%),
            #06030a;
        }

        /* ГЛАВНОЕ ОКНО В ФОРМАТЕ CRYSTALDISKINFO SPECIAL EDITION (как Kurei Kei Edition на фото) */
        .cdi-window {
          width: 100%;
          max-width: 1260px;
          min-height: 820px;
          border-radius: 10px;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          border: 1.5px solid rgba(255, 255, 255, 0.22);
          box-shadow:
            0 25px 70px rgba(0, 0, 0, 0.9),
            0 0 45px rgba(255, 0, 127, 0.22),
            0 0 80px rgba(0, 229, 255, 0.14);
          background: #0d0818;
        }

        /* Верхняя строка меню как в нативном окне CrystalDiskInfo */
        .cdi-menubar {
          height: 38px;
          background: rgba(12, 8, 22, 0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 25;
        }
        .menu-links {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .menu-btn {
          background: transparent;
          border: 1px solid transparent;
          color: #e2dcf0;
          padding: 4px 10px;
          border-radius: 5px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .menu-btn:hover {
          background: rgba(255, 0, 127, 0.22);
          border-color: rgba(255, 0, 127, 0.55);
          color: #fff;
        }
        .menu-btn-accent {
          background: linear-gradient(90deg, rgba(255, 0, 127, 0.3), rgba(255, 107, 26, 0.3));
          border: 1px solid rgba(255, 190, 11, 0.6);
          color: #ffbe0b;
          font-weight: 700;
        }

        /* Тело окна: СЛЕВА — ПОЛНОРОСТОВОЙ АРТ (410px), СПРАВА — ПОЛУПРОЗРАЧНЫЙ СТЕКЛЯННЫЙ ИНТЕРФЕЙС CDI */
        .cdi-body {
          flex: 1;
          display: grid;
          grid-template-columns: 410px 1fr;
          position: relative;
        }
        @media (max-width: 1024px) {
          .cdi-body {
            grid-template-columns: 1fr;
          }
        }

        /* Размытая копия арта на весь задний план под стеклом справа (чтобы цвета светились сквозь таблицу!) */
        .ambient-art-bleed {
          position: absolute;
          inset: 0;
          z-index: 0;
          opacity: 0.26;
          filter: blur(36px) saturate(1.8);
          pointer-events: none;
        }

        /* Левая витрина персонажа (как в Kurei Kei Edition) */
        .left-art-showcase {
          position: relative;
          z-index: 10;
          border-right: 1px solid rgba(255, 255, 255, 0.18);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          min-height: 760px;
        }
        .art-canvas-holder {
          position: absolute;
          inset: 0;
          z-index: 1;
        }
        .art-overlay-top {
          position: relative;
          z-index: 5;
          padding: 12px 14px;
          background: linear-gradient(180deg, rgba(8, 5, 16, 0.82) 0%, transparent 100%);
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .skin-pill {
          padding: 5px 10px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(15, 10, 28, 0.78);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: #e2dcf0;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: all 0.15s;
        }
        .skin-pill:hover, .skin-pill.active {
          background: linear-gradient(90deg, #ff007f, #ff6b1a);
          border-color: #ffbe0b;
          color: #fff;
          box-shadow: 0 0 15px rgba(255, 0, 127, 0.6);
        }

        /* Нижний блок мыслей Гарри прямо поверх нижней трети арта и под таблицей */
        .art-overlay-bottom {
          position: relative;
          z-index: 5;
          margin-top: auto;
          padding: 18px 16px 14px 16px;
          background: linear-gradient(0deg, rgba(7, 4, 15, 0.96) 0%, rgba(12, 7, 24, 0.84) 78%, transparent 100%);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* ПРАВАЯ ЧАСТЬ: КЛАССИЧЕСКИЙ ИНТЕРФЕЙС CRYSTALDISKINFO ПОВЕРХ МАТОВОГО СТЕКЛА */
        .right-cdi-glass {
          position: relative;
          z-index: 10;
          background: rgba(14, 10, 26, 0.68);
          backdrop-filter: blur(18px);
          padding: 14px 20px 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* 1. Вкладки дисков сверху (как "Хорошо / 40 °C / C: D:" в Kurei Kei Edition) */
        .cdi-drive-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.16);
          padding-bottom: 10px;
        }
        .cdi-tab-item {
          min-width: 128px;
          padding: 6px 14px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #e2dcf0;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
        }
        .cdi-tab-item:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .cdi-tab-item.active {
          background: linear-gradient(180deg, rgba(0, 229, 255, 0.25), rgba(131, 56, 236, 0.35));
          border: 1.5px solid #00f5d4;
          box-shadow: 0 0 18px rgba(0, 245, 212, 0.35);
          color: #fff;
        }

        /* 2. Крупный заголовок модели накопителя */
        .cdi-model-banner {
          text-align: center;
          padding: 6px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        }
        .cdi-model-title {
          margin: 0;
          font-size: 23px;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #ffffff;
          text-shadow: -1.5px 0 #ff007f, 1.5px 0 #00f5d4;
        }

        /* 3. Двухколоночный паспорт диска + центральный тотем (как на фото Kurei Kei Edition) */
        .cdi-passport-layout {
          display: grid;
          grid-template-columns: 1fr 92px 1fr;
          gap: 12px;
          align-items: center;
        }
        @media (max-width: 780px) {
          .cdi-passport-layout {
            grid-template-columns: 1fr;
          }
        }
        .cdi-field-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .cdi-field-row {
          display: grid;
          grid-template-columns: 135px 1fr;
          align-items: center;
          gap: 8px;
        }
        .cdi-field-label {
          text-align: right;
          font-size: 12px;
          color: #cbd5e1;
          white-space: nowrap;
        }
        .cdi-field-box {
          padding: 4px 10px;
          border-radius: 5px;
          background: rgba(8, 5, 18, 0.62);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Центральный тотем между колонками паспорта (Говорящий Галстук / Бросок 2d6) */
        .center-totem-btn {
          width: 88px;
          height: 126px;
          margin: 0 auto;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(255, 0, 127, 0.28), rgba(255, 107, 26, 0.32));
          border: 1.5px solid #ffbe0b;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          cursor: pointer;
          box-shadow: 0 0 20px rgba(255, 0, 127, 0.35);
          transition: all 0.18s;
          color: #fff;
        }
        .center-totem-btn:hover {
          transform: scale(1.05) rotate(-2deg);
          box-shadow: 0 0 28px rgba(255, 190, 11, 0.65);
        }

        /* 4. Две широкие горизонтальные капсулы ТЕХСОСТОЯНИЕ и ТЕМПЕРАТУРА (1:1 как в Kurei Kei Edition) */
        .cdi-status-bars {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 4px 0;
        }
        @media (max-width: 680px) {
          .cdi-status-bars { grid-template-columns: 1fr; }
        }
        .status-pill-group {
          display: grid;
          grid-template-columns: 135px 1fr;
          align-items: center;
          gap: 8px;
        }
        .cdi-big-pill {
          height: 36px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.03em;
          color: #fff;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
          border: 1.5px solid rgba(255, 255, 255, 0.45);
        }
        .pill-good {
          background: linear-gradient(90deg, #00b4d8, #0077b6, #00f5d4);
          box-shadow: 0 0 18px rgba(0, 245, 212, 0.45);
        }
        .pill-caution {
          background: linear-gradient(90deg, #ff9e00, #ff5400);
          box-shadow: 0 0 18px rgba(255, 158, 0, 0.5);
        }
        .pill-bad {
          background: linear-gradient(90deg, #ff0054, #9e0059);
          box-shadow: 0 0 22px rgba(255, 0, 84, 0.65);
        }

        /* 5. Стеклянная таблица S.M.A.R.T. (справа внизу, как на фото) */
        .cdi-smart-box {
          flex: 1;
          border-radius: 8px;
          background: rgba(8, 5, 18, 0.68);
          border: 1px solid rgba(255, 255, 255, 0.22);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .cdi-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .cdi-table th {
          background: rgba(255, 255, 255, 0.08);
          color: #e2dcf0;
          font-weight: 600;
          padding: 7px 10px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          white-space: nowrap;
        }
        .cdi-table td {
          padding: 6px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          color: #f8f5f0;
        }
        .cdi-table tr {
          cursor: pointer;
          transition: background 0.12s;
        }
        .cdi-table tr:hover td {
          background: rgba(255, 0, 127, 0.18);
        }
        .cdi-table tr.selected td {
          background: linear-gradient(90deg, rgba(255, 0, 127, 0.32), rgba(0, 245, 212, 0.2));
          border-top: 1px solid #ffbe0b;
          border-bottom: 1px solid #ffbe0b;
        }
        .orb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }
        .orb-good {
          background: radial-gradient(circle at 35% 35%, #a8f9ff, #00bbf9);
          box-shadow: 0 0 8px #00bbf9;
        }
        .orb-caution {
          background: radial-gradient(circle at 35% 35%, #fff3b0, #ff9e00);
          box-shadow: 0 0 8px #ff9e00;
        }
        .orb-bad {
          background: radial-gradient(circle at 35% 35%, #ffccd5, #ff0054);
          box-shadow: 0 0 10px #ff0054;
        }
      `,
        }}
      />

      {/* СКРЫТЫЙ INPUT ДЛЯ ЗАГРУЗКИ ВАШИХ АРТОВ */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleArtFiles(e.target.files)}
        style={{ display: "none" }}
      />

      {/* ОВЕРЛЕЙ ПРИ ПЕРЕТАСКИВАНИИ ФАЙЛОВ АРТОВ В ОКНО */}
      {isDraggingOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255, 0, 127, 0.35)",
            backdropFilter: "blur(8px)",
            zIndex: 99,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "4px dashed #ffbe0b",
          }}
        >
          <div className="font-oswald" style={{ fontSize: "28px", color: "#fff" }}>
            ✨ Отпустите файл изображения, чтобы установить его как скин Disco Elysium!
          </div>
        </div>
      )}

      {/* ГЛАВНОЕ ОКНО CRYSTALDISKINFO: DISCO ELYSIUM EDITION */}
      <div className="cdi-window">
        {/* РАЗМЫТОЕ СВЕЧЕНИЕ АРТА ПОД ПОЛУПРОЗРАЧНЫМ СТЕКЛОМ СПРАВА */}
        <div className="ambient-art-bleed">
          <PsychedelicArtworkCanvas
            themeId={visualTheme}
            customUrl={activeCustomUrl}
            health={effectiveHealth}
            temp={effectiveTemp}
          />
        </div>

        {/* ВЕРХНЯЯ СТРОКА МЕНЮ (КАК В CRYSTALDISKINFO) */}
        <header className="cdi-menubar">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              className="font-oswald"
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                background: "linear-gradient(90deg, #ff007f, #ff6b1a)",
                color: "#fff",
                fontSize: "11.5px",
              }}
            >
              DISCO ELYSIUM EDITION x64
            </span>
            <span style={{ fontWeight: 700, fontSize: "12.5px", color: "#fff" }}>
              CrystalDiskInfo 9.8.0 // Revachol Psychosis
            </span>
          </div>

          <div className="menu-links">
            <button onClick={() => fileInputRef.current?.click()} className="menu-btn menu-btn-accent">
              🖼️ Поставить свой арт (или перетащите фото сюда)
            </button>
            <button onClick={() => setShowImportModal(true)} className="menu-btn">
              📂 Вставить S.M.A.R.T. своего ПК
            </button>
            <button onClick={copySmartReport} className="menu-btn">
              📋 Копировать отчёт
            </button>
            <button
              onClick={() => setRawFormat((p) => (p === "HEX16" ? "DEC10" : "HEX16"))}
              className="menu-btn font-mono"
            >
              RAW: {rawFormat === "HEX16" ? "16 [HEX]" : "10 [DEC]"}
            </button>
            <button
              onClick={() => {
                soundFX.enabled = !soundOn;
                setSoundOn(!soundOn);
              }}
              className="menu-btn"
            >
              {soundOn ? "🔊 Звук" : "🔇 Тихо"}
            </button>
          </div>
        </header>

        {/* ОСНОВНОЙ КОРПУС: СЛЕВА — ПОЛНОРОСТОВОЙ АРТ И ГОЛОСА В ГОЛОВЕ, СПРАВА — СТЕКЛЯННЫЙ СТЕНД CDI */}
        <div className="cdi-body">
          {/* ЛЕВАЯ КОЛОНКА (410px): ПОЛНОРОСТОВОЙ АРТ + ПСИХОДЕЛИЧЕСКИЙ ПОТОК СОЗНАНИЯ */}
          <aside className="left-art-showcase">
            <div className="art-canvas-holder">
              <PsychedelicArtworkCanvas
                themeId={visualTheme}
                customUrl={activeCustomUrl}
                health={effectiveHealth}
                temp={effectiveTemp}
              />
            </div>

            {/* Переключатель визуальных сцен поверх верхней кромки арта */}
            <div className="art-overlay-top">
              <button
                onClick={() => setVisualTheme("mind_explosion")}
                className={`skin-pill ${visualTheme === "mind_explosion" ? "active" : ""}`}
              >
                🧠 Взрыв Сознания (B&apos; B&apos;&apos;)
              </button>
              <button
                onClick={() => setVisualTheme("church_lasers")}
                className={`skin-pill ${visualTheme === "church_lasers" ? "active" : ""}`}
              >
                ⚡ Лазеры и Долорес
              </button>
              {customArt1 && (
                <button
                  onClick={() => setVisualTheme("custom_1")}
                  className={`skin-pill ${visualTheme === "custom_1" ? "active" : ""}`}
                >
                  🎨 Ваш Арт #1
                </button>
              )}
              {customArt2 && (
                <button
                  onClick={() => setVisualTheme("custom_2")}
                  className={`skin-pill ${visualTheme === "custom_2" ? "active" : ""}`}
                >
                  🎨 Ваш Арт #2
                </button>
              )}
            </div>

            {/* Поток голосов в голове Гарри поверх нижней части арта */}
            <div className="art-overlay-bottom">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255, 0, 127, 0.4)",
                  paddingBottom: "4px",
                }}
              >
                <span className="font-oswald" style={{ fontSize: "12px", color: "#ffbe0b" }}>
                  Голоса в голове детектива // Регистр [{selectedAttrId}h]
                </span>
                {lastDice && (
                  <span className="font-mono" style={{ fontSize: "11.5px", color: "#00f5d4" }}>
                    🎲 Кости: [{lastDice[0]}] + [{lastDice[1]}]
                  </span>
                )}
              </div>

              <div style={{ maxHeight: "215px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
                {thoughts.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      borderLeft: `3px solid ${getSkillColor(t.category)}`,
                      paddingLeft: "10px",
                    }}
                  >
                    <div>
                      <span
                        className="font-oswald"
                        style={{ fontSize: "12.5px", color: getSkillColor(t.category) }}
                      >
                        {t.skill}
                      </span>
                      {t.difficulty && (
                        <span
                          className="font-serif-disco"
                          style={{ fontSize: "13px", color: "#cbd5e1", marginLeft: "6px", fontStyle: "italic" }}
                        >
                          [{t.difficulty}]
                        </span>
                      )}
                    </div>
                    <div
                      className="font-serif-disco"
                      style={{ fontSize: "16px", lineHeight: 1.38, color: "#fff", marginTop: "2px" }}
                    >
                      — {t.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ПРАВАЯ ЧАСТЬ: ПОЛУПРОЗРАЧНЫЙ СТЕКЛЯННЫЙ CRYSTALDISKINFO */}
          <main className="right-cdi-glass">
            {/* 1. Полоса вкладок дисков (как в CrystalDiskInfo) */}
            <div className="cdi-drive-tabs">
              {drives.map((drv, idx) => {
                const orbClass =
                  drv.healthStatus === "GOOD"
                    ? "orb-good"
                    : drv.healthStatus === "CAUTION"
                    ? "orb-caution"
                    : "orb-bad";
                return (
                  <button
                    key={drv.id}
                    onClick={() => handleSelectDrive(idx)}
                    className={`cdi-tab-item ${idx === activeDriveIdx ? "active" : ""}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontWeight: 700, fontSize: "12px" }}>
                      <span className={`orb ${orbClass}`} />
                      <span>
                        {drv.healthStatus === "GOOD"
                          ? "Хорошо"
                          : drv.healthStatus === "CAUTION"
                          ? "Тревога"
                          : "Серота"}{" "}
                        ({drv.healthPercent}%)
                      </span>
                    </div>
                    <div className="font-mono" style={{ fontSize: "12px", color: "#ffbe0b", marginTop: "2px" }}>
                      {drv.temperature} °C • Том [{drv.letter}]
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 2. Крупное название модели и объёма */}
            <div className="cdi-model-banner">
              <h1 className="cdi-model-title">
                {activeDrive.model} : {activeDrive.capacityGB.toFixed(1)} GB
              </h1>
            </div>

            {/* 3. Двухколоночный паспорт диска + центральный тотем броска кубиков 2d6 */}
            <div className="cdi-passport-layout">
              {/* Левый столбец паспорта */}
              <div className="cdi-field-list">
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Прошивка</span>
                  <div className="cdi-field-box font-mono">{activeDrive.firmware}</div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Серийный номер</span>
                  <div className="cdi-field-box font-mono">{activeDrive.serial}</div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Интерфейс</span>
                  <div className="cdi-field-box font-mono">{activeDrive.interfaceType}</div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Режим передачи</span>
                  <div className="cdi-field-box font-mono">{activeDrive.transferMode}</div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Буква тома</span>
                  <div className="cdi-field-box font-mono">
                    {activeDrive.letter} ({activeDrive.name})
                  </div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Стандарт</span>
                  <div className="cdi-field-box font-mono">{activeDrive.standard}</div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Возможности</span>
                  <div className="cdi-field-box font-mono">{activeDrive.features}</div>
                </div>
              </div>

              {/* Центральный тотем (на месте чиби-стикера в Kurei Kei Edition): Бросок костей 2d6 */}
              <button
                onClick={handleRollDice}
                className="center-totem-btn"
                title="Бросить кубики 2d6 (Белая проверка Интерфейса)"
              >
                <span style={{ fontSize: "28px" }}>🎲</span>
                <span className="font-oswald" style={{ fontSize: "11px", textAlign: "center", lineHeight: 1.15 }}>
                  Бросок 2d6
                  <br />
                  <span style={{ color: "#ffbe0b" }}>Допрос чипа</span>
                </span>
              </button>

              {/* Правый столбец паспорта */}
              <div className="cdi-field-list">
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Всего хост-чтений</span>
                  <div className="cdi-field-box font-mono">
                    {activeDrive.totalReadsGB.toLocaleString("ru-RU")} GB
                  </div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Всего хост-записей</span>
                  <div className="cdi-field-box font-mono">
                    {activeDrive.totalWritesGB.toLocaleString("ru-RU")} GB
                  </div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Скорость вращения</span>
                  <div className="cdi-field-box font-mono">{activeDrive.rotationRate}</div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Число включений</span>
                  <div className="cdi-field-box font-mono">
                    {activeDrive.powerOnCount.toLocaleString("ru-RU")} раз
                  </div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Общее время работы</span>
                  <div className="cdi-field-box font-mono">
                    {activeDrive.powerOnHours.toLocaleString("ru-RU")} ч
                  </div>
                </div>
                <div className="cdi-field-row">
                  <span className="cdi-field-label">Тепловой стресс</span>
                  <div className="cdi-field-box" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="range"
                      min={-10}
                      max={25}
                      value={tempOffset}
                      onChange={(e) => setTempOffset(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#ff007f", cursor: "pointer" }}
                    />
                    <span className="font-mono" style={{ fontSize: "11px", color: "#ffbe0b" }}>
                      {tempOffset >= 0 ? `+${tempOffset}°` : `${tempOffset}°`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Две широкие капсулы ТЕХСОСТОЯНИЕ и ТЕМПЕРАТУРА (как на фото Kurei Kei Edition) */}
            <div className="cdi-status-bars">
              <div className="status-pill-group">
                <span className="cdi-field-label" style={{ fontWeight: 700 }}>
                  Техсостояние
                </span>
                <div
                  className={`cdi-big-pill ${
                    effectiveHealth === "GOOD"
                      ? "pill-good"
                      : effectiveHealth === "CAUTION"
                      ? "pill-caution"
                      : "pill-bad"
                  }`}
                >
                  <span>
                    {effectiveHealth === "GOOD"
                      ? "Хорошо"
                      : effectiveHealth === "CAUTION"
                      ? "Тревога"
                      : "Плохо (Серота)"}{" "}
                    ({activeDrive.healthPercent} %)
                  </span>
                </div>
              </div>

              <div className="status-pill-group">
                <span className="cdi-field-label" style={{ fontWeight: 700 }}>
                  Температура
                </span>
                <div
                  className={`cdi-big-pill font-mono ${
                    effectiveTemp < 50
                      ? "pill-good"
                      : effectiveTemp < 60
                      ? "pill-caution"
                      : "pill-bad"
                  }`}
                >
                  <span>{effectiveTemp} °C</span>
                </div>
              </div>
            </div>

            {/* 5. Таблица S.M.A.R.T. (внизу справа, с прозрачным фоном) */}
            <div className="cdi-smart-box">
              <div style={{ overflowX: "auto", flex: 1 }}>
                <table className="cdi-table">
                  <thead>
                    <tr>
                      <th style={{ width: "36px" }}></th>
                      <th style={{ width: "48px" }}>ID</th>
                      <th>Атрибут (кликните для психоанализа сектора)</th>
                      <th style={{ textAlign: "right" }}>Текущее</th>
                      <th style={{ textAlign: "right" }}>Наихудшее</th>
                      <th style={{ textAlign: "right" }}>Порог</th>
                      <th style={{ textAlign: "right" }}>Raw-значения</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDrive.attributes.map((attr) => {
                      const orbClass =
                        attr.status === "GOOD"
                          ? "orb-good"
                          : attr.status === "CAUTION"
                          ? "orb-caution"
                          : "orb-bad";
                      return (
                        <tr
                          key={attr.id}
                          onClick={() => handleSelectAttribute(attr)}
                          className={selectedAttrId === attr.id ? "selected" : ""}
                        >
                          <td style={{ textAlign: "center" }}>
                            <span className={`orb ${orbClass}`} />
                          </td>
                          <td className="font-mono" style={{ fontWeight: 700, color: "#00f5d4" }}>
                            {attr.id}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{attr.ruName}</div>
                            <div style={{ fontSize: "11px", color: "#a5b4fc" }}>{attr.name}</div>
                          </td>
                          <td className="font-mono" style={{ textAlign: "right" }}>
                            {attr.current}
                          </td>
                          <td className="font-mono" style={{ textAlign: "right" }}>
                            {attr.worst}
                          </td>
                          <td className="font-mono" style={{ textAlign: "right", color: "#94a3b8" }}>
                            {attr.threshold}
                          </td>
                          <td
                            className="font-mono"
                            style={{
                              textAlign: "right",
                              fontWeight: 700,
                              color:
                                attr.status === "BAD"
                                  ? "#ff4d6d"
                                  : attr.status === "CAUTION"
                                  ? "#ffbe0b"
                                  : "#a8f9ff",
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
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ВСТАВКИ ОТЧЁТА СВОЕГО ПК */}
      {showImportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6, 3, 12, 0.85)",
            backdropFilter: "blur(10px)",
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
              maxWidth: "640px",
              background: "#130b24",
              border: "2px solid #ff007f",
              borderRadius: "12px",
              padding: "22px",
              boxShadow: "0 0 50px rgba(255, 0, 127, 0.4)",
            }}
          >
            <h3 className="font-oswald" style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#ffbe0b" }}>
              Импорт S.M.A.R.T.-телеметрии вашего накопителя
            </h3>
            <p style={{ margin: "0 0 12px 0", color: "#e2dcf0", fontSize: "13px" }}>
              В обычном CrystalDiskInfo нажмите `Ctrl + C` (или выполните `smartctl -a`) и вставьте текст ниже:
            </p>
            <textarea
              rows={9}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                "Model : TMI 512GB SATA\nFirmware : SFMB004K\nTemperature : 40 C\nHealth Status : Good (100 %)\n09 100 100 0 000000000138 Power-On Hours"
              }
              className="font-mono"
              style={{
                width: "100%",
                background: "#080510",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "8px",
                color: "#fff",
                padding: "10px",
                fontSize: "12px",
                marginBottom: "14px",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setShowImportModal(false)} className="menu-btn">
                Отмена
              </button>
              <button onClick={handleImportSubmit} className="menu-btn menu-btn-accent">
                Загрузить в терминал
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
