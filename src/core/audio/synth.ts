import { createRng } from '../exercise/rng';

/**
 * Síntese de corda dedilhada (Karplus–Strong) — especificação §12.5.
 * Usada como (a) som de referência sem dependências nem licenças e (b) sinal de
 * teste para o detector de altura (rico em harmônicos, como um violão).
 * O filtro de média atrasa meia amostra: f ≈ sr / (N + 0,5).
 */
export function karplusStrong(freq: number, sampleRate: number, seconds: number, seed = 1, decay = 0.996): Float32Array {
  const rng = createRng(seed);
  const n = Math.max(2, Math.round(sampleRate / freq - 0.5));
  const out = new Float32Array(Math.floor(sampleRate * seconds));
  const line = new Float32Array(n);
  for (let i = 0; i < n; i++) line[i] = rng.next() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = line[idx]!;
    const nxt = line[(idx + 1) % n]!;
    out[i] = cur;
    line[idx] = decay * 0.5 * (cur + nxt);
    idx = (idx + 1) % n;
  }
  // normaliza para pico 0,8
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]!));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i]! / peak) * 0.8;
  return out;
}

/** Frequência real produzida pelo Karplus–Strong (para comparar nos testes). */
export function karplusStrongFreq(freq: number, sampleRate: number): number {
  const n = Math.max(2, Math.round(sampleRate / freq - 0.5));
  return sampleRate / (n + 0.5);
}

/** Ruído branco com RMS dado (para testes de robustez). */
export function addNoise(sig: Float32Array, noiseRms: number, seed = 7): Float32Array {
  const rng = createRng(seed);
  const out = new Float32Array(sig.length);
  // ruído uniforme com o RMS pedido: amplitude = rms·√3
  const a = noiseRms * Math.sqrt(3);
  for (let i = 0; i < sig.length; i++) out[i] = sig[i]! + (rng.next() * 2 - 1) * a;
  return out;
}
