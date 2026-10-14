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
  Info,
  PlusCircle,
  Sliders,
} from "lucide-react";

// ============================================================================
// 1. МАТЕМАТИЧЕСКОЕ И СТАТИСТИЧЕСКОЕ ЯДРО
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

function significanceLabel(p: number): { stars: string; text: string; color: string } {
  if (p < 0.01) return { stars: "***", text: "Высокая (1%)", color: "text-emerald-400" };
  if (p < 0.05) return { stars: "**", text: "Значим (5%)", color: "text-teal-400" };
  if (p < 0.1) return { stars: "*", text: "Слабая (10%)", color: "text-amber-400" };
  return { stars: "—", text: "Незначим", color: "text-slate-500" };
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
    sigColor: string;
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
    const sig = significanceLabel(pValue);
    return {
      name,
      beta: betas[i],
      se: se[i],
      tStat,
      pValue,
      sigStars: sig.stars,
      sigText: sig.text,
      sigColor: sig.color,
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

  const labels = ["Фаза 1 (Низкие значения)", "Фаза 2 (Умеренные)", "Фаза 3 (Высокие значения)"];
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
      step: `Период +${step}`,
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
    labels,
    shortLabels,
    bounds: [
      `от ${sorted[0].toFixed(2)} до ${q1.toFixed(2)}`,
      `от ${q1.toFixed(2)} до ${q2.toFixed(2)}`,
      `от ${q2.toFixed(2)} до ${sorted[sorted.length - 1].toFixed(2)}`,
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

// ============================================================================
// 2. НАЧАЛЬНЫЙ НАБОР МАКРОЭКОНОМИЧЕСКИХ ДАННЫХ
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

// ============================================================================
// 3. ГЛАВНЫЙ КОМПОНЕНТ ИНТЕРФЕЙСА TED ANALYTICS
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
    "Загружена демонстрационная выборка (60 кварталов). Выберите факторы или загрузите свой CSV."
  );

  const varNames = Object.keys(df);
  const activeModel = models.find((m) => m.id === activeModelId) || models[models.length - 1];

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
        desc: descriptions[name] || "Производный показатель",
        mean,
        std,
        n,
      };
    });
  }, [df, descriptions, varNames]);

  const toggleSelectVar = (name: string) => {
    setSelectedVars((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  // Преобразования показателей с понятными уведомлениями
  const applyTransformation = (mode: "log" | "diff" | "lag1" | "sq" | "pch") => {
    if (selectedVars.length === 0) {
      setToastMsg("Отметьте галочкой хотя бы один показатель в списке слева.");
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
        nextDesc[newName] = `Значение за прошлый период ${col}(t-1)`;
        created.push(newName);
      } else if (mode === "sq") {
        const newName = `sq_${col}`;
        nextDf[newName] = series.map((v) => (v !== null ? Number((v * v).toFixed(5)) : null));
        nextDesc[newName] = `Квадрат показателя (${col})²`;
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
        nextDesc[newName] = `Цепной темп прироста ${col} (%)`;
        created.push(newName);
      }
    }

    setDf(nextDf);
    setDescriptions(nextDesc);
    setToastMsg(`Созданы новые показатели: ${created.join(", ")}`);
  };

  const handleRunOLS = () => {
    const targetX = regressors.filter((x) => x !== depVar);
    if (targetX.length === 0) {
      setToastMsg("Выберите хотя бы один объясняющий фактор (X) для построения модели.");
      return;
    }

    try {
      const nextId = models.length + 1;
      const res = estimateOLS(df, depVar, targetX, true, useHC3, nextId);
      setModels((prev) => [...prev, res]);
      setActiveModelId(nextId);
      setActiveTab("ols");
      setToastMsg(
        `Модель №${nextId} успешно рассчитана! Объясняющая способность R² = ${(
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
        ? `Ошибки (остатки) Модели №${activeModel.id} для ${activeModel.depVar}`
        : `Расчетные значения Модели №${activeModel.id} для ${activeModel.depVar}`;

    setDf((prev) => ({ ...prev, [colName]: newCol }));
    setDescriptions((prev) => ({ ...prev, [colName]: colDesc }));
    setToastMsg(`Показатель «${colName}» сохранен в общий список переменных слева.`);
  };

  // Формирование уравнения регрессии в читаемом виде
  const formattedEquation = useMemo(() => {
    if (!activeModel) return "";
    const parts: string[] = [];
    activeModel.coefficients.forEach((c, idx) => {
      const val = Math.abs(c.beta).toFixed(4);
      const sign = c.beta >= 0 ? (idx === 0 ? "" : " + ") : idx === 0 ? "-" : " - ";
      if (idx === 0) {
        parts.push(`${sign}${val}`);
      } else {
        parts.push(`${sign}${val} · ${c.name}`);
      }
    });
    return `${activeModel.depVar} = ${parts.join("")}`;
  }, [activeModel]);

  // Генерация автоматических выводов на русском языке для курсовой/отчета
  const autoConclusions = useMemo(() => {
    if (!activeModel) return [];
    const notes: string[] = [];
    const r2Pct = (activeModel.metrics.r2 * 100).toFixed(2);
    notes.push(
      `Вариация показателя «${activeModel.depVar}» на ${r2Pct}% объясняется включенными в модель факторами (скорректированный R² = ${(
        activeModel.metrics.adjR2 * 100
      ).toFixed(2)}%).`
    );

    if (activeModel.metrics.fPval < 0.05) {
      notes.push(
        `По F-критерию Фишера (F = ${activeModel.metrics.fStat.toFixed(
          2
        )}, p < 0.05) уравнение регрессии в целом статистически значимо и надежно.`
      );
    } else {
      notes.push(
        `Внимание: по F-критерию Фишера (F = ${activeModel.metrics.fStat.toFixed(
          2
        )}) модель в целом статистически незначима. Рекомендуется пересмотреть набор факторов.`
      );
    }

    activeModel.coefficients.slice(1).forEach((c) => {
      const dir = c.beta >= 0 ? "увеличивается" : "снижается";
      if (c.pValue < 0.05) {
        notes.push(
          `Фактор «${c.name}» оказывает статистически значимое влияние (p = ${
            c.pValue < 0.0001 ? c.pValue.toExponential(2) : c.pValue.toFixed(4)
          }): при росте «${c.name}» на 1 ед. показатель «${
            activeModel.depVar
          }» в среднем ${dir} на ${Math.abs(c.beta).toFixed(4)} ед. при неизменности прочих факторов.`
        );
      } else {
        notes.push(
          `Влияние фактора «${c.name}» оказалось статистически незначимым (p = ${c.pValue.toFixed(
            3
          )} > 0.05) — его можно исключить для упрощения модели.`
        );
      }
    });

    return notes;
  }, [activeModel]);

  const copyReportToClipboard = () => {
    if (!activeModel) return;
    const text = [
      `ОТЧЕТ ПО ЭКОНОМЕТРИЧЕСКОЙ МОДЕЛИ №${activeModel.id}`,
      `Зависимая переменная: ${activeModel.depVar} (объем выборки N = ${activeModel.nObs})`,
      `Уравнение регрессии: ${formattedEquation}`,
      `R² = ${activeModel.metrics.r2.toFixed(4)} | Скорр. R² = ${activeModel.metrics.adjR2.toFixed(4)} | F = ${activeModel.metrics.fStat.toFixed(2)}`,
      "",
      "АНАЛИТИЧЕСКИЕ ВЫВОДЫ:",
      ...autoConclusions.map((line, i) => `${i + 1}. ${line}`),
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setToastMsg("Готовый текстовый отчет скопирован в буфер обмена!");
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
        newDesc[h] = `Загружено из файла ${file.name}`;
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
        setToastMsg("Ошибка: в файле не найдено числовых колонок.");
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
      setToastMsg(
        `Загружен файл «${file.name}»: ${lines.length - 1} строк, ${numericHeaders.length} показателей.`
      );
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
    a.download = "ted_analytics_data.csv";
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* ВЕРХНЯЯ ШАПКА ПРИЛОЖЕНИЯ */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-20 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-tight text-white">
                TED Analytics
              </h1>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Эконометрическая лаборатория
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Регрессионный анализ • Проверка гипотез • Прогнозирование временных рядов и цепей Маркова
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition shadow-sm">
            <Upload className="w-4 h-4 text-indigo-400" />
            Загрузить свой CSV
            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          </label>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Скачать таблицу CSV
          </button>
        </div>
      </header>

      {/* ИНФОРМАЦИОННАЯ ПОДСКАЗКА (TOAST BANNER) */}
      <div className="bg-indigo-950/40 border-b border-indigo-500/20 px-6 py-2 flex items-center justify-between gap-4 text-xs text-indigo-200">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Объем выборки: {df[varNames[0]].length} периодов
        </span>
      </div>

      {/* ОСНОВНОЙ РАБОЧИЙ ЭКРАН */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* ЛЕВАЯ ПАНЕЛЬ: СПИСОК ПОКАЗАТЕЛЕЙ И ПРЕОБРАЗОВАНИЯ */}
        <aside className="lg:col-span-4 xl:col-span-3 border-r border-slate-800/80 bg-slate-900/40 flex flex-col">
          <div className="p-4 border-b border-slate-800/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Шаг 1. Показатели ({varNames.length})
              </span>
              <span className="text-[11px] text-indigo-400 font-medium">
                Выбрано: {selectedVars.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Отметьте показатели для построения графиков или создания новых переменных:
            </p>

            {/* Понятные кнопки трансформации */}
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => applyTransformation("log")}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/90 hover:bg-indigo-600/25 hover:border-indigo-500/50 border border-slate-700/80 text-slate-200 transition"
              >
                <PlusCircle className="w-3 h-3 text-indigo-400" />
                Логарифм ln(X)
              </button>
              <button
                onClick={() => applyTransformation("diff")}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/90 hover:bg-indigo-600/25 hover:border-indigo-500/50 border border-slate-700/80 text-slate-200 transition"
              >
                <PlusCircle className="w-3 h-3 text-indigo-400" />
                Разность ΔX
              </button>
              <button
                onClick={() => applyTransformation("lag1")}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/90 hover:bg-indigo-600/25 hover:border-indigo-500/50 border border-slate-700/80 text-slate-200 transition"
              >
                <PlusCircle className="w-3 h-3 text-indigo-400" />
                Лаг X(t-1)
              </button>
              <button
                onClick={() => applyTransformation("pch")}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/90 hover:bg-indigo-600/25 hover:border-indigo-500/50 border border-slate-700/80 text-slate-200 transition"
              >
                <PlusCircle className="w-3 h-3 text-indigo-400" />
                Прирост в %
              </button>
            </div>
          </div>

          {/* Список карточек переменных */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {varStats.map((v) => {
              const isSelected = selectedVars.includes(v.name);
              return (
                <div
                  key={v.name}
                  onClick={() => toggleSelectVar(v.name)}
                  className={`p-3 rounded-xl cursor-pointer transition border ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500/60 shadow-sm"
                      : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-600 bg-slate-950 text-indigo-500 pointer-events-none"
                      />
                      <span className="font-semibold text-xs text-white truncate">
                        {v.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                      Среднее: {v.mean.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 pl-6 truncate">
                    {v.desc}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 pl-6 font-mono">
                    <span>Разброс (σ): {v.std.toFixed(2)}</span>
                    <span>Наблюдений: {v.n}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ПРАВАЯ РАБОЧАЯ ЗОНА */}
        <main className="lg:col-span-8 xl:col-span-9 flex flex-col bg-slate-950">
          {/* Навигационные вкладки с понятными названиями */}
          <div className="border-b border-slate-800/80 bg-slate-900/30 px-6 pt-3 flex flex-wrap items-center gap-2">
            {[
              {
                id: "ols",
                label: "1. Регрессионная модель и выводы",
                icon: Layers,
              },
              {
                id: "markov",
                label: "2. Прогноз по цепям Маркова",
                icon: Activity,
              },
              {
                id: "timeseries",
                label: "3. Динамика и стационарность рядов",
                icon: BarChart3,
              },
              {
                id: "data",
                label: "4. Исходная таблица данных",
                icon: TableIcon,
              },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-t border-x transition ${
                    active
                      ? "bg-slate-950 text-indigo-400 border-slate-800"
                      : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-6 space-y-6 flex-1">
            {/* ============================================================== */}
            {/* ВКЛАДКА 1: РЕГРЕССИОННЫЙ АНАЛИЗ (МНК + АВТО-ВЫВОДЫ)             */}
            {/* ============================================================== */}
            {activeTab === "ols" && (
              <>
                {/* Шаг 2: Интуитивный конструктор модели */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-bold text-white">
                        Шаг 2. Настройка уравнения регрессии
                      </h2>
                      <p className="text-xs text-slate-400">
                        Укажите целевой показатель (Y), который хотите объяснить, и влияющие на него факторы (X)
                      </p>
                    </div>

                    <button
                      onClick={handleRunOLS}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Рассчитать модель
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-slate-800/80">
                    {/* Выбор Y */}
                    <div className="md:col-span-4">
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Целевой показатель (Y):
                      </label>
                      <select
                        value={depVar}
                        onChange={(e) => setDepVar(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-indigo-500"
                      >
                        {varNames.map((v) => (
                          <option key={v} value={v}>
                            {v} — {descriptions[v] || ""}
                          </option>
                        ))}
                      </select>

                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer mt-3">
                        <input
                          type="checkbox"
                          checked={useHC3}
                          onChange={(e) => setUseHC3(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-indigo-500"
                        />
                        <span>Защита от неоднородности (ошибки Уайта HC3)</span>
                      </label>
                    </div>

                    {/* Выбор факторов X */}
                    <div className="md:col-span-8">
                      <span className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Объясняющие факторы (X) — нажмите, чтобы включить или выключить:
                      </span>
                      <div className="flex flex-wrap gap-2">
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
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                                  active
                                    ? "bg-indigo-600/25 border-indigo-500 text-indigo-200 shadow-sm"
                                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                }`}
                              >
                                {active ? "✓ " : "+ "}
                                {v}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Переключатель истории рассчитанных моделей */}
                {models.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs text-slate-400 mr-1">История расчетов:</span>
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setActiveModelId(m.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          m.id === activeModel.id
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        Модель №{m.id}: {m.depVar} (R² = {(m.metrics.r2 * 100).toFixed(1)}%)
                      </button>
                    ))}
                  </div>
                )}

                {/* БЛОК УРАВНЕНИЯ И АВТОМАТИЧЕСКОЙ ИНТЕРПРЕТАЦИИ ДЛЯ ОТЧЕТА */}
                {activeModel && (
                  <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 via-slate-900/80 to-slate-900 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-sm font-bold text-white">
                          Готовое уравнение и аналитическое резюме (Модель №{activeModel.id})
                        </h3>
                      </div>
                      <button
                        onClick={copyReportToClipboard}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 transition cursor-pointer"
                      >
                        {copiedReport ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Скопировано!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Скопировать выводы для отчета
                          </>
                        )}
                      </button>
                    </div>

                    {/* Математическая запись полученного уравнения */}
                    <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-xs sm:text-sm text-indigo-200 overflow-x-auto">
                      {formattedEquation}
                    </div>

                    {/* Список автоматических выводов на русском языке */}
                    <ul className="space-y-2 text-xs text-slate-200 leading-relaxed">
                      {autoConclusions.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-indigo-400 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ТАБЛИЦА КОЭФФИЦИЕНТОВ И КЛЮЧЕВЫХ ПОКАЗАТЕЛЕЙ КАЧЕСТВА */}
                {activeModel && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Таблица оценок коэффициентов (МНК, N = {activeModel.nObs})
                        </h3>
                        <p className="text-xs text-slate-400">
                          Чем меньше p-значение (p &lt; 0.05), тем надежнее доказано влияние фактора на «{activeModel.depVar}»
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveModelSeriesToDf("resid")}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                        >
                          + Сохранить остатки в список
                        </button>
                        <button
                          onClick={() => saveModelSeriesToDf("fitted")}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                        >
                          + Сохранить прогноз в список
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                            <th className="py-3 px-4">Фактор (Переменная)</th>
                            <th className="py-3 px-4 text-right">Коэффициент (β)</th>
                            <th className="py-3 px-4 text-right">Станд. ошибка</th>
                            <th className="py-3 px-4 text-right">t-критерий</th>
                            <th className="py-3 px-4 text-right">Вероятность ошибки (p-value)</th>
                            <th className="py-3 px-4 text-center">Значимость</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {activeModel.coefficients.map((c) => (
                            <tr key={c.name} className="hover:bg-slate-800/30">
                              <td className="py-2.5 px-4 font-sans font-semibold text-white">
                                {c.name}
                                {descriptions[c.name] && (
                                  <span className="block text-[11px] font-normal text-slate-400">
                                    {descriptions[c.name]}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-indigo-300">
                                {c.beta.toFixed(5)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-300">
                                {c.se.toFixed(5)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-200">
                                {c.tStat.toFixed(4)}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-300">
                                {c.pValue < 0.0001
                                  ? c.pValue.toExponential(2)
                                  : c.pValue.toFixed(4)}
                              </td>
                              <td className={`py-2.5 px-4 text-center font-sans font-semibold ${c.sigColor}`}>
                                {c.sigText} {c.sigStars !== "—" && `(${c.sigStars})`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Карточки сводных метрик с пояснениями */}
                    <div className="p-4 bg-slate-950/60 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 block text-[11px]">
                          Точность подгонки (R² / Скорр. R²)
                        </span>
                        <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                          {(activeModel.metrics.r2 * 100).toFixed(2)}%{" "}
                          <span className="text-xs font-normal text-slate-400">
                            ({(activeModel.metrics.adjR2 * 100).toFixed(2)}%)
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Доля объясненной дисперсии Y
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 block text-[11px]">
                          Критерий Фишера F({activeModel.dfModel}, {activeModel.dfResid})
                        </span>
                        <div className="text-base font-bold text-white font-mono mt-0.5">
                          {activeModel.metrics.fStat.toFixed(2)}{" "}
                          <span className="text-xs font-normal text-emerald-400">
                            (p = {activeModel.metrics.fPval.toExponential(2)})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Надежность уравнения в целом
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 block text-[11px]">
                          Критерий Дарбина — Уотсона (DW)
                        </span>
                        <div className="text-base font-bold text-indigo-300 font-mono mt-0.5">
                          {activeModel.metrics.dw.toFixed(3)}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {activeModel.metrics.dw >= 1.5 && activeModel.metrics.dw <= 2.5
                            ? "Норма (около 2.0 — автокорреляции нет)"
                            : "Отклонение от 2.0 (риск автокорреляции)"}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-slate-400 block text-[11px]">
                          Информационные критерии AIC / BIC
                        </span>
                        <div className="text-base font-bold text-slate-200 font-mono mt-0.5">
                          {activeModel.metrics.aic.toFixed(1)} /{" "}
                          {activeModel.metrics.bic.toFixed(1)}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Чем меньше значение, тем лучше модель
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* НАГЛЯДНАЯ ПРОВЕРКА УСЛОВИЙ ГАУССА — МАРКОВА */}
                {activeModel && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Проверка корректности модели (Тесты Гаусса — Маркова)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
                      {/* 1. Гетероскедастичность */}
                      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                            <span>1. Однородность ошибок</span>
                            {activeModel.diagnostics.bpPval > 0.05 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                В норме
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                Внимание
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Тест Бреуша — Пагана проверяет постоянство разброса ошибок.
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80">
                          <div className="font-mono text-xs text-slate-200">
                            LM = {activeModel.diagnostics.bpLM.toFixed(2)} (p ={" "}
                            {activeModel.diagnostics.bpPval.toFixed(3)})
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {activeModel.diagnostics.bpPval > 0.05
                              ? "✓ Гетероскедастичность отсутствует (p > 0.05)"
                              : "⚠ Есть гетероскедастичность (включите галочку HC3 выше)"}
                          </p>
                        </div>
                      </div>

                      {/* 2. Спецификация Рамсея */}
                      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                            <span>2. Правильность формы</span>
                            {activeModel.diagnostics.resetPval > 0.05 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                В норме
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                Внимание
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Тест Рамсея (RESET) проверяет, не пропущены ли квадраты и нелинейные связи.
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80">
                          <div className="font-mono text-xs text-slate-200">
                            F = {activeModel.diagnostics.resetF.toFixed(2)} (p ={" "}
                            {activeModel.diagnostics.resetPval.toFixed(3)})
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {activeModel.diagnostics.resetPval > 0.05
                              ? "✓ Линейная формула выбрана верно (p > 0.05)"
                              : "⚠ Рекомендуется добавить логарифмы или квадраты"}
                          </p>
                        </div>
                      </div>

                      {/* 3. Нормальность остатков */}
                      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                            <span>3. Нормальность остатков</span>
                            {activeModel.diagnostics.jbPval > 0.05 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                В норме
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                Внимание
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Тест Жарка — Бера проверяет колоколообразность распределения ошибок.
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80">
                          <div className="font-mono text-xs text-slate-200">
                            JB = {activeModel.diagnostics.jbStat.toFixed(2)} (p ={" "}
                            {activeModel.diagnostics.jbPval.toFixed(3)})
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {activeModel.diagnostics.jbPval > 0.05
                              ? "✓ Остатки распределены нормально (p > 0.05)"
                              : "⚠ Есть выбросы в остатках"}
                          </p>
                        </div>
                      </div>

                      {/* 4. Мультиколлинеарность VIF */}
                      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                            <span>4. Независимость X (VIF)</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Если VIF &lt; 10, факторы не дублируют друг друга (мультиколлинеарности нет):
                          </p>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1 font-mono text-xs">
                          {activeModel.diagnostics.vif.map((v) => (
                            <div key={v.name} className="flex justify-between">
                              <span className="text-slate-300 truncate pr-2">{v.name}:</span>
                              <span
                                className={
                                  v.value < 5
                                    ? "text-emerald-400 font-bold"
                                    : v.value < 10
                                    ? "text-amber-400 font-bold"
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
                  </div>
                )}

                {/* ГРАФИКИ МОДЕЛИ */}
                {activeModel && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                      <h3 className="text-xs font-bold text-white mb-1">
                        Насколько точно модель повторяет реальные данные ({activeModel.depVar})
                      </h3>
                      <p className="text-[11px] text-slate-400 mb-4">
                        Голубая линия — фактические значения, пунктирная — расчет по уравнению регрессии
                      </p>
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
                                borderRadius: "10px",
                                fontSize: "12px",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Line
                              type="monotone"
                              dataKey="actual"
                              name={`Факт (${activeModel.depVar})`}
                              stroke="#38bdf8"
                              strokeWidth={2.2}
                              dot={{ r: 2 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="fitted"
                              name="Расчет по модели"
                              stroke="#f43f5e"
                              strokeWidth={2.2}
                              strokeDasharray="5 5"
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                      <h3 className="text-xs font-bold text-white mb-1">
                        Диаграмма разброса ошибок (остатков) модели
                      </h3>
                      <p className="text-[11px] text-slate-400 mb-4">
                        Равномерное облако точек вокруг красной нулевой линии подтверждает высокое качество модели
                      </p>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis
                              type="number"
                              dataKey="fitted"
                              name="Прогноз"
                              stroke="#64748b"
                              fontSize={11}
                            />
                            <YAxis
                              type="number"
                              dataKey="resid"
                              name="Ошибка"
                              stroke="#64748b"
                              fontSize={11}
                            />
                            <Tooltip
                              cursor={{ strokeDasharray: "3 3" }}
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                borderColor: "#334155",
                                borderRadius: "10px",
                                fontSize: "12px",
                              }}
                            />
                            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
                            <Scatter
                              name="Остатки наблюдений"
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
            {/* ВКЛАДКА 2: ПРОГНОЗИРОВАНИЕ ЦЕПЯМИ МАРКОВА                      */}
            {/* ============================================================== */}
            {activeTab === "markov" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Стохастическое прогнозирование по цепям Маркова
                    </h2>
                    <p className="text-xs text-slate-400">
                      Ряд автоматически делится на 3 экономические фазы (Спад, Стагнация, Рост) и рассчитываются вероятности переходов между ними
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-300">Показатель:</span>
                    <select
                      value={markovVar}
                      onChange={(e) => setMarkovVar(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      {varNames.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">
                        Матрица переходных вероятностей (P)
                      </h3>
                      <span className="text-xs text-indigo-300 font-medium">
                        Сейчас система в фазе: {markovResult.currentState}
                      </span>
                    </div>

                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 text-left">Из фазы (t) \ В фазу (t+1)</th>
                          {markovResult.shortLabels.map((l) => (
                            <th key={l} className="py-2 text-center">
                              {l}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {markovResult.P.map((row, i) => (
                          <tr key={i}>
                            <td className="py-3 font-sans font-semibold text-indigo-300">
                              {markovResult.shortLabels[i]}
                              <span className="block text-[11px] font-normal text-slate-400">
                                {markovResult.bounds[i]}
                              </span>
                            </td>
                            {row.map((prob, j) => (
                              <td key={j} className="py-3 text-center">
                                <div
                                  className="inline-block px-3 py-1 rounded-lg font-bold text-white"
                                  style={{
                                    backgroundColor: `rgba(99, 102, 241, ${
                                      0.15 + prob * 0.65
                                    })`,
                                  }}
                                >
                                  {(prob * 100).toFixed(1)}%
                                </div>
                                <span className="block text-[10px] text-slate-400 mt-1">
                                  ({prob.toFixed(4)} • переходов: {markovResult.counts[i][j]})
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="pt-3 border-t border-slate-800">
                      <span className="text-xs font-semibold text-slate-300 block mb-2">
                        Долгосрочное равновесие (финальные вероятности π · P = π):
                      </span>
                      <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
                        {markovResult.shortLabels.map((l, idx) => (
                          <div
                            key={l}
                            className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center"
                          >
                            <div className="text-slate-400 font-sans text-[11px]">{l}</div>
                            <div className="text-emerald-400 font-bold text-base mt-0.5">
                              {(markovResult.stationary[idx] * 100).toFixed(2)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col">
                    <h3 className="text-sm font-bold text-white mb-1">
                      Прогноз вероятностей по шагам на 6 периодов вперед
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Показывает, с какой вероятностью показатель «{markovVar}» окажется в фазе спада, стагнации или роста
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
                              borderRadius: "10px",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px" }} />
                          <Bar
                            dataKey="S1"
                            name="S1 (Спад)"
                            fill="#f43f5e"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="S2"
                            name="S2 (Стагнация)"
                            fill="#eab308"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="S3"
                            name="S3 (Рост)"
                            fill="#10b981"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 3: ВРЕМЕННЫЕ РЯДЫ И ТЕСТ СТАЦИОНАРНОСТИ ДИКИ — ФУЛЛЕРА  */}
            {/* ============================================================== */}
            {activeTab === "timeseries" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Проверка стационарности временного ряда (Тест Дики — Фуллера / ADF)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Позволяет узнать, есть ли в ряде нестационарный тренд, который может вызвать ложную регрессию
                      </p>
                    </div>
                    <select
                      value={tsVar}
                      onChange={(e) => setTsVar(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      {varNames.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 mb-1">
                        Вариант 1. Модель с константой (без тренда):
                      </div>
                      <div className="text-base font-bold text-white font-mono">
                        t-статистика = {adfResult.constModel.tau.toFixed(4)}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          (порог 5%: {adfResult.constModel.crit5})
                        </span>
                      </div>
                      <div
                        className={`mt-2 font-semibold flex items-center gap-1.5 ${
                          adfResult.constModel.stationary
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {adfResult.constModel.stationary ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Ряд стационарен — можно сразу использовать в регрессии
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4" />
                            Ряд нестационарен — нажмите «Разность ΔX» в левой панели
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 mb-1">
                        Вариант 2. Модель с константой и линейным трендом:
                      </div>
                      <div className="text-base font-bold text-white font-mono">
                        t-статистика = {adfResult.trendModel.tau.toFixed(4)}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          (порог 5%: {adfResult.trendModel.crit5})
                        </span>
                      </div>
                      <div
                        className={`mt-2 font-semibold flex items-center gap-1.5 ${
                          adfResult.trendModel.stationary
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {adfResult.trendModel.stationary ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Ряд стационарен относительно линейного тренда
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4" />
                            Присутствует стохастический тренд (требуется взятие разностей)
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <h3 className="text-sm font-bold text-white mb-1">
                    График динамики отмеченных слева показателей ({selectedVars.join(", ")})
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Отмечайте галочками любые показатели в левой колонке, чтобы сравнить их поведение на одном графике
                  </p>
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
                            borderRadius: "10px",
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
                                strokeWidth={2.2}
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
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Полная таблица данных ({df[varNames[0]].length} наблюдений)
                  </h3>
                  <span className="text-xs text-slate-400">
                    Все созданные логарифмы, разности и прогнозы автоматически добавляются в крайние правые столбцы
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[520px]">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-300">
                      <tr>
                        <th className="py-3 px-4">Период (t)</th>
                        {varNames.map((v) => (
                          <th key={v} className="py-3 px-4 text-right">
                            {v}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {Array.from({ length: df[varNames[0]].length }, (_, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-800/40">
                          <td className="py-2 px-4 text-slate-500">{rowIdx + 1}</td>
                          {varNames.map((v) => (
                            <td key={v} className="py-2 px-4 text-right text-slate-200">
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
          </div>
        </main>
      </div>
    </div>
  );
}
