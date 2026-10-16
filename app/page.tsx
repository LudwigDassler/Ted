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
  Copy,
  Check,
  Plus,
  Trash2,
  Sun,
  Moon,
} from "lucide-react";

// ============================================================================
// 1. МАТЕМАТИЧЕСКОЕ ЯДРО (ТОЧНЫЕ РАСЧЕТЫ МНК, СПЕЦИФИКАЦИЙ, ADF И МАРКОВА)
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

interface SpecComparisonItem {
  formName: string;
  formulaStr: string;
  r2Native: number;
  adjR2Native: number;
  aicComparable: number;
  fStat: number;
  resetPval: number;
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
      note: "Постоянные предельные эффекты ∂Y/∂Xⱼ = βⱼ",
    });
  } catch {}

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
        formName: "Полулогарифмическая (Lin-Log)",
        formulaStr: `${depVar} = β₀ + Σ βⱼ·ln(Xⱼ)`,
        r2Native: mLinLog.metrics.r2,
        adjR2Native: mLinLog.metrics.adjR2,
        aicComparable: mLinLog.metrics.aic,
        fStat: mLinLog.metrics.fStat,
        resetPval: mLinLog.diagnostics.resetPval,
        note: "Рост Xⱼ на 1% меняет Y на 0.01·βⱼ ед.",
      });
    } catch {}
  }

  if (yAllPositive) {
    try {
      const tmpDf: Record<string, (number | null)[]> = { ...df };
      tmpDf["__lnY"] = df[depVar].map((v) => (v !== null && v > 0 ? Math.log(v) : null));
      const mLogLin = estimateOLS(tmpDf, "__lnY", indepVars, true, false, 0);
      const sumLnY = mLogLin.seriesData.reduce((a, pt) => a + pt.actual, 0);
      results.push({
        formName: "Экспоненциальная (Log-Lin)",
        formulaStr: `ln(${depVar}) = β₀ + Σ βⱼ·Xⱼ`,
        r2Native: mLogLin.metrics.r2,
        adjR2Native: mLogLin.metrics.adjR2,
        aicComparable: mLogLin.metrics.aic + 2 * sumLnY,
        fStat: mLogLin.metrics.fStat,
        resetPval: mLogLin.diagnostics.resetPval,
        note: "Рост Xⱼ на 1 ед. меняет Y на (100·βⱼ)%",
      });
    } catch {}
  }

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
      results.push({
        formName: "Степенная Кобба — Дугласа (Log-Log)",
        formulaStr: `ln(${depVar}) = β₀ + Σ βⱼ·ln(Xⱼ)`,
        r2Native: mLogLog.metrics.r2,
        adjR2Native: mLogLog.metrics.adjR2,
        aicComparable: mLogLog.metrics.aic + 2 * sumLnY,
        fStat: mLogLog.metrics.fStat,
        resetPval: mLogLog.diagnostics.resetPval,
        note: "Постоянные эластичности: βⱼ = %ΔY / %ΔXⱼ",
      });
    } catch {}
  }

  return results;
}

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

  return {
    lags: rows,
    qStat: rows[rows.length - 1]?.qStat || 0,
    qPval: rows[rows.length - 1]?.pVal || 1,
    bartlettBand: Number((1.96 / Math.sqrt(T)).toFixed(4)),
  };
}

function computeMarkovChain(series: (number | null)[], steps = 6) {
  const clean = series.filter((v): v is number => v !== null && !isNaN(v));
  const sorted = [...clean].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length / 3)] ?? 0;
  const q2 = sorted[Math.floor((2 * sorted.length) / 3)] ?? 0;

  const shortLabels = ["S₁ (Спад)", "S₂ (Стагнация)", "S₃ (Рост)"];
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
          M[i][j] = 1 / Math.max(pi[i], 1e-4);
        } else {
          M[i][j] = (Z[j][j] - Z[i][j]) / Math.max(pi[j], 1e-4);
        }
      }
    }
  } catch {}

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
// 2. ЭТАЛОННЫЕ НАБОРЫ ДАННЫХ
// ============================================================================

interface CuratedDataset {
  id: string;
  title: string;
  defaultY: string;
  defaultX: string[];
  df: Record<string, (number | null)[]>;
  descriptions: Record<string, string>;
}

function getCuratedDatasets(): CuratedDataset[] {
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
    const Y = Number(
      (1.85 * Math.pow(K, 0.58) * Math.pow(L, 0.44) * Math.pow(RD, 0.15) * (0.97 + ((i * 5) % 9) * 0.008)).toFixed(2)
    );
    cdCapital.push(K);
    cdLabor.push(L);
    cdRD.push(RD);
    cdEnergy.push(E);
    cdOutput.push(Y);
  }

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
      title: "Макроэкономика РФ (2014–2025, T = 48)",
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
        Investment: "Инвестиции в основной капитал (% к ВВП)",
        KeyRate: "Ключевая ставка Банка России (% годовых)",
        Inflation: "Инфляция ИПЦ (%, г/г)",
        Brent_USD: "Нефть марки Brent (USD/баррель)",
        USD_RUB: "Обменный курс доллара США (руб./USD)",
      },
    },
    {
      id: "cobb_douglas",
      title: "Функция Кобба — Дугласа (Отрасли, T = 45)",
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
        Output_Y: "Валовой выпуск продукции Y (млрд руб.)",
        Capital_K: "Основные производственные фонды K (млрд руб.)",
        Labor_L: "Численность занятых L (тыс. чел.)",
        RD_Share: "Интенсивность затрат на НИОКР (%)",
        Energy_E: "Промышленное энергопотребление E (млн кВт·ч)",
      },
    },
    {
      id: "phillips_okun",
      title: "Кривая Филлипса и Закон Оукена (T = 40)",
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
        CPI_Inf: "Инфляция потребительских цен (%)",
        Unemp_Rate: "Уровень безработицы МОТ (%)",
        Wage_Growth: "Темп роста номинальной зарплаты (%)",
        Money_M2: "Прирост денежного агрегата M2 (%)",
        Output_Gap: "Разрыв выпуска ВВП (%)",
      },
    },
  ];
}

// ============================================================================
// 3. ГЛАВНЫЙ КОМПОНЕНТ (EDITORIAL / SCIENTIFIC PRINT DESIGN)
// ============================================================================

export default function TedEditorialNotebook() {
  const curatedList = useMemo(() => getCuratedDatasets(), []);
  const [activeDatasetId, setActiveDatasetId] = useState<string>(curatedList[0].id);
  const [theme, setTheme] = useState<"paper" | "graphite">("paper");

  const [df, setDf] = useState<Record<string, (number | null)[]>>(curatedList[0].df);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(
    curatedList[0].descriptions
  );

  const [selectedVars, setSelectedVars] = useState<string[]>([
    "GDP_Growth",
    "Investment",
    "KeyRate",
  ]);
  const [activeTab, setActiveTab] = useState<
    "regression" | "matrices" | "timeseries" | "markov" | "data"
  >("regression");

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

  const [newColName, setNewColName] = useState<string>("");
  const [newColFormula, setNewColFormula] = useState<string>("");
  const [pasteBuffer, setPasteBuffer] = useState<string>("");
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);

  const [markovVar, setMarkovVar] = useState<string>(curatedList[0].defaultY);
  const [tsVar, setTsVar] = useState<string>(curatedList[0].defaultY);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");

  const varNames = Object.keys(df);
  const nRows = varNames.length > 0 ? df[varNames[0]].length : 0;
  const activeModel = models.find((m) => m.id === activeModelId) || models[models.length - 1];

  const notify = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  };

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
    notify(`Загружен набор: ${found.title}`);
  };

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
        desc: descriptions[name] || "Производный ряд",
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

  const toggleSelectVar = (name: string) => {
    setSelectedVars((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  const deleteVariable = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (varNames.length <= 2) return;
    const nextDf = { ...df };
    delete nextDf[name];
    setDf(nextDf);
    setSelectedVars((prev) => prev.filter((v) => v !== name));
    setRegressors((prev) => prev.filter((v) => v !== name));
    notify(`Удалена переменная ${name}`);
  };

  const applyTransformation = (mode: "log" | "diff" | "lag1" | "pch") => {
    if (selectedVars.length === 0) {
      notify("Сначала отметьте переменные на верхней полке.");
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
        nextDesc[newName] = `Δ${col}`;
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
        nextDesc[newName] = `%Δ${col}`;
      }
      created.push(newName);
    }

    if (created.length > 0) {
      setDf(nextDf);
      setDescriptions(nextDesc);
      notify(`Добавлено: ${created.join(", ")}`);
    }
  };

  const handleCreateByFormula = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newColName.trim().replace(/\s+/g, "_");
    const expr = newColFormula.trim();
    if (!cleanName) return;

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
        [cleanName]: expr ? `= ${expr}` : "Ручной ввод",
      }));
      setNewColName("");
      setNewColFormula("");
      notify(`Создана переменная ${cleanName}`);
    } catch {
      notify("Ошибка в синтаксисе формулы.");
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
      for (const k of Object.keys(prev)) next[k] = [...prev[k], 0];
      return next;
    });
  };

  const deleteObservationRow = (rowIdx: number) => {
    if (nRows <= 5) return;
    setDf((prev) => {
      const next: Record<string, (number | null)[]> = {};
      for (const k of Object.keys(prev)) {
        next[k] = prev[k].filter((_, idx) => idx !== rowIdx);
      }
      return next;
    });
  };

  const handlePasteFromExcel = () => {
    const lines = pasteBuffer
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return;

    const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
    const headers = lines[0]
      .split(sep)
      .map((h, i) => h.trim().replace(/^"|"$/g, "").replace(/\s+/g, "_") || `X_${i + 1}`);

    const newDf: Record<string, (number | null)[]> = {};
    const newDesc: Record<string, string> = {};
    headers.forEach((h) => {
      newDf[h] = [];
      newDesc[h] = "Импорт из Excel";
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
    notify(`Импортировано ${lines.length - 1} наблюдений.`);
  };

  const handleRunOLS = () => {
    const targetX = regressors.filter((x) => x !== depVar);
    if (targetX.length === 0) return;
    try {
      const nextId = models.length + 1;
      const res = estimateOLS(df, depVar, targetX, includeConst, useHC3, nextId);
      setModels((prev) => [...prev, res]);
      setActiveModelId(nextId);
      notify(`Оценена Модель ${nextId} (R² = ${res.metrics.r2.toFixed(4)})`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : String(err));
    }
  };

  const saveModelSeriesToDf = (type: "resid" | "fitted") => {
    if (!activeModel) return;
    const newCol: (number | null)[] = Array(nRows).fill(null);
    for (const pt of activeModel.seriesData) {
      newCol[pt.rowIdx] = type === "resid" ? pt.resid : pt.fitted;
    }
    const colName = type === "resid" ? `uhat_${activeModel.id}` : `yhat_${activeModel.id}`;
    setDf((prev) => ({ ...prev, [colName]: newCol }));
    setDescriptions((prev) => ({
      ...prev,
      [colName]: type === "resid" ? `Остатки Модели ${activeModel.id}` : `Прогноз Модели ${activeModel.id}`,
    }));
    notify(`Ряд ${colName} сохранен в список переменных.`);
  };

  const formattedEquation = useMemo(() => {
    if (!activeModel) return "";
    const parts: string[] = [];
    activeModel.coefficients.forEach((c, idx) => {
      const val = Math.abs(c.beta).toFixed(4);
      const sign = c.beta >= 0 ? (idx === 0 ? "" : " + ") : idx === 0 ? "−" : " − ";
      if (c.name === "const") {
        parts.push(`${sign}${val}`);
      } else {
        parts.push(`${sign}${val} · ${c.name}`);
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
        "\\begin{tabular}{lcccc}\\toprule",
        "Переменная & Коэффициент & Ст. ошибка & $t$-стат. & $p$-value \\\\ \\midrule",
        rows,
        "\\midrule",
        `Наблюдений ($T$) & \\multicolumn{4}{c}{${activeModel.nObs}} \\\\`,
        `$R^2$ / Скорр. $R^2$ & \\multicolumn{4}{c}{${activeModel.metrics.r2.toFixed(4)} / ${activeModel.metrics.adjR2.toFixed(4)}} \\\\`,
        `$F$-статистика & \\multicolumn{4}{c}{${activeModel.metrics.fStat.toFixed(2)} ($p = ${activeModel.metrics.fPval.toExponential(2)}$)} \\\\`,
        "\\bottomrule\\end{tabular}\\end{table}",
      ].join("\n");
      navigator.clipboard.writeText(latex);
      setCopiedType("latex");
    } else {
      const text = [
        `МОДЕЛЬ ${activeModel.id} (МНК, T = ${activeModel.nObs})`,
        `Уравнение: ${formattedEquation}`,
        `R² = ${activeModel.metrics.r2.toFixed(4)} | Adj. R² = ${activeModel.metrics.adjR2.toFixed(4)} | F = ${activeModel.metrics.fStat.toFixed(2)} | DW = ${activeModel.metrics.dw.toFixed(4)}`,
      ].join("\n");
      navigator.clipboard.writeText(text);
      setCopiedType("text");
    }
    setTimeout(() => setCopiedType(null), 2000);
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
        newDesc[h] = `Файл ${file.name}`;
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
      if (numericHeaders.length === 0) return;

      const filteredDf: Record<string, (number | null)[]> = {};
      numericHeaders.forEach((h) => (filteredDf[h] = newDf[h]));

      setDf(filteredDf);
      setDescriptions(newDesc);
      setSelectedVars(numericHeaders.slice(0, 3));
      setDepVar(numericHeaders[0]);
      setRegressors(numericHeaders.slice(1, 4));
      setMarkovVar(numericHeaders[0]);
      setTsVar(numericHeaders[0]);
      notify(`Загружен ${file.name} (T = ${lines.length - 1})`);
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
    a.download = "ted_dataset.csv";
    a.click();
  };

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

  const isPaper = theme === "paper";
  const chartColors = {
    grid: isPaper ? "#E6E2D8" : "#262626",
    axis: isPaper ? "#57534E" : "#8E8E93",
    actual: isPaper ? "#1E3A5F" : "#60A5FA",
    fitted: isPaper ? "#991B1B" : "#F87171",
    accent: isPaper ? "#166534" : "#34D399",
    tooltipBg: isPaper ? "#FDFBF7" : "#1C1C1E",
    tooltipBorder: isPaper ? "#D6D1C7" : "#3A3A3C",
  };

  return (
    <div className={`notebook-root ${isPaper ? "theme-paper" : "theme-graphite"}`}>
      {/* АКАДЕМИЧЕСКАЯ ГАЗЕТНО-ЖУРНАЛЬНАЯ ВЕРСТКА (BOOKTABS & SERIF MATH) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        * { box-sizing: border-box; }
        .theme-paper {
          --bg-canvas: #F4F1EA;
          --bg-sheet: #FCFBF9;
          --bg-subtle: #EFECE4;
          --ink: #18181B;
          --ink-muted: #656059;
          --rule-light: #DFDBD0;
          --rule-heavy: #18181B;
          --accent: #1E3A5F;
          --accent-soft: rgba(30, 58, 95, 0.08);
          --crimson: #991B1B;
          --forest: #166534;
        }
        .theme-graphite {
          --bg-canvas: #0F0F10;
          --bg-sheet: #171719;
          --bg-subtle: #202023;
          --ink: #EDEDEF;
          --ink-muted: #8E8E95;
          --rule-light: #2A2A2E;
          --rule-heavy: #A1A1AA;
          --accent: #60A5FA;
          --accent-soft: rgba(96, 165, 250, 0.12);
          --crimson: #F87171;
          --forest: #34D399;
        }
        body, html {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
          font-size: 14px;
          line-height: 1.55;
          -webkit-font-smoothing: antialiased;
        }
        .notebook-root {
          min-height: 100vh;
          background-color: var(--bg-canvas);
          color: var(--ink);
          padding-bottom: 60px;
          transition: background-color 0.2s, color 0.2s;
        }
        .serif-math {
          font-family: "Georgia", "Times New Roman", "Cambria", serif;
        }
        .num {
          font-family: "JetBrains Mono", "Consolas", "SF Mono", monospace;
          font-variant-numeric: tabular-nums;
          font-size: 13px;
        }
        /* Контейнер печатного листа */
        .page-container {
          max-width: 1220px;
          margin: 0 auto;
          padding: 0 28px;
        }
        /* Минималистичная шапка в духе научного издания */
        .editorial-header {
          border-bottom: 2px solid var(--rule-heavy);
          padding: 22px 0 16px 0;
          margin-bottom: 20px;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
        }
        .journal-title {
          font-family: "Georgia", "Times New Roman", serif;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
          color: var(--ink);
        }
        .journal-sub {
          font-size: 13px;
          color: var(--ink-muted);
          margin-left: 14px;
          font-weight: 400;
        }
        /* Кнопки без лишнего шума */
        .ui-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 13px;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--ink);
          background: var(--bg-sheet);
          border: 1px solid var(--rule-light);
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .ui-btn:hover {
          border-color: var(--ink);
        }
        .ui-btn-primary {
          background: var(--accent);
          color: #FFFFFF;
          border-color: var(--accent);
          font-weight: 600;
        }
        .theme-graphite .ui-btn-primary {
          color: #09090B;
        }
        .ui-btn-primary:hover {
          opacity: 0.92;
        }
        .ui-select {
          padding: 6px 12px;
          font-size: 13px;
          color: var(--ink);
          background: var(--bg-sheet);
          border: 1px solid var(--rule-light);
          border-radius: 3px;
          outline: none;
        }
        .ui-select:focus {
          border-color: var(--accent);
        }
        /* Горизонтальная полка переменных (вместо тесного сайдбара) */
        .var-shelf {
          background: var(--bg-sheet);
          border: 1px solid var(--rule-light);
          padding: 14px 18px;
          margin-bottom: 24px;
        }
        .var-shelf-top {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--rule-light);
          margin-bottom: 12px;
        }
        .var-pills-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .var-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 11px;
          font-size: 12.5px;
          border: 1px solid var(--rule-light);
          background: var(--bg-canvas);
          color: var(--ink);
          cursor: pointer;
          user-select: none;
          transition: all 0.12s;
        }
        .var-pill.active {
          border-color: var(--accent);
          background: var(--accent-soft);
          font-weight: 600;
        }
        /* Чистая навигация по разделам */
        .section-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 28px;
          border-bottom: 1px solid var(--rule-light);
          margin-bottom: 28px;
        }
        .sec-tab {
          padding: 10px 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-muted);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: color 0.15s;
        }
        .sec-tab:hover {
          color: var(--ink);
        }
        .sec-tab.active {
          color: var(--ink);
          font-weight: 700;
          border-bottom-color: var(--ink);
        }
        /* Лист отчета (Paper Sheet) */
        .paper-sheet {
          background: var(--bg-sheet);
          border: 1px solid var(--rule-light);
          padding: 28px 32px;
          margin-bottom: 28px;
        }
        .sheet-heading {
          font-family: "Georgia", "Times New Roman", serif;
          font-size: 19px;
          font-weight: 700;
          margin: 0 0 6px 0;
          color: var(--ink);
        }
        .sheet-desc {
          font-size: 13px;
          color: var(--ink-muted);
          margin: 0 0 20px 0;
        }
        /* Академические таблицы LaTeX booktabs (без вертикальных линий и рамок) */
        .booktabs {
          width: 100%;
          border-collapse: collapse;
          border-top: 2px solid var(--rule-heavy);
          border-bottom: 2px solid var(--rule-heavy);
          margin: 14px 0;
        }
        .booktabs th {
          font-family: "Georgia", "Times New Roman", serif;
          font-weight: 700;
          font-size: 13px;
          color: var(--ink);
          text-align: left;
          padding: 9px 12px;
          border-bottom: 1px solid var(--rule-heavy);
          white-space: nowrap;
        }
        .booktabs td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--rule-light);
          color: var(--ink);
        }
        .booktabs tr:last-child td {
          border-bottom: none;
        }
        .booktabs tr:hover td {
          background: var(--accent-soft);
        }
        /* Блок математической формулы (как в Wolfram / LaTeX equation) */
        .math-display {
          font-family: "Georgia", "Times New Roman", serif;
          font-size: 17px;
          padding: 16px 22px;
          background: var(--bg-subtle);
          border-left: 3px solid var(--accent);
          margin: 16px 0 22px 0;
          overflow-x: auto;
        }
        .two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
        }
        .four-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          padding: 16px 0;
          border-top: 1px solid var(--rule-light);
          border-bottom: 1px solid var(--rule-light);
          margin: 20px 0;
        }
        @media (max-width: 920px) {
          .two-columns, .four-metrics { grid-template-columns: 1fr; }
          .paper-sheet { padding: 18px; }
        }
        .cell-edit {
          width: 100%;
          min-width: 72px;
          text-align: right;
          background: transparent;
          border: 1px solid transparent;
          color: var(--ink);
          padding: 3px 6px;
          font-family: "JetBrains Mono", monospace;
          font-size: 13px;
        }
        .cell-edit:focus {
          outline: none;
          border-color: var(--accent);
          background: var(--bg-canvas);
        }
      `,
        }}
      />

      <div className="page-container">
        {/* ШАПКА ИЗДАНИЯ */}
        <header className="editorial-header">
          <div>
            <h1 className="journal-title">
              TED
              <span className="journal-sub">
                Аналитическая система эконометрических исследований (T = {nRows}, K = {varNames.length})
              </span>
            </h1>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
            <select
              value={activeDatasetId}
              onChange={(e) => handleSelectCuratedDataset(e.target.value)}
              className="ui-select"
              title="Выбор эталонного набора данных"
            >
              {curatedList.map((d) => (
                <option key={d.id} value={d.id}>
                  Набор: {d.title}
                </option>
              ))}
            </select>

            <button onClick={() => setShowPasteModal(true)} className="ui-btn">
              <Plus size={14} /> Вставить из Excel
            </button>
            <label className="ui-btn">
              <Upload size={14} /> CSV
              <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: "none" }} />
            </label>
            <button onClick={exportToCSV} className="ui-btn">
              <Download size={14} /> Скачать
            </button>

            <button
              onClick={() => setTheme(isPaper ? "graphite" : "paper")}
              className="ui-btn"
              title="Переключить оформление: Бумага / Графит"
            >
              {isPaper ? <Moon size={14} /> : <Sun size={14} />}
              <span>{isPaper ? "Графит" : "Бумага"}</span>
            </button>
          </div>
        </header>

        {/* КОМПАКТНАЯ ПОЛКА ПЕРЕМЕННЫХ (ВМЕСТО ГРОМОЗДКОГО ЛЕВОГО САЙДБАРА) */}
        <section className="var-shelf">
          <div className="var-shelf-top">
            <div style={{ fontSize: "12.5px", color: "var(--ink-muted)" }}>
              <strong style={{ color: "var(--ink)" }}>Рабочие переменные ({varNames.length}):</strong>{" "}
              кликните для выделения, затем примените оператор преобразования
              {notice && (
                <span style={{ marginLeft: "14px", color: "var(--forest)", fontWeight: 600 }}>
                  — {notice}
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button onClick={() => applyTransformation("log")} className="ui-btn serif-math">
                + <i>ln</i>(<i>X</i>)
              </button>
              <button onClick={() => applyTransformation("diff")} className="ui-btn serif-math">
                + Δ<i>X</i>
              </button>
              <button onClick={() => applyTransformation("lag1")} className="ui-btn serif-math">
                + <i>X</i><sub>t−1</sub>
              </button>
              <button onClick={() => applyTransformation("pch")} className="ui-btn serif-math">
                + %Δ<i>X</i>
              </button>
            </div>
          </div>

          <div className="var-pills-wrap">
            {varStats.map((v) => {
              const isSel = selectedVars.includes(v.name);
              return (
                <div
                  key={v.name}
                  onClick={() => toggleSelectVar(v.name)}
                  className={`var-pill ${isSel ? "active" : ""}`}
                  title={v.desc}
                >
                  <span>{v.name}</span>
                  <span className="num" style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}>
                    μ={v.mean.toFixed(1)}
                  </span>
                  {varNames.length > 2 && (
                    <span
                      onClick={(e) => deleteVariable(v.name, e)}
                      style={{ color: "var(--ink-muted)", fontSize: "11px", marginLeft: "2px" }}
                      title="Удалить переменную"
                    >
                      ×
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ЧИСТАЯ НАВИГАЦИЯ ПО РАЗДЕЛАМ */}
        <nav className="section-tabs">
          {[
            { id: "regression", label: "I. Регрессионный анализ и Спецификации" },
            { id: "matrices", label: "II. Пошаговые матричные выкладки" },
            { id: "timeseries", label: "III. Стационарность (ADF) и Коррелограмма" },
            { id: "markov", label: "IV. Цепи Маркова (Кемени — Снелл)" },
            { id: "data", label: "V. Таблица данных и Формулы" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`sec-tab ${activeTab === t.id ? "active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* ================================================================== */}
        {/* РАЗДЕЛ I: РЕГРЕССИОННЫЙ АНАЛИЗ И СРАВНЕНИЕ СПЕЦИФИКАЦИЙ             */}
        {/* ================================================================== */}
        {activeTab === "regression" && activeModel && (
          <>
            {/* Панель постановки задачи */}
            <div className="paper-sheet">
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "18px" }}>
                <div>
                  <h2 className="sheet-heading">Постановка линейной регрессионной модели</h2>
                  <p className="sheet-desc" style={{ marginBottom: 0 }}>
                    Выберите объясняемую переменную <i>Y</i> и множество регрессоров <i>X</i>
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                  <label style={{ fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="checkbox"
                      checked={includeConst}
                      onChange={(e) => setIncludeConst(e.target.checked)}
                    />
                    Свободный член (<i>β</i><sub>0</sub>)
                  </label>
                  <label style={{ fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="checkbox"
                      checked={useHC3}
                      onChange={(e) => setUseHC3(e.target.checked)}
                    />
                    Робастные ошибки Уайта (HC<sub>3</sub>)
                  </label>
                  <button onClick={handleRunOLS} className="ui-btn ui-btn-primary">
                    Оценить методом наименьших квадратов
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "24px", alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)", marginBottom: "6px" }}>
                    Зависимая переменная (<i>Y</i>):
                  </div>
                  <select
                    value={depVar}
                    onChange={(e) => setDepVar(e.target.value)}
                    className="ui-select"
                    style={{ width: "100%", fontWeight: 600 }}
                  >
                    {varNames.map((v) => (
                      <option key={v} value={v}>
                        {v} — {descriptions[v] || ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)", marginBottom: "6px" }}>
                    Регрессоры (<i>X</i>):
                  </div>
                  <div className="var-pills-wrap">
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
                            className={`var-pill ${isAct ? "active" : ""}`}
                          >
                            {isAct ? "✓ " : "+ "}
                            {v}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* Протокол оцененной модели в стиле журнальной публикации */}
            <div className="paper-sheet">
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
                <div>
                  <h2 className="sheet-heading">
                    Таблица 1. Оценка параметров модели #{activeModel.id} (зависимая переменная: {activeModel.depVar})
                  </h2>
                  <p className="sheet-desc" style={{ marginBottom: 0 }}>
                    Метод наименьших квадратов, объем выборки <i>T</i> = {activeModel.nObs}, степеней свободы <i>df</i> = {activeModel.dfResid}
                    {activeModel.useHC3 ? " (робастная ковариационная матрица Уайта HC₃)" : ""}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button onClick={() => saveModelSeriesToDf("resid")} className="ui-btn">
                    Сохранить остатки <i>û</i>
                  </button>
                  <button onClick={() => saveModelSeriesToDf("fitted")} className="ui-btn">
                    Сохранить прогноз <i>Ŷ</i>
                  </button>
                  <button onClick={() => copyModelOutput("latex")} className="ui-btn">
                    {copiedType === "latex" ? <Check size={14} /> : <Copy size={14} />}
                    Код таблицы LaTeX
                  </button>
                </div>
              </div>

              {/* Аналитическая запись уравнения */}
              <div className="math-display">
                <i>Ŷ</i> : &nbsp; {formattedEquation}
              </div>

              {/* Таблица в стандарте LaTeX booktabs */}
              <div style={{ overflowX: "auto" }}>
                <table className="booktabs">
                  <thead>
                    <tr>
                      <th>Фактор (Регрессор)</th>
                      <th style={{ textAlign: "right" }}>Оценка <i>β̂</i></th>
                      <th style={{ textAlign: "right" }}>Ст. ошибка <i>SE</i></th>
                      <th style={{ textAlign: "right" }}><i>t</i>-статистика</th>
                      <th style={{ textAlign: "right" }}><i>p</i>-value</th>
                      <th style={{ textAlign: "right" }}>95% Доверительный интервал</th>
                      <th style={{ textAlign: "right" }}>Ст. коэфф. <i>β*</i></th>
                      <th style={{ textAlign: "right" }}>Эластичность <i>E</i></th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {activeModel.coefficients.map((c) => (
                      <tr key={c.name}>
                        <td style={{ fontFamily: "inherit", fontWeight: 600 }}>
                          {c.name === "const" ? "Константа (β₀)" : c.name}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {c.beta.toFixed(5)}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--ink-muted)" }}>
                          ({c.se.toFixed(5)})
                        </td>
                        <td style={{ textAlign: "right" }}>{c.tStat.toFixed(4)}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: c.pValue < 0.05 ? 700 : 400,
                            color: c.pValue < 0.05 ? "var(--forest)" : "var(--ink-muted)",
                          }}
                        >
                          {c.pValue < 0.0001 ? c.pValue.toExponential(2) : c.pValue.toFixed(4)}{" "}
                          <span style={{ color: "var(--crimson)" }}>{c.stars}</span>
                        </td>
                        <td style={{ textAlign: "right", color: "var(--ink-muted)" }}>
                          [{c.ciLow.toFixed(4)}; {c.ciHigh.toFixed(4)}]
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {c.stdBeta !== null ? c.stdBeta.toFixed(4) : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {c.elasticity !== null ? `${c.elasticity.toFixed(3)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                Примечание: *** значимость на уровне 1% (<i>p</i> &lt; 0.01), ** на уровне 5% (<i>p</i> &lt; 0.05), * на уровне 10% (<i>p</i> &lt; 0.10). В скобках указаны стандартные ошибки.
              </div>

              {/* Спокойная сводка ключевых метрик без тяжелых рамок */}
              <div className="four-metrics">
                <div>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                    Коэффициент детерминации <i>R</i>² (Скорр. <i>R</i>²)
                  </div>
                  <div className="num" style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                    {activeModel.metrics.r2.toFixed(4)}{" "}
                    <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--ink-muted)" }}>
                      ({activeModel.metrics.adjR2.toFixed(4)})
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                    Критерий Фишера <i>F</i>({activeModel.dfModel}, {activeModel.dfResid}) [крит. = {activeModel.metrics.fCrit95.toFixed(2)}]
                  </div>
                  <div className="num" style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                    {activeModel.metrics.fStat.toFixed(2)}{" "}
                    <span style={{ fontSize: "13px", color: "var(--forest)" }}>
                      (p = {activeModel.metrics.fPval.toExponential(2)})
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                    Статистика Дарбина — Уотсона <i>DW</i> / Ст. ошибка <i>SE</i>
                  </div>
                  <div className="num" style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                    {activeModel.metrics.dw.toFixed(4)}{" "}
                    <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--ink-muted)" }}>
                      / ±{activeModel.metrics.seReg.toFixed(3)}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                    Информационные критерии <i>AIC</i> / <i>BIC</i>
                  </div>
                  <div className="num" style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                    {activeModel.metrics.aic.toFixed(2)} / {activeModel.metrics.bic.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Диагностические тесты в единой академической таблице */}
              <h3 className="serif-math" style={{ fontSize: "16px", margin: "24px 0 8px 0" }}>
                Таблица 2. Диагностика предпосылок теоремы Гаусса — Маркова
              </h3>
              <table className="booktabs">
                <thead>
                  <tr>
                    <th>Диагностический тест</th>
                    <th>Проверяемая нулевая гипотеза <i>H</i>₀</th>
                    <th style={{ textAlign: "right" }}>Статистика</th>
                    <th style={{ textAlign: "right" }}><i>p</i>-value</th>
                    <th>Заключение (при <i>α</i> = 0.05)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Тест Бреуша — Пагана</td>
                    <td>Гомоскедастичность остатков (Var(<i>u<sub>t</sub></i>) = σ²)</td>
                    <td className="num" style={{ textAlign: "right" }}>LM = {activeModel.diagnostics.bpLM.toFixed(4)}</td>
                    <td className="num" style={{ textAlign: "right" }}>{activeModel.diagnostics.bpPval.toFixed(4)}</td>
                    <td style={{ color: activeModel.diagnostics.bpPval > 0.05 ? "var(--forest)" : "var(--crimson)" }}>
                      {activeModel.diagnostics.bpPval > 0.05 ? "Условие выполнено (гомоскедастичность)" : "Гетероскедастичность (включите HC₃)"}
                    </td>
                  </tr>
                  <tr>
                    <td>Тест Рамсея (RESET)</td>
                    <td>Линейная функциональная форма адекватна</td>
                    <td className="num" style={{ textAlign: "right" }}>F = {activeModel.diagnostics.resetF.toFixed(4)}</td>
                    <td className="num" style={{ textAlign: "right" }}>{activeModel.diagnostics.resetPval.toFixed(4)}</td>
                    <td style={{ color: activeModel.diagnostics.resetPval > 0.05 ? "var(--forest)" : "var(--crimson)" }}>
                      {activeModel.diagnostics.resetPval > 0.05 ? "Спецификация корректна" : "Пропущены нелинейные члены"}
                    </td>
                  </tr>
                  <tr>
                    <td>Тест Жарка — Бера</td>
                    <td>Нормальный закон распределения остатков <i>u<sub>t</sub></i> ~ N(0, σ²)</td>
                    <td className="num" style={{ textAlign: "right" }}>JB = {activeModel.diagnostics.jbStat.toFixed(4)}</td>
                    <td className="num" style={{ textAlign: "right" }}>{activeModel.diagnostics.jbPval.toFixed(4)}</td>
                    <td style={{ color: activeModel.diagnostics.jbPval > 0.05 ? "var(--forest)" : "var(--crimson)" }}>
                      {activeModel.diagnostics.jbPval > 0.05 ? "Остатки распределены нормально" : "Отклонение от нормальности"}
                    </td>
                  </tr>
                  <tr>
                    <td>Факторы инфляции дисперсии (VIF)</td>
                    <td>Отсутствие мультиколлинеарности (VIF &lt; 10)</td>
                    <td className="num" style={{ textAlign: "right" }} colSpan={2}>
                      {activeModel.diagnostics.vif.map((v) => `${v.name}: ${v.value.toFixed(2)}`).join(" | ")}
                    </td>
                    <td style={{ color: "var(--forest)" }}>
                      {activeModel.diagnostics.vif.every((v) => v.value < 10)
                        ? "Мультиколлинеарность отсутствует"
                        : "Высокая коллинеарность регрессоров"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Графики на чистом листе */}
              <div className="two-columns" style={{ marginTop: "28px" }}>
                <div>
                  <h4 className="serif-math" style={{ margin: "0 0 10px 0", fontSize: "15px" }}>
                    Рис. 1. Фактическая траектория ({activeModel.depVar}) и аппроксимация МНК (<i>Ŷ<sub>t</sub></i>)
                  </h4>
                  <div style={{ height: "270px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activeModel.seriesData}>
                        <CartesianGrid strokeDasharray="2 2" stroke={chartColors.grid} />
                        <XAxis dataKey="t" stroke={chartColors.axis} fontSize={11} />
                        <YAxis stroke={chartColors.axis} fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: chartColors.tooltipBg,
                            borderColor: chartColors.tooltipBorder,
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          name={`Факт (${activeModel.depVar})`}
                          stroke={chartColors.actual}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="fitted"
                          name="Модель МНК (Ŷ)"
                          stroke={chartColors.fitted}
                          strokeWidth={2}
                          strokeDasharray="5 4"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h4 className="serif-math" style={{ margin: "0 0 10px 0", fontSize: "15px" }}>
                    Рис. 2. Квантиль-квантильный график нормальности остатков (Normal Q-Q Plot)
                  </h4>
                  <div style={{ height: "270px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="2 2" stroke={chartColors.grid} />
                        <XAxis
                          type="number"
                          dataKey="theo"
                          name="Теор. квантиль N(0,1)"
                          stroke={chartColors.axis}
                          fontSize={11}
                          domain={[-2.5, 2.5]}
                        />
                        <YAxis
                          type="number"
                          dataKey="emp"
                          name="Стандартиз. остаток"
                          stroke={chartColors.axis}
                          fontSize={11}
                          domain={[-2.5, 2.5]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: chartColors.tooltipBg,
                            borderColor: chartColors.tooltipBorder,
                            fontSize: "12px",
                          }}
                        />
                        <ReferenceLine
                          segment={[
                            { x: -2.4, y: -2.4 },
                            { x: 2.4, y: 2.4 },
                          ]}
                          stroke={chartColors.fitted}
                          strokeDasharray="4 4"
                        />
                        <Scatter name="Квантили остатков" data={activeModel.qqData} fill={chartColors.actual} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Автоматическое сравнение функциональных форм */}
            <div className="paper-sheet">
              <h2 className="sheet-heading">
                Таблица 3. Сравнение альтернативных функциональных спецификаций (Бокса — Кокса)
              </h2>
              <p className="sheet-desc">
                Для моделей с логарифмированной зависимой переменной <i>ln</i>(<i>Y</i>) критерий Акаике скорректирован на якобиан преобразования (<i>AIC</i><sub>adj</sub> = <i>AIC</i><sub>lnY</sub> + 2·Σ<i>ln</i>(<i>Y<sub>t</sub></i>)) для строгой сопоставимости с линейной моделью
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="booktabs">
                  <thead>
                    <tr>
                      <th>Спецификация модели</th>
                      <th>Аналитическая форма</th>
                      <th style={{ textAlign: "right" }}><i>R</i>²</th>
                      <th style={{ textAlign: "right" }}>Скорр. <i>R</i>²</th>
                      <th style={{ textAlign: "right" }}>Сопоставимый <i>AIC</i></th>
                      <th style={{ textAlign: "right" }}><i>F</i>-стат.</th>
                      <th style={{ textAlign: "right" }}>RESET (<i>p</i>)</th>
                      <th>Интерпретация коэффициентов</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specComparisons.map((sp, idx) => {
                      const bestAic = Math.min(...specComparisons.map((s) => s.aicComparable));
                      const isBest = Math.abs(sp.aicComparable - bestAic) < 1e-4;
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: isBest ? 700 : 500, color: isBest ? "var(--forest)" : "var(--ink)" }}>
                            {isBest ? "★ " : ""}
                            {sp.formName}
                          </td>
                          <td className="serif-math">{sp.formulaStr}</td>
                          <td className="num" style={{ textAlign: "right" }}>{sp.r2Native.toFixed(4)}</td>
                          <td className="num" style={{ textAlign: "right" }}>{sp.adjR2Native.toFixed(4)}</td>
                          <td className="num" style={{ textAlign: "right", fontWeight: isBest ? 700 : 400 }}>
                            {sp.aicComparable.toFixed(2)}
                          </td>
                          <td className="num" style={{ textAlign: "right" }}>{sp.fStat.toFixed(2)}</td>
                          <td className="num" style={{ textAlign: "right" }}>{sp.resetPval.toFixed(4)}</td>
                          <td style={{ fontSize: "12.5px", color: "var(--ink-muted)" }}>{sp.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ================================================================== */}
        {/* РАЗДЕЛ II: ПОШАГОВЫЕ МАТРИЧНЫЕ ВЫКЛАДКИ                             */}
        {/* ================================================================== */}
        {activeTab === "matrices" && activeModel && (
          <div className="paper-sheet">
            <h2 className="sheet-heading">
              Матричное разложение метода наименьших квадратов: β̂ = (X&apos;X)⁻¹ · X&apos;Y
            </h2>
            <p className="sheet-desc">
              Промежуточные матрицы системы нормальных уравнений Гаусса для Модели #{activeModel.id} (размерность матрицы плана <i>X</i>: {activeModel.nObs} × {activeModel.colNames.length})
            </p>

            <h3 className="serif-math" style={{ fontSize: "16px", marginTop: "20px" }}>
              1. Матрица Грамма (X&apos;X) и вектор правой части (X&apos;Y)
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table className="booktabs num">
                <thead>
                  <tr>
                    <th>Строка \ Столбец</th>
                    {activeModel.colNames.map((c) => (
                      <th key={c} style={{ textAlign: "right" }}>{c}</th>
                    ))}
                    <th style={{ textAlign: "right" }}>Вектор X&apos;Y</th>
                  </tr>
                </thead>
                <tbody>
                  {activeModel.matrices.XTX.map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td style={{ fontWeight: 600 }}>{activeModel.colNames[rIdx]}</td>
                      {row.map((val, cIdx) => (
                        <td key={cIdx} style={{ textAlign: "right" }}>{val.toFixed(2)}</td>
                      ))}
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {activeModel.matrices.XTY[rIdx].toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="two-columns" style={{ marginTop: "24px" }}>
              <div style={{ overflowX: "auto" }}>
                <h3 className="serif-math" style={{ fontSize: "16px" }}>
                  2. Обратная матрица (X&apos;X)⁻¹
                </h3>
                <table className="booktabs num">
                  <thead>
                    <tr>
                      <th>(X&apos;X)⁻¹</th>
                      {activeModel.colNames.map((c) => (
                        <th key={c} style={{ textAlign: "right" }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeModel.matrices.XTX_inv.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ fontWeight: 600 }}>{activeModel.colNames[rIdx]}</td>
                        {row.map((val, cIdx) => (
                          <td key={cIdx} style={{ textAlign: "right" }}>{val.toExponential(3)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ overflowX: "auto" }}>
                <h3 className="serif-math" style={{ fontSize: "16px" }}>
                  3. Ковариационная матрица оценок Cov(β̂)
                </h3>
                <table className="booktabs num">
                  <thead>
                    <tr>
                      <th>Cov(β̂)</th>
                      {activeModel.colNames.map((c) => (
                        <th key={c} style={{ textAlign: "right" }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeModel.matrices.covBeta.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ fontWeight: 600 }}>{activeModel.colNames[rIdx]}</td>
                        {row.map((val, cIdx) => (
                          <td
                            key={cIdx}
                            style={{
                              textAlign: "right",
                              fontWeight: rIdx === cIdx ? 700 : 400,
                              color: rIdx === cIdx ? "var(--forest)" : "var(--ink)",
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

            <h3 className="serif-math" style={{ fontSize: "16px", marginTop: "24px" }}>
              4. Диагностика влиятельных наблюдений (Рычаги проекционной матрицы <i>h<sub>ii</sub></i> и расстояние Кука <i>D<sub>i</sub></i>)
            </h3>
            <table className="booktabs num">
              <thead>
                <tr>
                  <th>Наблюдение (<i>t</i>)</th>
                  <th style={{ textAlign: "right" }}>Факт (<i>Y<sub>t</sub></i>)</th>
                  <th style={{ textAlign: "right" }}>Остаток (<i>e<sub>t</sub></i>)</th>
                  <th style={{ textAlign: "right" }}>Рычаг <i>h<sub>ii</sub></i></th>
                  <th style={{ textAlign: "right" }}>Расстояние Кука <i>D<sub>i</sub></i></th>
                  <th>Оценка влияния (порог 4/<i>T</i> = {(4 / activeModel.nObs).toFixed(4)})</th>
                </tr>
              </thead>
              <tbody>
                {activeModel.diagnostics.topInfluential.map((pt) => {
                  const high = pt.cooksD > 4 / activeModel.nObs;
                  return (
                    <tr key={pt.t}>
                      <td style={{ fontWeight: 600 }}>t = {pt.t}</td>
                      <td style={{ textAlign: "right" }}>{pt.actual.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }}>{pt.resid.toFixed(4)}</td>
                      <td style={{ textAlign: "right" }}>{pt.leverage.toFixed(4)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{pt.cooksD.toFixed(4)}</td>
                      <td style={{ fontFamily: "sans-serif", color: high ? "var(--crimson)" : "var(--forest)" }}>
                        {high ? "Влиятельный выброс (D_i > 4/T)" : "В пределах нормы"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ================================================================== */}
        {/* РАЗДЕЛ III: СТАЦИОНАРНОСТЬ, АКФ/ЧАКФ И ОПИСАТЕЛЬНАЯ СТАТИСТИКА      */}
        {/* ================================================================== */}
        {activeTab === "timeseries" && (
          <>
            <div className="paper-sheet">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h2 className="sheet-heading">
                    Анализ временного ряда: тест Дики — Фуллера (ADF) и Коррелограмма
                  </h2>
                  <p className="sheet-desc" style={{ marginBottom: 0 }}>
                    Проверка на наличие единичного корня и автокорреляционная структура (критерий Льюнга — Бокса <i>Q</i> = {correlogramResult.qStat}, <i>p</i> = {correlogramResult.qPval})
                  </p>
                </div>
                <select
                  value={tsVar}
                  onChange={(e) => setTsVar(e.target.value)}
                  className="ui-select"
                >
                  {varNames.map((v) => (
                    <option key={v} value={v}>Исследуемый ряд: {v}</option>
                  ))}
                </select>
              </div>

              <table className="booktabs" style={{ marginTop: "18px" }}>
                <thead>
                  <tr>
                    <th>Спецификация уравнения Дики — Фуллера</th>
                    <th style={{ textAlign: "right" }}>Расчетная <i>τ</i>-статистика</th>
                    <th style={{ textAlign: "right" }}>Критическое значение (5%)</th>
                    <th style={{ textAlign: "right" }}>Критическое значение (1%)</th>
                    <th>Заключение о стационарности ряда</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>С константой (<i>ΔY<sub>t</sub> = α + γY<sub>t−1</sub> + ε<sub>t</sub></i>)</td>
                    <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{adfResult.constModel.tau.toFixed(4)}</td>
                    <td className="num" style={{ textAlign: "right" }}>{adfResult.constModel.crit5}</td>
                    <td className="num" style={{ textAlign: "right" }}>{adfResult.constModel.crit1}</td>
                    <td style={{ color: adfResult.constModel.stationary ? "var(--forest)" : "var(--crimson)" }}>
                      {adfResult.constModel.stationary ? "Ряд стационарен I(0)" : "Ряд нестационарен (единичный корень)"}
                    </td>
                  </tr>
                  <tr>
                    <td>С константой и трендом (<i>ΔY<sub>t</sub> = α + βt + γY<sub>t−1</sub> + ε<sub>t</sub></i>)</td>
                    <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{adfResult.trendModel.tau.toFixed(4)}</td>
                    <td className="num" style={{ textAlign: "right" }}>{adfResult.trendModel.crit5}</td>
                    <td className="num" style={{ textAlign: "right" }}>{adfResult.trendModel.crit1}</td>
                    <td style={{ color: adfResult.trendModel.stationary ? "var(--forest)" : "var(--crimson)" }}>
                      {adfResult.trendModel.stationary ? "Стационарен относительно тренда" : "Нестационарен (требуется взятие разности ΔX)"}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="two-columns" style={{ marginTop: "24px" }}>
                <div>
                  <h4 className="serif-math" style={{ margin: "0 0 10px 0", fontSize: "15px" }}>
                    Рис. 3. Автокорреляционная (ACF) и частная автокорреляционная (PACF) функции
                  </h4>
                  <div style={{ height: "260px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={correlogramResult.lags}>
                        <CartesianGrid strokeDasharray="2 2" stroke={chartColors.grid} />
                        <XAxis dataKey="lag" stroke={chartColors.axis} fontSize={11} />
                        <YAxis stroke={chartColors.axis} fontSize={11} domain={[-1, 1]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: chartColors.tooltipBg,
                            borderColor: chartColors.tooltipBorder,
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <ReferenceLine y={correlogramResult.bartlettBand} stroke={chartColors.fitted} strokeDasharray="3 3" />
                        <ReferenceLine y={-correlogramResult.bartlettBand} stroke={chartColors.fitted} strokeDasharray="3 3" />
                        <ReferenceLine y={0} stroke={chartColors.axis} />
                        <Bar dataKey="acf" name="АКФ (ACF)" fill={chartColors.actual} />
                        <Bar dataKey="pacf" name="ЧАКФ (PACF)" fill={chartColors.fitted} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h4 className="serif-math" style={{ margin: "0 0 10px 0", fontSize: "15px" }}>
                    Матрица парных корреляций Пирсона
                  </h4>
                  <div style={{ overflowX: "auto" }}>
                    <table className="booktabs num">
                      <thead>
                        <tr>
                          <th>Переменная</th>
                          {varNames.slice(0, 6).map((v) => (
                            <th key={v} style={{ textAlign: "right" }}>{v}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {varNames.slice(0, 6).map((rVar) => (
                          <tr key={rVar}>
                            <td style={{ fontWeight: 600 }}>{rVar}</td>
                            {varNames.slice(0, 6).map((cVar) => {
                              const r = pearsonCorr(df[rVar], df[cVar]);
                              const strong = Math.abs(r) > 0.65 && rVar !== cVar;
                              return (
                                <td
                                  key={cVar}
                                  style={{
                                    textAlign: "right",
                                    fontWeight: strong ? 700 : 400,
                                    color: strong ? "var(--crimson)" : "var(--ink)",
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

            <div className="paper-sheet">
              <h2 className="sheet-heading">Сводная таблица описательных статистик выборки</h2>
              <div style={{ overflowX: "auto" }}>
                <table className="booktabs num">
                  <thead>
                    <tr>
                      <th>Переменная</th>
                      <th style={{ textAlign: "right" }}>Среднее</th>
                      <th style={{ textAlign: "right" }}>Медиана</th>
                      <th style={{ textAlign: "right" }}>Ст. откл. (<i>σ</i>)</th>
                      <th style={{ textAlign: "right" }}>Минимум</th>
                      <th style={{ textAlign: "right" }}>Максимум</th>
                      <th style={{ textAlign: "right" }}>Коэф. вариации (<i>CV</i>%)</th>
                      <th style={{ textAlign: "right" }}>Асимметрия</th>
                      <th style={{ textAlign: "right" }}><i>N</i></th>
                    </tr>
                  </thead>
                  <tbody>
                    {varStats.map((s) => (
                      <tr key={s.name}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td style={{ textAlign: "right" }}>{s.mean.toFixed(4)}</td>
                        <td style={{ textAlign: "right" }}>{s.median.toFixed(4)}</td>
                        <td style={{ textAlign: "right" }}>{s.std.toFixed(4)}</td>
                        <td style={{ textAlign: "right" }}>{s.min.toFixed(4)}</td>
                        <td style={{ textAlign: "right" }}>{s.max.toFixed(4)}</td>
                        <td style={{ textAlign: "right" }}>{s.cv.toFixed(2)}%</td>
                        <td style={{ textAlign: "right" }}>{s.skew.toFixed(4)}</td>
                        <td style={{ textAlign: "right" }}>{s.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ================================================================== */}
        {/* РАЗДЕЛ IV: ЦЕПИ МАРКОВА И ФУНДАМЕНТАЛЬНАЯ МАТРИЦА КЕМЕНИ — СНЕЛЛА    */}
        {/* ================================================================== */}
        {activeTab === "markov" && (
          <div className="paper-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
              <div>
                <h2 className="sheet-heading">
                  Стохастическое моделирование цепями Маркова (Фундаментальный анализ Кемени — Снелла)
                </h2>
                <p className="sheet-desc" style={{ marginBottom: 0 }}>
                  Текущее состояние: <strong>{markovResult.currentState}</strong> | Второе собственное значение |<i>λ</i>₂| = {markovResult.lambda2Mod.toFixed(4)} | Время перемешивания <i>τ</i><sub>mix</sub> ≈ {markovResult.mixingTime.toFixed(2)} пер.
                </p>
              </div>
              <select
                value={markovVar}
                onChange={(e) => setMarkovVar(e.target.value)}
                className="ui-select"
              >
                {varNames.map((v) => (
                  <option key={v} value={v}>Показатель: {v}</option>
                ))}
              </select>
            </div>

            <div className="two-columns">
              <div>
                <h3 className="serif-math" style={{ fontSize: "16px" }}>
                  1. Матрица переходных вероятностей <i>P<sub>ij</sub></i> и вектор <i>π</i>
                </h3>
                <table className="booktabs num">
                  <thead>
                    <tr>
                      <th>Состояние (<i>t</i>) \ (<i>t</i>+1)</th>
                      {markovResult.shortLabels.map((l) => (
                        <th key={l} style={{ textAlign: "right" }}>{l}</th>
                      ))}
                      <th style={{ textAlign: "right" }}>Финальное <i>π<sub>i</sub></i></th>
                    </tr>
                  </thead>
                  <tbody>
                    {markovResult.P.map((row, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{markovResult.shortLabels[i]}</strong>
                          <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                            {markovResult.bounds[i]}
                          </div>
                        </td>
                        {row.map((prob, j) => (
                          <td key={j} style={{ textAlign: "right" }}>
                            <div>{prob.toFixed(4)}</div>
                            <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                              (n={markovResult.counts[i][j]})
                            </div>
                          </td>
                        ))}
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--forest)" }}>
                          {(markovResult.stationary[i] * 100).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3 className="serif-math" style={{ fontSize: "16px", marginTop: "24px" }}>
                  2. Матрица среднего времени первого достижения <i>M<sub>ij</sub></i> (в периодах)
                </h3>
                <table className="booktabs num">
                  <thead>
                    <tr>
                      <th>Из фазы \ В фазу</th>
                      {markovResult.shortLabels.map((l) => (
                        <th key={l} style={{ textAlign: "right" }}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {markovResult.M.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{markovResult.shortLabels[i]}</td>
                        {row.map((val, j) => (
                          <td key={j} style={{ textAlign: "right", fontWeight: i === j ? 700 : 400 }}>
                            {val.toFixed(2)} пер.
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="serif-math" style={{ fontSize: "16px" }}>
                  3. Прогноз распределения вероятностей состояний <i>S<sub>t</sub> = S₀ · P<sup>t</sup></i>
                </h3>
                <div style={{ height: "310px", marginTop: "14px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={markovResult.forecast}>
                      <CartesianGrid strokeDasharray="2 2" stroke={chartColors.grid} />
                      <XAxis dataKey="step" stroke={chartColors.axis} fontSize={12} />
                      <YAxis stroke={chartColors.axis} fontSize={12} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartColors.tooltipBg,
                          borderColor: chartColors.tooltipBorder,
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar dataKey="S1" name="S₁ (Спад)" fill={chartColors.fitted} />
                      <Bar dataKey="S2" name="S₂ (Стагнация)" fill={chartColors.actual} />
                      <Bar dataKey="S3" name="S₃ (Рост)" fill={chartColors.accent} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* РАЗДЕЛ V: ТАБЛИЦА ДАННЫХ И ГЕНЕРАТОР ФОРМУЛ                         */}
        {/* ================================================================== */}
        {activeTab === "data" && (
          <div className="paper-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <div>
                <h2 className="sheet-heading">Матрица исходных данных и редактор формул</h2>
                <p className="sheet-desc" style={{ marginBottom: 0 }}>
                  Любую ячейку таблицы можно изменить вручную (кликните по числу) или создать новый столбец по формуле
                </p>
              </div>
              <button onClick={addObservationRow} className="ui-btn">
                <Plus size={14} /> Добавить строку (t = {nRows + 1})
              </button>
            </div>

            <form
              onSubmit={handleCreateByFormula}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                padding: "14px",
                background: "var(--bg-subtle)",
                marginBottom: "20px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Имя новой переменной (напр. RealRate)"
                className="ui-select num"
                style={{ minWidth: "220px" }}
              />
              <input
                type="text"
                value={newColFormula}
                onChange={(e) => setNewColFormula(e.target.value)}
                placeholder="Формула: KeyRate - Inflation  или  ln(Investment) * 2"
                className="ui-select num"
                style={{ flex: 1, minWidth: "280px" }}
              />
              <button type="submit" className="ui-btn ui-btn-primary">
                Вычислить столбец
              </button>
            </form>

            <div style={{ overflowX: "auto", maxHeight: "540px" }}>
              <table className="booktabs num">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}><i>t</i></th>
                    {varNames.map((v) => (
                      <th key={v} style={{ textAlign: "right" }}>{v}</th>
                    ))}
                    <th style={{ width: "50px", textAlign: "center" }}>Удал.</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: nRows }, (_, rowIdx) => (
                    <tr key={rowIdx}>
                      <td style={{ color: "var(--ink-muted)" }}>{rowIdx + 1}</td>
                      {varNames.map((v) => {
                        const cellVal = df[v][rowIdx];
                        return (
                          <td key={v} style={{ padding: "4px 6px", textAlign: "right" }}>
                            <input
                              type="text"
                              defaultValue={
                                cellVal !== null && cellVal !== undefined ? String(cellVal) : ""
                              }
                              onBlur={(e) => handleCellEdit(v, rowIdx, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              }}
                              className="cell-edit"
                            />
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => deleteObservationRow(rowIdx)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}
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
        )}
      </div>

      {/* МОДАЛЬНОЕ ОКНО ВСТАВКИ ИЗ EXCEL */}
      {showPasteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div className="paper-sheet" style={{ width: "100%", maxWidth: "620px", margin: 0 }}>
            <h3 className="sheet-heading">Вставка диапазона из Excel</h3>
            <p className="sheet-desc">
              Скопируйте столбцы в Excel вместе с заголовками (`Ctrl+C`) и вставьте ниже (`Ctrl+V`):
            </p>
            <textarea
              rows={9}
              value={pasteBuffer}
              onChange={(e) => setPasteBuffer(e.target.value)}
              placeholder={"GDP_Growth\tInvestment\tKeyRate\n4.2\t21.5\t7.5\n3.8\t20.1\t8.0"}
              className="ui-select num"
              style={{ width: "100%", marginBottom: "14px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={() => setShowPasteModal(false)} className="ui-btn">
                Отмена
              </button>
              <button onClick={handlePasteFromExcel} className="ui-btn ui-btn-primary">
                Импортировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
