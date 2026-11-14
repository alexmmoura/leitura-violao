import { describe, expect, it } from 'vitest';
import { centsBetween, frequencyToMidi, midiToFrequency } from '../theory/pitch';
import { STANDARD_TUNING } from '../instrument/instrument';
import { addNoise, karplusStrong, karplusStrongFreq } from './synth';
import { decimate2, rms, yin } from './yin';

const SR = 48_000;
const FRAME = 2048; // a 48 kHz ≈ 43 ms
const opts = { sampleRate: SR / 2 };

/** Analisa um quadro a partir de `startMs` (pula o ataque) e devolve a estimativa. */
function analyze(sig: Float32Array, startMs = 80) {
  const s = Math.floor((startMs / 1000) * SR);
  return yin(decimate2(sig.subarray(s, s + FRAME)), opts);
}

describe('YIN (§15.3)', () => {
  it('senoide pura: erro < 3 cents em toda a faixa do violão', () => {
    for (let m = 40; m <= 84; m++) {
      const f = midiToFrequency(m);
      const sig = new Float32Array(FRAME * 2).map((_, i) => 0.5 * Math.sin((2 * Math.PI * f * i) / SR));
      const est = analyze(sig, 10);
      expect(est.freq, `midi ${m}`).not.toBeNull();
      expect(Math.abs(centsBetween(est.freq!, f)), `midi ${m}`).toBeLessThan(3);
    }
  });

  it('CA-AUD-1 (proxy sintético): corda dedilhada, 6 cordas × casas 0–12, com e sem ruído → nota certa ≥ 97 %, oitava ≤ 1 %', () => {
    let total = 0;
    let ok = 0;
    let octave = 0;
    for (const open of STANDARD_TUNING) {
      for (let fret = 0; fret <= 12; fret++) {
        const m = open + fret;
        for (const [seed, noise] of [[1, 0], [2, 0.01], [3, 0.03], [4, 0.05]] as const) {
          const real = karplusStrongFreq(midiToFrequency(m), SR);
          let sig = karplusStrong(midiToFrequency(m), SR, 0.4, seed);
          if (noise) sig = addNoise(sig, noise, seed);
          const est = analyze(sig);
          total++;
          if (est.freq === null) continue;
          const detected = Math.round(frequencyToMidi(est.freq));
          const expected = Math.round(frequencyToMidi(real));
          if (detected === expected) ok++;
          else if (Math.abs(detected - expected) % 12 === 0) octave++;
        }
      }
    }
    expect(total).toBe(6 * 13 * 4);
    expect(ok / total).toBeGreaterThanOrEqual(0.97);
    expect(octave / total).toBeLessThanOrEqual(0.01);
  });

  it('silêncio e ruído puro não produzem nota', () => {
    expect(analyze(new Float32Array(FRAME * 2)).freq).toBeNull();
    const noise = addNoise(new Float32Array(FRAME * 2), 0.1, 9);
    expect(analyze(noise).freq).toBeNull();
  });

  it('auxiliares', () => {
    expect(rms([1, -1, 1, -1])).toBe(1);
    expect(decimate2(new Float32Array([1, 1, 1, 1, 1, 1]))).toEqual(new Float32Array([1, 1, 1]));
  });
});
