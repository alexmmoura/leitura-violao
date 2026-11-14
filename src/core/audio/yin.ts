/**
 * Estimador de frequência fundamental YIN — de Cheveigné & Kawahara (2002),
 * J. Acoust. Soc. Am. 111(4). Especificação §15.3.
 *
 * Passos: (1) função de diferença; (2) diferença normalizada pela média
 * cumulativa (CMNDF); (3) limiar absoluto — escolhe o PRIMEIRO mínimo abaixo do
 * limiar (reduz erros de sub-oitava); (4) interpolação parabólica.
 * TypeScript puro (roda no AudioWorklet e nos testes).
 */
export interface YinOptions {
  readonly sampleRate: number;
  /** Abaixo de E2 (82,4 Hz) para tolerar afinação baixa. */
  readonly minFreq?: number;
  /** Acima de C6 (1046,5 Hz, casa 20 da corda 1). */
  readonly maxFreq?: number;
  /** Limiar do YIN (0,10–0,15 recomendado). */
  readonly threshold?: number;
}

export interface PitchEstimate {
  /** Hz, ou null se o quadro não tem altura definida. */
  readonly freq: number | null;
  /** 1 − CMNDF no mínimo escolhido (≈ confiança, 0–1). */
  readonly clarity: number;
  readonly rms: number;
}

export function rms(buf: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i]! * buf[i]!;
  return Math.sqrt(s / Math.max(1, buf.length));
}

/**
 * Reduz a taxa de amostragem pela metade com um passa-baixa simples [¼ ½ ¼].
 * Metade das amostras = ~4× menos trabalho no YIN, sem perder a faixa do violão.
 */
export function decimate2(input: ArrayLike<number>, out?: Float32Array): Float32Array {
  const n = Math.floor(input.length / 2);
  const o = out && out.length >= n ? out : new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = input[2 * i - 1] ?? input[0]!;
    const b = input[2 * i]!;
    const c = input[2 * i + 1] ?? b;
    o[i] = 0.25 * a + 0.5 * b + 0.25 * c;
  }
  return o;
}

export function yin(buf: ArrayLike<number>, opts: YinOptions, scratch?: Float32Array): PitchEstimate {
  const sr = opts.sampleRate;
  const minFreq = opts.minFreq ?? 70;
  const maxFreq = opts.maxFreq ?? 1400;
  const threshold = opts.threshold ?? 0.12;
  const level = rms(buf);

  const tauMax = Math.min(Math.floor(sr / minFreq), Math.floor(buf.length / 2));
  const tauMin = Math.max(2, Math.floor(sr / maxFreq));
  const W = buf.length - tauMax;
  if (W <= 0 || tauMax <= tauMin + 2) return { freq: null, clarity: 0, rms: level };

  const d = scratch && scratch.length > tauMax ? scratch : new Float32Array(tauMax + 1);
  // (1) função de diferença
  d[0] = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j]! - buf[j + tau]!;
      s += diff * diff;
    }
    d[tau] = s;
  }
  // (2) CMNDF (no próprio vetor)
  let running = 0;
  d[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau]!;
    d[tau] = running > 0 ? (d[tau]! * tau) / running : 1;
  }
  // (3) limiar absoluto: primeiro mínimo local abaixo do limiar
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (d[t]! < threshold) {
      while (t + 1 < tauMax && d[t + 1]! < d[t]!) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // sem mínimo abaixo do limiar: usa o mínimo global, mas só se for razoável
    let best = tauMin;
    for (let t = tauMin; t < tauMax; t++) if (d[t]! < d[best]!) best = t;
    if (d[best]! > 0.3) return { freq: null, clarity: 1 - d[best]!, rms: level };
    tau = best;
  }
  // (4) interpolação parabólica
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = d[tau - 1]!;
    const b = d[tau]!;
    const c = d[tau + 1]!;
    const denom = a + c - 2 * b;
    if (denom !== 0) better = tau + (a - c) / (2 * denom);
  }
  return { freq: sr / better, clarity: Math.max(0, 1 - d[tau]!), rms: level };
}
