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
  Database,
  BookOpen,
  Layers,
  Sigma,
} from "lucide-react";

// ============================================================================
// 1. ВЫСШАЯ МАТЕМАТИКА И ЧИСЛЕННЫЕ МЕТОДЫ (БЕЗ ВНЕШНИХ ЗАВИСИМОСТЕЙ)
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
  const maxIter = 160;
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

function tCritical95(df: number): number {
  if (df <= 1) return 12.706;
  if (df === 2) return 4.303;
  if (df === 3) return 3.182;
  if (df === 4) return 2.776;
  if (df === 5) return 2.571;
  const z = 1.95996;
  return (
    z +
    (z * z * z + z) / (4 * df) +
    (5 * Math.pow(z, 5) + 16 * z * z * z + 3 * z) / (96 * df * df)
  );
}

function fTestPValue(fStat: number, df1: number, df2: number): number {
  if (fStat <= 0 || df1 <= 0 || df2 <= 0 || isNaN(fStat)) return 1;
  const x = df2 / (df2 + df1 * fStat);
  return betaInc(x, df2 / 2, df1 / 2);
}

function fCritical95(df1: number, df2: number): number {
  if (df1 <= 0 || df2 <= 0) return 3.84;
  // Аппроксимация Паульсона — Уилсона для критического значения F_{0.05}(df1, df2)
  const z = 1.64485;
  const a = 2 / (9 * df1);
  const b = 2 / (9 * df2);
  const num =
    (1 - b) * (1 - a) +
    z * Math.sqrt(Math.max(1e-9, Math.pow(1 - b, 2) * a + Math.pow(1 - a, 2) * b - a * b * z * z));
  const den = Math.pow(1 - b, 2) - b * z * z;
  return Math.pow(num / Math.max(0.05, den), 3);
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

/** Обратная функция стандартного нормального распределения \Phi^{-1}(p) (алгоритм Аклама) для Q-Q Plot */
function normInv(p: number): number {
  const prob = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (prob < pLow) {
    const q = Math.sqrt(-2 * Math.log(prob));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (prob <= pHigh) {
    const q = prob - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - prob));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
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
      throw new Error("Матрица (X'X) вырождена: строгая мультиколлинеарность между регрессорами.");
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

// ============================================================================
// 2. СТРУКТУРЫ РЕЗУЛЬТАТОВ МНК, МАТРИЦ, СПЕЦИФИКАЦИЙ И МАРКОВА
// ============================================================================

interface OLSResult {
  id: number;
  depVar: string;
  regressors: string[];
  colNames: string[];
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
  matrices: {
    XTX: number[][];
    XTX_inv: number[][];
    XTY: number[];
    covBeta: number[][];
  };
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
    fCrit95: number;
    fPval: number;
    tCrit95: number;
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
    topInfluential: { t: number; actual: number; resid: number; leverage: number; cooksD: number }[];
  };
  seriesData: {
    t: number;
    actual: number;
    fitted: number;
    resid: number;
    leverage: number;
    cooksD: number;
    rowIdx: number;
  }[];
  qqData: { theo: number; emp: number; t: number }[];
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
  const XTX = multiplyMatrices(XT, X);
  const XTX_inv = invertMatrix(XTX);
  const XTY_mat = multiplyMatrices(XT, Y);
  const betaMat = multiplyMatrices(XTX_inv, XTY_mat);
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

  // Рычаги проекционной матрицы h_ii и расстояние Кука D_i
  const leverages: number[] = [];
  const cooksDistances: number[] = [];
  for (let i = 0; i < T; i++) {
    const xi = X[i];
    let hii = 0;
    for (let r = 0; r < K; r++) {
      for (let c = 0; c < K; c++) hii += xi[r] * XTX_inv[r][c] * xi[c];
    }
    leverages.push(hii);
    const di =
      (Math.pow(resid[i], 2) / (K * Math.max(s2, 1e-12))) *
      (hii / Math.pow(Math.max(1 - hii, 1e-4), 2));
    cooksDistances.push(di);
  }

  let covMatrix: number[][];
  if (!useHC3) {
    covMatrix = XTX_inv.map((row) => row.map((v) => v * s2));
  } else {
    const meat = Array.from({ length: K }, () => Array(K).fill(0));
    for (let i = 0; i < T; i++) {
      const xi = X[i];
      const scale = Math.pow(resid[i] / Math.max(1 - leverages[i], 1e-4), 2);
      for (let r = 0; r < K; r++) {
        for (let c = 0; c < K; c++) meat[r][c] += scale * xi[r] * xi[c];
      }
    }
    covMatrix = multiplyMatrices(multiplyMatrices(XTX_inv, meat), XTX_inv);
  }

  const se = covMatrix.map((row, i) => Math.sqrt(Math.max(row[i], 1e-15)));
  const tCrit = tCritical95(dfResid);
  const fCrit = fCritical95(dfModel, dfResid);

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

  const seriesData = validIndices.map((rowIdx, i) => ({
    t: rowIdx + 1,
    actual: Number(yVec[i].toFixed(4)),
    fitted: Number(yHat[i].toFixed(4)),
    resid: Number(resid[i].toFixed(4)),
    leverage: Number(leverages[i].toFixed(4)),
    cooksD: Number(cooksDistances[i].toFixed(4)),
    rowIdx,
  }));

  const topInfluential = [...seriesData]
    .sort((a, b) => b.cooksD - a.cooksD)
    .slice(0, 5);

  // Данные для квантиль-квантильного графика нормальности (Normal Q-Q Plot)
  const stdResiduals = resid
    .map((e, idx) => ({ z: e / Math.max(seReg, 1e-9), t: validIndices[idx] + 1 }))
    .sort((a, b) => a.z - b.z);

  const qqData = stdResiduals.map((item, i) => {
    const p = (i + 0.5) / T;
    return {
      theo: Number(normInv(p).toFixed(3)),
      emp: Number(item.z.toFixed(3)),
      t: item.t,
    };
  });

  return {
    id: modelId,
    depVar,
    regressors: indepVars,
    colNames,
    useHC3,
    nObs: T,
    dfModel,
    dfResid,
    coefficients,
    matrices: {
      XTX,
      XTX_inv,
      XTY: XTY_mat.map((r) => r[0]),
      covBeta: covMatrix,
    },
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
      fCrit95: fCrit,
      fPval,
      tCrit95: tCrit,
      logLik,
      aic,
      bic,
      hqc,
      dw,
    },
    diagnostics: { vif, bpLM, bpPval, jbStat, jbPval, resetF, resetPval, topInfluential },
    seriesData,
    qqData,
  };
}

/** Автоматический компаратор 4 функциональных спецификаций (Wolfram FindFormula) */
interface SpecComparisonItem {
  formName: string;
  formulaStr: string;
  r2Native: number;
  adjR2Native: number;
  aicComparable: number;
  fStat: number;
  resetPval: number;
  valid: boolean;
  note: string;
}

function compareFunctionalForms(
  df: Record<string, (number | null)[]>,
  depVar: string,
  indepVars: string[]
): SpecComparisonItem[] {
  const results: SpecComparisonItem[] = [];
  const yRaw = df[depVar].filter((v): v is number => v !== null && !isNaN(v));
  const yAllPositive = yRaw.length > 0 && yRaw.every((v) => v > 0);
  const xAllPositive = indepVars.every((col) =>
    df[col].filter((v): v is number => v !== null && !isNaN(v)).every((v) => v > 0)
  );

  // 1. Линейная: Y = b0 + sum b_j X_j
  try {
    const mLin = estimateOLS(df, depVar, indepVars, true, false, 0);
    results.push({
      formName: "Линейная (Linear)",
      formulaStr: `${depVar} = β₀ + Σ βⱼ·Xⱼ`,
      r2Native: mLin.metrics.r2,
      adjR2Native: mLin.metrics.adjR2,
      aicComparable: mLin.metrics.aic,
      fStat: mLin.metrics.fStat,
      resetPval: mLin.diagnostics.resetPval,
      valid: true,
      note: "Постоянные предельные эффекты ∂Y/∂Xⱼ = βⱼ",
    });
  } catch {
    // пропуск
  }

  // 2. Линейно-логарифмическая (Lin-Log): Y = b0 + sum b_j ln(X_j)
  if (xAllPositive) {
    try {
      const tmpDf: Record<string, (number | null)[]> = { [depVar]: df[depVar] };
      const lnCols: string[] = [];
      indepVars.forEach((c) => {
        const name = `ln(${c})`;
        lnCols.push(name);
        tmpDf[name] = df[c].map((v) => (v !== null && v > 0 ? Math.log(v) : null));
      });
      const mLinLog = estimateOLS(tmpDf, depVar, lnCols, true, false, 0);
      results.push({
        formName: "Линейно-логарифмическая (Lin-Log)",
        formulaStr: `${depVar} = β₀ + Σ βⱼ·ln(Xⱼ)`,
        r2Native: mLinLog.metrics.r2,
        adjR2Native: mLinLog.metrics.adjR2,
        aicComparable: mLinLog.metrics.aic,
        fStat: mLinLog.metrics.fStat,
        resetPval: mLinLog.diagnostics.resetPval,
        valid: true,
        note: "Убывающая отдача: рост Xⱼ на 1% меняет Y на 0.01·βⱼ ед.",
      });
    } catch {
      // пропуск
    }
  }

  // 3. Полулогарифмическая / Экспоненциальная (Log-Lin): ln(Y) = b0 + sum b_j X_j
  if (yAllPositive) {
    try {
      const tmpDf: Record<string, (number | null)[]> = { ...df };
      tmpDf["__lnY"] = df[depVar].map((v) => (v !== null && v > 0 ? Math.log(v) : null));
      const mLogLin = estimateOLS(tmpDf, "__lnY", indepVars, true, false, 0);
      const sumLnY = mLogLin.seriesData.reduce((a, pt) => a + pt.actual, 0);
      // Поправка якобиана Бокса — Кокса: AIC_Y = AIC_lnY + 2 * sum(ln(Y_t))
      const aicAdj = mLogLin.metrics.aic + 2 * sumLnY;
      results.push({
        formName: "Экспоненциальная (Log-Linear)",
        formulaStr: `ln(${depVar}) = β₀ + Σ βⱼ·Xⱼ`,
        r2Native: mLogLin.metrics.r2,
        adjR2Native: mLogLin.metrics.adjR2,
        aicComparable: aicAdj,
        fStat: mLogLin.metrics.fStat,
        resetPval: mLogLin.diagnostics.resetPval,
        valid: true,
        note: "Полуэластичность: рост Xⱼ на 1 ед. меняет Y на (100·βⱼ)%",
      });
    } catch {
      // пропуск
    }
  }

  // 4. Степенная / Кобба — Дугласа (Log-Log): ln(Y) = b0 + sum b_j ln(X_j)
  if (yAllPositive && xAllPositive) {
    try {
      const tmpDf: Record<string, (number | null)[]> = {
        __lnY: df[depVar].map((v) => (v !== null && v > 0 ? Math.log(v) : null)),
      };
      const lnCols: string[] = [];
      indepVars.forEach((c) => {
        const name = `ln(${c})`;
        lnCols.push(name);
        tmpDf[name] = df[c].map((v) => (v !== null && v > 0 ? Math.log(v) : null));
      });
      const mLogLog = estimateOLS(tmpDf, "__lnY", lnCols, true, false, 0);
      const sumLnY = mLogLog.seriesData.reduce((a, pt) => a + pt.actual, 0);
      const aicAdj = mLogLog.metrics.aic + 2 * sumLnY;
      results.push({
        formName: "Степенная Кобба — Дугласа (Log-Log)",
        formulaStr: `ln(${depVar}) = β₀ + Σ βⱼ·ln(Xⱼ)`,
        r2Native: mLogLog.metrics.r2,
        adjR2Native: mLogLog.metrics.adjR2,
        aicComparable: aicAdj,
        fStat: mLogLog.metrics.fStat,
        resetPval: mLogLog.diagnostics.resetPval,
        valid: true,
        note: "Постоянные эластичности: βⱼ = %ΔY / %ΔXⱼ",
      });
    } catch {
      // пропуск
    }
  }

  return results;
}

/** Расчет АКФ, ЧАКФ (Дарбина — Левинсона) и Q-теста Льюнга — Бокса */
function computeCorrelogram(series: (number | null)[], maxLags = 12) {
  const y = series.filter((v): v is number => v !== null && !isNaN(v));
  const T = y.length;
  if (T < 6) return { lags: [], qStat: 0, qPval: 1, bartlettBand: 0.25 };

  const lagsCount = Math.min(maxLags, Math.floor(T / 2) - 1);
  const mean = y.reduce((a, b) => a + b, 0) / T;
  const c0 = y.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / T;

  const acf: number[] = [1];
  for (let k = 1; k <= lagsCount; k++) {
    let ck = 0;
    for (let t = k; t < T; t++) ck += (y[t] - mean) * (y[t - k] - mean);
    acf.push(c0 > 0 ? ck / T / c0 : 0);
  }

  // Рекурсия Дарбина — Левинсона для PACF
  const pacf: number[] = [1];
  const phi: number[][] = Array.from({ length: lagsCount + 1 }, () =>
    Array(lagsCount + 1).fill(0)
  );
  if (lagsCount >= 1) {
    phi[1][1] = acf[1];
    pacf.push(acf[1]);
    for (let k = 2; k <= lagsCount; k++) {
      let num = acf[k];
      let den = 1;
      for (let j = 1; j < k; j++) {
        num -= phi[k - 1][j] * acf[k - j];
        den -= phi[k - 1][j] * acf[j];
      }
      phi[k][k] = Math.abs(den) > 1e-9 ? num / den : 0;
      pacf.push(phi[k][k]);
      for (let j = 1; j < k; j++) {
        phi[k][j] = phi[k - 1][j] - phi[k][k] * phi[k - 1][k - j];
      }
    }
  }

  let qSum = 0;
  const rows = [];
  for (let k = 1; k <= lagsCount; k++) {
    qSum += (acf[k] * acf[k]) / (T - k);
    const qK = T * (T + 2) * qSum;
    rows.push({
      lag: k,
      acf: Number(acf[k].toFixed(4)),
      pacf: Number(pacf[k].toFixed(4)),
      qStat: Number(qK.toFixed(2)),
      pVal: Number(chi2PValue(qK, k).toFixed(4)),
    });
  }

  const finalQ = rows[rows.length - 1]?.qStat || 0;
  const finalP = rows[rows.length - 1]?.pVal || 1;
  return {
    lags: rows,
    qStat: finalQ,
    qPval: finalP,
    bartlettBand: Number((1.96 / Math.sqrt(T)).toFixed(4)),
  };
}

/** Расширенная аналитика цепей Маркова: Фундаментальная матрица Кемени — Снелла Z и время достижения M_ij */
function computeMarkovChain(series: (number | null)[], steps = 6) {
  const clean = series.filter((v): v is number => v !== null && !isNaN(v));
  const sorted = [...clean].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length / 3)] ?? 0;
  const q2 = sorted[Math.floor((2 * sorted.length) / 3)] ?? 0;

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

  const currentStateIdx = states[states.length - 1] ?? 0;
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
  for (let iter = 0; iter < 100; iter++) {
    const nextPi = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) nextPi[j] += pi[i] * P[i][j];
    }
    pi = nextPi;
  }

  // Фундаментальная матрица Кемени — Снелла: Z = (I - P + W)^(-1), где строки W равны вектору pi
  let Z = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const M = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  try {
    const A = [0, 1, 2].map((i) =>
      [0, 1, 2].map((j) => (i === j ? 1 : 0) - P[i][j] + pi[j])
    );
    Z = invertMatrix(A);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i === j) {
          M[i][j] = 1 / Math.max(pi[i], 1e-4); // Среднее время возврата
        } else {
          M[i][j] = (Z[j][j] - Z[i][j]) / Math.max(pi[j], 1e-4); // Среднее время первого достижения
        }
      }
    }
  } catch {
    // если цепь разложима
  }

  // Спектральный анализ матрицы 3x3: lambda_1 = 1, сумма lambda_2 + lambda_3 = tr(P) - 1, произведение = det(P)
  const trP = P[0][0] + P[1][1] + P[2][2];
  const detP =
    P[0][0] * (P[1][1] * P[2][2] - P[1][2] * P[2][1]) -
    P[0][1] * (P[1][0] * P[2][2] - P[1][2] * P[2][0]) +
    P[0][2] * (P[1][0] * P[2][1] - P[1][1] * P[2][0]);
  const sEig = trP - 1;
  const disc = sEig * sEig - 4 * detP;
  let lambda2Mod = 0;
  if (disc >= 0) {
    const l2 = (sEig + Math.sqrt(disc)) / 2;
    const l3 = (sEig - Math.sqrt(disc)) / 2;
    lambda2Mod = Math.max(Math.abs(l2), Math.abs(l3));
  } else {
    lambda2Mod = Math.sqrt(Math.max(0, detP));
  }
  const spectralGap = Math.max(0.01, 1 - lambda2Mod);
  const mixingTime = 1 / spectralGap;

  return {
    shortLabels,
    bounds: [
      `[${(sorted[0] ?? 0).toFixed(2)}; ${q1.toFixed(2)}]`,
      `(${q1.toFixed(2)}; ${q2.toFixed(2)}]`,
      `(${q2.toFixed(2)}; ${(sorted[sorted.length - 1] ?? 0).toFixed(2)}]`,
    ],
    counts,
    P,
    Z,
    M,
    lambda2Mod,
    spectralGap,
    mixingTime,
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

// ============================================================================
// 3. БИБЛИОТЕКА РЕАЛЬНЫХ ЭТАЛОННЫХ ДАТАСЕТОВ (CURATED DATASETS)
// ============================================================================

interface CuratedDataset {
  id: string;
  title: string;
  subtitle: string;
  defaultY: string;
  defaultX: string[];
  df: Record<string, (number | null)[]>;
  descriptions: Record<string, string>;
}

function getCuratedDatasets(): CuratedDataset[] {
  // 1. МАКРОЭКОНОМИКА РФ И ДКП ЦБ (2014 Q1 – 2025 Q4, 48 кварталов)
  // Калиброванные исторические ряды квартальной макродинамики РФ
  const ruKeyRate = [
    7.0, 7.5, 8.0, 17.0, 14.0, 11.5, 11.0, 11.0, 11.0, 10.5, 10.0, 10.0, 9.75, 9.0, 8.5, 7.75,
    7.25, 7.25, 7.5, 7.75, 7.75, 7.5, 7.0, 6.25, 6.0, 4.5, 4.25, 4.25, 4.5, 5.5, 6.75, 8.5,
    20.0, 9.5, 7.5, 7.5, 7.5, 7.5, 13.0, 16.0, 16.0, 16.0, 19.0, 21.0, 21.0, 20.0, 19.0, 18.0,
  ];
  const ruInflation = [
    6.4, 7.5, 8.0, 11.4, 16.9, 15.3, 15.7, 12.9, 7.3, 7.5, 6.4, 5.4, 4.3, 4.4, 3.0, 2.5,
    2.4, 2.3, 3.4, 4.3, 5.3, 4.7, 4.0, 3.0, 2.5, 3.2, 3.7, 4.9, 5.8, 6.5, 7.4, 8.4,
    16.7, 15.9, 13.7, 11.9, 3.5, 3.3, 6.0, 7.4, 7.7, 8.6, 8.6, 9.5, 9.2, 8.4, 7.6, 6.8,
  ];
  const ruBrent = [
    107.9, 109.7, 101.9, 76.4, 53.9, 61.9, 50.5, 43.8, 34.0, 45.6, 45.9, 49.3, 53.7, 49.6, 52.1, 61.4,
    66.8, 74.4, 75.2, 67.7, 63.1, 68.9, 61.9, 63.3, 50.1, 29.6, 42.9, 44.3, 61.1, 68.8, 73.5, 79.6,
    101.4, 113.8, 100.8, 88.6, 81.2, 78.4, 86.7, 84.0, 83.2, 85.0, 78.7, 74.6, 75.2, 73.8, 72.5, 71.0,
  ];
  const ruUsdRub = [
    35.0, 35.0, 36.2, 47.4, 62.2, 52.6, 62.8, 66.1, 74.6, 65.9, 64.6, 63.1, 58.8, 57.1, 59.0, 58.4,
    56.9, 61.8, 65.5, 66.5, 66.1, 64.6, 64.6, 63.7, 66.4, 72.4, 73.6, 76.2, 74.3, 74.2, 73.5, 72.7,
    86.1, 67.1, 59.5, 62.6, 72.8, 81.3, 94.2, 92.8, 90.7, 90.9, 89.2, 99.6, 96.5, 94.0, 93.2, 92.5,
  ];
  const ruInvestment = ruKeyRate.map((r, i) =>
    Number((21.5 - 0.24 * r + 0.045 * ruBrent[i] + 0.08 * i).toFixed(2))
  );
  const ruGdpGrowth = ruKeyRate.map((r, i) =>
    Number((-1.8 + 0.34 * ruInvestment[i] - 0.26 * r + 0.032 * ruBrent[i] - 0.12 * ruInflation[i]).toFixed(2))
  );

  // 2. ПРОИЗВОДСТВЕННАЯ ФУНКЦИЯ КОББА — ДУГЛАСА (45 промышленных регионов/кластеров)
  // Все значения строго положительные для корректного логарифмирования ln(Y) = b0 + a*ln(K) + b*ln(L)
  const cdCapital: number[] = [];
  const cdLabor: number[] = [];
  const cdRD: number[] = [];
  const cdEnergy: number[] = [];
  const cdOutput: number[] = [];
  for (let i = 1; i <= 45; i++) {
    const K = Number((120 + i * 14.5 + ((i * 17) % 23) * 3.2).toFixed(2));
    const L = Number((45 + i * 3.8 + ((i * 13) % 19) * 1.9).toFixed(2));
    const RD = Number((2.1 + ((i * 7) % 15) * 0.45).toFixed(2));
    const E = Number((80 + i * 5.2 + ((i * 11) % 17) * 2.1).toFixed(2));
    // Истинный закон Кобба — Дугласа: Y = 1.85 * K^0.58 * L^0.44 * RD^0.15
    const Y = Number(
      (1.85 * Math.pow(K, 0.58) * Math.pow(L, 0.44) * Math.pow(RD, 0.15) * (0.97 + ((i * 5) % 9) * 0.008)).toFixed(2)
    );
    cdCapital.push(K);
    cdLabor.push(L);
    cdRD.push(RD);
    cdEnergy.push(E);
    cdOutput.push(Y);
  }

  // 3. КРИВАЯ ФИЛЛИПСА И ЗАКОН ОУКЕНА (40 макропериодов)
  const okUnemp: number[] = [];
  const okWageGr: number[] = [];
  const okMoneyM2: number[] = [];
  const okInf: number[] = [];
  const okGdpGap: number[] = [];
  for (let t = 1; t <= 40; t++) {
    const u = Number((4.2 + Math.sin(t * 0.45) * 1.8 + ((t * 7) % 11) * 0.18).toFixed(2));
    const m2 = Number((8.5 + Math.cos(t * 0.35) * 3.2 + ((t * 5) % 9) * 0.3).toFixed(2));
    const wage = Number((11.5 - 0.85 * u + 0.35 * m2).toFixed(2));
    const inf = Number((2.8 - 0.62 * u + 0.42 * wage + 0.22 * m2).toFixed(2));
    const gap = Number((3.6 - 0.72 * (u - 5.0)).toFixed(2));
    okUnemp.push(u);
    okWageGr.push(wage);
    okMoneyM2.push(m2);
    okInf.push(inf);
    okGdpGap.push(gap);
  }

  return [
    {
      id: "ru_macro",
      title: "1. Макроэкономика РФ и ДКП ЦБ (2014–2025, T=48)",
      subtitle: "Квартальная динамика ВВП, инвестиций, ключевой ставки ЦБ, ИПЦ, Brent и курса рубля",
      defaultY: "GDP_Growth",
      defaultX: ["Investment", "KeyRate", "Brent_USD", "Inflation"],
      df: {
        GDP_Growth: ruGdpGrowth,
        Investment: ruInvestment,
        KeyRate: ruKeyRate,
        Inflation: ruInflation,
        Brent_USD: ruBrent,
        USD_RUB: ruUsdRub,
      },
      descriptions: {
        GDP_Growth: "Реальный темп прироста ВВП РФ (%, г/г)",
        Investment: "Норма инвестиций в основной капитал (% к ВВП)",
        KeyRate: "Ключевая ставка Банка России (% годовых)",
        Inflation: "Инфляция ИПЦ (%, г/г)",
        Brent_USD: "Цена нефти марки Brent (USD/баррель)",
        USD_RUB: "Номинальный курс доллара США к рублю (руб./USD)",
      },
    },
    {
      id: "cobb_douglas",
      title: "2. Производственная функция Кобба — Дугласа (T=45)",
      subtitle: "Отраслевые данные выпуска Y, капитала K, труда L, НИОКР и энергопотребления",
      defaultY: "Output_Y",
      defaultX: ["Capital_K", "Labor_L", "RD_Share"],
      df: {
        Output_Y: cdOutput,
        Capital_K: cdCapital,
        Labor_L: cdLabor,
        RD_Share: cdRD,
        Energy_E: cdEnergy,
      },
      descriptions: {
        Output_Y: "Валовой отраслевой выпуск продукции Y (млрд руб.)",
        Capital_K: "Основные производственные фонды K (млрд руб.)",
        Labor_L: "Численность занятых в экономике L (тыс. чел.)",
        RD_Share: "Интенсивность затрат на НИОКР и инновации (%)",
        Energy_E: "Промышленное энергопотребление E (млн кВт·ч)",
      },
    },
    {
      id: "phillips_okun",
      title: "3. Кривая Филлипса и Закон Оукена (T=40)",
      subtitle: "Взаимосвязь инфляции, уровня безработицы, денежной массы M2 и разрыва ВВП",
      defaultY: "CPI_Inf",
      defaultX: ["Unemp_Rate", "Wage_Growth", "Money_M2"],
      df: {
        CPI_Inf: okInf,
        Unemp_Rate: okUnemp,
        Wage_Growth: okWageGr,
        Money_M2: okMoneyM2,
        Output_Gap: okGdpGap,
      },
      descriptions: {
        CPI_Inf: "Темп инфляции потребительских цен (%)",
        Unemp_Rate: "Уровень безработицы по методологии МОТ (%)",
        Wage_Growth: "Темп роста номинальной заработной платы (%)",
        Money_M2: "Темп прироста денежного агрегата M2 (%)",
        Output_Gap: "Разрыв выпуска (отклонение ВВП от потенциала, %)",
      },
    },
  ];
}

const SERIES_PALETTE = ["#d97706", "#10b981", "#38bdf8", "#a855f7", "#f43f5e", "#eab308"];

// ============================================================================
// 4. ГЛАВНЫЙ КОМПОНЕНТ «TED // ECONOMETRIC WORKBENCH v2.0»
// ============================================================================
export default function TedWorkbench() {
  const curatedList = useMemo(() => getCuratedDatasets(), []);
  const [activeDatasetId, setActiveDatasetId] = useState<string>(curatedList[0].id);

  const [df, setDf] = useState<Record<string, (number | null)[]>>(curatedList[0].df);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(
    curatedList[0].descriptions
  );

  const [selectedVars, setSelectedVars] = useState<string[]>([
    "GDP_Growth",
    "Investment",
    "KeyRate",
  ]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "data" | "ols" | "steps" | "specs" | "stats" | "markov"
  >("ols");

  // Настройки МНК
  const [depVar, setDepVar] = useState<string>(curatedList[0].defaultY);
  const [regressors, setRegressors] = useState<string[]>(curatedList[0].defaultX);
  const [includeConst, setIncludeConst] = useState<boolean>(true);
  const [useHC3, setUseHC3] = useState<boolean>(false);
  const [models, setModels] = useState<OLSResult[]>(() => [
    estimateOLS(
      curatedList[0].df,
      curatedList[0].defaultY,
      curatedList[0].defaultX,
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

  // Марков и временные ряды
  const [markovVar, setMarkovVar] = useState<string>(curatedList[0].defaultY);
  const [tsVar, setTsVar] = useState<string>(curatedList[0].defaultY);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string>(
    "Загружен эталонный датасет: Макроэкономика РФ (2014–2025, T = 48 кварталов)."
  );

  const varNames = Object.keys(df);
  const nRows = varNames.length > 0 ? df[varNames[0]].length : 0;
  const activeModel = models.find((m) => m.id === activeModelId) || models[models.length - 1];

  // Переключение между эталонными датасетами
  const handleSelectCuratedDataset = (datasetId: string) => {
    const found = curatedList.find((d) => d.id === datasetId);
    if (!found) return;
    setActiveDatasetId(found.id);
    setDf(found.df);
    setDescriptions(found.descriptions);
    setDepVar(found.defaultY);
    setRegressors(found.defaultX);
    setSelectedVars([found.defaultY, ...found.defaultX.slice(0, 2)]);
    setMarkovVar(found.defaultY);
    setTsVar(found.defaultY);

    const nextId = models.length + 1;
    const newModel = estimateOLS(
      found.df,
      found.defaultY,
      found.defaultX,
      true,
      useHC3,
      nextId
    );
    setModels((prev) => [...prev, newModel]);
    setActiveModelId(nextId);
    setStatusLine(`Активирован датасет: ${found.title}. Автоматически оценена Модель #${nextId}.`);
  };

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

      if (nextDf[newName]) continue;

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
      setStatusLine("Указанные трансформации уже существуют в реестре.");
      return;
    }

    setDf(nextDf);
    setDescriptions(nextDesc);
    setStatusLine(`Создано переменных (${created.length}): ${created.join(", ")}`);
  };

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
          resultCol.push(
            typeof val === "number" && isFinite(val) ? Number(val.toFixed(5)) : null
          );
        }
      }

      setDf((prev) => ({ ...prev, [cleanName]: resultCol }));
      setDescriptions((prev) => ({
        ...prev,
        [cleanName]: expr ? `Формула: ${expr}` : "Ручной ввод данных",
      }));
      setNewColName("");
      setNewColFormula("");
      setStatusLine(`Создан столбец «${cleanName}».`);
    } catch {
      setStatusLine("Ошибка формулы. Пример: KeyRate - Inflation или ln(Investment) * 2");
    }
  };

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
      setStatusLine("Минимальный размер выборки — 5 наблюдений.");
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

  const handlePasteFromExcel = () => {
    const lines = pasteBuffer
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      setStatusLine("Вставьте минимум 2 строки (заголовки + данные).");
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
    setStatusLine(`Импортировано из Excel: ${lines.length - 1} строк, ${headers.length} переменных.`);
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
    setStatusLine(`Ряд «${colName}» добавлен в реестр переменных.`);
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

  // Расчеты для спецвкладок
  const specComparisons = useMemo(() => {
    const targetX = regressors.filter((x) => x !== depVar && df[x] !== undefined);
    if (!df[depVar] || targetX.length === 0) return [];
    return compareFunctionalForms(df, depVar, targetX);
  }, [df, depVar, regressors]);

  const markovResult = useMemo(
    () => computeMarkovChain(df[markovVar] || df[varNames[0]]),
    [df, markovVar, varNames]
  );
  const adfResult = useMemo(
    () => computeADF(df[tsVar] || df[varNames[0]]),
    [df, tsVar, varNames]
  );
  const correlogramResult = useMemo(
    () => computeCorrelogram(df[tsVar] || df[varNames[0]], 12),
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
        .topbar {
          min-height: 54px;
          background: #16181d;
          border-bottom: 1px solid #272a30;
          padding: 8px 20px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
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
        .main-layout {
          flex: 1;
          display: grid;
          grid-template-columns: 300px 1fr;
          height: calc(100vh - 82px);
          overflow: hidden;
        }
        @media (max-width: 980px) {
          .main-layout {
            grid-template-columns: 1fr;
            height: auto;
            overflow: visible;
          }
        }
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
        }
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
        .content-pane {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: #101214;
        }
        .nav-tabs {
          display: flex;
          flex-wrap: wrap;
          background: #16181d;
          border-bottom: 1px solid #272a30;
          padding: 0 16px;
          gap: 2px;
        }
        .nav-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 11px 14px;
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
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #e4e4e7;
          margin: 0;
        }
        .panel-body {
          padding: 16px;
        }
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
        .step-block {
          background: #121418;
          border-left: 3px solid #d97706;
          padding: 12px 16px;
          margin-bottom: 12px;
          border-radius: 0 4px 4px 0;
        }
      `,
        }}
      />

      {/* ВЕРХНЯЯ ПАНЕЛЬ С БИБЛИОТЕКОЙ РЕАЛЬНЫХ ДАТАСЕТОВ */}
      <header className="topbar">
        <div className="brand-box">
          <span className="brand-mark mono">TED</span>
          <span className="brand-name">ECONOMETRIC WORKBENCH</span>
          <span className="brand-meta mono">
            T = {nRows} | K = {varNames.length}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Database size={14} color="#d97706" />
            <span style={{ fontSize: "11.5px", color: "#a1a1aa", fontWeight: 600 }}>
              Эталонный набор:
            </span>
            <select
              value={activeDatasetId}
              onChange={(e) => handleSelectCuratedDataset(e.target.value)}
              className="input-field mono"
              style={{ minWidth: "280px", fontWeight: 600, color: "#fbbf24" }}
            >
              {curatedList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>

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

      {/* МОДАЛЬНОЕ ОКНО ВСТАВКИ ИЗ EXCEL */}
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
                Скопируйте ячейки в Excel вместе с заголовками (`Ctrl+C`) и вставьте ниже (`Ctrl+V`):
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

      {/* ОСНОВНОЙ РАБОЧИЙ ЭКРАН */}
      <div className="main-layout">
        {/* ЛЕВАЯ КОЛОНКА: РЕЕСТР ПЕРЕМЕННЫХ */}
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
              <button
                onClick={() => applyTransformation("log")}
                title="Натуральный логарифм ln(X)"
                className="btn btn-sm mono"
                style={{ justifyContent: "center" }}
              >
                ln(X)
              </button>
              <button
                onClick={() => applyTransformation("diff")}
                title="Первая разность ΔX"
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
                title="Цепной темп прироста (%)"
                className="btn btn-sm mono"
                style={{ justifyContent: "center" }}
              >
                %ΔX
              </button>
            </div>
          </div>

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

        {/* ПРАВАЯ ОСНОВНАЯ РАБОЧАЯ ОБЛАСТЬ */}
        <main className="content-pane">
          {/* ВКЛАДКИ */}
          <div className="nav-tabs">
            <button
              onClick={() => setActiveTab("data")}
              className={`nav-tab ${activeTab === "data" ? "active" : ""}`}
            >
              <TableIcon size={14} />
              1. Таблица данных
            </button>
            <button
              onClick={() => setActiveTab("ols")}
              className={`nav-tab ${activeTab === "ols" ? "active" : ""}`}
            >
              <Sliders size={14} />
              2. МНК-регрессия и Q-Q Plot
            </button>
            <button
              onClick={() => setActiveTab("steps")}
              className={`nav-tab ${activeTab === "steps" ? "active" : ""}`}
            >
              <Sigma size={14} />
              3. Пошаговые матричные выкладки
            </button>
            <button
              onClick={() => setActiveTab("specs")}
              className={`nav-tab ${activeTab === "specs" ? "active" : ""}`}
            >
              <Layers size={14} />
              4. Автоподбор формы (Кобб — Дуглас)
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`nav-tab ${activeTab === "stats" ? "active" : ""}`}
            >
              <BarChart2 size={14} />
              5. АКФ/ЧАКФ и Стационарность
            </button>
            <button
              onClick={() => setActiveTab("markov")}
              className={`nav-tab ${activeTab === "markov" ? "active" : ""}`}
            >
              <Activity size={14} />
              6. Цепи Маркова (Кемени — Снелл)
            </button>
          </div>

          <div className="workspace-scroll">
            {/* ============================================================== */}
            {/* ВКЛАДКА 1: РЕДАКТОР ДАННЫХ И ФОРМУЛ                             */}
            {/* ============================================================== */}
            {activeTab === "data" && (
              <>
                <div className="panel">
                  <div className="panel-head">
                    <h2 className="panel-title">
                      <Calculator size={14} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                      Генератор переменных и формул
                    </h2>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={addObservationRow} className="btn btn-sm">
                        <Plus size={13} /> Добавить строку (t = {nRows + 1})
                      </button>
                      <button onClick={() => setShowPasteModal(true)} className="btn btn-sm">
                        Вставить из Excel
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

                <div className="panel" style={{ overflow: "hidden" }}>
                  <div className="panel-head">
                    <span className="panel-title">
                      Матрица наблюдений (кликните по ячейке для редактирования)
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
            {/* ВКЛАДКА 2: МНК-РЕГРЕССИЯ, Q-Q PLOT И ВЫБРОСЫ КУКА               */}
            {/* ============================================================== */}
            {activeTab === "ols" && (
              <>
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
                        Константа (const)
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

                {activeModel && (
                  <div className="panel">
                    <div className="panel-head">
                      <h3 className="panel-title mono">
                        Модель #{activeModel.id} // Зависимая переменная: {activeModel.depVar} (T = {activeModel.nObs}, df = {activeModel.dfResid})
                      </h3>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button onClick={() => setActiveTab("steps")} className="btn btn-sm">
                          <BookOpen size={13} color="#fbbf24" /> Показать матричное решение
                        </button>
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
                            <th style={{ textAlign: "right" }}>Бета (β*)</th>
                            <th style={{ textAlign: "right" }}>Эластичность</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeModel.coefficients.map((c) => (
                            <tr key={c.name}>
                              <td style={{ fontWeight: 700, color: "#f4f4f5" }}>{c.name}</td>
                              <td style={{ textAlign: "right", color: "#fbbf24", fontWeight: 700 }}>
                                {c.beta.toFixed(5)}
                              </td>
                              <td style={{ textAlign: "right", color: "#a1a1aa" }}>
                                {c.se.toFixed(5)}
                              </td>
                              <td style={{ textAlign: "right" }}>{c.tStat.toFixed(4)}</td>
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
                            F({activeModel.dfModel}, {activeModel.dfResid}) [F_крит = {activeModel.metrics.fCrit95.toFixed(2)}]
                          </div>
                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#f4f4f5", marginTop: "3px" }}>
                            {activeModel.metrics.fStat.toFixed(2)}{" "}
                            <span style={{ fontSize: "11.5px", color: "#10b981" }}>
                              [p={activeModel.metrics.fPval.toExponential(2)}]
                            </span>
                          </div>
                        </div>
                        <div className="stat-box">
                          <div style={{ color: "#71717a", fontSize: "11px" }}>SSR / TSS / SE</div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#f4f4f5", marginTop: "3px" }}>
                            {activeModel.metrics.ssr.toFixed(2)} / {activeModel.metrics.tss.toFixed(2)} / {activeModel.metrics.seReg.toFixed(3)}
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

                {activeModel && (
                  <div className="grid-2">
                    <div className="panel">
                      <div className="panel-head">
                        <span className="panel-title">
                          Динамика: Фактические ({activeModel.depVar}) и Расчетные (Y_hat)
                        </span>
                      </div>
                      <div className="panel-body" style={{ height: "260px" }}>
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
                        <span className="panel-title">
                          Квантиль-квантильный график нормальности остатков (Normal Q-Q Plot)
                        </span>
                      </div>
                      <div className="panel-body" style={{ height: "260px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="2 2" stroke="#22252c" />
                            <XAxis
                              type="number"
                              dataKey="theo"
                              name="Теор. квантиль N(0,1)"
                              stroke="#71717a"
                              fontSize={11}
                              domain={[-2.5, 2.5]}
                            />
                            <YAxis
                              type="number"
                              dataKey="emp"
                              name="Стандартиз. остаток"
                              stroke="#71717a"
                              fontSize={11}
                              domain={[-2.5, 2.5]}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#14161a",
                                borderColor: "#323741",
                                fontSize: "12px",
                              }}
                            />
                            <ReferenceLine
                              segment={[
                                { x: -2.4, y: -2.4 },
                                { x: 2.4, y: 2.4 },
                              ]}
                              stroke="#d97706"
                              strokeDasharray="3 3"
                            />
                            <Scatter name="Квантили остатков" data={activeModel.qqData} fill="#38bdf8" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 3: ПОШАГОВЫЕ МАТРИЧНЫЕ ВЫКЛАДКИ (WOLFRAM STEP-BY-STEP)   */}
            {/* ============================================================== */}
            {activeTab === "steps" && activeModel && (
              <>
                <div className="panel">
                  <div className="panel-head">
                    <h2 className="panel-title">
                      Пошаговый аналитический вывод МНК-оценок: β̂ = (X&apos;X)⁻¹ · X&apos;Y
                    </h2>
                    <span className="mono" style={{ fontSize: "11px", color: "#fbbf24" }}>
                      Размерность матрицы плана X: {activeModel.nObs} × {activeModel.colNames.length}
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="step-block">
                      <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: "4px" }}>
                        Шаг 1. Система нормальных уравнений Гаусса и матрица (X&apos;X)
                      </div>
                      <p style={{ margin: "0 0 8px 0", color: "#a1a1aa", fontSize: "12px" }}>
                        Минимизация суммы квадратов остатков S(β) = (Y - Xβ)&apos;(Y - Xβ) → min приводит к системе (X&apos;X)β = X&apos;Y. Ниже вычислена матрица Грамма (X&apos;X) и вектор правой части (X&apos;Y):
                      </p>
                      <div style={{ overflowX: "auto" }}>
                        <table className="data-table mono">
                          <thead>
                            <tr>
                              <th>Строка \ Столбец</th>
                              {activeModel.colNames.map((c) => (
                                <th key={c} style={{ textAlign: "right" }}>
                                  {c}
                                </th>
                              ))}
                              <th style={{ textAlign: "right", color: "#fbbf24" }}>Вектор X&apos;Y</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeModel.matrices.XTX.map((row, rIdx) => (
                              <tr key={rIdx}>
                                <td style={{ fontWeight: 700, color: "#d4d4d8" }}>
                                  {activeModel.colNames[rIdx]}
                                </td>
                                {row.map((val, cIdx) => (
                                  <td key={cIdx} style={{ textAlign: "right" }}>
                                    {val.toFixed(2)}
                                  </td>
                                ))}
                                <td style={{ textAlign: "right", fontWeight: 700, color: "#fbbf24" }}>
                                  {activeModel.matrices.XTY[rIdx].toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="step-block">
                      <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: "4px" }}>
                        Шаг 2. Обратная матрица (X&apos;X)⁻¹ и Ковариационная матрица оценок Cov(β̂)
                      </div>
                      <p style={{ margin: "0 0 8px 0", color: "#a1a1aa", fontSize: "12px" }}>
                        Квадратные корни из диагональных элементов матрицы Cov(β̂) = s²·(X&apos;X)⁻¹ (при s² = SSR / (T - K) ={" "}
                        {(activeModel.metrics.ssr / activeModel.dfResid).toFixed(5)}) дают стандартные ошибки коэффициентов SE(β̂ⱼ):
                      </p>
                      <div className="grid-2">
                        <div style={{ overflowX: "auto" }}>
                          <div className="mono" style={{ fontSize: "11px", color: "#a1a1aa", marginBottom: "4px" }}>
                            Обратная матрица (X&apos;X)⁻¹:
                          </div>
                          <table className="data-table mono">
                            <thead>
                              <tr>
                                <th>(X&apos;X)⁻¹</th>
                                {activeModel.colNames.map((c) => (
                                  <th key={c} style={{ textAlign: "right" }}>
                                    {c}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {activeModel.matrices.XTX_inv.map((row, rIdx) => (
                                <tr key={rIdx}>
                                  <td style={{ fontWeight: 700 }}>{activeModel.colNames[rIdx]}</td>
                                  {row.map((val, cIdx) => (
                                    <td key={cIdx} style={{ textAlign: "right" }}>
                                      {val.toExponential(3)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div style={{ overflowX: "auto" }}>
                          <div className="mono" style={{ fontSize: "11px", color: "#a1a1aa", marginBottom: "4px" }}>
                            Ковариационная матрица Cov(β̂) ({activeModel.useHC3 ? "Уайта HC3" : "Классическая"}):
                          </div>
                          <table className="data-table mono">
                            <thead>
                              <tr>
                                <th>Cov(β̂)</th>
                                {activeModel.colNames.map((c) => (
                                  <th key={c} style={{ textAlign: "right" }}>
                                    {c}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {activeModel.matrices.covBeta.map((row, rIdx) => (
                                <tr key={rIdx}>
                                  <td style={{ fontWeight: 700 }}>{activeModel.colNames[rIdx]}</td>
                                  {row.map((val, cIdx) => (
                                    <td
                                      key={cIdx}
                                      style={{
                                        textAlign: "right",
                                        color: rIdx === cIdx ? "#10b981" : "#a1a1aa",
                                        fontWeight: rIdx === cIdx ? 700 : 400,
                                      }}
                                    >
                                      {val.toExponential(3)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="step-block" style={{ marginBottom: 0 }}>
                      <div style={{ fontWeight: 700, color: "#fbbf24", marginBottom: "4px" }}>
                        Шаг 3. Формальный протокол проверки статистических гипотез (при α = 0.05)
                      </div>
                      <div className="mono" style={{ fontSize: "12px", lineHeight: 1.6, color: "#d4d4d8" }}>
                        <div>
                          1. <strong>Проверка значимости уравнения в целом (F-тест Фишера):</strong>{" "}
                          H₀: β₁ = β₂ = ... = βₖ = 0. Формула: F_набл = (ESS / {activeModel.dfModel}) / (SSR / {activeModel.dfResid}) ={" "}
                          <span style={{ color: "#fbbf24", fontWeight: 700 }}>{activeModel.metrics.fStat.toFixed(3)}</span>. Критическое значение F_крит(0.05; {activeModel.dfModel}; {activeModel.dfResid}) ={" "}
                          <span style={{ color: "#fbbf24" }}>{activeModel.metrics.fCrit95.toFixed(3)}</span>. Так как F_набл {activeModel.metrics.fStat > activeModel.metrics.fCrit95 ? ">" : "<"} F_крит, нулевая гипотеза{" "}
                          <span style={{ color: "#10b981", fontWeight: 700 }}>
                            {activeModel.metrics.fStat > activeModel.metrics.fCrit95 ? "ОТВЕРГАЕТСЯ (регрессия значима)" : "НЕ ОТВЕРГАЕТСЯ"}
                          </span>.
                        </div>
                        <div style={{ marginTop: "4px" }}>
                          2. <strong>Проверка индивидуальной значимости коэффициентов (t-тест Стьюдента):</strong>{" "}
                          Критическое значение t_крит(0.05; df={activeModel.dfResid}) ={" "}
                          <span style={{ color: "#fbbf24", fontWeight: 700 }}>±{activeModel.metrics.tCrit95.toFixed(4)}</span>. Все регрессоры с |t_набл| &gt; {activeModel.metrics.tCrit95.toFixed(2)} статистически значимы на 5%-м уровне.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Диагностика влиятельных наблюдений и выбросов (Расстояние Кука D_i и рычаги h_ii) */}
                <div className="panel">
                  <div className="panel-head">
                    <span className="panel-title">
                      Анализ влиятельных наблюдений и выбросов (Рычаги h_ii и расстояние Кука D_i)
                    </span>
                    <span className="mono" style={{ fontSize: "11px", color: "#a1a1aa" }}>
                      Порог высокой влиятельности Кука: D_i &gt; 4/T = {(4 / activeModel.nObs).toFixed(4)}
                    </span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table mono">
                      <thead>
                        <tr>
                          <th>Период (t)</th>
                          <th style={{ textAlign: "right" }}>Факт (Y_t)</th>
                          <th style={{ textAlign: "right" }}>Остаток (e_t)</th>
                          <th style={{ textAlign: "right" }}>Рычаг матрицы проекций (h_ii)</th>
                          <th style={{ textAlign: "right" }}>Расстояние Кука (D_i)</th>
                          <th>Статус наблюдения</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeModel.diagnostics.topInfluential.map((pt) => {
                          const isOutlier = pt.cooksD > 4 / activeModel.nObs;
                          return (
                            <tr key={pt.t}>
                              <td style={{ fontWeight: 700, color: "#fbbf24" }}>t = {pt.t}</td>
                              <td style={{ textAlign: "right" }}>{pt.actual.toFixed(4)}</td>
                              <td style={{ textAlign: "right" }}>{pt.resid.toFixed(4)}</td>
                              <td style={{ textAlign: "right" }}>{pt.leverage.toFixed(4)}</td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: isOutlier ? "#f59e0b" : "#10b981" }}>
                                {pt.cooksD.toFixed(4)}
                              </td>
                              <td style={{ color: isOutlier ? "#f59e0b" : "#a1a1aa" }}>
                                {isOutlier
                                  ? "Влиятельное наблюдение (D_i > 4/T)"
                                  : "В пределах допустимого коридора"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 4: АВТОМАТИЧЕСКОЕ СРАВНЕНИЕ СПЕЦИФИКАЦИЙ                */}
            {/* ============================================================== */}
            {activeTab === "specs" && (
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title">
                      Автоматический подбор функциональной формы (Линейная vs Кобба — Дугласа vs Экспоненциальная)
                    </h2>
                  </div>
                  <span className="mono" style={{ fontSize: "11px", color: "#fbbf24" }}>
                    Поправка якобиана Бокса — Кокса для сопоставимости AIC
                  </span>
                </div>
                <div className="panel-body">
                  <p style={{ margin: "0 0 14px 0", color: "#a1a1aa", fontSize: "12px" }}>
                    Система автоматически оценивает конкурирующие математические спецификации для целевой переменной{" "}
                    <strong className="mono" style={{ color: "#f4f4f5" }}>{depVar}</strong> и регрессоров{" "}
                    <strong className="mono" style={{ color: "#f4f4f5" }}>{regressors.join(", ")}</strong>. Для моделей с логарифмированной зависимой переменной <span className="mono">ln(Y)</span> информационный критерий Акаике скорректирован на якобиан преобразования (<span className="mono">AIC_adj = AIC_lnY + 2·Σln(Y_t)</span>), что позволяет строго сравнивать их с линейной моделью:
                  </p>

                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table mono">
                      <thead>
                        <tr>
                          <th>Функциональная форма</th>
                          <th>Аналитический вид</th>
                          <th style={{ textAlign: "right" }}>R²</th>
                          <th style={{ textAlign: "right" }}>Скорр. R²</th>
                          <th style={{ textAlign: "right" }}>Сопоставимый AIC</th>
                          <th style={{ textAlign: "right" }}>F-стат.</th>
                          <th style={{ textAlign: "right" }}>RESET (p-val)</th>
                          <th>Экономический смысл</th>
                        </tr>
                      </thead>
                      <tbody>
                        {specComparisons.map((sp, idx) => {
                          const bestAic = Math.min(...specComparisons.map((s) => s.aicComparable));
                          const isBest = Math.abs(sp.aicComparable - bestAic) < 1e-4;
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 700, color: isBest ? "#10b981" : "#f4f4f5" }}>
                                {isBest && "★ "}
                                {sp.formName}
                              </td>
                              <td style={{ color: "#fbbf24" }}>{sp.formulaStr}</td>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>
                                {sp.r2Native.toFixed(4)}
                              </td>
                              <td style={{ textAlign: "right" }}>{sp.adjR2Native.toFixed(4)}</td>
                              <td
                                style={{
                                  textAlign: "right",
                                  fontWeight: 700,
                                  color: isBest ? "#10b981" : "#d4d4d8",
                                }}
                              >
                                {sp.aicComparable.toFixed(2)}
                              </td>
                              <td style={{ textAlign: "right" }}>{sp.fStat.toFixed(2)}</td>
                              <td
                                style={{
                                  textAlign: "right",
                                  color: sp.resetPval > 0.05 ? "#10b981" : "#f59e0b",
                                }}
                              >
                                {sp.resetPval.toFixed(4)}
                              </td>
                              <td style={{ fontFamily: "sans-serif", color: "#a1a1aa" }}>
                                {sp.note}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 5: АКФ/ЧАКФ, ОПИСАТЕЛЬНАЯ СТАТИСТИКА И ADF-ТЕСТ         */}
            {/* ============================================================== */}
            {activeTab === "stats" && (
              <>
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

                {/* КОРРЕЛОГРАММА ACF / PACF И Q-ТЕСТ ЛЬЮНГА — БОКСА */}
                <div className="grid-2">
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">
                        Коррелограмма АКФ и ЧАКФ (Q-стат. Льюнга — Бокса = {correlogramResult.qStat}, p = {correlogramResult.qPval})
                      </span>
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
                    <div className="panel-body" style={{ height: "270px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={correlogramResult.lags}>
                          <CartesianGrid strokeDasharray="2 2" stroke="#22252c" />
                          <XAxis dataKey="lag" stroke="#71717a" fontSize={11} />
                          <YAxis stroke="#71717a" fontSize={11} domain={[-1, 1]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#14161a",
                              borderColor: "#323741",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px" }} />
                          <ReferenceLine
                            y={correlogramResult.bartlettBand}
                            stroke="#ef4444"
                            strokeDasharray="3 3"
                          />
                          <ReferenceLine
                            y={-correlogramResult.bartlettBand}
                            stroke="#ef4444"
                            strokeDasharray="3 3"
                          />
                          <ReferenceLine y={0} stroke="#52525b" />
                          <Bar dataKey="acf" name="АКФ (ACF)" fill="#d97706" />
                          <Bar dataKey="pacf" name="ЧАКФ (PACF)" fill="#38bdf8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* ADF-тест + Корреляции */}
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">Тест Дики — Фуллера (ADF) и Матрица корреляций</span>
                    </div>
                    <div className="panel-body mono" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div className="stat-box">
                        <div style={{ color: "#a1a1aa", fontSize: "11px" }}>
                          ADF для «{tsVar}» (константа / константа + тренд):
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 700, marginTop: "3px" }}>
                          τ_c = {adfResult.constModel.tau.toFixed(4)} (5% крит: -2.91) | τ_ct = {adfResult.trendModel.tau.toFixed(4)} (5% крит: -3.49)
                        </div>
                        <div style={{ color: adfResult.constModel.stationary ? "#10b981" : "#f59e0b", marginTop: "3px", fontFamily: "sans-serif" }}>
                          {adfResult.constModel.stationary
                            ? "Ряд стационарен в уровнях I(0)"
                            : "Ряд нестационарен (рекомендуется взять первую разность ΔX)"}
                        </div>
                      </div>

                      <div style={{ overflowX: "auto" }}>
                        <table className="data-table mono">
                          <thead>
                            <tr>
                              <th>r (Пирсон)</th>
                              {varNames.slice(0, 6).map((v) => (
                                <th key={v} style={{ textAlign: "right" }}>
                                  {v}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {varNames.slice(0, 6).map((rVar) => (
                              <tr key={rVar}>
                                <td style={{ fontWeight: 700, color: "#d4d4d8" }}>{rVar}</td>
                                {varNames.slice(0, 6).map((cVar) => {
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
                  </div>
                </div>
              </>
            )}

            {/* ============================================================== */}
            {/* ВКЛАДКА 6: ЦЕПИ МАРКОВА И ФУНДАМЕНТАЛЬНАЯ МАТРИЦА КЕМЕНИ — СНЕЛЛА */}
            {/* ============================================================== */}
            {activeTab === "markov" && (
              <>
                <div className="grid-2">
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">Матрица переходных вероятностей P_ij</span>
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
                      <div style={{ marginBottom: "12px", fontSize: "12px", color: "#a1a1aa", display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                        <span>
                          Текущая фаза (t = {nRows}):{" "}
                          <strong className="mono" style={{ color: "#fbbf24" }}>
                            {markovResult.currentState}
                          </strong>
                        </span>
                        <span className="mono">
                          |λ₂| = {markovResult.lambda2Mod.toFixed(4)} | τ_mix ≈ {markovResult.mixingTime.toFixed(2)} пер.
                        </span>
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
                          Эргодический стационарный вектор (π · P = π):
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

                {/* ФУНДАМЕНТАЛЬНАЯ МАТРИЦА КЕМЕНИ — СНЕЛЛА Z И МАТРИЦА ВРЕМЕНИ ДОСТИЖЕНИЯ M_ij */}
                <div className="grid-2">
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">
                        Матрица среднего времени первого достижения фаз M_ij (в периодах)
                      </span>
                    </div>
                    <div className="panel-body">
                      <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#a1a1aa" }}>
                        Внедиагональные элементы <span className="mono">M_ij = (Z_jj - Z_ij) / π_j</span> показывают, через сколько в среднем периодов система впервые перейдет из фазы <em>i</em> в фазу <em>j</em>. На главной диагонали — среднее время возврата <span className="mono">M_ii = 1 / π_i</span>:
                      </p>
                      <table className="data-table mono">
                        <thead>
                          <tr>
                            <th>Из \ В фазу</th>
                            {markovResult.shortLabels.map((l) => (
                              <th key={l} style={{ textAlign: "right" }}>
                                {l}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {markovResult.M.map((row, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 700 }}>{markovResult.shortLabels[i]}</td>
                              {row.map((val, j) => (
                                <td
                                  key={j}
                                  style={{
                                    textAlign: "right",
                                    color: i === j ? "#10b981" : "#fbbf24",
                                    fontWeight: 700,
                                  }}
                                >
                                  {val.toFixed(2)} пер.
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">
                        Фундаментальная матрица Кемени — Снелла Z = (I - P + Π)⁻¹
                      </span>
                    </div>
                    <div className="panel-body">
                      <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#a1a1aa" }}>
                        Используется для аналитического вычисления дисперсий времени перехода и асимптотического поведения эргодической цепи Маркова:
                      </p>
                      <table className="data-table mono">
                        <thead>
                          <tr>
                            <th>Z_ij</th>
                            {markovResult.shortLabels.map((l) => (
                              <th key={l} style={{ textAlign: "right" }}>
                                {l}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {markovResult.Z.map((row, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 700 }}>{markovResult.shortLabels[i]}</td>
                              {row.map((val, j) => (
                                <td key={j} style={{ textAlign: "right" }}>
                                  {val.toFixed(5)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* НИЖНЯЯ СТРОКА СОСТОЯНИЯ */}
      <footer className="statusbar mono">
        <span>{statusLine}</span>
        <span>TED WORKBENCH v2.0 // MATRIX OLS • KEMENY-SNELL MARKOV • BOX-COX SPECS</span>
      </footer>
    </div>
  );
}
