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
  Upload,
  Download,
  Play,
  Copy,
  Check,
  Plus,
  Trash2,
  FileCode,
  Table as TableIcon,
  Sliders,
  Activity,
  BarChart2,
  Calculator,
  Search,
} from "lucide-react";

// ============================================================================
// 1. МАТЕМАТИЧЕСКОЕ И ЭКОНОМЕТРИЧЕСКОЕ ЯДРО (ТОЧНАЯ ЧИСЛЕННАЯ РЕАЛИЗАЦИЯ)
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

/** Приближение критического значения t_{alpha/2, df} для 95% доверительного интервала */
function tCritical95(df: number): number {
  if (df <= 1) return 12.706;
  if (df === 2) return 4.303;
  if (df === 3) return 3.182;
  if (df === 4) return 2.776;
  if (df === 5) return 2.571;
  const z = 1.95996;
  return z + (z * z * z + z) / (4 * df) + (5 * Math.pow(z, 5) + 16 * z * z * z + 3 * z) / (96 * df * df);
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

function sigStars(p: number): string {
  if (p < 0.01) return "***";
  if (p < 0.05) return "**";
  if (p < 0.1) return "*";
  return "";
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
      throw new Error("Матрица (X'X) вырождена: строгая линейная зависимость между факторами.");
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
    ciLow: number;
    ciHigh: number;
    stdBeta: number | null;
    elasticity: number | null;
    stars: string;
  }[];
  metrics: {
    yMean: number;
    ySd: number;
    ssr: number;
    tss: number;
    ess: number;
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
  if (T <= K + 2) throw new Error("Недостаточно полных наблюдений для оценки модели.");

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
  const ess = Math.max(0, tss - ssr);
  const dfResid = T - K;
  const dfModel = includeConst ? K - 1 : K;
  const s2 = ssr / dfResid;
  const seReg = Math.sqrt(s2);
  const ySd = Math.sqrt(tss / (T - 1));

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
  const tCrit = tCritical95(dfResid);

  const coefficients = colNames.map((name, i) => {
    const tStat = betas[i] / se[i];
    const pValue = tTestPValue(tStat, dfResid);
    const ciLow = betas[i] - tCrit * se[i];
    const ciHigh = betas[i] + tCrit * se[i];

    let stdBeta: number | null = null;
    let elasticity: number | null = null;

    if (name !== "const") {
      const xVals = validIndices.map((idx) => df[name][idx] as number);
      const xMean = xVals.reduce((a, b) => a + b, 0) / T;
      const xSd = Math.sqrt(
        xVals.reduce((a, v) => a + Math.pow(v - xMean, 2), 0) / (T - 1)
      );
      stdBeta = ySd > 0 ? betas[i] * (xSd / ySd) : 0;
      elasticity = Math.abs(yMean) > 1e-9 ? betas[i] * (xMean / yMean) : null;
    }

    return {
      name,
      beta: betas[i],
      se: se[i],
      tStat,
      pValue,
      ciLow,
      ciHigh,
      stdBeta,
      elasticity,
      stars: sigStars(pValue),
    };
  });

  const r2 = Math.max(0, 1 - ssr / tss);
  const adjR2 = 1 - (1 - r2) * ((T - 1) / dfResid);
  const fStat = dfModel > 0 ? (ess / dfModel) / (ssr / dfResid) : 0;
  const fPval = dfModel > 0 ? fTestPValue(fStat, dfModel, dfResid) : 1;

  const logLik = (-T / 2) * (1 + Math.log(2 * Math.PI) + Math.log(ssr / T));
  const aic = -2 * logLik + 2 * K;
  const bic = -2 * logLik + K * Math.log(T);
  const hqc = -2 * logLik + 2 * K * Math.log(Math.log(T));

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
      ySd,
      ssr,
      tss,
      ess,
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

function computeMarkovChain(series: (number | null)[], steps = 6) {
  const clean = series.filter((v): v is number => v !== null && !isNaN(v));
  if (clean.length < 4) {
    return {
      shortLabels: ["S1 (Низкий)", "S2 (Средний)", "S3 (Высокий)"],
      bounds: ["—", "—", "—"],
      counts: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      P: [
        [1 / 3, 1 / 3, 1 / 3],
        [1 / 3, 1 / 3, 1 / 3],
        [1 / 3, 1 / 3, 1 / 3],
      ],
      currentState: "—",
      forecast: [],
      stationary: [1 / 3, 1 / 3, 1 / 3],
    };
  }
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
      step: `t+${step}`,
      S1: Number((sVec[0] * 100).toFixed(2)),
      S2: Number((sVec[1] * 100).toFixed(2)),
      S3: Number((sVec[2] * 100).toFixed(2)),
    });
  }

  let pi = [1 / 3, 1 / 3, 1 / 3];
  for (let iter = 0; iter < 80; iter++) {
    const nextPi = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) nextPi[j] += pi[i] * P[i][j];
    }
    pi = nextPi;
  }

  return {
    shortLabels,
    bounds: [
      `[${sorted[0].toFixed(2)}; ${q1.toFixed(2)}]`,
      `(${q1.toFixed(2)}; ${q2.toFixed(2)}]`,
      `(${q2.toFixed(2)}; ${sorted[sorted.length - 1].toFixed(2)}]`,
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
    Inflation: "Инфляция ИПЦ (%, г/г)",
  };

  return { df, descriptions };
}

const SERIES_PALETTE = ["#d97706", "#10b981", "#38bdf8", "#a855f7", "#f43f5e", "#eab308"];

// ============================================================================
// 2. ГЛАВНЫЙ КОМПОНЕНТ «TED // ECONOMETRIC WORKBENCH»
// ============================================================================
export default function TedWorkbench() {
  const initial = useMemo(() => createInitialDataset(), []);
  const [df, setDf] = useState<Record<string, (number | null)[]>>(initial.df);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(initial.descriptions);

  const [selectedVars, setSelectedVars] = useState<string[]>([
    "GDP_Growth",
    "Investment",
    "KeyRate",
  ]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"data" | "ols" | "stats" | "markov">("ols");

  // Настройки МНК
  const [depVar, setDepVar] = useState<string>("GDP_Growth");
  const [regressors, setRegressors] = useState<string[]>(["Investment", "KeyRate", "LaborProd"]);
  const [includeConst, setIncludeConst] = useState<boolean>(true);
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

  // Редактор данных и генератор формул
  const [newColName, setNewColName] = useState<string>("");
  const [newColFormula, setNewColFormula] = useState<string>("");
  const [pasteBuffer, setPasteBuffer] = useState<string>("");
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);

  // Марков и ADF
  const [markovVar, setMarkovVar] = useState<string>("GDP_Growth");
  const [tsVar, setTsVar] = useState<string>("GDP_Growth");
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string>(
    "Система готова. Выборка: T = 60 наблюдений. Режим: аналитический."
  );

  const varNames = Object.keys(df);
  const nRows = varNames.length > 0 ? df[varNames[0]].length : 0;
  const activeModel = models.find((m) => m.id === activeModelId) || models[models.length - 1];

  // Детальная статистика по всем переменным
  const varStats = useMemo(() => {
    return varNames.map((name, idx) => {
      const clean = df[name].filter((v): v is number => v !== null && !isNaN(v));
      const n = clean.length;
      const mean = n > 0 ? clean.reduce((a, b) => a + b, 0) / n : 0;
      const sorted = [...clean].sort((a, b) => a - b);
      const median =
        n > 0
          ? n % 2 === 1
            ? sorted[Math.floor(n / 2)]
            : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
          : 0;
      const min = n > 0 ? sorted[0] : 0;
      const max = n > 0 ? sorted[n - 1] : 0;
      const variance =
        n > 1 ? clean.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (n - 1) : 0;
      const std = Math.sqrt(variance);
      const cv = Math.abs(mean) > 1e-9 ? (std / Math.abs(mean)) * 100 : 0;
      const m3 =
        n > 2 ? clean.reduce((a, v) => a + Math.pow(v - mean, 3), 0) / n : 0;
      const skew = std > 0 ? m3 / Math.pow(std, 3) : 0;

      return {
        id: idx + 1,
        name,
        desc: descriptions[name] || "Пользовательский ряд",
        mean,
        median,
        std,
        min,
        max,
        cv,
        skew,
        n,
      };
    });
  }, [df, descriptions, varNames]);

  const filteredVars = useMemo(() => {
    if (!searchQuery.trim()) return varStats;
    const q = searchQuery.toLowerCase();
    return varStats.filter(
      (v) => v.name.toLowerCase().includes(q) || v.desc.toLowerCase().includes(q)
    );
  }, [varStats, searchQuery]);

  const toggleSelectVar = (name: string) => {
    setSelectedVars((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  const deleteVariable = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (varNames.length <= 2) {
      setStatusLine("Нельзя удалить последние переменные из датасета.");
      return;
    }
    const nextDf = { ...df };
    delete nextDf[name];
    setDf(nextDf);
    setSelectedVars((prev) => prev.filter((v) => v !== name));
    setRegressors((prev) => prev.filter((v) => v !== name));
    setStatusLine(`Переменная «${name}» удалена.`);
  };

  // Пакетные трансформации только для выбранных исходных переменных
  const applyTransformation = (mode: "log" | "diff" | "lag1" | "pch") => {
    if (selectedVars.length === 0) {
      setStatusLine("Отметьте переменные в левом списке для трансформации.");
      return;
    }

    const nextDf = { ...df };
    const nextDesc = { ...descriptions };
    const created: string[] = [];

    for (const col of selectedVars) {
      const series = df[col];
      if (!series) continue;

      const newName =
        mode === "log"
          ? `ln_${col}`
          : mode === "diff"
          ? `d_${col}`
          : mode === "lag1"
          ? `lag_${col}`
          : `pch_${col}`;

      if (nextDf[newName]) continue; // Защита от дублирования

      if (mode === "log") {
        nextDf[newName] = series.map((v) =>
          v !== null && v > 0 ? Number(Math.log(v).toFixed(5)) : null
        );
        nextDesc[newName] = `ln(${col})`;
      } else if (mode === "diff") {
        nextDf[newName] = series.map((v, i) =>
          i > 0 && v !== null && series[i - 1] !== null
            ? Number((v - (series[i - 1] as number)).toFixed(5))
            : null
        );
        nextDesc[newName] = `Δ${col} = ${col}(t) - ${col}(t-1)`;
      } else if (mode === "lag1") {
        nextDf[newName] = series.map((_, i) => (i > 0 ? series[i - 1] : null));
        nextDesc[newName] = `${col}(t-1)`;
      } else if (mode === "pch") {
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
      }
      created.push(newName);
    }

    if (created.length === 0) {
      setStatusLine("Эти трансформации уже существуют в списке.");
      return;
    }

    setDf(nextDf);
    setDescriptions(nextDesc);
    setStatusLine(`Создано переменных (${created.length}): ${created.join(", ")}`);
  };

  // Генератор новой переменной по произвольной формуле
  const handleCreateByFormula = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newColName.trim().replace(/\s+/g, "_");
    const expr = newColFormula.trim();
    if (!cleanName) {
      setStatusLine("Укажите имя нового столбца.");
      return;
    }

    try {
      const resultCol: (number | null)[] = [];
      for (let rowIdx = 0; rowIdx < nRows; rowIdx++) {
        if (!expr) {
          resultCol.push(0);
          continue;
        }
        let parsedExpr = expr
          .replace(/\bln\(/g, "Math.log(")
          .replace(/\blog\(/g, "Math.log(")
          .replace(/\bsqrt\(/g, "Math.sqrt(")
          .replace(/\babs\(/g, "Math.abs(")
          .replace(/\bexp\(/g, "Math.exp(")
          .replace(/\^/g, "**");

        // Подстановка значений переменных для строки rowIdx
        let hasNull = false;
        const sortedVars = [...varNames].sort((a, b) => b.length - a.length);
        for (const vName of sortedVars) {
          if (parsedExpr.includes(vName)) {
            const val = df[vName][rowIdx];
            if (val === null || isNaN(val)) {
              hasNull = true;
              break;
            }
            parsedExpr = parsedExpr.split(vName).join(`(${val})`);
          }
        }
        parsedExpr = parsedExpr.replace(/\bt\b/g, String(rowIdx + 1));

        if (hasNull) {
          resultCol.push(null);
        } else {
          const val = Function(`"use strict"; return (${parsedExpr});`)();
          resultCol.push(typeof val === "number" && isFinite(val) ? Number(val.toFixed(5)) : null);
        }
      }

      setDf((prev) => ({ ...prev, [cleanName]: resultCol }));
      setDescriptions((prev) => ({
        ...prev,
        [cleanName]: expr ? `Формула: ${expr}` : "Ручной ввод данных",
      }));
      setNewColName("");
      setNewColFormula("");
      setStatusLine(`Создан столбец «${cleanName}» (${expr || "нулевой вектор для ручного ввода"}).`);
    } catch {
      setStatusLine(
        "Ошибка в синтаксисе формулы. Пример: Investment / KeyRate или ln(LaborProd) * 2"
      );
    }
  };

  // Редактирование конкретной ячейки в таблице данных
  const handleCellEdit = (colName: string, rowIdx: number, rawValue: string) => {
    const normalized = rawValue.replace(",", ".").trim();
    const numVal = normalized === "" ? null : Number(normalized);
    if (normalized !== "" && isNaN(numVal!)) return;

    setDf((prev) => {
      const updatedCol = [...prev[colName]];
      updatedCol[rowIdx] = numVal;
      return { ...prev, [colName]: updatedCol };
    });
  };

  // Добавление и удаление строк наблюдений
  const addObservationRow = () => {
    setDf((prev) => {
      const next: Record<string, (number | null)[]> = {};
      for (const k of Object.keys(prev)) {
        next[k] = [...prev[k], 0];
      }
      return next;
    });
    setStatusLine(`Добавлено наблюдение t = ${nRows + 1}.`);
  };

  const deleteObservationRow = (rowIdx: number) => {
    if (nRows <= 5) {
      setStatusLine("Минимальный размер выборки — 5 строк.");
      return;
    }
    setDf((prev) => {
      const next: Record<string, (number | null)[]> = {};
      for (const k of Object.keys(prev)) {
        next[k] = prev[k].filter((_, idx) => idx !== rowIdx);
      }
      return next;
    });
    setStatusLine(`Удалено наблюдение t = ${rowIdx + 1}.`);
  };

  // Вставка данных из буфера обмена Excel / Таблиц
  const handlePasteFromExcel = () => {
    const lines = pasteBuffer
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      setStatusLine("Вставьте минимум 2 строки (первая строка — заголовки столбцов).");
      return;
    }

    const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
    const headers = lines[0]
      .split(sep)
      .map((h, i) => h.trim().replace(/^"|"$/g, "").replace(/\s+/g, "_") || `Var_${i + 1}`);

    const newDf: Record<string, (number | null)[]> = {};
    const newDesc: Record<string, string> = {};
    headers.forEach((h) => {
      newDf[h] = [];
      newDesc[h] = "Вставлено из буфера обмена";
    });

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(sep);
      headers.forEach((h, cIdx) => {
        const raw = cells[cIdx]?.replace(",", ".").trim();
        const num = raw !== undefined && raw !== "" ? Number(raw) : NaN;
        newDf[h].push(isNaN(num) ? null : num);
      });
    }

    setDf(newDf);
    setDescriptions(newDesc);
    setSelectedVars(headers.slice(0, 3));
    setDepVar(headers[0]);
    setRegressors(headers.slice(1, 4));
    setMarkovVar(headers[0]);
    setTsVar(headers[0]);
    setShowPasteModal(false);
    setPasteBuffer("");
    setStatusLine(`Импортировано из буфера: ${lines.length - 1} строк, ${headers.length} столбцов.`);
  };

  const handleRunOLS = () => {
    const targetX = regressors.filter((x) => x !== depVar);
    if (targetX.length === 0) {
      setStatusLine("Ошибка: выберите хотя бы один регрессор X.");
      return;
    }
    try {
      const nextId = models.length + 1;
      const res = estimateOLS(df, depVar, targetX, includeConst, useHC3, nextId);
      setModels((prev) => [...prev, res]);
      setActiveModelId(nextId);
      setActiveTab("ols");
      setStatusLine(
        `Модель #${nextId} оценена (T = ${res.nObs}, R² = ${res.metrics.r2.toFixed(4)}, F = ${res.metrics.fStat.toFixed(2)}).`
      );
    } catch (err: unknown) {
      setStatusLine(`Ошибка МНК: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const saveModelSeriesToDf = (type: "resid" | "fitted") => {
    if (!activeModel) return;
    const newCol: (number | null)[] = Array(nRows).fill(null);
    for (const pt of activeModel.seriesData) {
      newCol[pt.rowIdx] = type === "resid" ? pt.resid : pt.fitted;
    }
    const colName = type === "resid" ? `uhat_${activeModel.id}` : `yhat_${activeModel.id}`;
    const colDesc =
      type === "resid"
        ? `Остатки Модели #${activeModel.id} (${activeModel.depVar})`
        : `Расчетные значения Модели #${activeModel.id} (${activeModel.depVar})`;

    setDf((prev) => ({ ...prev, [colName]: newCol }));
    setDescriptions((prev) => ({ ...prev, [colName]: colDesc }));
    setStatusLine(`Ряд «${colName}» сохранен в реестр переменных.`);
  };

  const formattedEquation = useMemo(() => {
    if (!activeModel) return "";
    const parts: string[] = [];
    activeModel.coefficients.forEach((c, idx) => {
      const val = Math.abs(c.beta).toFixed(4);
      const sign = c.beta >= 0 ? (idx === 0 ? "" : " + ") : idx === 0 ? "-" : " - ";
      if (c.name === "const") {
        parts.push(`${sign}${val}`);
      } else {
        parts.push(`${sign}${val}·${c.name}`);
      }
    });
    return `${activeModel.depVar} = ${parts.join("")}`;
  }, [activeModel]);

  // Экспорт в LaTeX или текстовый отчет
  const copyModelOutput = (format: "text" | "latex") => {
    if (!activeModel) return;
    if (format === "latex") {
      const rows = activeModel.coefficients
        .map(
          (c) =>
            `${c.name.replace(/_/g, "\\_")} & ${c.beta.toFixed(4)}${c.stars} & (${c.se.toFixed(
              4
            )}) & ${c.tStat.toFixed(3)} & ${c.pValue.toFixed(4)} \\\\`
        )
        .join("\n");
      const latex = [
        "\\begin{table}[htbp]\\centering",
        `\\caption{Оценка МНК-модели (зависимая переменная: ${activeModel.depVar.replace(/_/g, "\\_")})}`,
        "\\begin{tabular}{lcccc}\\hline\\hline",
        "Переменная & Коэффициент & Ст. ошибка & $t$-стат. & $p$-value \\\\ \\hline",
        rows,
        "\\hline",
        `Наблюдений ($T$) & \\multicolumn{4}{c}{${activeModel.nObs}} \\\\`,
        `$R^2$ / Скорр. $R^2$ & \\multicolumn{4}{c}{${activeModel.metrics.r2.toFixed(4)} / ${activeModel.metrics.adjR2.toFixed(4)}} \\\\`,
        `$F$-статистика & \\multicolumn{4}{c}{${activeModel.metrics.fStat.toFixed(2)} ($p = ${activeModel.metrics.fPval.toExponential(2)}$)} \\\\`,
        "\\hline\\hline\\end{tabular}\\end{table}",
      ].join("\n");
      navigator.clipboard.writeText(latex);
      setCopiedType("latex");
      setStatusLine("Код таблицы LaTeX скопирован в буфер обмена.");
    } else {
      const text = [
        `МОДЕЛЬ #${activeModel.id} (МНК, T = ${activeModel.nObs})`,
        `Уравнение: ${formattedEquation}`,
        `R² = ${activeModel.metrics.r2.toFixed(4)} | Adj. R² = ${activeModel.metrics.adjR2.toFixed(4)} | F = ${activeModel.metrics.fStat.toFixed(2)} | DW = ${activeModel.metrics.dw.toFixed(4)}`,
        "",
        "Коэффициенты:",
        ...activeModel.coefficients.map(
          (c) =>
            `${c.name.padEnd(16)} beta=${c.beta.toFixed(5)} se=${c.se.toFixed(5)} t=${c.tStat.toFixed(
              3
            )} p=${c.pValue.toFixed(4)} ${c.stars}`
        ),
      ].join("\n");
      navigator.clipboard.writeText(text);
      setCopiedType("text");
      setStatusLine("Текстовый отчет скопирован в буфер обмена.");
    }
    setTimeout(() => setCopiedType(null), 2200);
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
        newDesc[h] = `Импорт: ${file.name}`;
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
        setStatusLine("Ошибка: в CSV не найдено числовых данных.");
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
      setStatusLine(`Импортирован файл ${file.name} (T = ${lines.length - 1}).`);
    };
    reader.readAsText(file);
  };

  const exportToCSV = () => {
    const cols = Object.keys(df);
    const csvRows = [cols.join(",")];
    for (let i = 0; i < nRows; i++) {
      csvRows.push(cols.map((c) => (df[c][i] ?? "")).join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ted_data.csv";
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
    const vars = selectedVars.length > 0 ? selectedVars : [varNames[0]];
    return Array.from({ length: nRows }, (_, i) => {
      const row: Record<string, number | null> = { t: i + 1 };
      vars.forEach((v) => (row[v] = df[v]?.[i] ?? null));
      return row;
    });
  }, [df, selectedVars, varNames, nRows]);

  return (
    <div className="ted-shell">
      {/* АВТОНОМНЫЙ УТИЛИТАРНЫЙ СТИЛЬ (INDUSTRIAL / ACADEMIC TERMINAL) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        * { box-sizing: border-box; }
        body, html {
          margin: 0;
          padding: 0;
          background-color: #101214;
          color: #e4e4e7;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          -webkit-font-smoothing: antialiased;
        }
        .mono {
          font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
        }
        .ted-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: #101214;
        }
        /* Верхняя панель */
        .topbar {
          height: 52px;
          background: #16181d;
          border-bottom: 1px solid #272a30;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .brand-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .brand-mark {
          padding: 4px 8px;
          background: #d97706;
          color: #090a0c;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.08em;
          border-radius: 3px;
        }
        .brand-name {
          font-size: 14px;
          font-weight: 700;
          color: #f4f4f5;
          letter-spacing: 0.02em;
        }
        .brand-meta {
          color: #71717a;
          font-size: 12px;
          border-left: 1px solid #272a30;
          padding-left: 12px;
        }
        /* Кнопки */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 4px;
          background: #1f232b;
          color: #e4e4e7;
          border: 1px solid #323741;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s;
        }
        .btn:hover {
          background: #292e38;
          border-color: #52525b;
        }
        .btn-amber {
          background: #d97706;
          color: #090a0c;
          border: 1px solid #f59e0b;
          font-weight: 700;
        }
        .btn-amber:hover {
          background: #f59e0b;
        }
        .btn-sm {
          padding: 4px 8px;
          font-size: 11px;
        }
        /* Основная сетка: фиксированная левая колонка + рабочая зона */
        .main-layout {
          flex: 1;
          display: grid;
          grid-template-columns: 300px 1fr;
          height: calc(100vh - 80px);
          overflow: hidden;
        }
        @media (max-width: 980px) {
          .main-layout {
            grid-template-columns: 1fr;
            height: auto;
            overflow: visible;
          }
        }
        /* Левый реестр переменных (БЕЗ СЖАТИЯ КАРТОЧЕК) */
        .var-sidebar {
          background: #14161a;
          border-right: 1px solid #272a30;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .sidebar-header {
          padding: 12px 14px;
          border-bottom: 1px solid #272a30;
          background: #16191e;
        }
        .search-input {
          width: 100%;
          padding: 6px 10px 6px 28px;
          background: #0d0f12;
          border: 1px solid #272a30;
          border-radius: 4px;
          color: #e4e4e7;
          font-size: 12px;
          outline: none;
        }
        .search-input:focus {
          border-color: #d97706;
        }
        .var-scroll-list {
          flex: 1;
          overflow-y: auto;
          divide-y: 1px solid #1f2229;
        }
        /* ВАЖНО: flex-shrink: 0 предотвращает сплющивание карточек! */
        .var-row {
          flex-shrink: 0;
          min-height: 48px;
          padding: 8px 12px;
          border-bottom: 1px solid #1e2128;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          cursor: pointer;
          transition: background 0.1s;
        }
        .var-row:hover {
          background: #1b1e25;
        }
        .var-row.selected {
          background: rgba(217, 119, 6, 0.12);
          border-left: 3px solid #d97706;
        }
        .del-btn {
          opacity: 0.35;
          background: none;
          border: none;
          color: #a1a1aa;
          cursor: pointer;
          padding: 3px;
        }
        .del-btn:hover {
          opacity: 1;
          color: #ef4444;
        }
        /* Правая рабочая зона */
        .content-pane {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: #101214;
        }
        .nav-tabs {
          display: flex;
          background: #16181d;
          border-bottom: 1px solid #272a30;
          padding: 0 20px;
          gap: 4px;
        }
        .nav-tab {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 11px 16px;
          font-size: 12px;
          font-weight: 600;
          color: #a1a1aa;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
        }
        .nav-tab:hover {
          color: #f4f4f5;
        }
        .nav-tab.active {
          color: #f59e0b;
          border-bottom-color: #d97706;
          background: rgba(217, 119, 6, 0.05);
        }
        .workspace-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        /* Строгие панели */
        .panel {
          background: #16181d;
          border: 1px solid #272a30;
          border-radius: 4px;
        }
        .panel-head {
          padding: 10px 16px;
          border-bottom: 1px solid #272a30;
          background: #191c22;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .panel-title {
          font-size: 12.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #e4e4e7;
          margin: 0;
        }
        .panel-body {
          padding: 16px;
        }
        /* Таблицы (академический стиль) */
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .data-table th {
          background: #131519;
          color: #a1a1aa;
          font-weight: 600;
          text-align: left;
          padding: 8px 12px;
          border-bottom: 1px solid #2e323b;
          white-space: nowrap;
        }
        .data-table td {
          padding: 7px 12px;
          border-bottom: 1px solid #20232a;
          color: #e4e4e7;
        }
        .data-table tr:hover td {
          background: #1c1f26;
        }
        /* Редактируемые ячейки таблицы данных */
        .cell-input {
          width: 100%;
          min-width: 75px;
          background: transparent;
          border: 1px solid transparent;
          color: #f4f4f5;
          text-align: right;
          padding: 3px 6px;
          border-radius: 3px;
          font-family: "JetBrains Mono", "Consolas", monospace;
          font-size: 12px;
        }
        .cell-input:hover {
          border-color: #323741;
          background: #101214;
        }
        .cell-input:focus {
          outline: none;
          border-color: #d97706;
          background: #090a0c;
        }
        .input-field {
          background: #0d0f12;
          border: 1px solid #323741;
          border-radius: 4px;
          padding: 6px 10px;
          color: #f4f4f5;
          font-size: 12px;
          outline: none;
        }
        .input-field:focus {
          border-color: #d97706;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 1024px) {
          .grid-2, .grid-4 { grid-template-columns: 1fr; }
        }
        .stat-box {
          background: #121418;
          border: 1px solid #272a30;
          padding: 10px 14px;
          border-radius: 4px;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 3px;
          font-size: 12px;
          background: #121418;
          border: 1px solid #2e323b;
          color: #a1a1aa;
          cursor: pointer;
        }
        .tag-chip.active {
          background: rgba(217, 119, 6, 0.16);
          border-color: #d97706;
          color: #fbbf24;
          font-weight: 600;
        }
        .statusbar {
          height: 28px;
          background: #16181d;
          border-top: 1px solid #272a30;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11.5px;
          color: #a1a1aa;
        }
      `,
        }}
      />

      {/* ВЕРХНЯЯ ПАНЕЛЬ УПРАВЛЕНИЯ */}
      <header className="topbar">
        <div className="brand-box">
          <span className="brand-mark mono">TED</span>
          <span className="brand-name">ECONOMETRIC WORKBENCH</span>
          <span className="brand-meta mono">
            T = {nRows} | K = {varNames.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => setShowPasteModal(true)} className="btn">
            <Plus size={14} /> Вставить из Excel
          </button>
          <label className="btn">
            <Upload size={14} /> Импорт CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              style={{ display: "none" }}
            />
          </label>
          <button onClick={exportToCSV} className="btn">
            <Download size={14} /> Экспорт CSV
          </button>
        </div>
      </header>

      {/* МОДАЛЬНОЕ ОКНО ВСТАВКИ ДАННЫХ ИЗ EXCEL */}
      {showPasteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div className="panel" style={{ width: "100%", maxWidth: "640px" }}>
            <div className="panel-head">
              <h3 className="panel-title">Вставка таблицы из Excel / Google Таблиц</h3>
              <button onClick={() => setShowPasteModal(false)} className="btn btn-sm">
                Закрыть
              </button>
            </div>
            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px" }}>
                Скопируйте диапазон ячеек в Excel вместе со строкой заголовков (`Ctrl+C`) и вставьте в поле ниже (`Ctrl+V`):
              </p>
              <textarea
                rows={10}
                value={pasteBuffer}
                onChange={(e) => setPasteBuffer(e.target.value)}
                placeholder={"GDP_Growth\tInvestment\tKeyRate\n4.2\t21.5\t7.5\n3.8\t20.1\t8.0"}
                className="input-field mono"
                style={{ width: "100%", resize: "vertical" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button onClick={() => setShowPasteModal(false)} className="btn">
                  Отмена
                </button>
                <button onClick={handlePasteFromExcel} className="btn btn-amber">
                  Загрузить данные
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ОСНОВНОЙ ИНТЕРФЕЙС */}
      <div className="main-layout">
        {/* ЛЕВАЯ КОЛОНКА: СТРОГИЙ РЕЕСТР ПЕРЕМЕННЫХ */}
        <aside className="var-sidebar">
          <div className="sidebar-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#a1a1aa", letterSpacing: "0.05em" }}>
                Реестр переменных ({varNames.length})
              </span>
              <span className="mono" style={{ fontSize: "11px", color: "#d97706" }}>
                Выбрано: {selectedVars.length}
              </span>
            </div>

            {/* Поиск по переменным */}
            <div style={{ position: "relative", marginBottom: "8px" }}>
              <Search
                size={13}
                color="#71717a"
                style={{ position: "absolute", left: "9px", top: "8px" }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Фильтр по имени..."
                className="search-input"
              />
            </div>

            {/* Строгие кнопки трансформации */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
              <button
                onClick={() => applyTransformation("log")}
                title="Натуральный логарифм выбранных переменных"
                className="btn btn-sm mono"
                style={{ justifyContent: "center" }}
              >
                ln(X)
              </button>
              <button
                onClick={() => applyTransformation("diff")}
                title="Первая разность ΔX = X(t) - X(t-1)"
                className="btn btn-sm mono"
                style={{ justifyContent: "center" }}
              >
                ΔX
              </button>
              <button
                onClick={() => applyTransformation("lag1")}
                title="Лаг 1-го порядка X(t-1)"
                className="btn btn-sm mono"
                style={{ justifyContent: "center" }}
              >
                X(t-1)
              </button>
              <button
                onClick={() => applyTransformation("pch")}
                title="Цепной темп прироста в %"
                className="btn btn-sm mono"
                style={{ justifyContent: "center" }}
              >
                %ΔX
              </button>
            </div>
          </div>

          {/* Список переменных с фиксированной высотой строки */}
          <div className="var-scroll-list">
            {filteredVars.map((v) => {
              const isSelected = selectedVars.includes(v.name);
              return (
                <div
                  key={v.name}
                  onClick={() => toggleSelectVar(v.name)}
                  className={`var-row ${isSelected ? "selected" : ""}`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      style={{ accentColor: "#d97706", cursor: "pointer", margin: 0 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="mono" style={{ fontSize: "11px", color: "#71717a" }}>
                          #{v.id}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontWeight: 700,
                            fontSize: "12.5px",
                            color: "#f4f4f5",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {v.name}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#71717a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {v.desc}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    <div className="mono" style={{ textAlign: "right", fontSize: "11px" }}>
                      <div style={{ color: "#d4d4d8" }}>μ={v.mean.toFixed(2)}</div>
                      <div style={{ color: "#71717a" }}>σ={v.std.toFixed(2)}</div>
                    </div>
                    <button
                      onClick={(e) => deleteVariable(v.name, e)}
                      title="Удалить переменную"
                      className="del-btn"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ПРАВАЯ РАБОЧАЯ ПАНЕЛЬ */}
        <main className="content-pane">
          {/* НАВИГАЦИОННЫЕ ВКЛАДКИ */}
          <div className="nav-tabs">
            <button
              onClick={() => setActiveTab("data")}
              className={`nav-tab ${activeTab === "data" ? "active" : ""}`}
            >
              <TableIcon size={14} />
              1. Таблица и Редактор данных
            </button>
            <button
              onClick={() => setActiveTab("ols")}
              className={`nav-tab ${activeTab === "ols" ? "active" : ""}`}
            >
              <Sliders size={14} />
              2. МНК-регрессия и Диагностика
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`nav-tab ${activeTab === "stats" ? "active" : ""}`}
            >
              <BarChart2 size={14} />
              3. Корреляции и Стационарность (ADF)
            </button>
            <button
              onClick={() => setActiveTab("markov")}
              className={`nav-tab ${activeTab === "markov" ? "active" : ""}`}
            >
              <Activity size={14} />
              4. Цепи Маркова
            </button>
          </div>

          <div className="workspace-scroll">
            {/* ============================================================== */}
            {/* ВКЛАДКА 1: РЕДАКТОР ДАННЫХ И ФОРМУЛ                             */}
            {/* ============================================================== */}
            {activeTab === "data" && (
              <>
                {/* Панель создания новой переменной или формулы */}
                <div className="panel">
                  <div className="panel-head">
                    <h2 className="panel-title">
                      <Calculator size={14} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                      Генератор переменных и ручной ввод
                    </h2>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={addObservationRow} className="btn btn-sm">
                        <Plus size={13} /> Добавить строку (t = {nRows + 1})
                      </button>
                      <button onClick={() => setShowPasteModal(true)} className="btn btn-sm">
                        Вставить таблицу из буфера
                      </button>
                    </div>
                  </div>
                  <div className="panel-body">
                    <form
                      onSubmit={handleCreateByFormula}
                      style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}
                    >
                      <div style={{ flex: "1 1 180px" }}>
                        <label style={{ display: "block", fontSize: "11px", color: "#a1a1aa", marginBottom: "4px" }}>
                          Имя нового столбца:
                        </label>
                        <input
                          type="text"
                          value={newColName}
                          onChange={(e) => setNewColName(e.target.value)}
                          placeholder="Напр.: RealRate"
                          className="input-field mono"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div style={{ flex: "2 1 340px" }}>
                        <label style={{ display: "block", fontSize: "11px", color: "#a1a1aa", marginBottom: "4px" }}>
                          Математическая формула (оставьте пустым для заполнения вручную):
                        </label>
                        <input
                          type="text"
                          value={newColFormula}
                          onChange={(e) => setNewColFormula(e.target.value)}
                          placeholder="Напр.: KeyRate - Inflation  или  ln(Investment) * 2"
                          className="input-field mono"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <button type="submit" className="btn btn-amber">
                        <Plus size={14} /> Создать столбец
                      </button>
                    </form>
                  </div>
                </div>

                {/* Интерактивная редактируемая таблица (Spreadsheet) */}
                <div className="panel" style={{ overflow: "hidden" }}>
                  <div className="panel-head">
                    <span className="panel-title">
                      Рабочая матрица наблюдений (кликните по любой ячейке для редактирования числа)
                    </span>
                    <span className="mono" style={{ fontSize: "11px", color: "#a1a1aa" }}>
                      Размерность: {nRows} × {varNames.length}
                    </span>
                  </div>
                  <div style={{ overflowX: "auto", maxHeight: "520px" }}>
                    <table className="data-table">
                      <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                        <tr>
                          <th style={{ width: "60px" }}>t</th>
                          {varNames.map((v) => (
                            <th key={v} className="mono" style={{ textAlign: "right" }}>
                              {v}
                            </th>
                          ))}
                          <th style={{ width: "44px", textAlign: "center" }}>Удал.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: nRows }, (_, rowIdx) => (
                          <tr key={rowIdx}>
                            <td className="mono" style={{ color: "#71717a" }}>
                              {rowIdx + 1}
                            </td>
                            {varNames.map((v) => {
                              const cellVal = df[v][rowIdx];
                              return (
                                <td key={v} style={{ padding: "3px 6px", textAlign: "right" }}>
                                  <input
                                    type="text"
                                    defaultValue={
                                      cellVal !== null && cellVal !== undefined
                                        ? String(cellVal)
                                        : ""
                                    }
                                    onBlur={(e) => handleCellEdit(v, rowIdx, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="cell-input"
                                  />
                                </td>
                              );
                            })}
                            <td style={{ textAlign: "center" }}>
                              <button
                                onClick={() => deleteObservationRow(rowIdx)}
                                className="del-btn"
                                title="Удалить строку"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 2: МНК-РЕГРЕССИЯ И ДИАГНОСТИКА                          */}
            {/* ============================================================== */}
            {activeTab === "ols" && (
              <>
                {/* Спецификация модели */}
                <div className="panel">
                  <div className="panel-head">
                    <h2 className="panel-title">Спецификация уравнения регрессии (МНК / OLS)</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#d4d4d8", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={includeConst}
                          onChange={(e) => setIncludeConst(e.target.checked)}
                          style={{ accentColor: "#d97706" }}
                        />
                        Включить константу (const)
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#d4d4d8", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={useHC3}
                          onChange={(e) => setUseHC3(e.target.checked)}
                          style={{ accentColor: "#d97706" }}
                        />
                        Робастные ошибки Уайта (HC3)
                      </label>
                      <button onClick={handleRunOLS} className="btn btn-amber">
                        <Play size={13} fill="#090a0c" /> Оценить модель
                      </button>
                    </div>
                  </div>

                  <div className="panel-body">
                    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "16px", alignItems: "start" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", color: "#a1a1aa", marginBottom: "5px", textTransform: "uppercase" }}>
                          Зависимая переменная (Y):
                        </label>
                        <select
                          value={depVar}
                          onChange={(e) => setDepVar(e.target.value)}
                          className="input-field mono"
                          style={{ width: "100%" }}
                        >
                          {varNames.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "11px", color: "#a1a1aa", marginBottom: "5px", textTransform: "uppercase" }}>
                          Объясняющие регрессоры (X):
                        </label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {varNames
                            .filter((v) => v !== depVar)
                            .map((v) => {
                              const isAct = regressors.includes(v);
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
                                  className={`tag-chip mono ${isAct ? "active" : ""}`}
                                >
                                  {isAct ? "■ " : "□ "}
                                  {v}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Переключатель оцененных моделей */}
                {models.length > 1 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: "#71717a", textTransform: "uppercase" }}>
                      Сессия моделей:
                    </span>
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setActiveModelId(m.id)}
                        className={`btn btn-sm mono ${m.id === activeModel?.id ? "btn-amber" : ""}`}
                      >
                        M{m.id}: {m.depVar} (R²={m.metrics.r2.toFixed(3)})
                      </button>
                    ))}
                  </div>
                )}

                {/* ПРОТОКОЛ РЕГРЕССИИ */}
                {activeModel && (
                  <div className="panel">
                    <div className="panel-head">
                      <div>
                        <h3 className="panel-title mono">
                          Модель #{activeModel.id} // Зависимая переменная: {activeModel.depVar} (T = {activeModel.nObs}, df = {activeModel.dfResid})
                        </h3>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button onClick={() => saveModelSeriesToDf("resid")} className="btn btn-sm mono">
                          + uhat_{activeModel.id}
                        </button>
                        <button onClick={() => saveModelSeriesToDf("fitted")} className="btn btn-sm mono">
                          + yhat_{activeModel.id}
                        </button>
                        <button onClick={() => copyModelOutput("text")} className="btn btn-sm">
                          {copiedType === "text" ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          Текст
                        </button>
                        <button onClick={() => copyModelOutput("latex")} className="btn btn-sm">
                          {copiedType === "latex" ? <Check size={13} color="#10b981" /> : <FileCode size={13} />}
                          LaTeX
                        </button>
                      </div>
                    </div>

                    {/* Уравнение в аналитическом виде */}
                    <div
                      className="mono"
                      style={{
                        padding: "10px 16px",
                        background: "#0d0f12",
                        borderBottom: "1px solid #272a30",
                        color: "#fbbf24",
                        fontSize: "12.5px",
                        overflowX: "auto",
                      }}
                    >
                      {formattedEquation}
                    </div>

                    {/* Расширенная эконометрическая таблица с 95% ДИ и Бета-коэффициентами */}
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table mono">
                        <thead>
                          <tr>
                            <th>Регрессор</th>
                            <th style={{ textAlign: "right" }}>Коэфф. (β)</th>
                            <th style={{ textAlign: "right" }}>Ст. ошибка</th>
                            <th style={{ textAlign: "right" }}>t-стат.</th>
                            <th style={{ textAlign: "right" }}>p-value</th>
                            <th style={{ textAlign: "right" }}>95% Дов. интервал</th>
                            <th style={{ textAlign: "right" }} title="Стандартизированный коэффициент (показывает относительную силу влияния фактора)">
                              Бета (β*)
                            </th>
                            <th style={{ textAlign: "right" }} title="Средний коэффициент эластичности Э = β * (X_ср / Y_ср)">
                              Эластичность
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeModel.coefficients.map((c) => (
                            <tr key={c.name}>
                              <td style={{ fontWeight: 700, color: "#f4f4f5" }}>
                                {c.name}
                              </td>
                              <td style={{ textAlign: "right", color: "#fbbf24", fontWeight: 700 }}>
                                {c.beta.toFixed(5)}
                              </td>
                              <td style={{ textAlign: "right", color: "#a1a1aa" }}>
                                {c.se.toFixed(5)}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                {c.tStat.toFixed(4)}
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  color: c.pValue < 0.05 ? "#10b981" : "#a1a1aa",
                                  fontWeight: c.pValue < 0.05 ? 700 : 400,
                                }}
                              >
                                {c.pValue < 0.0001 ? c.pValue.toExponential(2) : c.pValue.toFixed(4)}{" "}
                                <span style={{ color: "#f59e0b" }}>{c.stars}</span>
                              </td>
                              <td style={{ textAlign: "right", color: "#a1a1aa", fontSize: "11.5px" }}>
                                [{c.ciLow.toFixed(4)}; {c.ciHigh.toFixed(4)}]
                              </td>
                              <td style={{ textAlign: "right", color: "#d4d4d8" }}>
                                {c.stdBeta !== null ? c.stdBeta.toFixed(4) : "—"}
                              </td>
                              <td style={{ textAlign: "right", color: "#d4d4d8" }}>
                                {c.elasticity !== null ? `${c.elasticity.toFixed(3)}%` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Сводная матрица критериев качества модели */}
                    <div className="panel-body">
                      <div className="grid-4 mono" style={{ fontSize: "12px" }}>
                        <div className="stat-box">
                          <div style={{ color: "#71717a", fontSize: "11px" }}>R² / Скорр. R²</div>
                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#10b981", marginTop: "3px" }}>
                            {activeModel.metrics.r2.toFixed(5)} / {activeModel.metrics.adjR2.toFixed(5)}
                          </div>
                        </div>
                        <div className="stat-box">
                          <div style={{ color: "#71717a", fontSize: "11px" }}>
                            F({activeModel.dfModel}, {activeModel.dfResid}) [p-val]
                          </div>
                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#f4f4f5", marginTop: "3px" }}>
                            {activeModel.metrics.fStat.toFixed(3)}{" "}
                            <span style={{ fontSize: "11.5px", color: "#10b981" }}>
                              [{activeModel.metrics.fPval.toExponential(2)}]
                            </span>
                          </div>
                        </div>
                        <div className="stat-box">
                          <div style={{ color: "#71717a", fontSize: "11px" }}>SSR / Ст. ошибка (SE)</div>
                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#f4f4f5", marginTop: "3px" }}>
                            {activeModel.metrics.ssr.toFixed(3)} / {activeModel.metrics.seReg.toFixed(4)}
                          </div>
                        </div>
                        <div className="stat-box">
                          <div style={{ color: "#71717a", fontSize: "11px" }}>DW / AIC / BIC</div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#fbbf24", marginTop: "3px" }}>
                            {activeModel.metrics.dw.toFixed(3)} | {activeModel.metrics.aic.toFixed(1)} | {activeModel.metrics.bic.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ДИАГНОСТИЧЕСКИЕ ТЕСТЫ ПРЕДПОСЫЛОК ГАУССА — МАРКОВА */}
                {activeModel && (
                  <div className="grid-4">
                    <div className="panel">
                      <div className="panel-head">
                        <span className="panel-title">Бреуш — Паган (Гетероск.)</span>
                      </div>
                      <div className="panel-body mono" style={{ fontSize: "12px" }}>
                        <div>LM = {activeModel.diagnostics.bpLM.toFixed(4)}</div>
                        <div>p-value = {activeModel.diagnostics.bpPval.toFixed(4)}</div>
                        <div
                          style={{
                            marginTop: "6px",
                            color: activeModel.diagnostics.bpPval > 0.05 ? "#10b981" : "#f59e0b",
                            fontFamily: "sans-serif",
                          }}
                        >
                          {activeModel.diagnostics.bpPval > 0.05
                            ? "H0 принята: остатки гомоскедастичны"
                            : "H0 отвергнута: гетероскедастичность (вкл. HC3)"}
                        </div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-head">
                        <span className="panel-title">Рамсей RESET (Специф.)</span>
                      </div>
                      <div className="panel-body mono" style={{ fontSize: "12px" }}>
                        <div>F = {activeModel.diagnostics.resetF.toFixed(4)}</div>
                        <div>p-value = {activeModel.diagnostics.resetPval.toFixed(4)}</div>
                        <div
                          style={{
                            marginTop: "6px",
                            color: activeModel.diagnostics.resetPval > 0.05 ? "#10b981" : "#f59e0b",
                            fontFamily: "sans-serif",
                          }}
                        >
                          {activeModel.diagnostics.resetPval > 0.05
                            ? "H0 принята: линейная форма корректна"
                            : "H0 отвергнута: пропущены нелинейности"}
                        </div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-head">
                        <span className="panel-title">Жарк — Бера (Нормальн.)</span>
                      </div>
                      <div className="panel-body mono" style={{ fontSize: "12px" }}>
                        <div>JB = {activeModel.diagnostics.jbStat.toFixed(4)}</div>
                        <div>p-value = {activeModel.diagnostics.jbPval.toFixed(4)}</div>
                        <div
                          style={{
                            marginTop: "6px",
                            color: activeModel.diagnostics.jbPval > 0.05 ? "#10b981" : "#f59e0b",
                            fontFamily: "sans-serif",
                          }}
                        >
                          {activeModel.diagnostics.jbPval > 0.05
                            ? "H0 принята: остатки нормальны"
                            : "H0 отвергнута: асимметрия/выбросы"}
                        </div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-head">
                        <span className="panel-title">Факторы VIF (Мультиколл.)</span>
                      </div>
                      <div className="panel-body mono" style={{ fontSize: "11.5px" }}>
                        {activeModel.diagnostics.vif.map((v) => (
                          <div key={v.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                            <span style={{ color: "#a1a1aa" }}>{v.name}:</span>
                            <span style={{ color: v.value < 10 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                              {v.value.toFixed(3)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ГРАФИКИ ФАКТ vs МОДЕЛЬ И ОСТАТКИ */}
                {activeModel && (
                  <div className="grid-2">
                    <div className="panel">
                      <div className="panel-head">
                        <span className="panel-title">
                          Динамика: Фактические ({activeModel.depVar}) и Расчетные (Y_hat)
                        </span>
                      </div>
                      <div className="panel-body" style={{ height: "270px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={activeModel.seriesData}>
                            <CartesianGrid strokeDasharray="2 2" stroke="#22252c" />
                            <XAxis dataKey="t" stroke="#71717a" fontSize={11} />
                            <YAxis stroke="#71717a" fontSize={11} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#14161a",
                                borderColor: "#323741",
                                fontSize: "12px",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Line
                              type="monotone"
                              dataKey="actual"
                              name={`Факт (${activeModel.depVar})`}
                              stroke="#e4e4e7"
                              strokeWidth={1.8}
                              dot={{ r: 2 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="fitted"
                              name="Оценка МНК (Y_hat)"
                              stroke="#d97706"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-head">
                        <span className="panel-title">Диаграмма остатков (u_t vs Y_hat)</span>
                      </div>
                      <div className="panel-body" style={{ height: "270px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="2 2" stroke="#22252c" />
                            <XAxis type="number" dataKey="fitted" name="Y_hat" stroke="#71717a" fontSize={11} />
                            <YAxis type="number" dataKey="resid" name="Остаток u" stroke="#71717a" fontSize={11} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#14161a",
                                borderColor: "#323741",
                                fontSize: "12px",
                              }}
                            />
                            <ReferenceLine y={0} stroke="#d97706" strokeDasharray="3 3" />
                            <Scatter name="Остатки u_i" data={activeModel.seriesData} fill="#10b981" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 3: ОПИСАТЕЛЬНАЯ СТАТИСТИКА, КОРРЕЛЯЦИИ И ADF-ТЕСТ        */}
            {/* ============================================================== */}
            {activeTab === "stats" && (
              <>
                {/* Описательная статистика по всем переменным */}
                <div className="panel" style={{ overflow: "hidden" }}>
                  <div className="panel-head">
                    <h2 className="panel-title">Сводная таблица описательных статистик</h2>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table mono">
                      <thead>
                        <tr>
                          <th>Переменная</th>
                          <th style={{ textAlign: "right" }}>Среднее</th>
                          <th style={{ textAlign: "right" }}>Медиана</th>
                          <th style={{ textAlign: "right" }}>Ст. откл. (σ)</th>
                          <th style={{ textAlign: "right" }}>Минимум</th>
                          <th style={{ textAlign: "right" }}>Максимум</th>
                          <th style={{ textAlign: "right" }}>Коэф. вариации (CV%)</th>
                          <th style={{ textAlign: "right" }}>Асимметрия</th>
                          <th style={{ textAlign: "right" }}>Набл. (N)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {varStats.map((s) => (
                          <tr key={s.name}>
                            <td style={{ fontWeight: 700, color: "#fbbf24" }}>{s.name}</td>
                            <td style={{ textAlign: "right" }}>{s.mean.toFixed(4)}</td>
                            <td style={{ textAlign: "right" }}>{s.median.toFixed(4)}</td>
                            <td style={{ textAlign: "right" }}>{s.std.toFixed(4)}</td>
                            <td style={{ textAlign: "right" }}>{s.min.toFixed(4)}</td>
                            <td style={{ textAlign: "right" }}>{s.max.toFixed(4)}</td>
                            <td style={{ textAlign: "right" }}>{s.cv.toFixed(2)}%</td>
                            <td style={{ textAlign: "right" }}>{s.skew.toFixed(4)}</td>
                            <td style={{ textAlign: "right", color: "#a1a1aa" }}>{s.n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid-2">
                  {/* Корреляционная матрица Пирсона */}
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">Матрица парных корреляций Пирсона (r)</span>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table mono">
                        <thead>
                          <tr>
                            <th>Переменная</th>
                            {varNames.slice(0, 7).map((v) => (
                              <th key={v} style={{ textAlign: "right" }}>
                                {v}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {varNames.slice(0, 7).map((rVar) => (
                            <tr key={rVar}>
                              <td style={{ fontWeight: 700, color: "#d4d4d8" }}>{rVar}</td>
                              {varNames.slice(0, 7).map((cVar) => {
                                const r = pearsonCorr(df[rVar], df[cVar]);
                                const strong = Math.abs(r) > 0.6 && rVar !== cVar;
                                return (
                                  <td
                                    key={cVar}
                                    style={{
                                      textAlign: "right",
                                      color: strong ? "#fbbf24" : "#a1a1aa",
                                      fontWeight: strong ? 700 : 400,
                                    }}
                                  >
                                    {r.toFixed(3)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Расширенный тест Дики — Фуллера (ADF) */}
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">Тест единичного корня Дики — Фуллера (ADF)</span>
                      <select
                        value={tsVar}
                        onChange={(e) => setTsVar(e.target.value)}
                        className="input-field mono"
                      >
                        {varNames.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="panel-body mono" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div className="stat-box">
                        <div style={{ color: "#a1a1aa", fontSize: "11px" }}>
                          1. Спецификация с константой (крит. 5% = {adfResult.constModel.crit5}; 1% = {adfResult.constModel.crit1})
                        </div>
                        <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
                          τ_c = {adfResult.constModel.tau.toFixed(4)}
                        </div>
                        <div style={{ color: adfResult.constModel.stationary ? "#10b981" : "#f59e0b", marginTop: "4px", fontFamily: "sans-serif" }}>
                          {adfResult.constModel.stationary
                            ? "H0 отвергается: ряд стационарен в уровнях I(0)"
                            : "H0 не отвергается: ряд нестационарен (возьмите разность ΔX)"}
                        </div>
                      </div>

                      <div className="stat-box">
                        <div style={{ color: "#a1a1aa", fontSize: "11px" }}>
                          2. Спецификация с константой и трендом (крит. 5% = {adfResult.trendModel.crit5}; 1% = {adfResult.trendModel.crit1})
                        </div>
                        <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
                          τ_ct = {adfResult.trendModel.tau.toFixed(4)}
                        </div>
                        <div style={{ color: adfResult.trendModel.stationary ? "#10b981" : "#f59e0b", marginTop: "4px", fontFamily: "sans-serif" }}>
                          {adfResult.trendModel.stationary
                            ? "H0 отвергается: ряд стационарен относительно тренда"
                            : "H0 не отвергается: присутствует единичный корень"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Многомерный график выбранных в левом списке рядов */}
                <div className="panel">
                  <div className="panel-head">
                    <span className="panel-title">
                      График временных рядов (отмеченных в левом реестре: {selectedVars.join(", ")})
                    </span>
                  </div>
                  <div className="panel-body" style={{ height: "280px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={multiSeriesChartData}>
                        <CartesianGrid strokeDasharray="2 2" stroke="#22252c" />
                        <XAxis dataKey="t" stroke="#71717a" fontSize={11} />
                        <YAxis stroke="#71717a" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#14161a",
                            borderColor: "#323741",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        {(selectedVars.length > 0 ? selectedVars : [varNames[0]]).map((v, i) => (
                          <Line
                            key={v}
                            type="monotone"
                            dataKey={v}
                            stroke={SERIES_PALETTE[i % SERIES_PALETTE.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 4: ЦЕПИ МАРКОВА                                        */}
            {/* ============================================================== */}
            {activeTab === "markov" && (
              <div className="grid-2">
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <span className="panel-title">Матрица переходных вероятностей P_ij</span>
                    </div>
                    <select
                      value={markovVar}
                      onChange={(e) => setMarkovVar(e.target.value)}
                      className="input-field mono"
                    >
                      {varNames.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="panel-body">
                    <div style={{ marginBottom: "12px", fontSize: "12px", color: "#a1a1aa" }}>
                      Состояние в последний момент выборки (t = {nRows}):{" "}
                      <strong className="mono" style={{ color: "#fbbf24" }}>
                        {markovResult.currentState}
                      </strong>
                    </div>

                    <table className="data-table mono">
                      <thead>
                        <tr>
                          <th>Из (t) \ В (t+1)</th>
                          {markovResult.shortLabels.map((l) => (
                            <th key={l} style={{ textAlign: "right" }}>
                              {l}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {markovResult.P.map((row, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ fontWeight: 700, color: "#f4f4f5" }}>
                                {markovResult.shortLabels[i]}
                              </div>
                              <div style={{ fontSize: "10.5px", color: "#71717a" }}>
                                {markovResult.bounds[i]}
                              </div>
                            </td>
                            {row.map((prob, j) => (
                              <td key={j} style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: 700, color: prob > 0.4 ? "#fbbf24" : "#e4e4e7" }}>
                                  {prob.toFixed(4)} ({(prob * 100).toFixed(1)}%)
                                </div>
                                <div style={{ fontSize: "10.5px", color: "#71717a" }}>
                                  n = {markovResult.counts[i][j]}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ marginTop: "16px" }}>
                      <div style={{ fontSize: "11px", color: "#a1a1aa", textTransform: "uppercase", marginBottom: "8px" }}>
                        Финальный стационарный вектор (π · P = π):
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                        {markovResult.shortLabels.map((l, idx) => (
                          <div key={l} className="stat-box mono" style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "11px", color: "#a1a1aa" }}>{l}</div>
                            <div style={{ fontSize: "15px", fontWeight: 700, color: "#10b981", marginTop: "3px" }}>
                              {(markovResult.stationary[idx] * 100).toFixed(2)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <span className="panel-title">
                      Прогноз распределения вероятностей состояний (S_t = S_0 · P^t)
                    </span>
                  </div>
                  <div className="panel-body" style={{ height: "340px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={markovResult.forecast}>
                        <CartesianGrid strokeDasharray="2 2" stroke="#22252c" />
                        <XAxis dataKey="step" stroke="#71717a" fontSize={12} />
                        <YAxis stroke="#71717a" fontSize={12} unit="%" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#14161a",
                            borderColor: "#323741",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar dataKey="S1" name="S1 (Спад)" fill="#ef4444" />
                        <Bar dataKey="S2" name="S2 (Стагнация)" fill="#d97706" />
                        <Bar dataKey="S3" name="S3 (Рост)" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* НИЖНЯЯ СТРОКА СОСТОЯНИЯ */}
      <footer className="statusbar mono">
        <span>{statusLine}</span>
        <span>TED WORKBENCH // OLS • HC3 • ADF • MARKOV</span>
      </footer>
    </div>
  );
}
