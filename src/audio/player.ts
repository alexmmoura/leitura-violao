import { karplusStrong } from '../core/audio/synth';
import { midiToFrequency } from '../core/theory/pitch';
import { audioContext } from './metronome';

/**
 * Reprodução de referência — especificação §12.5 e Módulo H.
 * Corda dedilhada sintetizada localmente (Karplus–Strong): zero amostras externas,
 * zero licenças, funciona offline. As alturas são SOANTES (MIDI).
 */
export interface PlayEvent {
  readonly midi: number;
  /** Início em segundos a partir do começo da sequência. */
  readonly at: number;
  readonly dur: number;
}

let current: AudioBufferSourceNode | null = null;

export async function playEvents(events: readonly PlayEvent[], aRef = 440, gain = 0.5): Promise<number> {
  const ctx = audioContext();
  if (ctx.state !== 'running') await ctx.resume();
  current?.stop();
  const sr = ctx.sampleRate;
  const total = Math.max(...events.map((e) => e.at + e.dur)) + 0.3;
  const buf = ctx.createBuffer(1, Math.ceil(sr * total), sr);
  const data = buf.getChannelData(0);
  events.forEach((e, i) => {
    const tone = karplusStrong(midiToFrequency(e.midi, aRef), sr, e.dur + 0.25, i + 11, 0.997);
    const start = Math.floor(e.at * sr);
    for (let k = 0; k < tone.length && start + k < data.length; k++) data[start + k]! += tone[k]! * 0.6;
  });
  // evita saturação quando várias notas soam juntas
  let peak = 0;
  for (let k = 0; k < data.length; k++) peak = Math.max(peak, Math.abs(data[k]!));
  if (peak > 0.95) for (let k = 0; k < data.length; k++) data[k] = (data[k]! / peak) * 0.95;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(ctx.destination);
  src.start();
  current = src;
  return total;
}

export function stopPlayback() {
  try {
    current?.stop();
  } catch {
    /* já parado */
  }
  current = null;
}

/** Notas em sequência. */
export const melodic = (midis: readonly number[], step = 0.6): PlayEvent[] => midis.map((m, i) => ({ midi: m, at: i * step, dur: step }));
/** Notas juntas (acorde / intervalo harmônico), com leve rasgueado. */
export const harmonic = (midis: readonly number[], at = 0, dur = 1.6, strum = 0.025): PlayEvent[] =>
  [...midis].sort((a, b) => a - b).map((m, i) => ({ midi: m, at: at + i * strum, dur }));

/**
 * Cadência I–IV–V–I na tonalidade (tônica soante `tonicMidi`), para estabelecer o
 * contexto tonal antes de perguntas funcionais.
 */
export function cadence(tonicMidi: number): PlayEvent[] {
  const t = tonicMidi;
  const chords = [
    [t - 12, t, t + 4, t + 7],
    [t - 7, t + 5, t + 9, t + 12],
    [t - 5, t + 2, t + 7, t + 11],
    [t - 12, t, t + 4, t + 7],
  ];
  return chords.flatMap((c, i) => harmonic(c, i * 0.8, 0.8));
}
