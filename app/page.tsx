"use client";

import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  Upload,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Check,
  Layers,
  Activity,
  BarChart3,
  Table as TableIcon,
  PlusCircle,
  Sliders,
  Gauge,
  Grid,
} from "lucide-react";

// ============================================================================
// 1. МАТЕМАТИЧЕСКОЕ И ЭКОНОМЕТРИЧЕСКОЕ ЯДРО
// ============================================================================

function logGamma(z: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaCf(x: number, a: number, b: number): number {
  const maxIter = 150;
  const eps = 3e-7;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < eps) break;
  }
  return h;
}

function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaCf(x, a, b)) / a;
  }
  return 1 - (bt * betaCf(1 - x, b, a)) / b;
}

function tTestPValue(tStat: number, df: number): number {
  if (df <= 0 || isNaN(tStat)) return 1;
  const x = df / (df + tStat * tStat);
  return betaInc(x, df / 2, 0.5);
}

function fTestPValue(fStat: number, df1: number, df2: number): number {
  if (fStat <= 0 || df1 <= 0 || df2 <= 0 || isNaN(fStat)) return 1;
  const x = df2 / (df2 + df1 * fStat);
  return betaInc(x, df2 / 2, df1 / 2);
}

function chi2PValue(x: number, k: number): number {
  if (x <= 0 || k <= 0) return 1;
  const z = (Math.pow(x / k, 1 / 3) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k));
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const prob =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? prob : 1 - prob;
}

function significanceBadge(p: number): { stars: string; text: string; badgeClass: string } {
  if (p < 0.01) return { stars: "***", text: "Высокая (1%)", badgeClass: "badge-emerald" };
  if (p < 0.05) return { stars: "**", text: "Значим (5%)", badgeClass: "badge-cyan" };
  if (p < 0.1) return { stars: "*", text: "Слабая (10%)", badgeClass: "badge-amber" };
  return { stars: "—", text: "Незначим", badgeClass: "badge-muted" };
}

function transpose(A: number[][]): number[][] {
  return A[0].map((_, c) => A.map((r) => r[c]));
}

function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  const rA = A.length,
    cA = A[0].length,
    cB = B[0].length;
  const C = Array.from({ length: rA }, () => Array(cB).fill(0));
  for (let i = 0; i < rA; i++) {
    for (let k = 0; k < cA; k++) {
      const aik = A[i][k];
      for (let j = 0; j < cB; j++) C[i][j] += aik * B[k][j];
    }
  }
  return C;
}

function invertMatrix(M: number[][]): number[][] {
  const n = M.length;
  const A = M.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];

    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error("Обнаружена строгая мультиколлинеарность (один из факторов дублирует другой).");
    }

    for (let j = 0; j < 2 * n; j++) A[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = 0; j < 2 * n; j++) A[k][j] -= factor * A[i][j];
      }
    }
  }
  return A.map((row) => row.slice(n, 2 * n));
}

function pearsonCorr(x: (number | null)[], y: (number | null)[]): number {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== null && y[i] !== null && !isNaN(x[i]!) && !isNaN(y[i]!)) {
      pairs.push([x[i]!, y[i]!]);
    }
  }
  const n = pairs.length;
  if (n < 2) return 0;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n;
  const my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let num = 0,
    dx = 0,
    dy = 0;
  for (const [vx, vy] of pairs) {
    num += (vx - mx) * (vy - my);
    dx += Math.pow(vx - mx, 2);
    dy += Math.pow(vy - my, 2);
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}

interface OLSResult {
  id: number;
  depVar: string;
  regressors: string[];
  useHC3: boolean;
  nObs: number;
  dfModel: number;
  dfResid: number;
  coefficients: {
    name: string;
    beta: number;
    se: number;
    tStat: number;
    pValue: number;
    sigStars: string;
    sigText: string;
    badgeClass: string;
  }[];
  metrics: {
    yMean: number;
    ySd: number;
    ssr: number;
    seReg: number;
    r2: number;
    adjR2: number;
    fStat: number;
    fPval: number;
    logLik: number;
    aic: number;
    bic: number;
    dw: number;
  };
  diagnostics: {
    vif: { name: string; value: number }[];
    bpLM: number;
    bpPval: number;
    jbStat: number;
    jbPval: number;
    resetF: number;
    resetPval: number;
  };
  seriesData: { t: number; actual: number; fitted: number; resid: number; rowIdx: number }[];
}

function estimateOLS(
  df: Record<string, (number | null)[]>,
  depVar: string,
  indepVars: string[],
  includeConst: boolean,
  useHC3: boolean,
  modelId: number
): OLSResult {
  const nTotal = df[depVar].length;
  const validIndices: number[] = [];

  for (let i = 0; i < nTotal; i++) {
    const yVal = df[depVar][i];
    if (yVal === null || isNaN(yVal)) continue;
    let ok = true;
    for (const v of indepVars) {
      const xVal = df[v][i];
      if (xVal === null || isNaN(xVal)) {
        ok = false;
        break;
      }
    }
    if (ok) validIndices.push(i);
  }

  const T = validIndices.length;
  const colNames = includeConst ? ["Свободный член (β₀)", ...indepVars] : [...indepVars];
  const K = colNames.length;
  if (T <= K + 2) throw new Error("Недостаточно наблюдений для оценки модели.");

  const Y: number[][] = [];
  const X: number[][] = [];

  for (const idx of validIndices) {
    Y.push([df[depVar][idx] as number]);
    const row: number[] = [];
    if (includeConst) row.push(1);
    for (const v of indepVars) row.push(df[v][idx] as number);
    X.push(row);
  }

  const XT = transpose(X);
  const XTX_inv = invertMatrix(multiplyMatrices(XT, X));
  const XTY = multiplyMatrices(XT, Y);
  const betaMat = multiplyMatrices(XTX_inv, XTY);
  const betas = betaMat.map((r) => r[0]);

  const yVec = Y.map((r) => r[0]);
  const yHat = multiplyMatrices(X, betaMat).map((r) => r[0]);
  const resid = yVec.map((y, i) => y - yHat[i]);

  const yMean = yVec.reduce((a, b) => a + b, 0) / T;
  const tss = yVec.reduce((acc, y) => acc + Math.pow(y - yMean, 2), 0);
  const ssr = resid.reduce((acc, e) => acc + e * e, 0);
  const dfResid = T - K;
  const dfModel = includeConst ? K - 1 : K;
  const s2 = ssr / dfResid;
  const seReg = Math.sqrt(s2);

  let covMatrix: number[][];
  if (!useHC3) {
    covMatrix = XTX_inv.map((row) => row.map((v) => v * s2));
  } else {
    const meat = Array.from({ length: K }, () => Array(K).fill(0));
    for (let i = 0; i < T; i++) {
      const xi = X[i];
      let hii = 0;
      for (let r = 0; r < K; r++) {
        for (let c = 0; c < K; c++) hii += xi[r] * XTX_inv[r][c] * xi[c];
      }
      const scale = Math.pow(resid[i] / Math.max(1 - hii, 1e-5), 2);
      for (let r = 0; r < K; r++) {
        for (let c = 0; c < K; c++) meat[r][c] += scale * xi[r] * xi[c];
      }
    }
    covMatrix = multiplyMatrices(multiplyMatrices(XTX_inv, meat), XTX_inv);
  }

  const se = covMatrix.map((row, i) => Math.sqrt(Math.max(row[i], 1e-15)));
  const coefficients = colNames.map((name, i) => {
    const tStat = betas[i] / se[i];
    const pValue = tTestPValue(tStat, dfResid);
    const sig = significanceBadge(pValue);
    return {
      name,
      beta: betas[i],
      se: se[i],
      tStat,
      pValue,
      sigStars: sig.stars,
      sigText: sig.text,
      badgeClass: sig.badgeClass,
    };
  });

  const r2 = Math.max(0, 1 - ssr / tss);
  const adjR2 = 1 - (1 - r2) * ((T - 1) / dfResid);
  const fStat = dfModel > 0 ? ((tss - ssr) / dfModel) / (ssr / dfResid) : 0;
  const fPval = dfModel > 0 ? fTestPValue(fStat, dfModel, dfResid) : 1;

  const logLik = (-T / 2) * (1 + Math.log(2 * Math.PI) + Math.log(ssr / T));
  const aic = -2 * logLik + 2 * K;
  const bic = -2 * logLik + K * Math.log(T);

  let dwNum = 0;
  for (let i = 1; i < T; i++) dwNum += Math.pow(resid[i] - resid[i - 1], 2);
  const dw = dwNum / ssr;

  const vif: { name: string; value: number }[] = [];
  if (indepVars.length > 1) {
    for (let j = 0; j < indepVars.length; j++) {
      const targetX = validIndices.map((idx) => [df[indepVars[j]][idx] as number]);
      const otherX = validIndices.map((idx) => {
        const r = [1];
        indepVars.forEach((v, k) => {
          if (k !== j) r.push(df[v][idx] as number);
        });
        return r;
      });
      try {
        const oXT = transpose(otherX);
        const oBeta = multiplyMatrices(
          invertMatrix(multiplyMatrices(oXT, otherX)),
          multiplyMatrices(oXT, targetX)
        );
        const oHat = multiplyMatrices(otherX, oBeta).map((r) => r[0]);
        const tVec = targetX.map((r) => r[0]);
        const tMean = tVec.reduce((a, b) => a + b, 0) / T;
        const tTSS = tVec.reduce((a, y) => a + Math.pow(y - tMean, 2), 0);
        const tSSR = tVec.reduce((a, y, idx) => a + Math.pow(y - oHat[idx], 2), 0);
        const r2j = Math.max(0, 1 - tSSR / tTSS);
        vif.push({ name: indepVars[j], value: 1 / Math.max(1 - r2j, 1e-6) });
      } catch {
        vif.push({ name: indepVars[j], value: 99.9 });
      }
    }
  } else if (indepVars.length === 1) {
    vif.push({ name: indepVars[0], value: 1.0 });
  }

  let bpLM = 0,
    bpPval = 1;
  try {
    const u2 = resid.map((e) => [e * e]);
    const u2Vec = u2.map((r) => r[0]);
    const u2Mean = u2Vec.reduce((a, b) => a + b, 0) / T;
    const u2TSS = u2Vec.reduce((a, v) => a + Math.pow(v - u2Mean, 2), 0);
    const bpBeta = multiplyMatrices(XTX_inv, multiplyMatrices(XT, u2));
    const u2Hat = multiplyMatrices(X, bpBeta).map((r) => r[0]);
    const u2SSR = u2Vec.reduce((a, v, i) => a + Math.pow(v - u2Hat[i], 2), 0);
    const bpR2 = Math.max(0, 1 - u2SSR / u2TSS);
    bpLM = T * bpR2;
    bpPval = chi2PValue(bpLM, Math.max(1, dfModel));
  } catch {
    bpLM = 0;
  }

  const rMean = resid.reduce((a, b) => a + b, 0) / T;
  const m2 = resid.reduce((a, e) => a + Math.pow(e - rMean, 2), 0) / T;
  const m3 = resid.reduce((a, e) => a + Math.pow(e - rMean, 3), 0) / T;
  const m4 = resid.reduce((a, e) => a + Math.pow(e - rMean, 4), 0) / T;
  const skew = m3 / Math.pow(m2, 1.5);
  const kurt = m4 / Math.pow(m2, 2);
  const jbStat = (T / 6) * (Math.pow(skew, 2) + Math.pow(kurt - 3, 2) / 4);
  const jbPval = chi2PValue(jbStat, 2);

  let resetF = 0,
    resetPval = 1;
  try {
    const X_reset = X.map((row, i) => [...row, Math.pow(yHat[i], 2)]);
    const XrT = transpose(X_reset);
    const betaReset = multiplyMatrices(
      invertMatrix(multiplyMatrices(XrT, X_reset)),
      multiplyMatrices(XrT, Y)
    );
    const yHatReset = multiplyMatrices(X_reset, betaReset).map((r) => r[0]);
    const ssrReset = yVec.reduce((a, y, i) => a + Math.pow(y - yHatReset[i], 2), 0);
    const dfResetDenom = T - (K + 1);
    resetF = Math.max(0, (ssr - ssrReset) / (ssrReset / dfResetDenom));
    resetPval = fTestPValue(resetF, 1, dfResetDenom);
  } catch {
    resetF = 0;
  }

  return {
    id: modelId,
    depVar,
    regressors: indepVars,
    useHC3,
    nObs: T,
    dfModel,
    dfResid,
    coefficients,
    metrics: {
      yMean,
      ySd: Math.sqrt(tss / (T - 1)),
      ssr,
      seReg,
      r2,
      adjR2,
      fStat,
      fPval,
      logLik,
      aic,
      bic,
      dw,
    },
    diagnostics: { vif, bpLM, bpPval, jbStat, jbPval, resetF, resetPval },
    seriesData: validIndices.map((rowIdx, i) => ({
      t: rowIdx + 1,
      actual: Number(yVec[i].toFixed(4)),
      fitted: Number(yHat[i].toFixed(4)),
      resid: Number(resid[i].toFixed(4)),
      rowIdx,
    })),
  };
}

function computeMarkovChain(series: (number | null)[], steps = 6) {
  const clean = series.filter((v): v is number => v !== null && !isNaN(v));
  const sorted = [...clean].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length / 3)];
  const q2 = sorted[Math.floor((2 * sorted.length) / 3)];

  const shortLabels = ["S1 (Спад)", "S2 (Стагнация)", "S3 (Рост)"];
  const getState = (v: number) => (v <= q1 ? 0 : v <= q2 ? 1 : 2);
  const states = clean.map(getState);

  const counts = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let t = 0; t < states.length - 1; t++) {
    counts[states[t]][states[t + 1]]++;
  }

  const P = counts.map((row) => {
    const rowSum = row.reduce((a, b) => a + b, 0);
    return row.map((v) => (rowSum > 0 ? v / rowSum : 1 / 3));
  });

  const currentStateIdx = states[states.length - 1];
  let sVec = [0, 0, 0];
  sVec[currentStateIdx] = 1;

  const forecast: { step: string; S1: number; S2: number; S3: number }[] = [];
  for (let step = 1; step <= steps; step++) {
    const nextVec = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) nextVec[j] += sVec[i] * P[i][j];
    }
    sVec = nextVec;
    forecast.push({
      step: `Шаг +${step}`,
      S1: Number((sVec[0] * 100).toFixed(2)),
      S2: Number((sVec[1] * 100).toFixed(2)),
      S3: Number((sVec[2] * 100).toFixed(2)),
    });
  }

  let pi = [1 / 3, 1 / 3, 1 / 3];
  for (let iter = 0; iter < 60; iter++) {
    const nextPi = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) nextPi[j] += pi[i] * P[i][j];
    }
    pi = nextPi;
  }

  return {
    shortLabels,
    bounds: [
      `[${sorted[0].toFixed(2)} .. ${q1.toFixed(2)}]`,
      `(${q1.toFixed(2)} .. ${q2.toFixed(2)}]`,
      `(${q2.toFixed(2)} .. ${sorted[sorted.length - 1].toFixed(2)}]`,
    ],
    counts,
    P,
    currentState: shortLabels[currentStateIdx],
    forecast,
    stationary: pi,
  };
}

function computeADF(series: (number | null)[]) {
  const y = series.filter((v): v is number => v !== null && !isNaN(v));
  const dy: number[] = [];
  const yLag: number[] = [];
  const tVec: number[] = [];

  for (let i = 1; i < y.length; i++) {
    dy.push(y[i] - y[i - 1]);
    yLag.push(y[i - 1]);
    tVec.push(i);
  }

  const tmpDf: Record<string, number[]> = { dY: dy, Y_lag1: yLag, trend: tVec };
  const olsC = estimateOLS(tmpDf, "dY", ["Y_lag1"], true, false, 0);
  const olsCT = estimateOLS(tmpDf, "dY", ["Y_lag1", "trend"], true, false, 0);

  const tauC = olsC.coefficients.find((c) => c.name === "Y_lag1")?.tStat ?? 0;
  const tauCT = olsCT.coefficients.find((c) => c.name === "Y_lag1")?.tStat ?? 0;

  return {
    nObs: dy.length,
    constModel: {
      tau: tauC,
      crit5: -2.91,
      stationary: tauC < -2.91,
    },
    trendModel: {
      tau: tauCT,
      crit5: -3.49,
      stationary: tauCT < -3.49,
    },
  };
}

function createInitialDataset() {
  const n = 60;
  const df: Record<string, (number | null)[]> = {
    GDP_Growth: [],
    Investment: [],
    KeyRate: [],
    LaborProd: [],
    Inflation: [],
  };

  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const randNorm = () => {
    const u1 = Math.max(rand(), 1e-6);
    const u2 = rand();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  };

  for (let t = 0; t < n; t++) {
    const inv = Number((22.0 + 3.2 * randNorm()).toFixed(4));
    const rate = Number((6.0 + 10.0 * rand()).toFixed(4));
    const prod = Number((100.0 + (32.0 * t) / (n - 1) + 1.8 * randNorm()).toFixed(4));
    const inf = Number((4.0 + 0.35 * rate + 0.9 * randNorm()).toFixed(4));
    const gdp = Number(
      (-7.5 + 0.42 * inv - 0.28 * rate + 0.11 * prod + 1.1 * randNorm()).toFixed(4)
    );

    df.GDP_Growth.push(gdp);
    df.Investment.push(inv);
    df.KeyRate.push(rate);
    df.LaborProd.push(prod);
    df.Inflation.push(inf);
  }

  const descriptions: Record<string, string> = {
    GDP_Growth: "Темп прироста ВВП (%, г/г)",
    Investment: "Инвестиции в основной капитал (% к ВВП)",
    KeyRate: "Ключевая ставка ЦБ (% годовых)",
    LaborProd: "Индекс производительности труда (база = 100)",
    Inflation: "Уровень инфляции ИПЦ (%, г/г)",
  };

  return { df, descriptions };
}

// Цветовые акценты для карточек переменных
const VAR_COLORS = [
  "#06b6d4", // Cyan
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#3b82f6", // Blue
  "#f43f5e", // Rose
];

// ============================================================================
// 2. ГЛАВНЫЙ КОМПОНЕНТ С АВТОНОМНЫМ ДИЗАЙН-ДВИЖКОМ (PRISM / GLASS UI)
// ============================================================================
export default function TedAnalyticsStudio() {
  const initial = useMemo(() => createInitialDataset(), []);
  const [df, setDf] = useState<Record<string, (number | null)[]>>(initial.df);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(initial.descriptions);

  const [selectedVars, setSelectedVars] = useState<string[]>([
    "GDP_Growth",
    "Investment",
    "KeyRate",
  ]);
  const [activeTab, setActiveTab] = useState<"ols" | "markov" | "timeseries" | "data">("ols");

  const [depVar, setDepVar] = useState<string>("GDP_Growth");
  const [regressors, setRegressors] = useState<string[]>(["Investment", "KeyRate", "LaborProd"]);
  const [useHC3, setUseHC3] = useState<boolean>(false);
  const [models, setModels] = useState<OLSResult[]>(() => [
    estimateOLS(
      initial.df,
      "GDP_Growth",
      ["Investment", "KeyRate", "LaborProd"],
      true,
      false,
      1
    ),
  ]);
  const [activeModelId, setActiveModelId] = useState<number>(1);

  const [markovVar, setMarkovVar] = useState<string>("GDP_Growth");
  const [tsVar, setTsVar] = useState<string>("GDP_Growth");
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>(
    "Активна демонстрационная макровыборка (60 кварталов). Выбирайте факторы, крутите ползунки прогноза или загрузите свой CSV!"
  );

  // Ползунки для интерактивного симулятора «Что если?»
  const [simValues, setSimValues] = useState<Record<string, number>>({
    Investment: 22.0,
    KeyRate: 11.0,
    LaborProd: 116.0,
    Inflation: 8.0,
  });

  const varNames = Object.keys(df);
  const activeModel = models.find((m) => m.id === activeModelId) || models[models.length - 1];

  const varStats = useMemo(() => {
    return varNames.map((name, idx) => {
      const clean = df[name].filter((v): v is number => v !== null && !isNaN(v));
      const n = clean.length;
      const mean = n > 0 ? clean.reduce((a, b) => a + b, 0) / n : 0;
      const min = n > 0 ? Math.min(...clean) : 0;
      const max = n > 0 ? Math.max(...clean) : 100;
      const std =
        n > 1
          ? Math.sqrt(clean.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (n - 1))
          : 0;
      return {
        id: idx + 1,
        name,
        desc: descriptions[name] || "Производный показатель",
        mean,
        min,
        max,
        std,
        n,
        color: VAR_COLORS[idx % VAR_COLORS.length],
      };
    });
  }, [df, descriptions, varNames]);

  const toggleSelectVar = (name: string) => {
    setSelectedVars((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  const applyTransformation = (mode: "log" | "diff" | "lag1" | "pch") => {
    if (selectedVars.length === 0) {
      setToastMsg("Отметьте хотя бы один показатель в левой колонке!");
      return;
    }

    const nextDf = { ...df };
    const nextDesc = { ...descriptions };
    const created: string[] = [];

    for (const col of selectedVars) {
      const series = df[col];
      if (!series) continue;

      if (mode === "log") {
        const newName = `ln_${col}`;
        nextDf[newName] = series.map((v) =>
          v !== null && v > 0 ? Number(Math.log(v).toFixed(5)) : null
        );
        nextDesc[newName] = `Натуральный логарифм ln(${col})`;
        created.push(newName);
      } else if (mode === "diff") {
        const newName = `diff_${col}`;
        nextDf[newName] = series.map((v, i) =>
          i > 0 && v !== null && series[i - 1] !== null
            ? Number((v - (series[i - 1] as number)).toFixed(5))
            : null
        );
        nextDesc[newName] = `Первая разность Δ${col}`;
        created.push(newName);
      } else if (mode === "lag1") {
        const newName = `lag_${col}`;
        nextDf[newName] = series.map((_, i) => (i > 0 ? series[i - 1] : null));
        nextDesc[newName] = `Значение прошлого периода ${col}(t-1)`;
        created.push(newName);
      } else if (mode === "pch") {
        const newName = `gr_${col}`;
        nextDf[newName] = series.map((v, i) =>
          i > 0 && v !== null && series[i - 1] !== null && series[i - 1] !== 0
            ? Number(
                (
                  ((v - (series[i - 1] as number)) / Math.abs(series[i - 1] as number)) *
                  100
                ).toFixed(4)
              )
            : null
        );
        nextDesc[newName] = `Темп прироста ${col} (%)`;
        created.push(newName);
      }
    }

    setDf(nextDf);
    setDescriptions(nextDesc);
    setToastMsg(`✨ Добавлены новые показатели: ${created.join(", ")}`);
  };

  const handleRunOLS = () => {
    const targetX = regressors.filter((x) => x !== depVar);
    if (targetX.length === 0) {
      setToastMsg("Выберите хотя бы один фактор X для построения регрессии!");
      return;
    }

    try {
      const nextId = models.length + 1;
      const res = estimateOLS(df, depVar, targetX, true, useHC3, nextId);
      setModels((prev) => [...prev, res]);
      setActiveModelId(nextId);
      setActiveTab("ols");
      setToastMsg(
        `🚀 Модель №${nextId} построена! Точность объяснения R² = ${(
          res.metrics.r2 * 100
        ).toFixed(1)}%`
      );
    } catch (err: unknown) {
      setToastMsg(`Ошибка: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const saveModelSeriesToDf = (type: "resid" | "fitted") => {
    if (!activeModel) return;
    const totalLen = df[activeModel.depVar].length;
    const newCol: (number | null)[] = Array(totalLen).fill(null);

    for (const pt of activeModel.seriesData) {
      newCol[pt.rowIdx] = type === "resid" ? pt.resid : pt.fitted;
    }

    const colName =
      type === "resid" ? `Остатки_М${activeModel.id}` : `Прогноз_М${activeModel.id}`;
    const colDesc =
      type === "resid"
        ? `Ошибки Модели №${activeModel.id} (${activeModel.depVar})`
        : `Расчетный ряд Модели №${activeModel.id} (${activeModel.depVar})`;

    setDf((prev) => ({ ...prev, [colName]: newCol }));
    setDescriptions((prev) => ({ ...prev, [colName]: colDesc }));
    setToastMsg(`💾 Ряд «${colName}» добавлен в палитру показателей слева!`);
  };

  // Расчет прогноза по ползункам симулятора «Что если?»
  const simulatedPrediction = useMemo(() => {
    if (!activeModel) return 0;
    let yPred = activeModel.coefficients[0]?.beta || 0;
    for (let i = 1; i < activeModel.coefficients.length; i++) {
      const coef = activeModel.coefficients[i];
      const statObj = varStats.find((s) => s.name === coef.name);
      const val =
        simValues[coef.name] !== undefined
          ? simValues[coef.name]
          : statObj?.mean || 0;
      yPred += coef.beta * val;
    }
    return yPred;
  }, [activeModel, simValues, varStats]);

  const formattedEquation = useMemo(() => {
    if (!activeModel) return "";
    const parts: string[] = [];
    activeModel.coefficients.forEach((c, idx) => {
      const val = Math.abs(c.beta).toFixed(4);
      const sign = c.beta >= 0 ? (idx === 0 ? "" : " + ") : idx === 0 ? "-" : " - ";
      if (idx === 0) {
        parts.push(`${sign}${val}`);
      } else {
        parts.push(`${sign}${val} × ${c.name}`);
      }
    });
    return `${activeModel.depVar} = ${parts.join("")}`;
  }, [activeModel]);

  const autoConclusions = useMemo(() => {
    if (!activeModel) return [];
    const notes: string[] = [];
    const r2Pct = (activeModel.metrics.r2 * 100).toFixed(2);
    notes.push(
      `Объясняющая способность: выбранные факторы описывают ${r2Pct}% изменений показателя «${activeModel.depVar}» (скорректированный R² = ${(
        activeModel.metrics.adjR2 * 100
      ).toFixed(2)}%).`
    );

    if (activeModel.metrics.fPval < 0.05) {
      notes.push(
        `Надежность модели: по критерию Фишера (F = ${activeModel.metrics.fStat.toFixed(
          2
        )}, p < 0.01) регрессионное уравнение статистически значимо и пригодно для прогнозирования.`
      );
    }

    activeModel.coefficients.slice(1).forEach((c) => {
      const dir = c.beta >= 0 ? "увеличивается" : "снижается";
      if (c.pValue < 0.05) {
        notes.push(
          `Влияние «${c.name}» доказано (p = ${
            c.pValue < 0.0001 ? c.pValue.toExponential(2) : c.pValue.toFixed(4)
          }): рост «${c.name}» на 1 ед. приводит к тому, что «${
            activeModel.depVar
          }» в среднем ${dir} на ${Math.abs(c.beta).toFixed(4)} ед.`
        );
      } else {
        notes.push(
          `Фактор «${c.name}» статистически незначим (p = ${c.pValue.toFixed(
            3
          )} > 0.05) — его влияние неотличимо от случайного шума.`
        );
      }
    });

    return notes;
  }, [activeModel]);

  const copyReportToClipboard = () => {
    if (!activeModel) return;
    const text = [
      `АНАЛИТИЧЕСКИЙ ОТЧЕТ (TED ANALYTICS) — МОДЕЛЬ №${activeModel.id}`,
      `Целевой показатель: ${activeModel.depVar} (N = ${activeModel.nObs})`,
      `Уравнение: ${formattedEquation}`,
      `R² = ${(activeModel.metrics.r2 * 100).toFixed(2)}% | F = ${activeModel.metrics.fStat.toFixed(2)} | DW = ${activeModel.metrics.dw.toFixed(3)}`,
      "",
      "ВЫВОДЫ:",
      ...autoConclusions.map((line, i) => `${i + 1}. ${line}`),
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setToastMsg("📋 Готовый отчет скопирован в буфер обмена!");
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || "");
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) return;

      const sep = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
      const newDf: Record<string, (number | null)[]> = {};
      const newDesc: Record<string, string> = {};

      headers.forEach((h) => {
        newDf[h] = [];
        newDesc[h] = `Импорт из ${file.name}`;
      });

      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(sep);
        headers.forEach((h, colIdx) => {
          const raw = vals[colIdx]?.replace(",", ".").trim();
          const parsed = raw !== undefined && raw !== "" ? Number(raw) : NaN;
          newDf[h].push(isNaN(parsed) ? null : parsed);
        });
      }

      const numericHeaders = headers.filter((h) =>
        newDf[h].some((v) => v !== null && !isNaN(v))
      );
      if (numericHeaders.length === 0) {
        setToastMsg("Ошибка: в CSV не найдено числовых колонок.");
        return;
      }

      const filteredDf: Record<string, (number | null)[]> = {};
      numericHeaders.forEach((h) => (filteredDf[h] = newDf[h]));

      setDf(filteredDf);
      setDescriptions(newDesc);
      setSelectedVars(numericHeaders.slice(0, 3));
      setDepVar(numericHeaders[0]);
      setRegressors(numericHeaders.slice(1, 4));
      setMarkovVar(numericHeaders[0]);
      setTsVar(numericHeaders[0]);
      setToastMsg(`📂 Загружен файл «${file.name}»: ${lines.length - 1} наблюдений.`);
    };
    reader.readAsText(file);
  };

  const exportToCSV = () => {
    const cols = Object.keys(df);
    const nRows = df[cols[0]].length;
    const csvRows = [cols.join(",")];
    for (let i = 0; i < nRows; i++) {
      csvRows.push(cols.map((c) => (df[c][i] ?? "")).join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ted_analytics_dataset.csv";
    a.click();
  };

  const markovResult = useMemo(
    () => computeMarkovChain(df[markovVar] || df[varNames[0]]),
    [df, markovVar, varNames]
  );
  const adfResult = useMemo(
    () => computeADF(df[tsVar] || df[varNames[0]]),
    [df, tsVar, varNames]
  );

  const multiSeriesChartData = useMemo(() => {
    const len = df[varNames[0]].length;
    const vars = selectedVars.length > 0 ? selectedVars : [varNames[0]];
    return Array.from({ length: len }, (_, i) => {
      const row: Record<string, number | null> = { t: i + 1 };
      vars.forEach((v) => (row[v] = df[v]?.[i] ?? null));
      return row;
    });
  }, [df, selectedVars, varNames]);

  return (
    <div className="ted-root">
      {/* АВТОНОМНЫЙ ДИЗАЙН-ДВИЖОК (НЕ ЗАВИСИТ ОТ СБОРКИ ВНЕШНЕГО TAILWIND) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        * { box-sizing: border-box; }
        body, html {
          margin: 0;
          padding: 0;
          background-color: #060714;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .ted-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(circle at 12% 18%, rgba(168, 85, 247, 0.16), transparent 34%),
            radial-gradient(circle at 86% 12%, rgba(6, 182, 212, 0.16), transparent 36%),
            radial-gradient(circle at 50% 88%, rgba(236, 72, 153, 0.12), transparent 40%),
            #060714;
        }
        .prism-bar {
          height: 4px;
          width: 100%;
          background: linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899, #f59e0b, #10b981);
        }
        .ted-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 28px;
          background: rgba(12, 14, 32, 0.82);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
          position: sticky;
          top: 0;
          z-index: 30;
        }
        .brand-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .brand-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 55%, #ec4899 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow: 0 8px 24px -4px rgba(139, 92, 246, 0.55);
        }
        .brand-title {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0;
          background: linear-gradient(90deg, #ffffff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .brand-pill {
          display: inline-block;
          margin-left: 10px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(6, 182, 212, 0.2), rgba(168, 85, 247, 0.25));
          border: 1px solid rgba(168, 85, 247, 0.45);
          color: #e9d5ff;
          vertical-align: middle;
        }
        .brand-sub {
          margin: 2px 0 0 0;
          font-size: 12px;
          color: #94a3b8;
        }
        .btn-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .btn-glass {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          color: #f8fafc;
          background: rgba(30, 41, 59, 0.75);
          border: 1px solid rgba(148, 163, 184, 0.22);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-glass:hover {
          background: rgba(51, 65, 85, 0.9);
          border-color: rgba(56, 189, 248, 0.55);
          transform: translateY(-1px);
        }
        .btn-primary-glow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 22px;
          border-radius: 13px;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          background: linear-gradient(135deg, #06b6d4 0%, #6366f1 50%, #ec4899 100%);
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.6);
          transition: all 0.2s ease;
        }
        .btn-primary-glow:hover {
          transform: translateY(-1px) scale(1.01);
          box-shadow: 0 12px 28px -4px rgba(236, 72, 153, 0.65);
        }
        .toast-strip {
          padding: 10px 28px;
          background: linear-gradient(90deg, rgba(6, 182, 212, 0.14), rgba(139, 92, 246, 0.14), rgba(236, 72, 153, 0.1));
          border-bottom: 1px solid rgba(139, 92, 246, 0.25);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12.5px;
          color: #e0e7ff;
        }
        .workspace-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 330px 1fr;
          min-height: calc(100vh - 115px);
        }
        @media (max-width: 1024px) {
          .workspace-grid {
            grid-template-columns: 1fr;
          }
        }
        .sidebar {
          background: rgba(11, 14, 29, 0.78);
          border-right: 1px solid rgba(148, 163, 184, 0.14);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .transform-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        .btn-transform {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 10px;
          border-radius: 10px;
          font-size: 11.5px;
          font-weight: 600;
          color: #e2e8f0;
          background: rgba(30, 41, 59, 0.65);
          border: 1px solid rgba(148, 163, 184, 0.2);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-transform:hover {
          background: rgba(99, 102, 241, 0.22);
          border-color: #818cf8;
          color: #fff;
        }
        .var-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
          overflow-y: auto;
          max-height: calc(100vh - 290px);
          padding-right: 4px;
        }
        .var-card {
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(17, 22, 42, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.15);
          cursor: pointer;
          transition: all 0.18s ease;
          position: relative;
          overflow: hidden;
        }
        .var-card:hover {
          border-color: rgba(148, 163, 184, 0.38);
          transform: translateX(2px);
        }
        .var-card.active {
          background: linear-gradient(135deg, rgba(30, 27, 75, 0.85), rgba(15, 23, 42, 0.9));
          border-color: rgba(56, 189, 248, 0.65);
          box-shadow: 0 4px 20px -4px rgba(6, 182, 212, 0.28);
        }
        .main-area {
          padding: 22px 28px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          overflow-x: hidden;
        }
        .tabs-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding: 6px;
          border-radius: 16px;
          background: rgba(15, 20, 40, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.14);
        }
        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 12px;
          font-size: 12.5px;
          font-weight: 700;
          color: #94a3b8;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.04);
        }
        .tab-btn.active {
          color: #ffffff;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.28), rgba(139, 92, 246, 0.38));
          border: 1px solid rgba(139, 92, 246, 0.55);
          box-shadow: 0 4px 16px -2px rgba(139, 92, 246, 0.35);
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        @media (max-width: 1100px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .kpi-grid { grid-template-columns: 1fr; }
        }
        .kpi-card {
          padding: 16px 18px;
          border-radius: 18px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(12px);
        }
        .kpi-cyan {
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(15, 23, 42, 0.85));
          border: 1px solid rgba(6, 182, 212, 0.4);
        }
        .kpi-violet {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(15, 23, 42, 0.85));
          border: 1px solid rgba(168, 85, 247, 0.4);
        }
        .kpi-emerald {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(15, 23, 42, 0.85));
          border: 1px solid rgba(16, 185, 129, 0.4);
        }
        .kpi-pink {
          background: linear-gradient(135deg, rgba(236, 72, 153, 0.18), rgba(15, 23, 42, 0.85));
          border: 1px solid rgba(236, 72, 153, 0.4);
        }
        .glass-panel {
          border-radius: 20px;
          background: rgba(14, 18, 38, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.16);
          padding: 20px 22px;
          box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.5);
        }
        .prism-panel {
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(30, 27, 75, 0.72), rgba(15, 23, 42, 0.9), rgba(49, 16, 66, 0.65));
          border: 1px solid rgba(168, 85, 247, 0.42);
          padding: 20px 22px;
          box-shadow: 0 12px 34px -8px rgba(139, 92, 246, 0.25);
        }
        .chip-btn {
          padding: 7px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(15, 23, 42, 0.8);
          color: #94a3b8;
        }
        .chip-btn.selected {
          background: linear-gradient(90deg, rgba(6, 182, 212, 0.25), rgba(139, 92, 246, 0.35));
          border-color: #38bdf8;
          color: #ffffff;
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.3);
        }
        .select-styled {
          width: 100%;
          padding: 10px 14px;
          border-radius: 12px;
          background: #090d1d;
          border: 1px solid rgba(139, 92, 246, 0.45);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          outline: none;
        }
        .ted-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .ted-table th {
          text-align: left;
          padding: 12px 14px;
          color: #94a3b8;
          font-weight: 700;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(9, 13, 29, 0.65);
        }
        .ted-table td {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }
        .ted-table tr:hover td {
          background: rgba(99, 102, 241, 0.08);
        }
        .badge-emerald {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(16, 185, 129, 0.18);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.4);
        }
        .badge-cyan {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(6, 182, 212, 0.18);
          color: #22d3ee;
          border: 1px solid rgba(6, 182, 212, 0.4);
        }
        .badge-amber {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(245, 158, 11, 0.18);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.4);
        }
        .badge-muted {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(148, 163, 184, 0.12);
          color: #94a3b8;
        }
        .two-col-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }
        @media (max-width: 960px) {
          .two-col-grid { grid-template-columns: 1fr; }
        }
        .range-slider {
          width: 100%;
          accent-color: #ec4899;
          cursor: pointer;
        }
      `,
        }}
      />

      {/* РАДУЖНАЯ ПОЛОСА СПЕКТРА ВВЕРХУ ЭКРАНА */}
      <div className="prism-bar" />

      {/* ШАПКА ПРИЛОЖЕНИЯ */}
      <header className="ted-header">
        <div className="brand-wrap">
          <div className="brand-icon">
            <TrendingUp size={24} />
          </div>
          <div>
            <h1 className="brand-title">
              TED Analytics
              <span className="brand-pill">Интерактивная эконометрика</span>
            </h1>
            <p className="brand-sub">
              МНК-моделирование • Диагностика гипотез • Симулятор сценариев • Цепи Маркова
            </p>
          </div>
        </div>

        <div className="btn-group">
          <label className="btn-glass">
            <Upload size={15} color="#38bdf8" />
            <span>Загрузить свой CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              style={{ display: "none" }}
            />
          </label>
          <button onClick={exportToCSV} className="btn-glass">
            <Download size={15} color="#34d399" />
            <span>Скачать таблицу CSV</span>
          </button>
        </div>
      </header>

      {/* ЦВЕТНАЯ СТРОКА УВЕДОМЛЕНИЙ */}
      <div className="toast-strip">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles size={16} color="#c084fc" />
          <span>{toastMsg}</span>
        </div>
        <span style={{ fontSize: "11.5px", color: "#94a3b8", fontWeight: 600 }}>
          Наблюдений в выборке: {df[varNames[0]].length}
        </span>
      </div>

      {/* РАБОЧАЯ ОБЛАСТЬ */}
      <div className="workspace-grid">
        {/* ЛЕВАЯ КОЛОНКА: ЯРКАЯ ПАЛИТРА ПОКАЗАТЕЛЕЙ */}
        <aside className="sidebar">
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "#e2e8f0", display: "flex", alignItems: "center", gap: "6px" }}>
                <Sliders size={14} color="#38bdf8" />
                Палитра показателей ({varNames.length})
              </span>
              <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700 }}>
                Активно: {selectedVars.length}
              </span>
            </div>
            <p style={{ fontSize: "11.5px", color: "#94a3b8", margin: "4px 0 8px 0" }}>
              Создайте новые ряды в один клик:
            </p>

            <div className="transform-grid">
              <button onClick={() => applyTransformation("log")} className="btn-transform">
                <PlusCircle size={13} color="#38bdf8" /> Логарифм ln(X)
              </button>
              <button onClick={() => applyTransformation("diff")} className="btn-transform">
                <PlusCircle size={13} color="#c084fc" /> Разность ΔX
              </button>
              <button onClick={() => applyTransformation("lag1")} className="btn-transform">
                <PlusCircle size={13} color="#f472b6" /> Лаг X(t-1)
              </button>
              <button onClick={() => applyTransformation("pch")} className="btn-transform">
                <PlusCircle size={13} color="#34d399" /> Прирост в %
              </button>
            </div>
          </div>

          <div className="var-list">
            {varStats.map((v) => {
              const isSelected = selectedVars.includes(v.name);
              return (
                <div
                  key={v.name}
                  onClick={() => toggleSelectVar(v.name)}
                  className={`var-card ${isSelected ? "active" : ""}`}
                  style={{ borderLeft: `4px solid ${v.color}` }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        style={{ accentColor: v.color, cursor: "pointer" }}
                      />
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#fff" }}>
                        {v.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        background: "rgba(15, 23, 42, 0.9)",
                        color: v.color,
                        fontWeight: 700,
                      }}
                    >
                      μ = {v.mean.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "5px", paddingLeft: "22px" }}>
                    {v.desc}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "10.5px",
                      color: "#64748b",
                      marginTop: "6px",
                      paddingLeft: "22px",
                      fontFamily: "monospace",
                    }}
                  >
                    <span>Разброс σ: {v.std.toFixed(2)}</span>
                    <span>min: {v.min.toFixed(1)} | max: {v.max.toFixed(1)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ПРАВАЯ ОСНОВНАЯ ОБЛАСТЬ */}
        <main className="main-area">
          {/* НАВИГАЦИЯ ПО РАЗДЕЛАМ */}
          <div className="tabs-nav">
            {[
              { id: "ols", label: "1. Регрессия и Симулятор сценариев", icon: Layers },
              { id: "markov", label: "2. Цепи Маркова и Прогноз фаз", icon: Activity },
              { id: "timeseries", label: "3. Временные ряды и Тепловая карта", icon: BarChart3 },
              { id: "data", label: "4. Таблица наблюдений", icon: TableIcon },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`tab-btn ${isActive ? "active" : ""}`}
                >
                  <Icon size={16} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* ============================================================== */}
          {/* ВКЛАДКА 1: МНК-РЕГРЕССИЯ + СИМУЛЯТОР «ЧТО ЕСЛИ?»                */}
          {/* ============================================================== */}
          {activeTab === "ols" && activeModel && (
            <>
              {/* ЯРКИЕ KPI-КАРТОЧКИ МОДЕЛИ */}
              <div className="kpi-grid">
                <div className="kpi-card kpi-cyan">
                  <div style={{ fontSize: "11.5px", color: "#67e8f9", fontWeight: 700 }}>
                    ТОЧНОСТЬ МОДЕЛИ (R²)
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff", marginTop: "4px" }}>
                    {(activeModel.metrics.r2 * 100).toFixed(1)}%
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "99px", marginTop: "8px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.min(100, activeModel.metrics.r2 * 100)}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #06b6d4, #38bdf8)",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                    Скорректированный R²: {(activeModel.metrics.adjR2 * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="kpi-card kpi-violet">
                  <div style={{ fontSize: "11.5px", color: "#d8b4fe", fontWeight: 700 }}>
                    F-КРИТЕРИЙ ФИШЕРА
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff", marginTop: "4px" }}>
                    {activeModel.metrics.fStat.toFixed(1)}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#34d399", fontWeight: 700, marginTop: "8px" }}>
                    ✓ p-value: {activeModel.metrics.fPval.toExponential(2)}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    Модель статистически надежна
                  </div>
                </div>

                <div className="kpi-card kpi-emerald">
                  <div style={{ fontSize: "11.5px", color: "#6ee7b7", fontWeight: 700 }}>
                    ДАРБИНА — УОТСОНА (DW)
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff", marginTop: "4px" }}>
                    {activeModel.metrics.dw.toFixed(3)}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#a7f3d0", marginTop: "8px" }}>
                    {activeModel.metrics.dw >= 1.5 && activeModel.metrics.dw <= 2.5
                      ? "✓ Норма (~2.0, автокорр. нет)"
                      : "⚠ Отклонение от 2.0"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    Станд. ошибка: ±{activeModel.metrics.seReg.toFixed(3)}
                  </div>
                </div>

                <div className="kpi-card kpi-pink">
                  <div style={{ fontSize: "11.5px", color: "#f9a8d4", fontWeight: 700 }}>
                    КРИТЕРИИ AIC / BIC
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#fff", marginTop: "4px" }}>
                    {activeModel.metrics.aic.toFixed(1)}{" "}
                    <span style={{ fontSize: "15px", color: "#f472b6" }}>
                      / {activeModel.metrics.bic.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#fbcfe8", marginTop: "8px" }}>
                    Выборка: {activeModel.nObs} наблюдений
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    Сумма кв. остатков: {activeModel.metrics.ssr.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* КОНСТРУКТОР УРАВНЕНИЯ РЕГРЕССИИ */}
              <div className="glass-panel">
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" }}>
                      Конструктор регрессионной модели
                    </h2>
                    <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                      Выберите зависимую переменную (Y) и кликните по факторам (X), которые хотите включить в расчет
                    </p>
                  </div>
                  <button onClick={handleRunOLS} className="btn-primary-glow">
                    <Play size={16} fill="#fff" />
                    <span>Пересчитать модель</span>
                  </button>
                </div>

                <div className="two-col-grid" style={{ alignItems: "start" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                      Целевой показатель (Y):
                    </label>
                    <select
                      value={depVar}
                      onChange={(e) => setDepVar(e.target.value)}
                      className="select-styled"
                    >
                      {varNames.map((v) => (
                        <option key={v} value={v}>
                          {v} — {descriptions[v] || ""}
                        </option>
                      ))}
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#cbd5e1", marginTop: "12px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={useHC3}
                        onChange={(e) => setUseHC3(e.target.checked)}
                        style={{ accentColor: "#ec4899" }}
                      />
                      <span>Робастные стандартные ошибки Уайта (HC3)</span>
                    </label>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#cbd5e1", marginBottom: "8px" }}>
                      Объясняющие факторы (X):
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {varNames
                        .filter((v) => v !== depVar)
                        .map((v) => {
                          const isSel = regressors.includes(v);
                          return (
                            <button
                              key={v}
                              onClick={() =>
                                setRegressors((prev) =>
                                  prev.includes(v)
                                    ? prev.filter((x) => x !== v)
                                    : [...prev, v]
                                )
                              }
                              className={`chip-btn ${isSel ? "selected" : ""}`}
                            >
                              {isSel ? "✦ " : "+ "}
                              {v}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ИНТЕРАКТИВНЫЙ СИМУЛЯТОР СЦЕНАРИЕВ «ЧТО ЕСЛИ?» + ВЫВОДЫ */}
              <div className="two-col-grid">
                {/* Левая карточка: Симулятор сценариев с ползунками */}
                <div className="prism-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Gauge size={20} color="#38bdf8" />
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff" }}>
                        Интерактивный симулятор «Что если?»
                      </h3>
                    </div>
                    <span className="badge-cyan">Живой прогноз</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#cbd5e1", margin: "0 0 14px 0" }}>
                    Двигайте ползунки факторов, чтобы увидеть, какое значение «{activeModel.depVar}» предсказывает построенная модель:
                  </p>

                  <div
                    style={{
                      padding: "14px 18px",
                      borderRadius: "14px",
                      background: "rgba(6, 7, 20, 0.75)",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
                        Прогнозное значение {activeModel.depVar}:
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#67e8f9" }}>
                        Среднее по выборке: {activeModel.metrics.yMean.toFixed(2)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "28px",
                        fontWeight: 900,
                        fontFamily: "monospace",
                        background: "linear-gradient(90deg, #38bdf8, #f472b6)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {simulatedPrediction.toFixed(2)}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {activeModel.coefficients.slice(1).map((c) => {
                      const st = varStats.find((s) => s.name === c.name);
                      const minVal = st ? Number((st.min * 0.8).toFixed(1)) : 0;
                      const maxVal = st ? Number((st.max * 1.2).toFixed(1)) : 100;
                      const curVal =
                        simValues[c.name] !== undefined
                          ? simValues[c.name]
                          : Number((st?.mean || 10).toFixed(2));
                      return (
                        <div key={c.name}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                            <span style={{ fontWeight: 700, color: "#f1f5f9" }}>
                              {c.name}{" "}
                              <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                                (β = {c.beta >= 0 ? `+${c.beta.toFixed(3)}` : c.beta.toFixed(3)})
                              </span>
                            </span>
                            <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#f472b6" }}>
                              {curVal}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={minVal}
                            max={maxVal}
                            step={(maxVal - minVal) / 100 || 0.1}
                            value={curVal}
                            onChange={(e) =>
                              setSimValues((prev) => ({
                                ...prev,
                                [c.name]: Number(e.target.value),
                              }))
                            }
                            className="range-slider"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Правая карточка: Готовое уравнение и выводы для курсовой */}
                <div className="glass-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Sparkles size={18} color="#f472b6" />
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff" }}>
                          Математическое уравнение и выводы
                        </h3>
                      </div>
                      <button onClick={copyReportToClipboard} className="btn-glass">
                        {copiedReport ? (
                          <>
                            <Check size={14} color="#34d399" />
                            <span>Скопировано!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} color="#c084fc" />
                            <span>Скопировать отчет</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: "#060714",
                        border: "1px solid rgba(236, 72, 153, 0.35)",
                        fontFamily: "monospace",
                        fontSize: "12.5px",
                        color: "#f9a8d4",
                        marginBottom: "14px",
                        overflowX: "auto",
                      }}
                    >
                      {formattedEquation}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px", color: "#e2e8f0", lineHeight: 1.5 }}>
                      {autoConclusions.map((note, idx) => (
                        <div key={idx} style={{ display: "flex", gap: "8px" }}>
                          <span style={{ color: "#38bdf8", fontWeight: 800 }}>✦</span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(148,163,184,0.14)" }}>
                    <button onClick={() => saveModelSeriesToDf("resid")} className="btn-glass">
                      + Сохранить остатки в список
                    </button>
                    <button onClick={() => saveModelSeriesToDf("fitted")} className="btn-glass">
                      + Сохранить прогноз в список
                    </button>
                  </div>
                </div>
              </div>

              {/* ТАБЛИЦА КОЭФФИЦИЕНТОВ МНК */}
              <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(148,163,184,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff" }}>
                      Параметры оцененной модели (МНК, N = {activeModel.nObs})
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                      Зеленый и бирюзовый бейджи означают статистически доказанное влияние фактора
                    </p>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="ted-table">
                    <thead>
                      <tr>
                        <th>Фактор (Переменная)</th>
                        <th style={{ textAlign: "right" }}>Коэффициент (β)</th>
                        <th style={{ textAlign: "right" }}>Станд. ошибка</th>
                        <th style={{ textAlign: "right" }}>t-статистика</th>
                        <th style={{ textAlign: "right" }}>p-value</th>
                        <th style={{ textAlign: "center" }}>Статус значимости</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeModel.coefficients.map((c) => (
                        <tr key={c.name}>
                          <td style={{ fontWeight: 700, color: "#fff" }}>
                            {c.name}
                            {descriptions[c.name] && (
                              <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 400 }}>
                                {descriptions[c.name]}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#38bdf8", fontSize: "13.5px" }}>
                            {c.beta.toFixed(5)}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", color: "#cbd5e1" }}>
                            {c.se.toFixed(5)}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", color: "#e2e8f0" }}>
                            {c.tStat.toFixed(4)}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", color: "#cbd5e1" }}>
                            {c.pValue < 0.0001 ? c.pValue.toExponential(2) : c.pValue.toFixed(4)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className={c.badgeClass}>
                              {c.sigText} {c.sigStars !== "—" && c.sigStars}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ГРАФИКИ С ГРАДИЕНТНОЙ ЗАЛИВКОЙ */}
              <div className="two-col-grid">
                <div className="glass-panel">
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 800, color: "#fff" }}>
                    Совпадение фактических данных и модели ({activeModel.depVar})
                  </h3>
                  <p style={{ margin: "0 0 14px 0", fontSize: "11.5px", color: "#94a3b8" }}>
                    Неоновая бирюзовая волна — реальные данные, розовый пунктир — расчет по модели
                  </p>
                  <div style={{ height: "270px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activeModel.seriesData}>
                        <defs>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="t" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#090d1d",
                            borderColor: "#38bdf8",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Area
                          type="monotone"
                          dataKey="actual"
                          name={`Факт (${activeModel.depVar})`}
                          stroke="#06b6d4"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorActual)"
                        />
                        <Area
                          type="monotone"
                          dataKey="fitted"
                          name="Модель (Прогноз)"
                          stroke="#ec4899"
                          strokeWidth={2.5}
                          strokeDasharray="5 5"
                          fill="none"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel">
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 800, color: "#fff" }}>
                    Диагностика тестов Гаусса — Маркова и остатков
                  </h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "11.5px", color: "#94a3b8" }}>
                    Сводка статистических проверок качества остатков регрессии
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                    <div style={{ padding: "10px 12px", borderRadius: "12px", background: "rgba(9,13,29,0.7)", border: "1px solid rgba(148,163,184,0.15)" }}>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>Тест Бреуша — Пагана</div>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: activeModel.diagnostics.bpPval > 0.05 ? "#34d399" : "#fbbf24", marginTop: "2px" }}>
                        p = {activeModel.diagnostics.bpPval.toFixed(3)} ({activeModel.diagnostics.bpPval > 0.05 ? "Гомоскедастичность" : "Гетероскедастичность"})
                      </div>
                    </div>
                    <div style={{ padding: "10px 12px", borderRadius: "12px", background: "rgba(9,13,29,0.7)", border: "1px solid rgba(148,163,184,0.15)" }}>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>Тест Рамсея (RESET)</div>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: activeModel.diagnostics.resetPval > 0.05 ? "#34d399" : "#fbbf24", marginTop: "2px" }}>
                        p = {activeModel.diagnostics.resetPval.toFixed(3)} ({activeModel.diagnostics.resetPval > 0.05 ? "Форма верна" : "Нужна нелинейность"})
                      </div>
                    </div>
                  </div>

                  <div style={{ height: "190px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis type="number" dataKey="fitted" name="Прогноз" stroke="#64748b" fontSize={11} />
                        <YAxis type="number" dataKey="resid" name="Остаток" stroke="#64748b" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#090d1d",
                            borderColor: "#f59e0b",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <ReferenceLine y={0} stroke="#ec4899" strokeDasharray="4 4" />
                        <Scatter name="Остатки модели" data={activeModel.seriesData} fill="#f59e0b" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ============================================================== */}
          {/* ВКЛАДКА 2: ЦЕПИ МАРКОВА                                        */}
          {/* ============================================================== */}
          {activeTab === "markov" && (
            <div className="two-col-grid">
              <div className="prism-panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" }}>
                      Матрица переходных вероятностей Маркова
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#cbd5e1" }}>
                      Текущая фаза: <strong style={{ color: "#38bdf8" }}>{markovResult.currentState}</strong>
                    </p>
                  </div>
                  <select
                    value={markovVar}
                    onChange={(e) => setMarkovVar(e.target.value)}
                    className="select-styled"
                    style={{ width: "auto" }}
                  >
                    {varNames.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <table className="ted-table">
                  <thead>
                    <tr>
                      <th>Из (t) \ В (t+1)</th>
                      {markovResult.shortLabels.map((l) => (
                        <th key={l} style={{ textAlign: "center" }}>
                          {l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {markovResult.P.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: "#e2e8f0" }}>
                          {markovResult.shortLabels[i]}
                          <div style={{ fontSize: "10.5px", color: "#94a3b8", fontFamily: "monospace" }}>
                            {markovResult.bounds[i]}
                          </div>
                        </td>
                        {row.map((prob, j) => (
                          <td key={j} style={{ textAlign: "center" }}>
                            <div
                              style={{
                                display: "inline-block",
                                padding: "6px 12px",
                                borderRadius: "10px",
                                fontWeight: 800,
                                fontFamily: "monospace",
                                color: "#fff",
                                background: `linear-gradient(135deg, rgba(6, 182, 212, ${
                                  0.15 + prob * 0.7
                                }), rgba(168, 85, 247, ${0.15 + prob * 0.7}))`,
                                border: "1px solid rgba(56, 189, 248, 0.35)",
                              }}
                            >
                              {(prob * 100).toFixed(1)}%
                            </div>
                            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "3px" }}>
                              n = {markovResult.counts[i][j]}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: "18px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1", marginBottom: "8px" }}>
                    Финальное стационарное равновесие (π · P = π):
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                    {markovResult.shortLabels.map((l, idx) => (
                      <div
                        key={l}
                        style={{
                          padding: "10px",
                          borderRadius: "12px",
                          background: "rgba(6, 7, 20, 0.7)",
                          border: "1px solid rgba(168, 85, 247, 0.35)",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#cbd5e1" }}>{l}</div>
                        <div style={{ fontSize: "18px", fontWeight: 900, color: "#34d399", marginTop: "2px", fontFamily: "monospace" }}>
                          {(markovResult.stationary[idx] * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-panel">
                <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800, color: "#fff" }}>
                  Прогноз распределения вероятностей на 6 шагов вперед
                </h3>
                <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#94a3b8" }}>
                  Динамика вероятностей перехода показателя «{markovVar}» по экономическим фазам
                </p>
                <div style={{ height: "320px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={markovResult.forecast}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="step" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#090d1d",
                          borderColor: "#a855f7",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar dataKey="S1" name="S1 (Спад)" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="S2" name="S2 (Стагнация)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="S3" name="S3 (Рост)" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ВКЛАДКА 3: ВРЕМЕННЫЕ РЯДЫ И ЦВЕТНАЯ ТЕПЛОВАЯ КАРТА КОРРЕЛЯЦИЙ   */}
          {/* ============================================================== */}
          {activeTab === "timeseries" && (
            <>
              <div className="two-col-grid">
                {/* Тест Дики — Фуллера */}
                <div className="glass-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff" }}>
                        Тест стационарности Дики — Фуллера (ADF)
                      </h3>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                        Проверка на отсутствие единичного корня
                      </p>
                    </div>
                    <select
                      value={tsVar}
                      onChange={(e) => setTsVar(e.target.value)}
                      className="select-styled"
                      style={{ width: "auto" }}
                    >
                      {varNames.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="kpi-card kpi-cyan">
                      <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
                        1. Модель с константой (порог 5%: {adfResult.constModel.crit5})
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 800, fontFamily: "monospace", marginTop: "4px" }}>
                        τ = {adfResult.constModel.tau.toFixed(4)}
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: adfResult.constModel.stationary ? "#34d399" : "#fbbf24", marginTop: "6px" }}>
                        {adfResult.constModel.stationary
                          ? "✓ Ряд стационарен I(0) — пригоден для моделирования"
                          : "⚠ Ряд нестационарен — нажмите «Разность ΔX» слева"}
                      </div>
                    </div>

                    <div className="kpi-card kpi-violet">
                      <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
                        2. Модель с константой и трендом (порог 5%: {adfResult.trendModel.crit5})
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 800, fontFamily: "monospace", marginTop: "4px" }}>
                        τ = {adfResult.trendModel.tau.toFixed(4)}
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: adfResult.trendModel.stationary ? "#34d399" : "#fbbf24", marginTop: "6px" }}>
                        {adfResult.trendModel.stationary
                          ? "✓ Ряд стационарен относительно тренда"
                          : "⚠ Присутствует стохастический тренд"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Тепловая матрица парных корреляций Пирсона */}
                <div className="glass-panel">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <Grid size={18} color="#ec4899" />
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff" }}>
                      Тепловая матрица корреляций Пирсона
                    </h3>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="ted-table">
                      <thead>
                        <tr>
                          <th>Показатель</th>
                          {varNames.slice(0, 6).map((v) => (
                            <th key={v} style={{ textAlign: "center", fontSize: "11px" }}>
                              {v}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {varNames.slice(0, 6).map((rVar) => (
                          <tr key={rVar}>
                            <td style={{ fontWeight: 700, fontSize: "11.5px", color: "#e2e8f0" }}>
                              {rVar}
                            </td>
                            {varNames.slice(0, 6).map((cVar) => {
                              const r = pearsonCorr(df[rVar], df[cVar]);
                              const absR = Math.abs(r);
                              const bg =
                                r >= 0
                                  ? `rgba(6, 182, 212, ${0.12 + absR * 0.65})`
                                  : `rgba(236, 72, 153, ${0.12 + absR * 0.65})`;
                              return (
                                <td key={cVar} style={{ textAlign: "center", padding: "6px" }}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "4px 7px",
                                      borderRadius: "8px",
                                      fontFamily: "monospace",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      background: bg,
                                      color: "#fff",
                                    }}
                                  >
                                    {r.toFixed(2)}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="glass-panel">
                <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: 800, color: "#fff" }}>
                  Сравнение динамики выбранных показателей ({selectedVars.join(", ")})
                </h3>
                <div style={{ height: "280px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={multiSeriesChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="t" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#090d1d",
                          borderColor: "#8b5cf6",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      {(selectedVars.length > 0 ? selectedVars : [varNames[0]]).map((v, i) => (
                        <Area
                          key={v}
                          type="monotone"
                          dataKey={v}
                          stroke={VAR_COLORS[i % VAR_COLORS.length]}
                          fill={VAR_COLORS[i % VAR_COLORS.length]}
                          fillOpacity={0.12}
                          strokeWidth={2.4}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* ============================================================== */}
          {/* ВКЛАДКА 4: ТАБЛИЦА НАБЛЮДЕНИЙ                                  */}
          {/* ============================================================== */}
          {activeTab === "data" && (
            <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(148,163,184,0.15)" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff" }}>
                  Полная таблица данных ({df[varNames[0]].length} периодов)
                </h3>
              </div>
              <div style={{ overflowX: "auto", maxHeight: "540px" }}>
                <table className="ted-table">
                  <thead>
                    <tr>
                      <th>Период (t)</th>
                      {varNames.map((v) => (
                        <th key={v} style={{ textAlign: "right" }}>
                          {v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: df[varNames[0]].length }, (_, rowIdx) => (
                      <tr key={rowIdx}>
                        <td style={{ color: "#94a3b8", fontFamily: "monospace" }}>#{rowIdx + 1}</td>
                        {varNames.map((v) => (
                          <td key={v} style={{ textAlign: "right", fontFamily: "monospace", color: "#e2e8f0" }}>
                            {df[v][rowIdx] !== null && df[v][rowIdx] !== undefined
                              ? Number(df[v][rowIdx]).toFixed(4)
                              : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
