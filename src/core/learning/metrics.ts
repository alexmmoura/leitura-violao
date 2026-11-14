/**
 * Métricas estatísticas por item — especificação §11.1.
 */

/** Limite inferior do intervalo de Wilson (95 %): 1/1 ≈ 0,21; 20/20 ≈ 0,84. */
export function wilsonLower(successes: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return Math.max(0, (centre - margin) / denom);
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Modelo de fluência (§10.5): média móvel exponencial do log do tempo das respostas
 * corretas. Separado da memória: lembrar devagar ≠ ler com fluência.
 */
export interface Fluency {
  readonly n: number;
  /** EWMA de ln(ms). */
  readonly logMean: number;
  readonly logVar: number;
}

export const EMPTY_FLUENCY: Fluency = { n: 0, logMean: 0, logVar: 0 };

export function updateFluency(f: Fluency, rtMs: number, alpha = 0.3): Fluency {
  const x = Math.log(Math.max(50, rtMs));
  if (f.n === 0) return { n: 1, logMean: x, logVar: 0 };
  const d = x - f.logMean;
  const logMean = f.logMean + alpha * d;
  const logVar = (1 - alpha) * (f.logVar + alpha * d * d);
  return { n: f.n + 1, logMean, logVar };
}

/** Tempo típico estimado pela fluência (ms), ou null sem dados. */
export function fluencyMs(f: Fluency): number | null {
  return f.n === 0 ? null : Math.exp(f.logMean);
}
