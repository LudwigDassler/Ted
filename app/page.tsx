"use client";

import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
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
  Database,
  TrendingUp,
  Activity,
  Terminal,
  Upload,
  Download,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Play,
  Save,
  BarChart3,
} from "lucide-react";

// ============================================================================
// 1. МАТЕМАТИЧЕСКОЕ И ЭКОНОМЕТРИЧЕСКОЕ ЯДРО (ЧИСТЫЙ TYPESCRIPT)
// ============================================================================

/** Логарифм гамма-функции (аппроксимация Ланцоша) для точных p-value */
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

/** Регуляризованная неполная бета-функция I_x(a, b) (цепная дробь Ленца) */
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

/** Точные двусторонние p-value для t-критерия Стьюдента, F-критерия и Хи-квадрат */
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
  // Аппроксимация Уилсона — Хилферти для распределения Хи-квадрат
  const z = (Math.pow(x / k, 1 / 3) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k));
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const prob =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? prob : 1 - prob;
}

function stars(p: number): string {
  if (p < 0.01) return "***";
  if (p < 0.05) return "**";
  if (p < 0.1) return "*";
  return "";
}

/** Базовые матричные операции */
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

/** Обращение матрицы методом Гаусса — Жордана с частичным выбором главного элемента */
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
    if (Math.abs(pivot) < 1e-12) throw new Error("Вырожденная матрица (строгая мультиколлинеарность)");

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

// Интерфейс результата МНК-оценивания
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
    sig: string;
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
    hqc: number;
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

/** Полный цикл оценки МНК (OLS) + робастные ошибки Уайта (HC3) + диагностические тесты */
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
  const colNames = includeConst ? ["const", ...indepVars] : [...indepVars];
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

  // Ковариационная матрица: классическая или HC3 (Уайта)
  let covMatrix: number[][];
  if (!useHC3) {
    covMatrix = XTX_inv.map((row) => row.map((v) => v * s2));
  } else {
    // Расчет диагонали hat-матрицы h_ii = x_i * (X'X)^(-1) * x_i'
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
    return { name, beta: betas[i], se: se[i], tStat, pValue, sig: stars(pValue) };
  });

  const r2 = Math.max(0, 1 - ssr / tss);
  const adjR2 = 1 - (1 - r2) * ((T - 1) / dfResid);
  const fStat = dfModel > 0 ? ((tss - ssr) / dfModel) / (ssr / dfResid) : 0;
  const fPval = dfModel > 0 ? fTestPValue(fStat, dfModel, dfResid) : 1;

  const logLik = (-T / 2) * (1 + Math.log(2 * Math.PI) + Math.log(ssr / T));
  const aic = -2 * logLik + 2 * K;
  const bic = -2 * logLik + K * Math.log(T);
  const hqc = -2 * logLik + 2 * K * Math.log(Math.log(T));

  // Статистика Дарбина — Уотсона
  let dwNum = 0;
  for (let i = 1; i < T; i++) dwNum += Math.pow(resid[i] - resid[i - 1], 2);
  const dw = dwNum / ssr;

  // 1. Факторы инфляции дисперсии (VIF)
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
        vif.push({ name: indepVars[j], value: 999.9 });
      }
    }
  } else if (indepVars.length === 1) {
    vif.push({ name: indepVars[0], value: 1.0 });
  }

  // 2. Тест Бреуша — Пагана (LM = T * R^2 вспомогательной регрессии u^2 на X)
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

  // 3. Тест Жарка — Бера на нормальность остатков
  const rMean = resid.reduce((a, b) => a + b, 0) / T;
  const m2 = resid.reduce((a, e) => a + Math.pow(e - rMean, 2), 0) / T;
  const m3 = resid.reduce((a, e) => a + Math.pow(e - rMean, 3), 0) / T;
  const m4 = resid.reduce((a, e) => a + Math.pow(e - rMean, 4), 0) / T;
  const skew = m3 / Math.pow(m2, 1.5);
  const kurt = m4 / Math.pow(m2, 2);
  const jbStat = (T / 6) * (Math.pow(skew, 2) + Math.pow(kurt - 3, 2) / 4);
  const jbPval = chi2PValue(jbStat, 2);

  // 4. Тест Рамсея (RESET) с квадратом расчетных значений Y_hat^2
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
      hqc,
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

/** Расчет цепей Маркова: квантильная разбивка, матрица P_ij, прогноз P^t и вектор эргодичности pi */
function computeMarkovChain(series: (number | null)[], steps = 6) {
  const clean = series.filter((v): v is number => v !== null && !isNaN(v));
  const sorted = [...clean].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length / 3)];
  const q2 = sorted[Math.floor((2 * sorted.length) / 3)];

  const labels = ["S1 (Спад)", "S2 (Стагнация)", "S3 (Рост)"];
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
      step: `t + ${step}`,
      S1: Number((sVec[0] * 100).toFixed(2)),
      S2: Number((sVec[1] * 100).toFixed(2)),
      S3: Number((sVec[2] * 100).toFixed(2)),
    });
  }

  // Стационарное (эргодическое) распределение pi * P = pi (сходимость P^50)
  let pi = [1 / 3, 1 / 3, 1 / 3];
  for (let iter = 0; iter < 60; iter++) {
    const nextPi = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) nextPi[j] += pi[i] * P[i][j];
    }
    pi = nextPi;
  }

  return {
    labels,
    bounds: [
      `[${sorted[0].toFixed(2)}; ${q1.toFixed(2)}]`,
      `(${q1.toFixed(2)}; ${q2.toFixed(2)}]`,
      `(${q2.toFixed(2)}; ${sorted[sorted.length - 1].toFixed(2)}]`,
    ],
    counts,
    P,
    currentState: labels[currentStateIdx],
    forecast,
    stationary: pi,
  };
}

/** Расширенный тест Дики — Фуллера (ADF) с константой и трендом: dY_t = a + b*t + gamma*Y_{t-1} + e_t */
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
      crit1: -3.54,
      stationary: tauC < -2.91,
    },
    trendModel: {
      tau: tauCT,
      crit5: -3.49,
      crit1: -4.12,
      stationary: tauCT < -3.49,
    },
  };
}

// ============================================================================
// 2. ГЕНЕРАЦИЯ ДЕМОНСТРАЦИОННОГО МАКРОЭКОНОМИЧЕСКОГО ДАТАСЕТА (60 КВАРТАЛОВ)
// ============================================================================
function createInitialDataset() {
  const n = 60;
  const df: Record<string, (number | null)[]> = {
    GDP_Growth: [],
    Investment: [],
    KeyRate: [],
    LaborProd: [],
    Inflation: [],
  };

  // Детерминированный псевдослучайный генератор для воспроизводимости
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
    Inflation: "Инфляция ИПЦ (%, г/г)",
  };

  return { df, descriptions };
}

// ============================================================================
// 3. ГЛАВНЫЙ КОМПОНЕНТ ВЕБ-ПРИЛОЖЕНИЯ NEXTGRETL
// ============================================================================
export default function NextGretlWorkspace() {
  const initial = useMemo(() => createInitialDataset(), []);
  const [df, setDf] = useState<Record<string, (number | null)[]>>(initial.df);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(initial.descriptions);

  // Выбранные переменные в левой панели gretl
  const [selectedVars, setSelectedVars] = useState<string[]>(["GDP_Growth", "Investment", "KeyRate"]);
  const [activeTab, setActiveTab] = useState<"ols" | "markov" | "timeseries" | "data">("ols");

  // Параметры окна МНК (OLS)
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

  // Параметры вкладок Цепи Маркова и Временные ряды
  const [markovVar, setMarkovVar] = useState<string>("GDP_Growth");
  const [tsVar, setTsVar] = useState<string>("GDP_Growth");

  // Нижняя командная строка hansl
  const [cmdInput, setCmdInput] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>(
    "Готово. Рабочий набор: 60 наблюдений (квартальные макроданные)."
  );

  const varNames = Object.keys(df);
  const activeModel = models.find((m) => m.id === activeModelId) || models[models.length - 1];

  // Расчет базовых метрик для реестра переменных
  const varStats = useMemo(() => {
    return varNames.map((name, idx) => {
      const clean = df[name].filter((v): v is number => v !== null && !isNaN(v));
      const n = clean.length;
      const mean = n > 0 ? clean.reduce((a, b) => a + b, 0) / n : 0;
      const std =
        n > 1
          ? Math.sqrt(clean.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (n - 1))
          : 0;
      return {
        id: idx + 1,
        name,
        desc: descriptions[name] || "Пользовательский ряд",
        mean,
        std,
        n,
      };
    });
  }, [df, descriptions, varNames]);

  // Переключение выбора переменной в списке
  const toggleSelectVar = (name: string) => {
    setSelectedVars((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  // Быстрые трансформации gretl (l_, d_, _1, sq_, pch_)
  const applyTransformation = (mode: "log" | "diff" | "lag1" | "sq" | "pch", targets?: string[]) => {
    const varsToUse = targets && targets.length > 0 ? targets : selectedVars;
    if (varsToUse.length === 0) {
      setStatusMsg("Выберите хотя бы одну переменную в левом списке для трансформации.");
      return;
    }

    const nextDf = { ...df };
    const nextDesc = { ...descriptions };
    const created: string[] = [];

    for (const col of varsToUse) {
      const series = df[col];
      if (!series) continue;

      if (mode === "log") {
        const newName = `l_${col}`;
        nextDf[newName] = series.map((v) => (v !== null && v > 0 ? Number(Math.log(v).toFixed(5)) : null));
        nextDesc[newName] = `= log(${col})`;
        created.push(newName);
      } else if (mode === "diff") {
        const newName = `d_${col}`;
        nextDf[newName] = series.map((v, i) =>
          i > 0 && v !== null && series[i - 1] !== null
            ? Number((v - (series[i - 1] as number)).toFixed(5))
            : null
        );
        nextDesc[newName] = `= ${col}(t) - ${col}(t-1)`;
        created.push(newName);
      } else if (mode === "lag1") {
        const newName = `${col}_1`;
        nextDf[newName] = series.map((_, i) => (i > 0 ? series[i - 1] : null));
        nextDesc[newName] = `= ${col}(t-1)`;
        created.push(newName);
      } else if (mode === "sq") {
        const newName = `sq_${col}`;
        nextDf[newName] = series.map((v) => (v !== null ? Number((v * v).toFixed(5)) : null));
        nextDesc[newName] = `= ${col}^2`;
        created.push(newName);
      } else if (mode === "pch") {
        const newName = `pch_${col}`;
        nextDf[newName] = series.map((v, i) =>
          i > 0 && v !== null && series[i - 1] !== null && series[i - 1] !== 0
            ? Number((((v - (series[i - 1] as number)) / Math.abs(series[i - 1] as number)) * 100).toFixed(4))
            : null
        );
        nextDesc[newName] = `Темп прироста ${col} (%)`;
        created.push(newName);
      }
    }

    setDf(nextDf);
    setDescriptions(nextDesc);
    setStatusMsg(`Добавлены трансформированные ряды: ${created.join(", ")}`);
  };

  // Оценка новой МНК-модели
  const handleRunOLS = (
    customY?: string,
    customX?: string[],
    customHC3?: boolean
  ) => {
    const targetY = customY || depVar;
    const targetX = (customX || regressors).filter((x) => x !== targetY);
    const hc3Flag = customHC3 !== undefined ? customHC3 : useHC3;

    if (targetX.length === 0) {
      setStatusMsg("Ошибка: выберите хотя бы один независимый регрессор X.");
      return;
    }

    try {
      const nextId = models.length + 1;
      const res = estimateOLS(df, targetY, targetX, true, hc3Flag, nextId);
      setModels((prev) => [...prev, res]);
      setActiveModelId(nextId);
      setActiveTab("ols");
      setStatusMsg(
        `Оценена Модель ${nextId} (МНК: ${targetY} от ${targetX.join(", ")}). R² = ${(res.metrics.r2 * 100).toFixed(2)}%`
      );
    } catch (err: unknown) {
      setStatusMsg(`Ошибка расчетов МНК: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Сохранение остатков uhat или прогноза yhat обратно в датасет (как в gretl)
  const saveModelSeriesToDf = (type: "resid" | "fitted") => {
    if (!activeModel) return;
    const totalLen = df[activeModel.depVar].length;
    const newCol: (number | null)[] = Array(totalLen).fill(null);

    for (const pt of activeModel.seriesData) {
      newCol[pt.rowIdx] = type === "resid" ? pt.resid : pt.fitted;
    }

    const colName = type === "resid" ? `uhat${activeModel.id}` : `yhat${activeModel.id}`;
    const colDesc =
      type === "resid"
        ? `Остатки Модели ${activeModel.id} (${activeModel.depVar})`
        : `Расчетные значения Модели ${activeModel.id} (${activeModel.depVar})`;

    setDf((prev) => ({ ...prev, [colName]: newCol }));
    setDescriptions((prev) => ({ ...prev, [colName]: colDesc }));
    setStatusMsg(`Ряд '${colName}' успешно добавлен в реестр переменных.`);
  };

  // Загрузка пользовательского CSV-файла
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

      // Оставляем только числовые столбцы
      const numericHeaders = headers.filter((h) =>
        newDf[h].some((v) => v !== null && !isNaN(v))
      );
      if (numericHeaders.length === 0) {
        setStatusMsg("Ошибка: в CSV не найдено числовых столбцов.");
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
      setStatusMsg(`Импортирован файл ${file.name}: ${lines.length - 1} набл., ${numericHeaders.length} перем.`);
    };
    reader.readAsText(file);
  };

  // Экспорт текущего датасета в CSV
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
    a.download = "nextgretl_dataset.csv";
    a.click();
  };

  // Исполнение команд консоли hansl
  const handleHanslCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = cmdInput.trim();
    if (!raw) return;
    setCmdInput("");

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).filter((a) => a !== "const" && df[a] !== undefined);

    if (cmd === "ols" && args.length >= 2) {
      setDepVar(args[0]);
      setRegressors(args.slice(1));
      handleRunOLS(args[0], args.slice(1));
    } else if ((cmd === "logs" || cmd === "log") && args.length >= 1) {
      applyTransformation("log", args);
    } else if (cmd === "diff" && args.length >= 1) {
      applyTransformation("diff", args);
    } else if (cmd === "square" && args.length >= 1) {
      applyTransformation("sq", args);
    } else if (cmd === "markov" && args.length >= 1) {
      setMarkovVar(args[0]);
      setActiveTab("markov");
      setStatusMsg(`Построена цепь Маркова для ${args[0]}`);
    } else if (cmd === "adf" && args.length >= 1) {
      setTsVar(args[0]);
      setActiveTab("timeseries");
      setStatusMsg(`Выполнен ADF-тест стационарности для ${args[0]}`);
    } else {
      setStatusMsg(
        "Синтаксис hansl: ols Y X1 X2 | logs X1 | diff X1 | square X1 | markov Y | adf Y"
      );
    }
  };

  // Вычисляем результаты Маркова и ADF
  const markovResult = useMemo(
    () => computeMarkovChain(df[markovVar] || df[varNames[0]]),
    [df, markovVar, varNames]
  );
  const adfResult = useMemo(
    () => computeADF(df[tsVar] || df[varNames[0]]),
    [df, tsVar, varNames]
  );

  // Данные для мульти-графика временных рядов
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* ВЕРХНЯЯ ПАНЕЛЬ (ШАПКА GRETL STUDIO) */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              NextGretl
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Econometric Studio
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              МНК (OLS + HC3) • Диагностика Гаусса — Маркова • ADF • Цепи Маркова
            </p>
          </div>
        </div>

        {/* Кнопки импорта и экспорта CSV */}
        <div className="flex items-center gap-2.5">
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            Импорт CSV
            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          </label>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Экспорт CSV
          </button>
        </div>
      </header>

      {/* ОСНОВНАЯ РАБОЧАЯ ОБЛАСТЬ (ЛЕВЫЙ РЕЕСТР ПЕРЕМЕННЫХ + ПРАВЫЕ ВКЛАДКИ) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* ЛЕВАЯ КОЛОНКА: РЕЕСТР ПЕРЕМЕННЫХ КАК В GRETL */}
        <aside className="lg:col-span-4 xl:col-span-3 border-r border-slate-800 bg-slate-900/50 flex flex-col">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              Реестр переменных ({varNames.length + 1})
            </span>
            <span className="text-[11px] text-slate-500">Клик для выбора</span>
          </div>

          {/* Панель быстрых трансформаций («Меню Добавить» в gretl) */}
          <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-wrap gap-1.5">
            <button
              onClick={() => applyTransformation("log")}
              title="Натуральный логарифм выбранных переменных"
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700 text-slate-200 transition"
            >
              + log (l_)
            </button>
            <button
              onClick={() => applyTransformation("diff")}
              title="Первые разности выбранных переменных"
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700 text-slate-200 transition"
            >
              + diff (d_)
            </button>
            <button
              onClick={() => applyTransformation("lag1")}
              title="Лаг 1-го порядка (t-1)"
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700 text-slate-200 transition"
            >
              + lag (_1)
            </button>
            <button
              onClick={() => applyTransformation("sq")}
              title="Квадраты переменных"
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700 text-slate-200 transition"
            >
              + sq (X²)
            </button>
            <button
              onClick={() => applyTransformation("pch")}
              title="Темп прироста в %"
              className="px-2 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700 text-slate-200 transition"
            >
              + pch (%)
            </button>
          </div>

          {/* Таблица переменных */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 text-xs">
            {/* ID 0 = const */}
            <div className="px-3.5 py-2.5 bg-slate-900/30 text-slate-500 flex items-center justify-between font-mono">
              <div>
                <span className="inline-block w-6 text-slate-600">0</span>
                <span className="font-semibold text-slate-400">const</span>
                <p className="text-[11px] font-sans text-slate-500 pl-6">
                  Константа (единичный вектор)
                </p>
              </div>
              <span className="text-[11px]">μ = 1.00</span>
            </div>

            {varStats.map((v) => {
              const isSelected = selectedVars.includes(v.name);
              return (
                <div
                  key={v.name}
                  onClick={() => toggleSelectVar(v.name)}
                  className={`px-3.5 py-2.5 cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? "bg-indigo-600/15 border-l-2 border-l-indigo-500"
                      : "hover:bg-slate-800/50"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="w-5 text-slate-500">{v.id}</span>
                      <span className="font-semibold text-slate-100 truncate">
                        {v.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate pl-6">
                      {v.desc}
                    </p>
                  </div>
                  <div className="text-right font-mono text-[11px] shrink-0">
                    <div className="text-slate-300">μ: {v.mean.toFixed(2)}</div>
                    <div className="text-slate-500">
                      σ: {v.std.toFixed(2)} (N={v.n})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ПРАВАЯ ЧАСТЬ: ВКЛАДКИ АНАЛИЗА И ГРАФИКОВ */}
        <main className="lg:col-span-8 xl:col-span-9 flex flex-col overflow-y-auto bg-slate-950">
          {/* Переключатель рабочих вкладок */}
          <div className="border-b border-slate-800 bg-slate-900/40 px-6 flex items-center gap-2 pt-2">
            {[
              { id: "ols", label: "МНК-Модели (OLS & Диагностика)", icon: Layers },
              { id: "markov", label: "Цепи Маркова (Матрица P и Прогноз)", icon: Activity },
              { id: "timeseries", label: "Временные ряды (ADF & Корреляции)", icon: BarChart3 },
              { id: "data", label: "Таблица наблюдений", icon: Database },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg border-t border-x transition ${
                    active
                      ? "bg-slate-950 text-indigo-400 border-slate-800"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-6 space-y-6 flex-1">
            {/* ============================================================== */}
            {/* ВКЛАДКА 1: МНК-РЕГРЕССИЯ (OLS MODEL WINDOW КАК В GRETL)         */}
            {/* ============================================================== */}
            {activeTab === "ols" && (
              <>
                {/* Конструктор спецификации модели */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                          Зависимая переменная (Y)
                        </label>
                        <select
                          value={depVar}
                          onChange={(e) => setDepVar(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                        >
                          {varNames.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={useHC3}
                          onChange={(e) => setUseHC3(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-indigo-500"
                        />
                        Робастные ст. ошибки Уайта (HC3)
                      </label>
                    </div>

                    <button
                      onClick={() => handleRunOLS()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Оценить модель МНК
                    </button>
                  </div>

                  {/* Выбор регрессоров (X) чипсами */}
                  <div>
                    <span className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                      Независимые переменные / Регрессоры (X):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {varNames
                        .filter((v) => v !== depVar)
                        .map((v) => {
                          const active = regressors.includes(v);
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
                              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition ${
                                active
                                  ? "bg-indigo-600/25 border-indigo-500 text-indigo-200"
                                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              {v}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Список открытых окон моделей (Модель 1, Модель 2...) */}
                {models.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setActiveModelId(m.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono border transition ${
                          m.id === activeModel.id
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        Модель {m.id}: {m.depVar} ({m.useHC3 ? "HC3" : "OLS"})
                      </button>
                    ))}
                  </div>
                )}

                {/* ФИРМЕННАЯ ТАБЛИЦА ОТЧЕТА GRETL */}
                {activeModel && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-900">
                      <div>
                        <h2 className="text-sm font-bold text-white font-mono">
                          Модель {activeModel.id}: МНК, использованы наблюдения 1–
                          {activeModel.nObs} (T = {activeModel.nObs})
                        </h2>
                        <p className="text-xs text-slate-400 font-mono">
                          Зависимая переменная: {activeModel.depVar}{" "}
                          {activeModel.useHC3 && "• Робастные ошибки Уайта (HC3)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveModelSeriesToDf("resid")}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                        >
                          <Save className="w-3.5 h-3.5 text-amber-400" />+ uhat
                          {activeModel.id}
                        </button>
                        <button
                          onClick={() => saveModelSeriesToDf("fitted")}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />+ yhat
                          {activeModel.id}
                        </button>
                      </div>
                    </div>

                    {/* Таблица коэффициентов */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                            <th className="py-2.5 px-4">Переменная</th>
                            <th className="py-2.5 px-4 text-right">Коэффициент</th>
                            <th className="py-2.5 px-4 text-right">Ст. ошибка</th>
                            <th className="py-2.5 px-4 text-right">t-статистика</th>
                            <th className="py-2.5 px-4 text-right">p-значение</th>
                            <th className="py-2.5 px-4 text-center">Знач.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {activeModel.coefficients.map((c) => (
                            <tr key={c.name} className="hover:bg-slate-800/40">
                              <td className="py-2 px-4 font-semibold text-indigo-300">
                                {c.name}
                              </td>
                              <td className="py-2 px-4 text-right text-slate-100">
                                {c.beta.toFixed(5)}
                              </td>
                              <td className="py-2 px-4 text-right text-slate-300">
                                {c.se.toFixed(5)}
                              </td>
                              <td className="py-2 px-4 text-right text-slate-200">
                                {c.tStat.toFixed(4)}
                              </td>
                              <td className="py-2 px-4 text-right text-slate-300">
                                {c.pValue < 0.0001
                                  ? c.pValue.toExponential(2)
                                  : c.pValue.toFixed(4)}
                              </td>
                              <td className="py-2 px-4 text-center text-amber-400 font-bold">
                                {c.sig}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Двухколоночный блок метрик gretl */}
                    <div className="p-4 bg-slate-950/60 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 block text-[11px]">
                          R-квадрат / Испр. R²
                        </span>
                        <span className="text-emerald-400 font-bold">
                          {activeModel.metrics.r2.toFixed(4)}
                        </span>{" "}
                        / {activeModel.metrics.adjR2.toFixed(4)}
                      </div>
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 block text-[11px]">
                          F({activeModel.dfModel}, {activeModel.dfResid}) [p-val]
                        </span>
                        <span className="text-white font-bold">
                          {activeModel.metrics.fStat.toFixed(2)}
                        </span>{" "}
                        [{activeModel.metrics.fPval.toExponential(2)}]
                      </div>
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 block text-[11px]">
                          Критерии AIC / BIC
                        </span>
                        <span className="text-slate-200">
                          {activeModel.metrics.aic.toFixed(2)} /{" "}
                          {activeModel.metrics.bic.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 block text-[11px]">
                          Дарбина — Уотсона (DW)
                        </span>
                        <span className="text-indigo-300 font-bold">
                          {activeModel.metrics.dw.toFixed(4)}
                        </span>{" "}
                        (SSR: {activeModel.metrics.ssr.toFixed(1)})
                      </div>
                    </div>
                  </div>
                )}

                {/* БЛОК ДИАГНОСТИЧЕСКИХ ТЕСТОВ ПРЕДПОСЫЛОК ГАУССА — МАРКОВА */}
                {activeModel && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Бреуш — Паган */}
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span>Бреуш — Паган (LM)</span>
                        {activeModel.diagnostics.bpPval > 0.05 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-300">
                        LM = {activeModel.diagnostics.bpLM.toFixed(3)} (p ={" "}
                        {activeModel.diagnostics.bpPval.toFixed(3)})
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {activeModel.diagnostics.bpPval > 0.05
                          ? "Гомоскедастичность (норма)"
                          : "Гетероскедастичность (включите HC3)"}
                      </p>
                    </div>

                    {/* Рамсей RESET */}
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span>Тест Рамсея (RESET)</span>
                        {activeModel.diagnostics.resetPval > 0.05 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-300">
                        F = {activeModel.diagnostics.resetF.toFixed(3)} (p ={" "}
                        {activeModel.diagnostics.resetPval.toFixed(3)})
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {activeModel.diagnostics.resetPval > 0.05
                          ? "Линейная спецификация адекватна"
                          : "Пропущены нелинейности (X²)"}
                      </p>
                    </div>

                    {/* Жарк — Бера */}
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span>Жарк — Бера (JB)</span>
                        {activeModel.diagnostics.jbPval > 0.05 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-300">
                        JB = {activeModel.diagnostics.jbStat.toFixed(3)} (p ={" "}
                        {activeModel.diagnostics.jbPval.toFixed(3)})
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {activeModel.diagnostics.jbPval > 0.05
                          ? "Остатки распределены нормально"
                          : "Отклонение от нормальности"}
                      </p>
                    </div>

                    {/* Мультиколлинеарность VIF */}
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                      <div className="text-xs font-semibold mb-1">
                        Факторы инфляции (VIF)
                      </div>
                      <div className="space-y-0.5 font-mono text-[11px]">
                        {activeModel.diagnostics.vif.map((v) => (
                          <div key={v.name} className="flex justify-between">
                            <span className="text-slate-400 truncate pr-2">
                              {v.name}:
                            </span>
                            <span
                              className={
                                v.value < 5
                                  ? "text-emerald-400"
                                  : v.value < 10
                                  ? "text-amber-400"
                                  : "text-rose-400 font-bold"
                              }
                            >
                              {v.value.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ИНТЕРАКТИВНЫЕ ГРАФИКИ RECHARTS: Y vs Y_HAT И ОСТАТКИ */}
                {activeModel && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                      <h3 className="text-xs font-semibold text-slate-300 mb-3">
                        Фактические ({activeModel.depVar}) и расчетные значения (Y_hat)
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={activeModel.seriesData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="t" stroke="#64748b" fontSize={11} />
                            <YAxis stroke="#64748b" fontSize={11} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                borderColor: "#334155",
                                fontSize: "12px",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Line
                              type="monotone"
                              dataKey="actual"
                              name={`Факт (${activeModel.depVar})`}
                              stroke="#38bdf8"
                              strokeWidth={2}
                              dot={{ r: 2 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="fitted"
                              name="Модель МНК (Y_hat)"
                              stroke="#f43f5e"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                      <h3 className="text-xs font-semibold text-slate-300 mb-3">
                        Диаграмма остатков регрессии (uhat vs Y_hat)
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis
                              type="number"
                              dataKey="fitted"
                              name="Y_hat"
                              stroke="#64748b"
                              fontSize={11}
                            />
                            <YAxis
                              type="number"
                              dataKey="resid"
                              name="Остаток e"
                              stroke="#64748b"
                              fontSize={11}
                            />
                            <Tooltip
                              cursor={{ strokeDasharray: "3 3" }}
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                borderColor: "#334155",
                                fontSize: "12px",
                              }}
                            />
                            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
                            <Scatter
                              name="Наблюдения (e_i)"
                              data={activeModel.seriesData}
                              fill="#f59e0b"
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 2: ЦЕПИ МАРКОВА (МАТРИЦА ПЕРЕХОДОВ И ПРОГНОЗ)          */}
            {/* ============================================================== */}
            {activeTab === "markov" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-400">
                      Анализируемый показатель:
                    </label>
                    <select
                      value={markovVar}
                      onChange={(e) => setMarkovVar(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                    >
                      {varNames.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs font-mono text-slate-300">
                    Текущее состояние (t=0):{" "}
                    <span className="text-indigo-400 font-bold">
                      {markovResult.currentState}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Матрица переходных вероятностей P_ij */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-white">
                      Матрица переходных вероятностей (P_ij) и частоты (n_ij)
                    </h3>
                    <table className="w-full border-collapse font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 text-left">Из (t) \ В (t+1)</th>
                          {markovResult.labels.map((l) => (
                            <th key={l} className="py-2 text-center">
                              {l}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {markovResult.P.map((row, i) => (
                          <tr key={i}>
                            <td className="py-3 font-semibold text-indigo-300">
                              {markovResult.labels[i]}
                              <span className="block text-[10px] text-slate-500">
                                {markovResult.bounds[i]}
                              </span>
                            </td>
                            {row.map((prob, j) => (
                              <td key={j} className="py-3 text-center">
                                <div
                                  className="inline-block px-2.5 py-1 rounded font-bold"
                                  style={{
                                    backgroundColor: `rgba(99, 102, 241, ${
                                      0.12 + prob * 0.65
                                    })`,
                                  }}
                                >
                                  {prob.toFixed(4)}
                                </div>
                                <span className="block text-[10px] text-slate-500 mt-0.5">
                                  n = {markovResult.counts[i][j]}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Стационарное (эргодическое) распределение pi */}
                    <div className="pt-3 border-t border-slate-800">
                      <span className="text-xs text-slate-400 block mb-2">
                        Предельное (эргодическое) распределение вероятностей (π · P = π):
                      </span>
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                        {markovResult.labels.map((l, idx) => (
                          <div
                            key={l}
                            className="p-2.5 rounded bg-slate-950 border border-slate-800 text-center"
                          >
                            <div className="text-slate-400 text-[11px]">{l}</div>
                            <div className="text-emerald-400 font-bold text-sm mt-0.5">
                              {(markovResult.stationary[idx] * 100).toFixed(2)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* График прогноза распределения вероятностей S(t) = S(0) * P^t */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col">
                    <h3 className="text-sm font-bold text-white mb-1">
                      Динамика прогноза состояний по шагам (S_t = S_0 · P^t)
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Вероятности нахождения показателя в каждой фазе (%) на 6 периодов вперед
                    </p>
                    <div className="flex-1 min-h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={markovResult.forecast}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="step" stroke="#64748b" fontSize={12} />
                          <YAxis stroke="#64748b" fontSize={12} unit="%" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderColor: "#334155",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px" }} />
                          <Bar dataKey="S1" name="S1 (Спад)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                          <Bar
                            dataKey="S2"
                            name="S2 (Стагнация)"
                            fill="#eab308"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar dataKey="S3" name="S3 (Рост)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 3: ВРЕМЕННЫЕ РЯДЫ (ADF-ТЕСТ И МАТРИЦА КОРРЕЛЯЦИЙ)       */}
            {/* ============================================================== */}
            {activeTab === "timeseries" && (
              <div className="space-y-6">
                {/* Карточка теста Дики — Фуллера (ADF) */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Расширенный тест Дики — Фуллера (ADF) на единичный корень
                      </h3>
                      <p className="text-xs text-slate-400">
                        Нулевая гипотеза H0: ряд нестационарен I(1) (содержит единичный корень)
                      </p>
                    </div>
                    <select
                      value={tsVar}
                      onChange={(e) => setTsVar(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                    >
                      {varNames.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 mb-1">
                        1. Спецификация с константой (τ_c):
                      </div>
                      <div className="text-base font-bold text-white">
                        τ = {adfResult.constModel.tau.toFixed(4)}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          (5% крит.: {adfResult.constModel.crit5})
                        </span>
                      </div>
                      <div
                        className={`mt-2 font-sans font-semibold ${
                          adfResult.constModel.stationary
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {adfResult.constModel.stationary
                          ? "✓ H0 отвергается: ряд стационарен в уровнях I(0)"
                          : "⚠ Ряд нестационарен (рекомендуется взять разность d_)"}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 mb-1">
                        2. Спецификация с константой и трендом (τ_ct):
                      </div>
                      <div className="text-base font-bold text-white">
                        τ = {adfResult.trendModel.tau.toFixed(4)}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          (5% крит.: {adfResult.trendModel.crit5})
                        </span>
                      </div>
                      <div
                        className={`mt-2 font-sans font-semibold ${
                          adfResult.trendModel.stationary
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {adfResult.trendModel.stationary
                          ? "✓ H0 отвергается: ряд стационарен вокруг тренда"
                          : "⚠ Ряд нестационарен"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* График выбранных в левом списке переменных */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <h3 className="text-xs font-semibold text-slate-300 mb-3">
                    Динамика выбранных в реестре переменных ({selectedVars.join(", ")})
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={multiSeriesChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="t" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#334155",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        {(selectedVars.length > 0 ? selectedVars : [varNames[0]]).map(
                          (v, i) => {
                            const palette = [
                              "#38bdf8",
                              "#a855f7",
                              "#10b981",
                              "#f59e0b",
                              "#f43f5e",
                            ];
                            return (
                              <Line
                                key={v}
                                type="monotone"
                                dataKey={v}
                                stroke={palette[i % palette.length]}
                                strokeWidth={2}
                                dot={false}
                              />
                            );
                          }
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 4: ТАБЛИЦА НАБЛЮДЕНИЙ                                  */}
            {/* ============================================================== */}
            {activeTab === "data" && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">t</th>
                        {varNames.map((v) => (
                          <th key={v} className="py-2.5 px-3 text-right">
                            {v}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {Array.from({ length: df[varNames[0]].length }, (_, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-800/40">
                          <td className="py-1.5 px-3 text-slate-500">{rowIdx + 1}</td>
                          {varNames.map((v) => (
                            <td key={v} className="py-1.5 px-3 text-right text-slate-200">
                              {df[v][rowIdx] !== null && df[v][rowIdx] !== undefined
                                ? Number(df[v][rowIdx]).toFixed(4)
                                : "NA"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* НИЖНЯЯ КОНСОЛЬ HANSL И СТРОКА СОСТОЯНИЯ */}
      <footer className="border-t border-slate-800 bg-slate-900 px-6 py-2.5 flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleHanslCommand} className="flex-1 flex items-center gap-2 w-full">
          <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            type="text"
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            placeholder="Консоль hansl: ols GDP_Growth Investment KeyRate | logs Investment | diff KeyRate | markov GDP_Growth"
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
          >
            Выполнить
          </button>
        </form>
        <div className="text-xs text-slate-400 font-mono truncate max-w-md">
          {statusMsg}
        </div>
      </footer>
    </div>
  );
}