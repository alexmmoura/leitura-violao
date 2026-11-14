import { describe, expect, it } from 'vitest';
import { midiToFrequency } from '../theory/pitch';
import { addNoise, karplusStrong } from './synth';
import { DEFAULT_TRACKER, NoteTracker, suggestGate, type Frame } from './tracker';
import { decimate2, yin } from './yin';

const HOP = 0.01;
const frame = (t: number, midi: number | null, rms = 0.1, cents = 0): Frame => ({
  t,
  freq: midi === null ? null : midiToFrequency(midi + cents / 100),
  clarity: midi === null ? 0 : 0.95,
  rms,
});

function run(tr: NoteTracker, frames: Frame[]) {
  return frames.map((f) => tr.push(f)).filter((e) => e !== null);
}

describe('rastreador de notas (§15.5)', () => {
  it('emite uma vez por nota, após N quadros estáveis, com o instante do ataque', () => {
    const tr = new NoteTracker();
    const frames = [frame(0, null, 0.001), ...Array.from({ length: 10 }, (_, i) => frame(0.01 + i * HOP, 52))];
    const ev = run(tr, frames);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.midi).toBe(52);
    expect(ev[0]!.onsetT).toBeCloseTo(0.01, 6);
    expect(ev[0]!.confirmT).toBeCloseTo(0.03, 6); // 3 quadros
  });

  it('melodia legato: cada mudança de altura é um evento', () => {
    const tr = new NoteTracker();
    const seq = [52, 52, 52, 52, 54, 54, 54, 54, 55, 55, 55];
    const ev = run(tr, seq.map((m, i) => frame(i * HOP, m)));
    expect(ev.map((e) => e.midi)).toEqual([52, 54, 55]);
  });

  it('nota repetida é reconhecida pelo novo ataque de energia', () => {
    const tr = new NoteTracker();
    const frames: Frame[] = [];
    let t = 0;
    for (let r = 0; r < 2; r++) {
      frames.push(frame(t, null, 0.001));
      t += HOP;
      for (let i = 0; i < 6; i++) {
        frames.push(frame(t, 57, 0.2 * Math.pow(0.8, i)));
        t += HOP;
      }
    }
    const ev = run(tr, frames);
    expect(ev.map((e) => e.midi)).toEqual([57, 57]);
  });

  it('fora da tolerância em cents não vira nota; ruído abaixo da porta é ignorado', () => {
    const tr = new NoteTracker({ ...DEFAULT_TRACKER, toleranceCents: 30 });
    expect(run(tr, Array.from({ length: 8 }, (_, i) => frame(i * HOP, 60, 0.1, 45)))).toHaveLength(0);
    const tr2 = new NoteTracker();
    expect(run(tr2, Array.from({ length: 8 }, (_, i) => frame(i * HOP, 60, 0.005)))).toHaveLength(0);
  });

  it('o ataque da próxima nota não repete a nota anterior que ainda está na janela', () => {
    // nota A decaindo; ataque forte; 1 quadro ainda com a altura de A (janela mista); depois B
    const tr = new NoteTracker();
    const frames: Frame[] = [];
    let t = 0;
    for (let i = 0; i < 8; i++, t += HOP) frames.push(frame(t, 55, 0.2 * Math.pow(0.85, i)));
    frames.push(frame(t, 55, 0.3)); // ataque, janela ainda com a nota antiga
    t += HOP;
    for (let i = 0; i < 6; i++, t += HOP) frames.push(frame(t, 59, 0.28 * Math.pow(0.9, i)));
    expect(run(tr, frames).map((e) => e.midi)).toEqual([55, 59]);
  });

  it('um quadro isolado de outra altura (glitch) não gera evento', () => {
    const tr = new NoteTracker();
    const seq = [52, 52, 52, 52, 64, 52, 52, 52];
    expect(run(tr, seq.map((m, i) => frame(i * HOP, m))).map((e) => e.midi)).toEqual([52]);
  });

  it('porta sugerida a partir do silêncio', () => {
    expect(suggestGate([0.001, 0.002, 0.0015])).toBeCloseTo(0.006, 6);
    expect(suggestGate([])).toBe(DEFAULT_TRACKER.gate);
    expect(suggestGate([0.0001])).toBe(0.003);
  });

  it('ponta a ponta: frase sintetizada → detector → rastreador reconhece as notas em ordem, latência < 120 ms', () => {
    const SR = 48_000;
    const notes = [52, 55, 57, 59, 60, 59, 57];
    const noteSec = 0.35;
    const sig = new Float32Array(Math.floor(SR * noteSec * notes.length));
    notes.forEach((m, k) => {
      const s = karplusStrong(midiToFrequency(m), SR, noteSec, k + 1);
      sig.set(s, Math.floor(k * noteSec * SR));
    });
    const noisy = addNoise(sig, 0.01, 3);
    const tr = new NoteTracker();
    const hop = 480; // 10 ms
    const win = 2048;
    const events = [];
    for (let s = 0; s + win <= noisy.length; s += hop) {
      const est = yin(decimate2(noisy.subarray(s, s + win)), { sampleRate: SR / 2 });
      const e = tr.push({ t: (s + win) / SR, freq: est.freq, clarity: est.clarity, rms: est.rms });
      if (e) events.push(e);
    }
    expect(events.map((e) => e.midi)).toEqual(notes);
    events.forEach((e, k) => {
      const realOnset = k * noteSec;
      expect(e.confirmT - realOnset).toBeLessThan(0.12);
      expect(e.confirmT - realOnset).toBeGreaterThan(0);
    });
  });
});
