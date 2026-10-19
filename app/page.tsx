"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

// ============================================================================
// 1. ТИПЫ ДАННЫХ CRYSTALDISKINFO // DISCO ELYSIUM EDITION
// ============================================================================

type HealthState = "GOOD" | "CAUTION" | "BAD";
type VisualThemeId = "the_expression" | "dolores_pieta" | "mind_explosion" | "custom_1" | "custom_2";

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
  nandEndurance: string;
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
      osc.frequency.setValueAtTime(status === "BAD" ? 145 : 460, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.042);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.048);
    } catch {}
  }

  playPrismChord(success: boolean) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const notes = success ? [196.0, 246.94, 293.66, 369.99, 440.0] : [98.0, 103.83, 146.83];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = success ? "triangle" : "sawtooth";
        osc.frequency.setValueAtTime(freq, t + i * 0.04);
        g.gain.setValueAtTime(0.001, t + i * 0.04);
        g.gain.linearRampToValueAtTime(success ? 0.048 : 0.035, t + i * 0.04 + 0.07);
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
// 3. ЖИВОПИСНЫЙ ДВИЖОК ЩЕТИННОЙ КИСТИ И МАСТИХИНА (IMPASTO BRISTLE ENGINE)
// ============================================================================

function PainterlyMasterpieceCanvas({
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

    const W = canvas.width;
    const H = canvas.height;

    // Офскрин-холст для тяжёлой многослойной масляной живописи (рендерится 1 раз при смене сцены)
    const offscreen = document.createElement("canvas");
    offscreen.width = W;
    offscreen.height = H;
    const octx = offscreen.getContext("2d");
    if (!octx) return;

    let seed =
      themeId === "the_expression" ? 7712 : themeId === "dolores_pieta" ? 4913 : 9281;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // Функция густого мазка щетинной кисти (рисует пучок волосков с рельефом краски)
    const bristleStroke = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      thickness: number,
      color: string,
      alpha = 0.85,
      highlightColor?: string
    ) => {
      octx.save();
      const bristles = Math.max(3, Math.floor(thickness / 2.2));
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;

      for (let b = 0; b < bristles; b++) {
        const offset = ((b / (bristles - 1)) - 0.5) * thickness;
        const jitter = (rand() - 0.5) * 3.5;
        octx.globalAlpha = alpha * (0.65 + rand() * 0.35);
        octx.strokeStyle = b === 0 && highlightColor ? highlightColor : color;
        octx.lineWidth = Math.max(1.2, (thickness / bristles) * 1.45);
        octx.lineCap = "round";
        octx.beginPath();
        octx.moveTo(x1 + nx * offset, y1 + ny * offset);
        octx.quadraticCurveTo(
          (x1 + x2) * 0.5 + nx * (offset + jitter),
          (y1 + y2) * 0.5 + ny * (offset + jitter),
          x2 + nx * offset,
          y2 + ny * offset
        );
        octx.stroke();
      }
      octx.restore();
    };

    // Мазок мастихина (плоская фактурная плашка с рваным краем)
    const knifeDab = (
      cx: number,
      cy: number,
      w: number,
      h: number,
      angle: number,
      color: string,
      alpha = 0.88
    ) => {
      octx.save();
      octx.translate(cx, cy);
      octx.rotate(angle);
      octx.globalAlpha = alpha;
      octx.fillStyle = color;
      octx.beginPath();
      octx.moveTo(-w * 0.5, -h * 0.45);
      octx.lineTo(w * 0.52, -h * 0.5);
      octx.lineTo(w * 0.46, h * 0.52);
      octx.lineTo(-w * 0.48, h * 0.46);
      octx.closePath();
      octx.fill();
      octx.restore();
    };

    if (themeId === "the_expression") {
      // ======================================================================
      // СЦЕНА I: «УХМЫЛКА КУСТО / THE EXPRESSION» (по референсу image_622444)
      // ======================================================================

      // 1. Фон на всё окно: тёмно-оливковый и бирюзово-янтарный кабинет справа + светлый ореол слева
      const bg = octx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#1f302b");
      bg.addColorStop(0.35, "#192421");
      bg.addColorStop(0.75, "#121716");
      bg.addColorStop(1, "#0b0e0d");
      octx.fillStyle = bg;
      octx.fillRect(0, 0, W, H);

      // 2. Широкие диагональные мазки мастихином позади головы (охра, горчичный, бирюза и кремовый свет)
      bristleStroke(-20, 210, 240, -30, 95, "#d89228", 0.92, "#f2b84b");
      bristleStroke(120, 290, 420, -20, 88, "#357873", 0.82, "#5cb5ad");
      bristleStroke(240, 420, 560, 80, 92, "#c97a22", 0.78, "#eab354");
      bristleStroke(340, 620, 880, 120, 140, "#182c29", 0.55);
      bristleStroke(520, 740, 1180, 180, 160, "#241b14", 0.45);

      // 3. Яркий кремово-пергаментный ореол мастихином вокруг головы Гарри (как на image_622444)
      const haloSpots = [
        [195, 225, 235, 260, -0.25],
        [155, 265, 210, 240, 0.18],
        [245, 275, 210, 250, -0.4],
        [195, 360, 240, 210, 0.08],
      ];
      haloSpots.forEach(([x, y, w, h, a]) => {
        knifeDab(x, y, w, h, a, "#e8ebd5", 0.94);
      });
      // Жёлто-охристые диагональные прочерки по углам ореола
      bristleStroke(10, 125, 165, -10, 48, "#d98a26", 0.94, "#f4b942");
      bristleStroke(295, 290, 415, 165, 54, "#d98a26", 0.9, "#f4b942");

      // 4. Оливково-зелёный диско-пиджак Гарри с широкими лацканами
      bristleStroke(65, 505, 18, 820, 115, "#2b3d1c", 0.98, "#435c2d");
      bristleStroke(135, 495, 110, 820, 110, "#384f25", 0.98, "#516e38");
      bristleStroke(265, 515, 365, 820, 125, "#233315", 0.98, "#384f25");
      bristleStroke(235, 540, 275, 820, 95, "#19260f", 0.96);

      // Белая рубашка с огромным острым диско-воротником 70-х поверх пиджака
      octx.save();
      octx.fillStyle = "#cfd6cc";
      octx.beginPath();
      octx.moveTo(138, 452);
      octx.lineTo(104, 628); // Острый левый конец воротника
      octx.lineTo(165, 558);
      octx.lineTo(175, 800);
      octx.lineTo(228, 800);
      octx.lineTo(234, 565);
      octx.lineTo(286, 615); // Острый правый конец воротника
      octx.lineTo(246, 468);
      octx.closePath();
      octx.fill();

      // Серо-оливковые тени на воротнике и рубашке
      bristleStroke(148, 520, 168, 760, 28, "#8c968b", 0.85);
      bristleStroke(222, 525, 214, 760, 28, "#737d72", 0.85);

      // Ужасающий галстук (зелёно-горчично-терракотовый узор)
      bristleStroke(194, 535, 198, 790, 34, "#3f4f22", 0.96);
      knifeDab(196, 585, 24, 34, 0.25, "#c98324", 0.95);
      knifeDab(198, 645, 26, 32, -0.3, "#b84a28", 0.92);
      knifeDab(195, 705, 24, 36, 0.15, "#d49b35", 0.92);
      octx.restore();

      // 5. Подбородок и шея в серо-пепельной тени (как на референсе image_622444)
      knifeDab(195, 455, 88, 70, 0.05, "#6b6a65", 0.96);
      knifeDab(196, 432, 76, 46, -0.04, "#8c8b85", 0.96);
      knifeDab(202, 444, 48, 28, 0.1, "#aba9a2", 0.9);

      // 6. Основа лица — пастозная лепка мастихином
      // Серо-телесная теневая сторона слева и тёплая розовато-охристая справа
      knifeDab(162, 275, 85, 145, -0.08, "#b5a69b", 0.96);
      knifeDab(228, 285, 88, 145, 0.08, "#c99782", 0.96);
      knifeDab(198, 245, 125, 95, -0.02, "#d8cfc4", 0.96);

      // Знаменитый яркий чисто-белый блик мастихином посреди лба (визитная карточка портрета Гарри)
      knifeDab(192, 222, 48, 62, -0.32, "#f7f9f4", 0.98);
      knifeDab(208, 248, 56, 34, 0.15, "#f7f9f4", 0.96);

      // Правое ухо (для зрителя слева) в тёплом красновато-коричневом рефлексе
      knifeDab(106, 298, 28, 64, -0.12, "#8f3f34", 0.95);
      knifeDab(108, 302, 16, 42, -0.12, "#592019", 0.92);

      // 7. Похмельный багрово-терракотовый румянец вокруг глаз, на переносице и кончике носа
      const redZones = [
        [168, 305, 58, 38, 0.12, "#9e3b2e"], // Левая глазница и мешок под глазом
        [242, 315, 54, 38, -0.15, "#8c2f23"], // Правая глазница
        [205, 338, 44, 48, 0.05, "#b84635"], // Нос
        [152, 342, 48, 42, -0.2, "#c77d6b"], // Левая скула
        [248, 352, 42, 42, 0.2, "#9e4738"], // Правая скула
      ];
      redZones.forEach(([x, y, w, h, a, col]) => {
        knifeDab(x as number, y as number, w as number, h as number, a as number, col as string, 0.88);
      });

      // Светлый мазок на спинке и кончике носа
      knifeDab(206, 318, 16, 38, 0.08, "#e3b8a6", 0.92);
      knifeDab(198, 342, 18, 14, 0, "#d96b59", 0.94);

      // 8. Прищуренные уставшие глаза с тёмными веками и крошечными живыми бликами
      // Левый глаз (приподнят в ироничном прищуре)
      bristleStroke(142, 276, 192, 286, 9, "#36221c", 0.95); // Бровь
      knifeDab(168, 302, 36, 16, 0.12, "#4a1c17", 0.95);
      knifeDab(168, 301, 22, 7, 0.12, "#1a0d0b", 0.98);
      knifeDab(164, 301, 5, 4, 0, "#e2dcd5", 0.92); // Белок/блик

      // Правый глаз (сильнее затенён и прищурен)
      bristleStroke(222, 292, 266, 286, 10, "#2b1a15", 0.95); // Бровь
      knifeDab(242, 312, 34, 16, -0.1, "#3d1612", 0.95);
      knifeDab(240, 312, 20, 7, -0.1, "#140908", 0.98);
      knifeDab(242, 312, 4, 4, 0, "#d8c8be", 0.9);

      // Мешки и морщины под глазами и на лбу тонкой кистью
      octx.strokeStyle = "#3d221c";
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(148, 312);
      octx.quadraticCurveTo(168, 322, 188, 312);
      octx.moveTo(224, 320);
      octx.quadraticCurveTo(242, 328, 258, 318);
      // Морщины на лбу
      octx.moveTo(168, 232);
      octx.quadraticCurveTo(205, 245, 248, 236);
      octx.moveTo(175, 248);
      octx.quadraticCurveTo(212, 258, 244, 252);
      octx.stroke();

      // 9. Знаменитые густые бакенбарды и усы Кусто, переходящие друг в друга
      // Левая бакенбарда
      for (let i = 0; i < 18; i++) {
        bristleStroke(
          112 + (i % 4) * 8,
          295 + i * 5,
          96 + (i % 5) * 10,
          365 + i * 4,
          14,
          i % 3 === 0 ? "#3d251b" : "#1f130e",
          0.94,
          "#59382b"
        );
      }
      // Правая бакенбарда
      for (let i = 0; i < 16; i++) {
        bristleStroke(
          262 + (i % 3) * 6,
          315 + i * 5,
          278 - (i % 4) * 6,
          378 + i * 4,
          14,
          i % 3 === 0 ? "#331e16" : "#170e0a",
          0.94
        );
      }
      // Густые нависающие усы
      bristleStroke(132, 385, 198, 362, 28, "#291811", 0.96, "#4d2f22");
      bristleStroke(198, 362, 258, 392, 26, "#1f120d", 0.96, "#3d241a");
      bristleStroke(145, 396, 185, 375, 22, "#382118", 0.95);

      // 10. Кривая зубастая ухмылка «Выражения» (The Expression)
      octx.save();
      octx.fillStyle = "#170b09";
      octx.beginPath();
      octx.moveTo(164, 386);
      octx.quadraticCurveTo(198, 412, 232, 394);
      octx.quadraticCurveTo(198, 426, 164, 386);
      octx.closePath();
      octx.fill();

      // Белый ряд зубов в ухмылке и розовая нижняя губа
      bristleStroke(172, 392, 218, 398, 8, "#e8e4dc", 0.95);
      bristleStroke(176, 405, 216, 409, 9, "#c46b5e", 0.92, "#e08e82");
      octx.restore();

      // 11. Растрёпанная шевелюра сверху с выбивающимися прядями на лоб
      for (let h = 0; h < 28; h++) {
        const hx = 115 + (h / 28) * 165;
        const hy = 185 - Math.sin((h / 28) * Math.PI) * 38 + (rand() - 0.5) * 18;
        bristleStroke(
          hx,
          hy + 35,
          hx + (rand() - 0.3) * 45,
          hy - 22,
          16,
          h % 4 === 0 ? "#42342f" : h % 2 === 0 ? "#261d1a" : "#17110f",
          0.94,
          "#5c4942"
        );
      }
      // Тонкие графичные волоски, падающие на белый блик лба
      octx.strokeStyle = "#1c1513";
      octx.lineWidth = 2.2;
      octx.beginPath();
      octx.moveTo(215, 182);
      octx.quadraticCurveTo(238, 218, 218, 242);
      octx.moveTo(232, 188);
      octx.quadraticCurveTo(252, 225, 235, 252);
      octx.moveTo(265, 212);
      octx.quadraticCurveTo(302, 218, 315, 235);
      octx.stroke();
    } else if (themeId === "dolores_pieta") {
      // ======================================================================
      // СЦЕНА II: «ПЬЕТА ДОЛОРЕС / СВЕТЯЩИЕСЯ ЛЁГКИЕ» (по референсу image_62245f)
      // ======================================================================

      // 1. Глубокий ночной фон с берлинской лазурью, кармином и золотым сиянием
      const bg = octx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#1d283a");
      bg.addColorStop(0.35, "#1a1423");
      bg.addColorStop(0.75, "#0d0b14");
      bg.addColorStop(1, "#06050a");
      octx.fillStyle = bg;
      octx.fillRect(0, 0, W, H);

      // Живописные облака кармина и охры в верхней части холста
      for (let i = 0; i < 45; i++) {
        const cx = rand() * 680;
        const cy = rand() * 440;
        const col =
          i % 3 === 0 ? "#7a1c24" : i % 3 === 1 ? "#2b4162" : "#8f5b28";
        knifeDab(cx, cy, 65 + rand() * 80, 45 + rand() * 60, rand() * Math.PI, col, 0.38);
      }

      // 2. Сияющий ореол золотых лёгких Долорес Дей
      const lungGlow = octx.createRadialGradient(225, 185, 10, 225, 185, 240);
      lungGlow.addColorStop(0, "rgba(255, 250, 205, 0.98)");
      lungGlow.addColorStop(0.3, "rgba(245, 158, 11, 0.72)");
      lungGlow.addColorStop(0.65, "rgba(185, 28, 28, 0.32)");
      lungGlow.addColorStop(1, "transparent");
      octx.fillStyle = lungGlow;
      octx.fillRect(0, 0, 580, 480);

      // Фигура и склонённый лик Долорес Дей вверху
      bristleStroke(145, 95, 315, 115, 95, "#6e3b32", 0.75, "#b86b52");
      knifeDab(245, 58, 68, 78, 0.25, "#c98a63", 0.92);
      knifeDab(235, 68, 48, 52, 0.25, "#e6b891", 0.92);
      // Прикрытые веки и мягкая полуулыбка Долорес
      bristleStroke(218, 56, 238, 62, 4, "#4a2518", 0.9);
      bristleStroke(252, 64, 268, 66, 4, "#4a2518", 0.9);
      bristleStroke(222, 86, 242, 89, 4, "#5c2c1d", 0.9);

      // 3. Два светящихся золотых лёгких с бронхиальным деревом
      octx.save();
      // Левое и правое лёгкое
      knifeDab(192, 182, 54, 88, 0.18, "#fde68a", 0.96);
      knifeDab(248, 186, 54, 88, -0.18, "#fde68a", 0.96);
      knifeDab(194, 182, 38, 68, 0.18, "#fffbeb", 0.95);
      knifeDab(246, 186, 38, 68, -0.18, "#fffbeb", 0.95);

      // Трахея и ветвящиеся бронхи внутри лёгких
      octx.strokeStyle = "#f59e0b";
      octx.lineWidth = 2.2;
      octx.beginPath();
      octx.moveTo(222, 118);
      octx.lineTo(220, 155);
      octx.lineTo(192, 178);
      octx.moveTo(220, 155);
      octx.lineTo(248, 182);
      octx.stroke();

      // Тонкие золотые лучи вокруг лёгких
      octx.strokeStyle = "rgba(254, 240, 138, 0.45)";
      octx.lineWidth = 1.2;
      for (let a = 0; a < Math.PI * 2; a += 0.22) {
        octx.beginPath();
        octx.moveTo(220 + Math.cos(a) * 52, 184 + Math.sin(a) * 52);
        octx.lineTo(220 + Math.cos(a) * 92, 184 + Math.sin(a) * 92);
        octx.stroke();
      }
      octx.restore();

      // 4. Кроваво-багровые потёки масляной краски слева (как на референсе image_62245f)
      for (let d = 0; d < 32; d++) {
        const dx = 18 + d * 5.2;
        const dyStart = 290 + (rand() - 0.5) * 80;
        const dyEnd = 520 + rand() * 290;
        bristleStroke(
          dx,
          dyStart,
          dx + (rand() - 0.5) * 4,
          dyEnd,
          3 + rand() * 5,
          d % 3 === 0 ? "#dc2626" : d % 2 === 0 ? "#991b1b" : "#450a0a",
          0.88,
          "#ef4444"
        );
      }

      // 5. Павший детектив (голова запрокинута на грудь Долорес, спина и рука в синих тенях)
      // Голова Гарри в профиль (освещена сверху золотом лёгких, снизу в синей тени)
      knifeDab(125, 265, 86, 68, -0.35, "#3b4254", 0.95);
      knifeDab(148, 248, 66, 46, -0.35, "#d6a889", 0.94);
      knifeDab(168, 242, 42, 28, -0.25, "#fce7d2", 0.95); // Золотой свет на подбородке и щеке
      bristleStroke(85, 255, 138, 315, 38, "#1e2433", 0.96); // Волосы и борода в тени

      // Обнажённый торс, плечо и опущенная рука (контраст золотого света на груди и лазурной тени на спине)
      bristleStroke(185, 295, 335, 385, 68, "#e2c099", 0.94, "#fef3c7"); // Освещённая грудь и живот
      bristleStroke(152, 335, 285, 445, 75, "#3b5978", 0.95, "#6488a8"); // Переход в полутень
      bristleStroke(135, 355, 225, 545, 62, "#1e3a5f", 0.96, "#3b628f"); // Плечо и предплечье в синей тени
      bristleStroke(215, 535, 325, 695, 46, "#0f1e36", 0.98); // Кисть руки внизу
    } else {
      // ======================================================================
      // СЦЕНА III: «ПСИХОЗ B' B'' / ВЗРЫВ СОЗНАНИЯ» (живописная версия image_542721)
      // ======================================================================
      const bg = octx.createRadialGradient(210, 310, 30, 540, 410, 960);
      bg.addColorStop(0, "#2b0d38");
      bg.addColorStop(0.4, "#120921");
      bg.addColorStop(1, "#06040a");
      octx.fillStyle = bg;
      octx.fillRect(0, 0, W, H);

      const ox = 212;
      const oy = 315;

      // Веер живописных мазков взрыва из виска
      const colors = ["#ff0a6c", "#ff4800", "#ffb703", "#00e5ff", "#7209b7", "#f72585"];
      for (let i = 0; i < 125; i++) {
        const ang = -Math.PI * 0.84 + (i / 125) * (Math.PI * 0.78);
        const len = 95 + ((i * 83) % 440);
        bristleStroke(
          ox,
          oy,
          ox + Math.cos(ang) * len,
          oy + Math.sin(ang) * len,
          10 + (i % 5) * 4,
          colors[i % colors.length],
          0.78,
          "#fff5e4"
        );
      }

      // Меловые дуги B', B'', B'''
      octx.strokeStyle = "rgba(186, 230, 253, 0.38)";
      octx.lineWidth = 1.8;
      [0, 1, 2].forEach((k) => {
        octx.beginPath();
        octx.moveTo(ox, oy);
        octx.bezierCurveTo(ox + 120, 140 - k * 35, 520, 75 + k * 45, W - 40, 35 + k * 85);
        octx.stroke();
      });
      octx.font = "italic 700 24px 'Cormorant Garamond', Georgia, serif";
      octx.fillStyle = "rgba(224, 242, 254, 0.78)";
      octx.fillText("B'", 288, 145);
      octx.fillText("B''", 358, 86);
      octx.fillText("B'''", 342, 196);

      // Живописный портрет Гарри с запрокинутой головой и рукой у виска (мазками кисти)
      bristleStroke(60, 520, 30, 820, 120, "#1b0d26", 0.98);
      bristleStroke(160, 460, 320, 820, 140, "#14091d", 0.98);
      bristleStroke(165, 390, 210, 510, 68, "#5e225c", 0.95, "#e06d94"); // Шея
      knifeDab(220, 338, 125, 115, 0.15, "#8a3472", 0.96); // Голова
      knifeDab(208, 305, 82, 65, -0.1, "#f794a4", 0.94); // Розовый свет на лбу и щеке
      knifeDab(186, 308, 22, 12, -0.2, "#ffe5ec", 0.96); // Левый глаз
      knifeDab(242, 318, 22, 12, 0.2, "#ffd6e0", 0.96); // Правый глаз
      bristleStroke(152, 362, 268, 385, 36, "#260d29", 0.96); // Усы и бакенбарды
      bristleStroke(282, 338, 355, 425, 42, "#752c68", 0.95, "#d96b98"); // Рука у виска
    }

    // Тонкая сетка кракелюра и зерна холста поверх всей картины
    octx.save();
    octx.strokeStyle = "rgba(255, 248, 231, 0.03)";
    octx.lineWidth = 1;
    for (let x = 0; x < W; x += 6) {
      octx.beginPath();
      octx.moveTo(x, 0);
      octx.lineTo(x, H);
      octx.stroke();
    }
    octx.restore();

    // Лёгкий анимационный цикл для живого дыхания света и пылинок
    let animId: number;
    let frame = 0;
    const animate = () => {
      frame += 1;
      ctx.drawImage(offscreen, 0, 0);

      // Мягкая пульсация света и редкие парящие искры памяти
      const pulse = 0.04 + Math.sin(frame * 0.025) * 0.025;
      ctx.fillStyle =
        health === "BAD"
          ? `rgba(220, 38, 38, ${pulse * 1.5})`
          : `rgba(245, 158, 11, ${pulse})`;
      ctx.fillRect(0, 0, 420, H);

      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animId);
  }, [themeId, customUrl, health, temp]);

  if (customUrl) {
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
        <img
          src={customUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(28px) saturate(1.4) brightness(0.42)",
            transform: "scale(1.08)",
          }}
        />
        <img
          src={customUrl}
          alt="Custom Artwork"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "430px",
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
    nandEndurance: "96% (V-NAND 3-bit MLC)",
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
    nandEndurance: "Магнитный CMR (2 пластины)",
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
    nandEndurance: "Крах G-List (Осыпание слоя)",
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
    name: "РЕАЛЬНЫЙ ДИСК ПК",
    model,
    capacityGB: 1000.0,
    firmware,
    serial,
    interfaceType,
    transferMode,
    standard: "Аппаратный S.M.A.R.T.",
    features: "S.M.A.R.T., Телеметрия ядра",
    nandEndurance: `${healthPercent}% (Аппаратный отчёт)`,
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
  const [visualTheme, setVisualTheme] = useState<VisualThemeId>("the_expression");
  const [customArt1, setCustomArt1] = useState<string | null>(null);
  const [customArt2, setCustomArt2] = useState<string | null>(null);

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
      skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
      category: "PSY",
      difficulty: "Средне: Успех",
      text: "Кремний помнит всё, Гарри. Нажми на любую строчку S.M.A.R.T. справа или брось кости Белой проверки в центре паспорта.",
    },
    {
      id: "init_2",
      skill: "ЭЛЕКТРОХИМИЯ",
      category: "FYS",
      difficulty: "Легко: Успех",
      text: "Посмотри на эту ухмылку в зеркале монитора! Четыре линии PCIe 4.0 гонят чистый дофамин со скоростью семь гигабайт в секунду!",
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
  const effectiveTemp = activeDrive.temperature;
  const effectiveHealth = activeDrive.healthStatus;

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
    const order: VisualThemeId[] = ["the_expression", "dolores_pieta", "mind_explosion"];
    if (customArt1) order.push("custom_1");
    if (customArt2) order.push("custom_2");
    const nextIdx = (order.indexOf(visualTheme) + 1) % order.length;
    setVisualTheme(order[nextIdx]);
    soundFX.playClick("GOOD");
  };

  const handleSelectDrive = (idx: number) => {
    const drv = drives[idx];
    setActiveDriveIdx(idx);
    soundFX.playClick(drv.healthStatus);

    if (drv.healthStatus === "BAD") setVisualTheme("dolores_pieta");
    else if (drv.healthStatus === "CAUTION") setVisualTheme("mind_explosion");
    else setVisualTheme("the_expression");

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
          ? "Твой разум пробивает оболочку операционной системы и ныряет прямо в микрокод контроллера! Карта физических блоков открывается как ночной Ревашоль: все уязвимые сектора помечены."
          : "Перед глазами плывут масляные круги. Ты забыл, что такое LBA-адресация, почему ты сидишь перед этим монитором и зачем нацепил этот галстук.",
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
        return "#ff4d6d";
      case "MOT":
        return "#f4b942";
      case "TIE":
        return "#ff6b1a";
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
      {/* ПОЛНЫЙ ЗАПРЕТ БЕЛЫХ СИСТЕМНЫХ СКРОЛЛБАРОВ WINDOWS + СТИЛИ КАРТИНЫ */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500;1,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Oswald:wght@500;600;700&display=swap');

        * {
          box-sizing: border-box;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        *::-webkit-scrollbar {
          width: 0px !important;
          height: 0px !important;
          display: none !important;
          background: transparent !important;
        }
        body, html {
          margin: 0;
          padding: 0;
          background: #070908;
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
            radial-gradient(circle at 25% 25%, rgba(53, 120, 115, 0.16), transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(216, 146, 40, 0.12), transparent 50%),
            #060807;
        }

        .cdi-native-frame {
          width: 100%;
          max-width: 1260px;
          min-height: 820px;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(216, 185, 138, 0.32);
          box-shadow:
            0 30px 90px rgba(0, 0, 0, 0.95),
            0 0 1px 1px rgba(0, 0, 0, 0.85);
          background: #0c100e;
        }

        .masterpiece-bg-layer {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .canvas-grain-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(circle at 22% 45%, transparent 38%, rgba(8, 10, 9, 0.55) 100%),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 3px);
        }

        .native-titlebar {
          position: relative;
          z-index: 20;
          height: 30px;
          background: rgba(11, 14, 13, 0.92);
          border-bottom: 1px solid rgba(216, 185, 138, 0.16);
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
          height: 30px;
          background: rgba(17, 22, 20, 0.88);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(216, 185, 138, 0.22);
          padding: 0 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
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
          background: rgba(216, 146, 40, 0.2);
          border-color: rgba(216, 146, 40, 0.5);
          color: #fff;
        }
        .scene-switcher-bar {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .scene-tab-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(216, 185, 138, 0.22);
          color: #cbbba0;
          padding: 2px 9px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.12s;
        }
        .scene-tab-btn.active, .scene-tab-btn:hover {
          background: rgba(216, 146, 40, 0.32);
          border-color: #f4b942;
          color: #fff;
        }

        .cdi-workspace {
          position: relative;
          z-index: 10;
          flex: 1;
          display: grid;
          grid-template-columns: 395px 1fr;
        }
        @media (max-width: 1024px) {
          .cdi-workspace {
            grid-template-columns: 1fr;
          }
        }

        /* Левая портретная витрина с чистым блоком монолога без скроллбаров */
        .left-portrait-zone {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 755px;
          border-right: 1px solid rgba(216, 185, 138, 0.2);
          position: relative;
          cursor: pointer;
        }
        .dialogue-dossier-overlay {
          background: linear-gradient(0deg, rgba(8, 10, 9, 0.96) 0%, rgba(12, 16, 14, 0.88) 82%, transparent 100%);
          padding: 28px 18px 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          cursor: default;
        }

        /* Правая полупрозрачная область данных */
        .right-telemetry-zone {
          background: rgba(11, 15, 14, 0.62);
          backdrop-filter: blur(9px);
          padding: 10px 18px 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .cdi-disk-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          border-bottom: 1px solid rgba(216, 185, 138, 0.22);
          padding-bottom: 8px;
        }
        .disk-rect-tab {
          min-width: 122px;
          padding: 5px 12px;
          background: rgba(16, 22, 20, 0.78);
          border: 1px solid rgba(216, 185, 138, 0.26);
          color: #d8cfc2;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 9px;
          transition: all 0.14s;
        }
        .disk-rect-tab:hover {
          background: rgba(28, 38, 35, 0.88);
          border-color: rgba(244, 185, 66, 0.55);
        }
        .disk-rect-tab.active {
          background: linear-gradient(180deg, rgba(53, 82, 68, 0.88), rgba(18, 26, 23, 0.94));
          border: 1px solid #f4b942;
          box-shadow: inset 0 2px 0 #d89228;
          color: #fff;
        }
        .disk-letter-big {
          font-size: 18px;
          font-weight: 700;
          color: #f4b942;
          line-height: 1;
        }

        .model-header-strip {
          text-align: center;
          padding: 4px 8px 6px 8px;
          border-bottom: 1px solid rgba(216, 185, 138, 0.2);
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
          grid-template-columns: 135px 1fr;
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
          background: rgba(8, 11, 10, 0.72);
          border: 1px solid rgba(216, 185, 138, 0.26);
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.75);
          color: #f8f5f0;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .white-check-emblem {
          width: 88px;
          height: 132px;
          margin: 0 auto;
          background: linear-gradient(180deg, rgba(34, 48, 38, 0.88), rgba(14, 19, 16, 0.95));
          border: 1.5px solid #d4a359;
          box-shadow: inset 0 0 12px rgba(244, 185, 66, 0.18), 0 4px 14px rgba(0,0,0,0.75);
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
          background: linear-gradient(180deg, rgba(216, 146, 40, 0.35), rgba(53, 120, 115, 0.32));
          transform: translateY(-1px);
        }

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
          grid-template-columns: 135px 1fr;
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
          background: linear-gradient(180deg, rgba(42, 118, 110, 0.9) 0%, rgba(22, 68, 64, 0.96) 100%);
          border-color: #5cb5ad;
        }
        .plate-caution {
          background: linear-gradient(180deg, rgba(216, 130, 38, 0.92) 0%, rgba(142, 72, 16, 0.96) 100%);
          border-color: #f4b942;
        }
        .plate-bad {
          background: linear-gradient(180deg, rgba(185, 28, 28, 0.92) 0%, rgba(105, 14, 14, 0.96) 100%);
          border-color: #f87171;
        }

        .smart-grid-container {
          flex: 1;
          background: rgba(8, 11, 10, 0.72);
          border: 1px solid rgba(216, 185, 138, 0.26);
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
          background: rgba(18, 25, 23, 0.92);
          color: #d8cfc2;
          font-weight: 600;
          padding: 6px 10px;
          text-align: left;
          border-bottom: 1px solid rgba(216, 185, 138, 0.25);
          white-space: nowrap;
        }
        .smart-grid-table td {
          padding: 5.5px 10px;
          border-bottom: 1px solid rgba(216, 185, 138, 0.08);
          color: #f3eee6;
        }
        .smart-grid-table tr {
          cursor: pointer;
          transition: background 0.1s;
        }
        .smart-grid-table tr:hover td {
          background: rgba(216, 146, 40, 0.16);
        }
        .smart-grid-table tr.active-row td {
          background: linear-gradient(90deg, rgba(216, 146, 40, 0.32), rgba(53, 120, 115, 0.22));
          border-top: 1px solid rgba(244, 185, 66, 0.65);
          border-bottom: 1px solid rgba(244, 185, 66, 0.65);
        }
        .diamond-led {
          width: 9px;
          height: 9px;
          display: inline-block;
          transform: rotate(45deg);
        }
        .led-good {
          background: #5cb5ad;
          box-shadow: 0 0 6px #5cb5ad;
        }
        .led-caution {
          background: #f4b942;
          box-shadow: 0 0 6px #f4b942;
        }
        .led-bad {
          background: #ef4444;
          box-shadow: 0 0 8px #ef4444;
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
            background: "rgba(14, 20, 18, 0.88)",
            zIndex: 99,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed #f4b942",
          }}
        >
          <div className="font-serif-disco" style={{ fontSize: "28px", color: "#fff" }}>
            Отпустите иллюстрацию, чтобы поместить её на холст
          </div>
        </div>
      )}

      {/* НАТИВНОЕ ОКНО CRYSTALDISKINFO // DISCO ELYSIUM EDITION */}
      <div className="cdi-native-frame">
        {/* ПОЛНОЭКРАННЫЙ ЖИВОПИСНЫЙ ХОЛСТ МАСЛОМ */}
        <div className="masterpiece-bg-layer">
          <PainterlyMasterpieceCanvas
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
                background: "#f4b942",
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

        {/* 2. СТРОКА МЕНЮ И ПЕРЕКЛЮЧАТЕЛЬ КАРТИН */}
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
              onClick={() => setVisualTheme("the_expression")}
              className={`scene-tab-btn ${visualTheme === "the_expression" ? "active" : ""}`}
            >
              I. Ухмылка Кусто
            </button>
            <button
              onClick={() => setVisualTheme("dolores_pieta")}
              className={`scene-tab-btn ${visualTheme === "dolores_pieta" ? "active" : ""}`}
            >
              II. Пьета Долорес
            </button>
            <button
              onClick={() => setVisualTheme("mind_explosion")}
              className={`scene-tab-btn ${visualTheme === "mind_explosion" ? "active" : ""}`}
            >
              III. Взрыв (B&apos; B&apos;&apos;)
            </button>
            {customArt1 && (
              <button
                onClick={() => setVisualTheme("custom_1")}
                className={`scene-tab-btn ${visualTheme === "custom_1" ? "active" : ""}`}
              >
                IV. Свой Холст #1
              </button>
            )}
            {customArt2 && (
              <button
                onClick={() => setVisualTheme("custom_2")}
                className={`scene-tab-btn ${visualTheme === "custom_2" ? "active" : ""}`}
              >
                V. Свой Холст #2
              </button>
            )}
          </div>
        </nav>

        {/* 3. РАБОЧАЯ ОБЛАСТЬ ОКНА */}
        <div className="cdi-workspace">
          {/* ЛЕВАЯ ЧАСТЬ: ПОЛОТНО С ПЕРСОНАЖЕМ + БЛОК МОНОЛОГА БЕЗ СКРОЛЛБАРА */}
          <aside
            className="left-portrait-zone"
            onClick={cycleTheme}
            title="Нажмите на холст для переключения картины"
          >
            <div className="dialogue-dossier-overlay" onClick={(e) => e.stopPropagation()}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  borderBottom: "1px solid rgba(216, 185, 138, 0.28)",
                  paddingBottom: "4px",
                }}
              >
                <span className="font-oswald" style={{ fontSize: "11.5px", color: "#f4b942" }}>
                  Внутренний монолог // Регистр {selectedAttrId}h
                </span>
                <span className="font-mono" style={{ fontSize: "11px", color: "#5cb5ad" }}>
                  2d6: [{lastDice[0]}][{lastDice[1]}]
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
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

          {/* ПРАВАЯ ЧАСТЬ: ПОЛУПРОЗРАЧНЫЙ СТЕНД CRYSTALDISKINFO (БЕЗ ПОЛЗУНКОВ) */}
          <main className="right-telemetry-zone">
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

            <div className="model-header-strip">
              <h1 className="model-name-serif">
                {activeDrive.model} : {activeDrive.capacityGB.toFixed(1)} GB
              </h1>
            </div>

            {/* Двухколоночный паспорт накопителя (строгие текстовые поля без ползунков) */}
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

              {/* Эмблема Белой проверки 2d6 */}
              <button
                onClick={handleRollDice}
                className="white-check-emblem"
                title="Выполнить Белую проверку навыка Интерфейс (2d6)"
              >
                <svg width="54" height="54" viewBox="0 0 60 60">
                  <polygon
                    points="30,3 57,30 30,57 3,30"
                    fill="none"
                    stroke="#f4b942"
                    strokeWidth="2"
                  />
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
                  <rect
                    x="29"
                    y="26"
                    width="17"
                    height="17"
                    rx="2"
                    fill="#f4b942"
                    stroke="#111"
                    strokeWidth="1.5"
                  />
                  <circle cx="34" cy="31" r="1.6" fill="#111" />
                  <circle cx="37.5" cy="34.5" r="1.6" fill="#111" />
                  <circle cx="41" cy="38" r="1.6" fill="#111" />
                </svg>
                <span
                  className="font-oswald"
                  style={{
                    fontSize: "10.5px",
                    color: "#f3eee6",
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  ПРОВЕРКА 2D6
                  <br />
                  <span style={{ color: "#f4b942" }}>ДОПРОС ЧИПА</span>
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
                  <span className="spec-caption">Ресурс носителя</span>
                  <div className="spec-value-plate font-mono">{activeDrive.nandEndurance}</div>
                </div>
              </div>
            </div>

            {/* Две широкие прямоугольные плашки ТЕХСОСТОЯНИЕ и ТЕМПЕРАТУРА */}
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

            {/* Таблица S.M.A.R.T. */}
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
                          <td className="font-mono" style={{ fontWeight: 700, color: "#5cb5ad" }}>
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
                                  ? "#f87171"
                                  : attr.status === "CAUTION"
                                  ? "#f4b942"
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
            background: "rgba(6, 8, 7, 0.86)",
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
              background: "#111715",
              border: "1px solid #d4a359",
              padding: "22px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.9)",
            }}
          >
            <h3
              className="font-serif-disco"
              style={{ margin: "0 0 8px 0", fontSize: "22px", color: "#f4b942" }}
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
                background: "#080b0a",
                border: "1px solid rgba(216, 185, 138, 0.3)",
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
                style={{ border: "1px solid #f4b942", color: "#f4b942" }}
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
