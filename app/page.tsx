"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

// ============================================================================
// 1. ТИПЫ ДАННЫХ CRYSTALDISKINFO // DISCO ELYSIUM EDITION
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
  category: "INT" | "PSY" | "FYS" | "MOT" | "TIE";
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
      osc.frequency.setValueAtTime(status === "BAD" ? 150 : 480, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.045);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
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
        g.gain.linearRampToValueAtTime(success ? 0.05 : 0.035, t + i * 0.04 + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 1.5);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t + i * 0.04);
        osc.stop(t + 1.55);
      });
    } catch {}
  }
}

const soundFX = new ElysiumSound();

// ============================================================================
// 3. ПОЛНОЭКРАННЫЙ ХУДОЖЕСТВЕННЫЙ ХОЛСТ (АНАТОМИЧЕСКИЙ ПОРТРЕТ + ФОН НА ВСЁ ОКНО)
// ============================================================================

function FullWindowMasterpieceCanvas({
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
    if (customUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    // Генерируем 140 многослойных живописных мазков психоделического выброса
    const shards = Array.from({ length: 140 }, (_, i) => {
      const baseAngle = -Math.PI * 0.82 + (i / 140) * (Math.PI * 0.78);
      const length = 90 + ((i * 89) % 460);
      const width = 0.012 + ((i * 17) % 10) * 0.0045;
      const palette = [
        "#ff0a6c", // Глубокая карминно-неоновая фуксия
        "#ff4800", // Огненный кадмий
        "#ffb703", // Тёплое золото
        "#00e5ff", // Лазурный циан
        "#7209b7", // Королевский фиолет
        "#f72585", // Пурпурный
        "#4cc9f0", // Холодный голубой блик
        "#fb5607", // Янтарно-оранжевый
      ];
      return {
        angle: baseAngle,
        length,
        width,
        color: palette[i % palette.length],
        phase: i * 0.37,
      };
    });

    // Пылинки и мазки краски, парящие по всему фону окна (и под таблицей справа)
    const motes = Array.from({ length: 55 }, (_, i) => ({
      x: (i * 193) % 1280,
      y: (i * 137) % 820,
      r: 1.5 + (i % 4) * 1.4,
      ang: (i * 0.6) % Math.PI,
      color: i % 3 === 0 ? "#ffbe0b" : i % 3 === 1 ? "#ff0a6c" : "#00e5ff",
    }));

    const render = () => {
      frame += 1;
      const W = canvas.width;
      const H = canvas.height;
      const t = frame * 0.016;

      if (themeId === "mind_explosion") {
        // ====================================================================
        // СЦЕНА 1: АНАТОМИЧЕСКИЙ ПОРТРЕТ ГАРРИ «ВЗРЫВ СОЗНАНИЯ (B' B'' B''')»
        // ====================================================================

        // 1. Глубокий живописный фон на ВСЁ окно (индиго-умбра с архитектурной сеткой Ревашоля справа)
        const bgGrad = ctx.createRadialGradient(230, 310, 40, 560, 410, 980);
        bgGrad.addColorStop(0, "#2b0d38");
        bgGrad.addColorStop(0.38, "#130b21");
        bgGrad.addColorStop(0.75, "#0b0914");
        bgGrad.addColorStop(1, "#07060c");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Тонкая перспективная сетка изолятора Сероты и архитектурные своды на фоне под таблицей справа
        ctx.save();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.055)";
        ctx.lineWidth = 1;
        for (let gx = 380; gx < W; gx += 64) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx - 120, H);
          ctx.stroke();
        }
        for (let gy = 60; gy < H; gy += 64) {
          ctx.beginPath();
          ctx.moveTo(340, gy);
          ctx.lineTo(W, gy + 40);
          ctx.stroke();
        }
        ctx.restore();

        // Точка пробоя сознания (висок и лоб Гарри)
        const originX = 212;
        const originY = 318;

        // 2. Многослойное внутреннее свечение взрыва
        const coreGlow = ctx.createRadialGradient(
          originX - 45,
          originY - 75,
          8,
          originX - 20,
          originY - 60,
          390
        );
        coreGlow.addColorStop(0, "rgba(255, 240, 170, 0.98)");
        coreGlow.addColorStop(0.18, "rgba(255, 140, 20, 0.85)");
        coreGlow.addColorStop(0.42, "rgba(255, 10, 108, 0.55)");
        coreGlow.addColorStop(0.72, "rgba(114, 9, 183, 0.22)");
        coreGlow.addColorStop(1, "transparent");
        ctx.fillStyle = coreGlow;
        ctx.fillRect(0, 0, W, H);

        // 3. Живописный веер мазков и кристаллов, разлетающихся из головы влево-вверх и на правую панель
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        shards.forEach((sh, idx) => {
          const breathe = Math.sin(t * 1.2 + sh.phase) * 10;
          const a = sh.angle + Math.sin(t * 0.5 + idx) * 0.01;
          const len = sh.length + breathe + (temp > 50 ? 30 : 0);

          const x0 = originX + Math.cos(a) * 8;
          const y0 = originY + Math.sin(a) * 8;
          const x1 = originX + Math.cos(a - sh.width) * (len * 0.65);
          const y1 = originY + Math.sin(a - sh.width) * (len * 0.65);
          const x2 = originX + Math.cos(a) * len;
          const y2 = originY + Math.sin(a) * len;
          const x3 = originX + Math.cos(a + sh.width) * (len * 0.78);
          const y3 = originY + Math.sin(a + sh.width) * (len * 0.78);

          ctx.fillStyle = sh.color;
          ctx.globalAlpha = idx % 4 === 0 ? 0.88 : 0.62;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x3, y3);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();

        // 4. Длинные белые меловые траектории и формулы B', B'', B''', тянущиеся через ВЕСЬ фон окна
        ctx.save();
        ctx.strokeStyle = "rgba(186, 230, 253, 0.32)";
        ctx.lineWidth = 1.8;
        [0, 1, 2, 3].forEach((k) => {
          ctx.beginPath();
          ctx.moveTo(originX, originY - 12);
          ctx.bezierCurveTo(
            originX + 110,
            140 - k * 32,
            520,
            70 + k * 45,
            W - 40,
            25 + k * 85
          );
          ctx.stroke();
        });

        ctx.font = "italic 700 25px 'Cormorant Garamond', Georgia, serif";
        ctx.fillStyle = "rgba(224, 242, 254, 0.75)";
        ctx.fillText("B'", 288, 146 + Math.sin(t) * 3);
        ctx.font = "italic 700 22px 'Cormorant Garamond', Georgia, serif";
        ctx.fillText("B''", 358, 86 + Math.cos(t) * 3);
        ctx.font = "italic 600 19px 'Cormorant Garamond', Georgia, serif";
        ctx.fillText("B'''", 342, 198 + Math.sin(t * 0.8) * 3);

        // Дополнительные меловые заметки под полупрозрачной таблицей справа
        ctx.font = "italic 600 18px 'Cormorant Garamond', Georgia, serif";
        ctx.fillStyle = "rgba(224, 242, 254, 0.16)";
        ctx.fillText("∂Ψ / ∂t = −∇·J + Λ(Pale)", 540, 115);
        ctx.fillText("REVACHOL WEST // SECTOR 41 TELEMETRY", 780, 775);
        ctx.restore();

        // ====================================================================
        // 5. ДЕТАЛЬНЫЙ АНАТОМИЧЕСКИЙ ПОРТРЕТ ГАРРИ ДЮБУА (СВЕТОТЕНЬ И МАЗКИ)
        // ====================================================================
        ctx.save();

        // 5.1. Задняя масса тёмных растрёпанных волос
        ctx.fillStyle = "#11091a";
        ctx.beginPath();
        ctx.moveTo(215, 252);
        ctx.bezierCurveTo(265, 242, 315, 275, 332, 345);
        ctx.bezierCurveTo(345, 395, 328, 455, 295, 480);
        ctx.lineTo(225, 440);
        ctx.closePath();
        ctx.fill();

        // Отдельные живописные пряди волос
        ctx.strokeStyle = "#2a163b";
        ctx.lineWidth = 4;
        [0, 1, 2, 3, 4].forEach((s) => {
          ctx.beginPath();
          ctx.moveTo(245 + s * 8, 258 + s * 6);
          ctx.quadraticCurveTo(305 + s * 5, 295, 318 - s * 4, 385 + s * 10);
          ctx.stroke();
        });

        // 5.2. Торс, плечи и пиджак с фактурными лацканами
        const coatGrad = ctx.createLinearGradient(40, 460, 360, H);
        coatGrad.addColorStop(0, "#241130");
        coatGrad.addColorStop(0.5, "#150a1e");
        coatGrad.addColorStop(1, "#09050e");
        ctx.fillStyle = coatGrad;
        ctx.beginPath();
        ctx.moveTo(10, H);
        ctx.lineTo(48, 535);
        ctx.quadraticCurveTo(105, 468, 152, 452);
        ctx.lineTo(288, 468);
        ctx.quadraticCurveTo(355, 495, 405, H);
        ctx.closePath();
        ctx.fill();

        // Левый лацкан пиджака, освещённый пурпурно-розовым светом взрыва
        const lapelGrad = ctx.createLinearGradient(85, 460, 175, 620);
        lapelGrad.addColorStop(0, "#6c246e");
        lapelGrad.addColorStop(0.5, "#42164b");
        lapelGrad.addColorStop(1, "#1d0c26");
        ctx.fillStyle = lapelGrad;
        ctx.beginPath();
        ctx.moveTo(82, 535);
        ctx.lineTo(148, 452);
        ctx.lineTo(168, 495);
        ctx.lineTo(155, 645);
        ctx.lineTo(95, 610);
        ctx.closePath();
        ctx.fill();

       ctx.moveTo(152, 448);
ctx.lineTo(142, 522);
ctx.lineTo(168, 498);
ctx.closePath();
ctx.fill();

        // 5.3. Анатомия запрокинутой шеи (грудино-ключично-сосцевидная мышца и гортань)
        const neckShadow = ctx.createLinearGradient(145, 370, 265, 490);
        neckShadow.addColorStop(0, "#752c68");
        neckShadow.addColorStop(0.55, "#461847");
        neckShadow.addColorStop(1, "#220c29");
        ctx.fillStyle = neckShadow;
        ctx.beginPath();
        ctx.moveTo(155, 382);
        ctx.lineTo(256, 398);
        ctx.lineTo(248, 515);
        ctx.lineTo(148, 468);
        ctx.closePath();
        ctx.fill();

        // Яркий тепло-розовый свет на передней поверхности гортани и сухожилии шеи
        const neckLight = ctx.createLinearGradient(152, 380, 205, 480);
        neckLight.addColorStop(0, "#ff9ebb");
        neckLight.addColorStop(0.5, "#d95b82");
        neckLight.addColorStop(1, "rgba(117, 44, 104, 0)");
        ctx.fillStyle = neckLight;
        ctx.beginPath();
        ctx.moveTo(156, 384);
        ctx.quadraticCurveTo(188, 415, 195, 485);
        ctx.lineTo(162, 472);
        ctx.quadraticCurveTo(152, 425, 156, 384);
        ctx.closePath();
        ctx.fill();

        // 5.4. Скульптурная форма запрокинутой головы
        const faceBase = ctx.createLinearGradient(155, 265, 285, 410);
        faceBase.addColorStop(0, "#ffcad4");
        faceBase.addColorStop(0.28, "#f27a94");
        faceBase.addColorStop(0.62, "#9d3c72");
        faceBase.addColorStop(1, "#4c1b47");
        ctx.fillStyle = faceBase;
        ctx.beginPath();
        ctx.moveTo(154, 342); // Левая скула
        ctx.quadraticCurveTo(165, 295, 196, 268); // Висок и лоб
        ctx.quadraticCurveTo(235, 256, 268, 276); // Верхняя часть лба
        ctx.quadraticCurveTo(296, 305, 286, 358); // Правая скула и ухо
        ctx.quadraticCurveTo(272, 405, 228, 415); // Челюсть
        ctx.quadraticCurveTo(175, 402, 154, 342);
        ctx.closePath();
        ctx.fill();

        // 5.5. Световые плоскости лба, скул и надбровных дуг (импасто блики)
        ctx.fillStyle = "#ffe5ec";
        ctx.beginPath();
        ctx.moveTo(192, 272);
        ctx.quadraticCurveTo(224, 264, 245, 278);
        ctx.quadraticCurveTo(232, 296, 196, 292);
        ctx.closePath();
        ctx.fill();

        // Морщины на запрокинутом лбу
        ctx.strokeStyle = "#9d3c72";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(196, 278);
        ctx.quadraticCurveTo(222, 272, 248, 285);
        ctx.moveTo(192, 286);
        ctx.quadraticCurveTo(218, 281, 244, 293);
        ctx.stroke();

        // 5.6. Глубокие глазницы, веки и закатившиеся белки глаз
        // Левая глазница (ближе к взрыву)
        ctx.fillStyle = "#591d49";
        ctx.beginPath();
        ctx.ellipse(186, 308, 15, 9, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff0f3";
        ctx.beginPath();
        ctx.ellipse(187, 309, 10, 5, -0.25, 0, Math.PI * 2);
        ctx.fill();

        // Правая глазница (в драматической полутени под бровью)
        ctx.fillStyle = "#42143b";
        ctx.beginPath();
        ctx.ellipse(244, 318, 17, 10, 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd6e0";
        ctx.beginPath();
        ctx.ellipse(243, 320, 11, 5.5, 0.22, 0, Math.PI * 2);
        ctx.fill();

        // Густые изломанные брови Гарри
        ctx.fillStyle = "#260d29";
        ctx.beginPath();
        ctx.moveTo(170, 300);
        ctx.quadraticCurveTo(188, 290, 204, 301);
        ctx.lineTo(201, 306);
        ctx.quadraticCurveTo(186, 297, 172, 304);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(226, 304);
        ctx.quadraticCurveTo(248, 296, 268, 315);
        ctx.lineTo(264, 321);
        ctx.quadraticCurveTo(246, 305, 226, 310);
        ctx.closePath();
        ctx.fill();

        // 5.7. Анатомический нос в ракурсе снизу (переносица, кончик носа и ноздри)
        const noseGrad = ctx.createLinearGradient(195, 295, 232, 348);
        noseGrad.addColorStop(0, "#ffe5ec");
        noseGrad.addColorStop(0.5, "#f78ca2");
        noseGrad.addColorStop(1, "#6e2252");
        ctx.fillStyle = noseGrad;
        ctx.beginPath();
        ctx.moveTo(212, 298); // Переносица
        ctx.lineTo(194, 328); // Кончик носа
        ctx.lineTo(204, 344); // Основание носа
        ctx.lineTo(232, 342); // Правое крыло носа
        ctx.lineTo(224, 305);
        ctx.closePath();
        ctx.fill();

        // Тёмные ноздри (ракурс снизу, как на референсе image_542721)
        ctx.fillStyle = "#2b0c28";
        ctx.beginPath();
        ctx.ellipse(202, 336, 5.5, 3.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(218, 338, 6, 3.8, 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Яркий розовый треугольник света на правой щеке под глазом
        ctx.fillStyle = "#ffadc2";
        ctx.beginPath();
        ctx.moveTo(226, 326);
        ctx.lineTo(256, 334);
        ctx.lineTo(244, 368);
        ctx.lineTo(222, 348);
        ctx.closePath();
        ctx.fill();

        // 5.8. Объёмные усы и бакенбарды с живописными прядями
        const beardGrad = ctx.createLinearGradient(150, 340, 275, 425);
        beardGrad.addColorStop(0, "#3b173b");
        beardGrad.addColorStop(0.5, "#240d28");
        beardGrad.addColorStop(1, "#14071a");
        ctx.fillStyle = beardGrad;
        ctx.beginPath();
        ctx.moveTo(152, 355);
        ctx.quadraticCurveTo(178, 336, 208, 342);
        ctx.quadraticCurveTo(242, 348, 266, 382);
        ctx.lineTo(282, 355);
        ctx.lineTo(278, 422);
        ctx.quadraticCurveTo(250, 425, 232, 398);
        ctx.quadraticCurveTo(205, 368, 178, 388);
        ctx.lineTo(156, 392);
        ctx.closePath();
        ctx.fill();

        // Приоткрытый рот и нижняя губа под усами
        ctx.fillStyle = "#1a071c";
        ctx.beginPath();
        ctx.ellipse(204, 366, 16, 7, 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#9e3b68";
        ctx.beginPath();
        ctx.ellipse(203, 373, 14, 4, 0.12, 0, Math.PI);
        ctx.fill();

        // 5.9. Анатомическая кисть правой руки у виска (два пальца к виску, большой палец отведён)
        const handGrad = ctx.createLinearGradient(280, 330, 375, 470);
        handGrad.addColorStop(0, "#b54882");
        handGrad.addColorStop(0.45, "#6c2463");
        handGrad.addColorStop(1, "#2d0f33");
        ctx.fillStyle = handGrad;

        // Указательный и средний пальцы, упирающиеся в висок
        ctx.beginPath();
        ctx.moveTo(276, 334); // Кончики пальцев у виска
        ctx.quadraticCurveTo(308, 335, 338, 358); // Верхняя грань указательного пальца
        ctx.lineTo(368, 395); // Костяшки ладони
        ctx.lineTo(384, 366); // Отведённый большой палец
        ctx.lineTo(395, 374);
        ctx.lineTo(378, 435); // Запястье
        ctx.lineTo(324, 455);
        ctx.quadraticCurveTo(315, 405, 295, 382); // Согнутые безымянный и мизинец
        ctx.quadraticCurveTo(278, 360, 276, 334);
        ctx.closePath();
        ctx.fill();

        // Световые грани на фалангах пальцев и манжета рубашки на запястье
        ctx.strokeStyle = "#e87ea8";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(280, 338);
        ctx.lineTo(334, 362);
        ctx.moveTo(284, 350);
        ctx.lineTo(328, 374);
        ctx.stroke();

        // Светлая манжета на правом запястье (как на референсе image_542721)
        ctx.fillStyle = "#8f5b8a";
        ctx.beginPath();
        ctx.moveTo(322, 452);
        ctx.lineTo(380, 432);
        ctx.lineTo(386, 448);
        ctx.lineTo(326, 468);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      } else {
        // ====================================================================
        // СЦЕНА 2: «ХАРДКОР В ЦЕРКВИ // КИМ, ДОЛОРЕС ДЕЙ И ЛАЗЕРЫ» (image_54817e)
        // ====================================================================
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, "#15222e");
        bgGrad.addColorStop(0.45, "#261d15");
        bgGrad.addColorStop(1, "#0d1217");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 1. Деревянные стропила и своды церкви Мартинеза на ВСЮ ширину окна (просвечивают под таблицей!)
        ctx.save();
        ctx.strokeStyle = "rgba(212, 163, 89, 0.14)";
        ctx.lineWidth = 10;
        for (let arch = 180; arch < W + 200; arch += 220) {
          ctx.beginPath();
          ctx.moveTo(arch, 0);
          ctx.lineTo(arch - 260, H);
          ctx.stroke();
        }
        ctx.restore();

        // 2. Огромный золотой витраж Долорес Дей со светящимися лёгкими
        ctx.save();
        const vitrageGrad = ctx.createRadialGradient(270, 180, 15, 270, 220, 310);
        vitrageGrad.addColorStop(0, "#fff3b0");
        vitrageGrad.addColorStop(0.35, "#eab308");
        vitrageGrad.addColorStop(0.7, "rgba(180, 110, 30, 0.35)");
        vitrageGrad.addColorStop(1, "transparent");
        ctx.fillStyle = vitrageGrad;
        ctx.fillRect(0, 0, 680, 560);

        // Силуэт Долорес Дей в витраже
        ctx.fillStyle = "rgba(62, 44, 22, 0.75)";
        ctx.beginPath();
        ctx.arc(270, 88, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(215, 132);
        ctx.lineTo(325, 132);
        ctx.lineTo(350, 380);
        ctx.lineTo(190, 380);
        ctx.closePath();
        ctx.fill();

        // Светящиеся золотые лёгкие Долорес
        ctx.fillStyle = "#fff8cc";
        ctx.beginPath();
        ctx.ellipse(253, 175, 15, 25, 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(287, 175, 15, 25, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3. Детальная фигура Кима Кицураги в оранжевом бомбере слева
        ctx.save();
        // Брюки карго
        ctx.fillStyle = "#161a1d";
        ctx.beginPath();
        ctx.moveTo(65, 430);
        ctx.lineTo(205, 425);
        ctx.lineTo(238, H);
        ctx.lineTo(82, H);
        ctx.closePath();
        ctx.fill();

        // Оранжевый бомбер с проработанными складками и воротником
        const jacketGrad = ctx.createLinearGradient(45, 210, 220, 430);
        jacketGrad.addColorStop(0, "#ff6b1a");
        jacketGrad.addColorStop(0.6, "#c8460e");
        jacketGrad.addColorStop(1, "#6e2206");
        ctx.fillStyle = jacketGrad;
        ctx.beginPath();
        ctx.moveTo(42, 245);
        ctx.lineTo(182, 212);
        ctx.lineTo(222, 338);
        ctx.lineTo(175, 435);
        ctx.lineTo(52, 415);
        ctx.closePath();
        ctx.fill();

        // Белая футболка под расстёгнутым воротом
        ctx.fillStyle = "#d8e2dc";
        ctx.beginPath();
        ctx.moveTo(92, 232);
        ctx.lineTo(132, 228);
        ctx.lineTo(148, 355);
        ctx.lineTo(105, 355);
        ctx.closePath();
        ctx.fill();

        // Нашивка РГМ на груди бомбера
        ctx.strokeStyle = "#e0f2fe";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(158, 278, 12, 0, Math.PI * 2);
        ctx.stroke();

        // Голова Кима, скулы, очки с голубым отблеском лазера
        ctx.fillStyle = "#d4966a";
        ctx.beginPath();
        ctx.moveTo(82, 162);
        ctx.lineTo(132, 156);
        ctx.lineTo(138, 212);
        ctx.lineTo(112, 232);
        ctx.lineTo(84, 216);
        ctx.closePath();
        ctx.fill();

        // Причёска Кима
        ctx.fillStyle = "#141416";
        ctx.beginPath();
        ctx.moveTo(78, 168);
        ctx.quadraticCurveTo(105, 134, 136, 158);
        ctx.lineTo(132, 172);
        ctx.lineTo(82, 174);
        ctx.closePath();
        ctx.fill();

        // Круглые очки Кима, отражающие лазерные лучи
        ctx.fillStyle = "#a5f3fc";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(98, 188, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(122, 184, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 4. ГОЛУБЫЕ ЛАЗЕРНЫЕ ЛУЧИ, ПРОНЗАЮЩИЕ ВСЁ ОКНО НАСКВОЗЬ (и под таблицей S.M.A.R.T.)
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const beams = [
          { x1: 0, y1: 95, x2: W, y2: 460, w: 16 },
          { x1: 80, y1: 0, x2: W, y2: 680, w: 9 },
          { x1: 310, y1: 0, x2: 0, y2: 440, w: 8 },
          { x1: 0, y1: 580, x2: W, y2: 240, w: 12 },
          { x1: 220, y1: H, x2: W, y2: 120, w: 7 },
        ];
        beams.forEach((b, i) => {
          const sway = Math.sin(t * 1.1 + i) * 5;
          ctx.strokeStyle = "rgba(0, 229, 255, 0.28)";
          ctx.lineWidth = b.w * 2.4;
          ctx.beginPath();
          ctx.moveTo(b.x1, b.y1 + sway);
          ctx.lineTo(b.x2, b.y2 - sway);
          ctx.stroke();

          ctx.strokeStyle = "#9bf6ff";
          ctx.lineWidth = b.w * 0.55;
          ctx.beginPath();
          ctx.moveTo(b.x1, b.y1 + sway);
          ctx.lineTo(b.x2, b.y2 - sway);
          ctx.stroke();
        });
        ctx.restore();
      }

      // Парящие живописные частицы по всему холсту
      ctx.save();
      motes.forEach((m, i) => {
        const yPos = (m.y - frame * 0.25 + 820) % 820;
        ctx.fillStyle = m.color;
        ctx.globalAlpha = 0.28 + Math.sin(t + i) * 0.15;
        ctx.fillRect(m.x, yPos, m.r * 2.2, m.r);
      });
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [themeId, customUrl, health, temp]);

  if (customUrl) {
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
        {/* Размытая панорамная подложка на всё окно справа */}
        <img
          src={customUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(28px) saturate(1.5) brightness(0.45)",
            transform: "scale(1.08)",
          }}
        />
        {/* Чёткий полноростовой арт в левой витрине с плавным растворением края */}
        <img
          src={customUrl}
          alt="Custom Artwork"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "440px",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            WebkitMaskImage: "linear-gradient(90deg, #000 78%, transparent 100%)",
            maskImage: "linear-gradient(90deg, #000 78%, transparent 100%)",
          }}
        />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={1280}
      height={820}
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
// 4. ПРОФИЛИ НАКОПИТЕЛЕЙ И РЕПЛИКИ НАВЫКОВ
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
            text: "41 градус Цельсия! Температура горячечного бреда после трёх бутылок «Комодор Ред», но для кремниевого чипа — это сладкая утренняя нега под медным радиатором.",
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
            text: "14 820 гигабайт пронеслись по четырём линиям PCIe 4.0 со скоростью 7000 МБ/с. Контроллер выплёвывает гигабайты быстрее, чем синапсы успевают сформировать мысль.",
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
            text: "Сорок восемь выжженных микрократеров на зеркале магнитного диска! Контроллер отметил их как мёртвую зону и перенёс данные в резервный конец пластины.",
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
            text: "14 нестабильных секторов в регистре C5h. Контрольная сумма ECC в них уже не сходится. При следующем обращении к этим кластерам система зависнет.",
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
// 5. ГЛАВНЫЙ КОМПОНЕНТ «CRYSTALDISKINFO // DISCO ELYSIUM EDITION»
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
  const [lastDice, setLastDice] = useState<[number, number]>([4, 5]);

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
      skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
      category: "PSY",
      difficulty: "Средне: Успех",
      text: "Выбери любой регистр в стеклянной ведомости справа или нажми на кости Белой проверки в центре паспорта, чтобы услышать, о чём шепчет контроллер.",
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const cycleTheme = () => {
    const order: VisualThemeId[] = ["mind_explosion", "church_lasers"];
    if (customArt1) order.push("custom_1");
    if (customArt2) order.push("custom_2");
    const nextIdx = (order.indexOf(visualTheme) + 1) % order.length;
    setVisualTheme(order[nextIdx]);
    soundFX.playClick("GOOD");
  };

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
        skill: `БЕЛАЯ ПРОВЕРКА // ИНТЕРФЕЙС [${d1} + ${d2} ${
          bonus >= 0 ? `+ ${bonus}` : `− ${Math.abs(bonus)}`
        } = ${total} против 8]`,
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
      `CrystalDiskInfo 9.8.0 // Disco Elysium Edition`,
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
        return "#56cfe1";
      case "PSY":
        return "#c77dff";
      case "FYS":
        return "#ff2a85";
      case "MOT":
        return "#ffbe0b";
      case "TIE":
        return "#ff5400";
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
      className="cdi-desktop-backdrop"
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
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500;1,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Oswald:wght@500;600;700&display=swap');

        * { box-sizing: border-box; }
        body, html {
          margin: 0;
          padding: 0;
          background: #06050a;
          color: #f3eee6;
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

        .cdi-desktop-backdrop {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background:
            radial-gradient(circle at 20% 20%, rgba(114, 9, 183, 0.18), transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(255, 72, 0, 0.12), transparent 50%),
            #050408;
        }

        /* НАТИВНОЕ ОКНО ПРИЛОЖЕНИЯ CRYSTALDISKINFO (С ПОЛНОЭКРАННЫМ ХОЛСТОМ ВНУТРИ) */
        .cdi-native-frame {
          width: 100%;
          max-width: 1260px;
          min-height: 820px;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(226, 212, 190, 0.28);
          box-shadow:
            0 30px 90px rgba(0, 0, 0, 0.95),
            0 0 1px 1px rgba(0, 0, 0, 0.8);
          background: #0b0813;
        }

        /* Полноэкранный живописный холст на ВСЁ окно */
        .masterpiece-bg-layer {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        /* Тонкая текстура холста и виньетка */
        .canvas-grain-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(circle at 22% 45%, transparent 35%, rgba(8, 6, 15, 0.58) 100%),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px);
        }

        /* 1. АУТЕНТИЧНАЯ СТРОКА ЗАГОЛОВКА И МЕНЮ (БЕЗ ДЕШЁВЫХ ТАБЛЕТОК И ЭМОДЗИ) */
        .native-titlebar {
          position: relative;
          z-index: 20;
          height: 30px;
          background: rgba(11, 8, 19, 0.92);
          border-bottom: 1px solid rgba(226, 212, 190, 0.14);
          padding: 0 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #d8cfc2;
          user-select: none;
        }
        .window-controls {
          display: flex;
          align-items: center;
          gap: 14px;
          color: #9c9286;
          font-size: 13px;
        }
        .native-menubar {
          position: relative;
          z-index: 20;
          height: 29px;
          background: rgba(18, 14, 28, 0.86);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(226, 212, 190, 0.2);
          padding: 0 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .menu-items-left {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .classic-menu-item {
          background: transparent;
          border: 1px solid transparent;
          color: #e6dfd5;
          padding: 3px 10px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s;
        }
        .classic-menu-item:hover {
          background: rgba(255, 183, 3, 0.16);
          border-color: rgba(255, 183, 3, 0.45);
          color: #fff;
        }
        .scene-switcher-bar {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .scene-tab-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(226, 212, 190, 0.2);
          color: #cbbba0;
          padding: 2px 9px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.12s;
        }
        .scene-tab-btn.active, .scene-tab-btn:hover {
          background: rgba(255, 10, 108, 0.28);
          border-color: #ffb703;
          color: #fff;
        }

        /* 2. ОСНОВНАЯ СЕТКА (СЛЕВА — ОТКРЫТЫЙ ХОЛСТ С ПОРТРЕТОМ, СПРАВА — ПОЛУПРОЗРАЧНЫЙ СТЕНД CDI) */
        .cdi-workspace {
          position: relative;
          z-index: 10;
          flex: 1;
          display: grid;
          grid-template-columns: 390px 1fr;
        }
        @media (max-width: 1024px) {
          .cdi-workspace {
            grid-template-columns: 1fr;
          }
        }

        /* Левая витрина персонажа (прозрачная, чтобы портрет на холсте был виден целиком) */
        .left-portrait-zone {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 755px;
          border-right: 1px solid rgba(226, 212, 190, 0.18);
          position: relative;
        }
        .dialogue-dossier-overlay {
          background: linear-gradient(0deg, rgba(8, 5, 15, 0.96) 0%, rgba(11, 8, 20, 0.86) 78%, transparent 100%);
          padding: 26px 16px 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        /* Правая полупрозрачная область данных (как в Kurei Kei Edition, сквозь неё виден фон холста) */
        .right-telemetry-zone {
          background: rgba(12, 9, 22, 0.56);
          backdrop-filter: blur(8px);
          padding: 10px 18px 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Вкладки дисков в стиле CrystalDiskInfo (строгие прямоугольные плашки) */
        .cdi-disk-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          border-bottom: 1px solid rgba(226, 212, 190, 0.2);
          padding-bottom: 8px;
        }
        .disk-rect-tab {
          min-width: 118px;
          padding: 5px 12px;
          background: rgba(18, 14, 30, 0.72);
          border: 1px solid rgba(226, 212, 190, 0.24);
          color: #d8cfc2;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 9px;
          transition: all 0.14s;
        }
        .disk-rect-tab:hover {
          background: rgba(34, 24, 52, 0.85);
          border-color: rgba(226, 212, 190, 0.5);
        }
        .disk-rect-tab.active {
          background: linear-gradient(180deg, rgba(45, 24, 66, 0.9), rgba(20, 14, 36, 0.92));
          border: 1px solid #ffb703;
          box-shadow: inset 0 2px 0 #ff0a6c;
          color: #fff;
        }
        .disk-letter-big {
          font-size: 18px;
          font-weight: 700;
          color: #ffb703;
          line-height: 1;
        }

        /* Заголовок модели диска */
        .model-header-strip {
          text-align: center;
          padding: 4px 8px 6px 8px;
          border-bottom: 1px solid rgba(226, 212, 190, 0.18);
        }
        .model-name-serif {
          margin: 0;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #ffffff;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
        }

        /* Двухколоночный паспорт диска + центральная эмблема Белой проверки 2d6 */
        .passport-columns {
          display: grid;
          grid-template-columns: 1fr 94px 1fr;
          gap: 12px;
          align-items: center;
        }
        @media (max-width: 780px) {
          .passport-columns { grid-template-columns: 1fr; }
        }
        .spec-stack {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .spec-line {
          display: grid;
          grid-template-columns: 132px 1fr;
          align-items: center;
          gap: 8px;
        }
        .spec-caption {
          text-align: right;
          font-size: 12px;
          color: #d4c8b8;
          text-shadow: 0 1px 2px #000;
          white-space: nowrap;
        }
        .spec-value-plate {
          height: 25px;
          padding: 0 9px;
          display: flex;
          align-items: center;
          background: rgba(9, 7, 16, 0.66);
          border: 1px solid rgba(226, 212, 190, 0.25);
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.75);
          color: #f8f5f0;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Центральная эмблема Белой проверки 2d6 (вместо дешёвого эмодзи) */
        .white-check-emblem {
          width: 88px;
          height: 132px;
          margin: 0 auto;
          background: linear-gradient(180deg, rgba(28, 16, 42, 0.88), rgba(14, 9, 24, 0.94));
          border: 1.5px solid #d4a359;
          box-shadow: inset 0 0 12px rgba(255, 183, 3, 0.2), 0 4px 14px rgba(0,0,0,0.75);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          padding: 6px;
          transition: all 0.16s ease;
        }
        .white-check-emblem:hover {
          border-color: #fff;
          background: linear-gradient(180deg, rgba(255, 10, 108, 0.32), rgba(255, 72, 0, 0.28));
          transform: translateY(-1px);
        }

        /* Строгие прямоугольные индикаторы ТЕХСОСТОЯНИЕ и ТЕМПЕРАТУРА (с фаской, без круглых таблеток) */
        .status-plates-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 2px 0;
        }
        @media (max-width: 680px) {
          .status-plates-row { grid-template-columns: 1fr; }
        }
        .status-plate-wrap {
          display: grid;
          grid-template-columns: 132px 1fr;
          align-items: center;
          gap: 8px;
        }
        .cdi-beveled-plate {
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.42);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 10px rgba(0,0,0,0.6);
          text-shadow: 0 1px 3px rgba(0,0,0,0.9);
        }
        .plate-good {
          background: linear-gradient(180deg, rgba(16, 138, 158, 0.88) 0%, rgba(11, 82, 107, 0.94) 100%);
          border-color: #56cfe1;
        }
        .plate-caution {
          background: linear-gradient(180deg, rgba(217, 119, 6, 0.9) 0%, rgba(146, 64, 14, 0.95) 100%);
          border-color: #ffb703;
        }
        .plate-bad {
          background: linear-gradient(180deg, rgba(209, 27, 70, 0.92) 0%, rgba(115, 11, 38, 0.96) 100%);
          border-color: #ff4d6d;
        }

        /* Полупрозрачная таблица S.M.A.R.T. */
        .smart-grid-container {
          flex: 1;
          background: rgba(9, 7, 16, 0.68);
          border: 1px solid rgba(226, 212, 190, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .smart-grid-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .smart-grid-table th {
          background: rgba(24, 18, 38, 0.88);
          color: #d8cfc2;
          font-weight: 600;
          padding: 6px 10px;
          text-align: left;
          border-bottom: 1px solid rgba(226, 212, 190, 0.25);
          white-space: nowrap;
        }
        .smart-grid-table td {
          padding: 5.5px 10px;
          border-bottom: 1px solid rgba(226, 212, 190, 0.08);
          color: #f3eee6;
        }
        .smart-grid-table tr {
          cursor: pointer;
          transition: background 0.1s;
        }
        .smart-grid-table tr:hover td {
          background: rgba(255, 10, 108, 0.16);
        }
        .smart-grid-table tr.active-row td {
          background: linear-gradient(90deg, rgba(255, 10, 108, 0.32), rgba(86, 207, 225, 0.18));
          border-top: 1px solid rgba(255, 183, 3, 0.65);
          border-bottom: 1px solid rgba(255, 183, 3, 0.65);
        }
        .diamond-led {
          width: 9px;
          height: 9px;
          display: inline-block;
          transform: rotate(45deg);
        }
        .led-good {
          background: #56cfe1;
          box-shadow: 0 0 6px #56cfe1;
        }
        .led-caution {
          background: #ffb703;
          box-shadow: 0 0 6px #ffb703;
        }
        .led-bad {
          background: #ff2a85;
          box-shadow: 0 0 8px #ff2a85;
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
            background: "rgba(18, 9, 36, 0.85)",
            zIndex: 99,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed #ffb703",
          }}
        >
          <div className="font-serif-disco" style={{ fontSize: "28px", color: "#fff" }}>
            Отпустите иллюстрацию, чтобы поместить её на холст
          </div>
        </div>
      )}

      {/* НАТИВНОЕ ОКНО CRYSTALDISKINFO // DISCO ELYSIUM EDITION */}
      <div className="cdi-native-frame">
        {/* ПОЛНОЭКРАННЫЙ ХУДОЖЕСТВЕННЫЙ ХОЛСТ НА ВСЁ ОКНО */}
        <div className="masterpiece-bg-layer">
          <FullWindowMasterpieceCanvas
            themeId={visualTheme}
            customUrl={activeCustomUrl}
            health={effectiveHealth}
            temp={effectiveTemp}
          />
        </div>
        <div className="canvas-grain-overlay" />

        {/* 1. СТРОГИЙ ВЕРХНИЙ ЗАГОЛОВОК ОКНА */}
        <div className="native-titlebar">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                background: "#ffb703",
                transform: "rotate(45deg)",
                display: "inline-block",
              }}
            />
            <span style={{ fontWeight: 600, letterSpacing: "0.02em" }}>
              CrystalDiskInfo 9.8.0 Disco Elysium Edition x64
            </span>
          </div>
          <div className="window-controls font-mono">
            <span>─</span>
            <span>□</span>
            <span>×</span>
          </div>
        </div>

        {/* 2. КЛАССИЧЕСКАЯ СТРОКА МЕНЮ (БЕЗ ЭМОДЗИ И ПЕРЕНОСОВ СТРОК) */}
        <nav className="native-menubar">
          <div className="menu-items-left">
            <button onClick={() => setShowImportModal(true)} className="classic-menu-item">
              Файл (Импорт S.M.A.R.T.)
            </button>
            <button onClick={copySmartReport} className="classic-menu-item">
              Правка (Копировать отчёт)
            </button>
            <button onClick={handleRollDice} className="classic-menu-item">
              Сервис (Проверка 2d6)
            </button>
            <button
              onClick={() => setRawFormat((p) => (p === "HEX16" ? "DEC10" : "HEX16"))}
              className="classic-menu-item"
            >
              Вид ({rawFormat === "HEX16" ? "HEX 16" : "DEC 10"})
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="classic-menu-item">
              Холст (Загрузить свой арт...)
            </button>
            <button
              onClick={() => {
                soundFX.enabled = !soundOn;
                setSoundOn(!soundOn);
              }}
              className="classic-menu-item"
            >
              Акустика ({soundOn ? "ВКЛ" : "ВЫКЛ"})
            </button>
          </div>

          <div className="scene-switcher-bar">
            <button
              onClick={() => setVisualTheme("mind_explosion")}
              className={`scene-tab-btn ${visualTheme === "mind_explosion" ? "active" : ""}`}
            >
              I. Взрыв Сознания (B&apos; B&apos;&apos;)
            </button>
            <button
              onClick={() => setVisualTheme("church_lasers")}
              className={`scene-tab-btn ${visualTheme === "church_lasers" ? "active" : ""}`}
            >
              II. Церковь и Долорес
            </button>
            {customArt1 && (
              <button
                onClick={() => setVisualTheme("custom_1")}
                className={`scene-tab-btn ${visualTheme === "custom_1" ? "active" : ""}`}
              >
                III. Свой Холст #1
              </button>
            )}
            {customArt2 && (
              <button
                onClick={() => setVisualTheme("custom_2")}
                className={`scene-tab-btn ${visualTheme === "custom_2" ? "active" : ""}`}
              >
                IV. Свой Холст #2
              </button>
            )}
          </div>
        </nav>

        {/* 3. РАБОЧАЯ ОБЛАСТЬ ОКНА */}
        <div className="cdi-workspace">
          {/* ЛЕВАЯ ЧАСТЬ: ОТКРЫТОЕ ПОЛОТНО С ПЕРСОНАЖЕМ + ДОСЬЕ ГОЛОСОВ ВНИЗУ */}
          <aside className="left-portrait-zone" onClick={cycleTheme} title="Нажмите на картину для смены сцены">
            <div className="dialogue-dossier-overlay" onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  borderBottom: "1px solid rgba(226, 212, 190, 0.25)",
                  paddingBottom: "4px",
                }}
              >
                <span className="font-oswald" style={{ fontSize: "11.5px", color: "#ffb703" }}>
                  Внутренний монолог // Регистр {selectedAttrId}h
                </span>
                <span className="font-mono" style={{ fontSize: "11px", color: "#56cfe1" }}>
                  2d6: [{lastDice[0]}][{lastDice[1]}]
                </span>
              </div>

              <div
                style={{
                  maxHeight: "205px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  paddingRight: "4px",
                }}
              >
                {thoughts.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      borderLeft: `2.5px solid ${getSkillColor(t.category)}`,
                      paddingLeft: "10px",
                    }}
                  >
                    <div>
                      <span
                        className="font-oswald"
                        style={{ fontSize: "12px", color: getSkillColor(t.category) }}
                      >
                        {t.skill}
                      </span>
                      {t.difficulty && (
                        <span
                          className="font-serif-disco"
                          style={{
                            fontSize: "13px",
                            color: "#cbbba0",
                            marginLeft: "6px",
                            fontStyle: "italic",
                          }}
                        >
                          [{t.difficulty}]
                        </span>
                      )}
                    </div>
                    <div
                      className="font-serif-disco"
                      style={{
                        fontSize: "15.5px",
                        lineHeight: 1.38,
                        color: "#f8f5f0",
                        marginTop: "2px",
                      }}
                    >
                      — {t.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ПРАВАЯ ЧАСТЬ: ПОЛУПРОЗРАЧНЫЙ ТЕХНИЧЕСКИЙ СТЕНД CRYSTALDISKINFO */}
          <main className="right-telemetry-zone">
            {/* Вкладки дисков (как в CrystalDiskInfo) */}
            <div className="cdi-disk-selector">
              {drives.map((drv, idx) => {
                const ledClass =
                  drv.healthStatus === "GOOD"
                    ? "led-good"
                    : drv.healthStatus === "CAUTION"
                    ? "led-caution"
                    : "led-bad";
                return (
                  <button
                    key={drv.id}
                    onClick={() => handleSelectDrive(idx)}
                    className={`disk-rect-tab ${idx === activeDriveIdx ? "active" : ""}`}
                  >
                    <span className={`diamond-led ${ledClass}`} />
                    <div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600 }}>
                        {drv.healthStatus === "GOOD"
                          ? "Хорошо"
                          : drv.healthStatus === "CAUTION"
                          ? "Тревога"
                          : "Серота"}{" "}
                        ({drv.healthPercent}%)
                      </div>
                      <div className="font-mono" style={{ fontSize: "11.5px", color: "#d8cfc2" }}>
                        {drv.temperature} °C
                      </div>
                    </div>
                    <span className="disk-letter-big font-oswald">{drv.letter}</span>
                  </button>
                );
              })}
            </div>

            {/* Заголовок модели и ёмкости */}
            <div className="model-header-strip">
              <h1 className="model-name-serif">
                {activeDrive.model} : {activeDrive.capacityGB.toFixed(1)} GB
              </h1>
            </div>

            {/* Двухколоночный паспорт накопителя + кастомная векторная эмблема 2d6 */}
            <div className="passport-columns">
              <div className="spec-stack">
                <div className="spec-line">
                  <span className="spec-caption">Прошивка</span>
                  <div className="spec-value-plate font-mono">{activeDrive.firmware}</div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Серийный номер</span>
                  <div className="spec-value-plate font-mono">{activeDrive.serial}</div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Интерфейс</span>
                  <div className="spec-value-plate font-mono">{activeDrive.interfaceType}</div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Режим передачи</span>
                  <div className="spec-value-plate font-mono">{activeDrive.transferMode}</div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Буква тома</span>
                  <div className="spec-value-plate font-mono">
                    {activeDrive.letter} ({activeDrive.name})
                  </div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Стандарт</span>
                  <div className="spec-value-plate font-mono">{activeDrive.standard}</div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Возможности</span>
                  <div className="spec-value-plate font-mono">{activeDrive.features}</div>
                </div>
              </div>

              {/* Кастомная векторная эмблема Белой проверки 2d6 (без эмодзи) */}
              <button
                onClick={handleRollDice}
                className="white-check-emblem"
                title="Выполнить Белую проверку навыка Интерфейс (2d6)"
              >
                <svg width="54" height="54" viewBox="0 0 60 60">
                  <polygon
                    points="30,3 57,30 30,57 3,30"
                    fill="none"
                    stroke="#ffb703"
                    strokeWidth="2"
                  />
                  {/* Первая кость */}
                  <rect
                    x="13"
                    y="17"
                    width="17"
                    height="17"
                    rx="2"
                    fill="#f3eee6"
                    stroke="#111"
                    strokeWidth="1.5"
                  />
                  <circle cx="18" cy="22" r="1.7" fill="#111" />
                  <circle cx="25" cy="29" r="1.7" fill="#111" />
                  {/* Вторая кость */}
                  <rect
                    x="29"
                    y="26"
                    width="17"
                    height="17"
                    rx="2"
                    fill="#ffb703"
                    stroke="#111"
                    strokeWidth="1.5"
                  />
                  <circle cx="34" cy="31" r="1.6" fill="#111" />
                  <circle cx="37.5" cy="34.5" r="1.6" fill="#111" />
                  <circle cx="41" cy="38" r="1.6" fill="#111" />
                </svg>
                <span
                  className="font-oswald"
                  style={{ fontSize: "10.5px", color: "#f3eee6", textAlign: "center", lineHeight: 1.2 }}
                >
                  ПРОВЕРКА 2D6
                  <br />
                  <span style={{ color: "#ffb703" }}>ДОПРОС ЧИПА</span>
                </span>
              </button>

              <div className="spec-stack">
                <div className="spec-line">
                  <span className="spec-caption">Всего хост-чтений</span>
                  <div className="spec-value-plate font-mono">
                    {activeDrive.totalReadsGB.toLocaleString("ru-RU")} GB
                  </div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Всего хост-записей</span>
                  <div className="spec-value-plate font-mono">
                    {activeDrive.totalWritesGB.toLocaleString("ru-RU")} GB
                  </div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Скорость вращения</span>
                  <div className="spec-value-plate font-mono">{activeDrive.rotationRate}</div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Число включений</span>
                  <div className="spec-value-plate font-mono">
                    {activeDrive.powerOnCount.toLocaleString("ru-RU")} раз
                  </div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Общее время работы</span>
                  <div className="spec-value-plate font-mono">
                    {activeDrive.powerOnHours.toLocaleString("ru-RU")} ч
                  </div>
                </div>
                <div className="spec-line">
                  <span className="spec-caption">Тепловой сдвиг</span>
                  <div className="spec-value-plate" style={{ gap: "8px" }}>
                    <input
                      type="range"
                      min={-10}
                      max={25}
                      value={tempOffset}
                      onChange={(e) => setTempOffset(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#ffb703", cursor: "pointer" }}
                    />
                    <span className="font-mono" style={{ fontSize: "11px", color: "#ffb703" }}>
                      {tempOffset >= 0 ? `+${tempOffset}°` : `${tempOffset}°`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Две широкие прямоугольные плашки ТЕХСОСТОЯНИЕ и ТЕМПЕРАТУРА (в пропорциях CrystalDiskInfo) */}
            <div className="status-plates-row">
              <div className="status-plate-wrap">
                <span className="spec-caption" style={{ fontWeight: 600 }}>
                  Техсостояние
                </span>
                <div
                  className={`cdi-beveled-plate ${
                    effectiveHealth === "GOOD"
                      ? "plate-good"
                      : effectiveHealth === "CAUTION"
                      ? "plate-caution"
                      : "plate-bad"
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

              <div className="status-plate-wrap">
                <span className="spec-caption" style={{ fontWeight: 600 }}>
                  Температура
                </span>
                <div
                  className={`cdi-beveled-plate font-mono ${
                    effectiveTemp < 50
                      ? "plate-good"
                      : effectiveTemp < 60
                      ? "plate-caution"
                      : "plate-bad"
                  }`}
                >
                  <span>{effectiveTemp} °C</span>
                </div>
              </div>
            </div>

            {/* Полупрозрачная таблица S.M.A.R.T. */}
            <div className="smart-grid-container">
              <div style={{ overflowX: "auto", flex: 1 }}>
                <table className="smart-grid-table">
                  <thead>
                    <tr>
                      <th style={{ width: "34px" }}></th>
                      <th style={{ width: "44px" }}>ID</th>
                      <th>Атрибут</th>
                      <th style={{ textAlign: "right" }}>Текущее</th>
                      <th style={{ textAlign: "right" }}>Наихудшее</th>
                      <th style={{ textAlign: "right" }}>Порог</th>
                      <th style={{ textAlign: "right" }}>Raw-значения</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDrive.attributes.map((attr) => {
                      const ledClass =
                        attr.status === "GOOD"
                          ? "led-good"
                          : attr.status === "CAUTION"
                          ? "led-caution"
                          : "led-bad";
                      return (
                        <tr
                          key={attr.id}
                          onClick={() => handleSelectAttribute(attr)}
                          className={selectedAttrId === attr.id ? "active-row" : ""}
                        >
                          <td style={{ textAlign: "center" }}>
                            <span className={`diamond-led ${ledClass}`} />
                          </td>
                          <td className="font-mono" style={{ fontWeight: 700, color: "#56cfe1" }}>
                            {attr.id}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{attr.ruName}</div>
                            <div style={{ fontSize: "11px", color: "#a89f91" }}>{attr.name}</div>
                          </td>
                          <td className="font-mono" style={{ textAlign: "right" }}>
                            {attr.current}
                          </td>
                          <td className="font-mono" style={{ textAlign: "right" }}>
                            {attr.worst}
                          </td>
                          <td className="font-mono" style={{ textAlign: "right", color: "#9c9286" }}>
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
                                  ? "#ffb703"
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

      {/* МОДАЛЬНОЕ ОКНО ИМПОРТА ОТЧЁТА СВОЕГО ПК */}
      {showImportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6, 4, 12, 0.85)",
            backdropFilter: "blur(8px)",
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
              background: "#120d20",
              border: "1px solid #d4a359",
              padding: "22px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.9)",
            }}
          >
            <h3
              className="font-serif-disco"
              style={{ margin: "0 0 8px 0", fontSize: "22px", color: "#ffb703" }}
            >
              Импорт S.M.A.R.T.-отчёта вашего компьютера
            </h3>
            <p style={{ margin: "0 0 12px 0", color: "#d8cfc2", fontSize: "13px" }}>
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
                background: "#080610",
                border: "1px solid rgba(226, 212, 190, 0.3)",
                color: "#fff",
                padding: "10px",
                fontSize: "12px",
                marginBottom: "14px",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={() => setShowImportModal(false)} className="classic-menu-item">
                Отмена
              </button>
              <button
                onClick={handleImportSubmit}
                className="classic-menu-item"
                style={{ border: "1px solid #ffb703", color: "#ffb703" }}
              >
                Загрузить телеметрию
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
