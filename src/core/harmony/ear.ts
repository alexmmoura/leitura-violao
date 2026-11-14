import { createRng } from '../exercise/rng';
import { intervalCode, intervalsUpTo, intervalSemitones, type Interval } from '../theory/intervals';
import { TETRADS, TRIADS, type ChordQuality } from '../theory/chords';

/**
 * Percepção (Módulo H) — especificação §6.8. Alturas SOANTES (MIDI).
 * Graus em contexto tonal (no espírito do Functional Ear Trainer), intervalos,
 * qualidade de acordes e ditado melódico respondido no braço.
 */
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
export const DEGREE_LABEL = ['1 (tônica)', '2', '3', '4', '5', '6', '7 (sensível)'];

/** Tônicas soantes usadas (região central do violão): Dó3, Ré3, Mi3, Fá3, Sol3, Lá2. */
export const TONICS = [48, 50, 52, 53, 55, 45];

export interface DegreeQuestion {
  readonly tonic: number;
  readonly degree: number; // 0–6
  readonly midi: number;
}

export function makeDegreeQuestion(seed: number, degrees: readonly number[] = [0, 1, 2, 3, 4, 5, 6]): DegreeQuestion {
  const rng = createRng(seed);
  const tonic = rng.pick(TONICS);
  const degree = rng.pick(degrees);
  const octave = rng.pick([0, 12]);
  return { tonic, degree, midi: tonic + MAJOR_SCALE[degree]! + octave };
}

export interface IntervalEarQuestion {
  readonly low: number;
  readonly high: number;
  readonly interval: Interval;
  readonly mode: 'asc' | 'desc' | 'harmonic';
  /** Opções de resposta (códigos), em ordem de tamanho. */
  readonly options: string[];
}

export function makeIntervalEarQuestion(
  seed: number,
  level: number,
  modes: readonly ('asc' | 'desc' | 'harmonic')[],
  forced?: { interval: Interval; mode: 'asc' | 'desc' | 'harmonic' },
): IntervalEarQuestion {
  const rng = createRng(seed);
  // pela audição, A4 e d5 soam iguais: usa só um representante por número de semitons
  const bySemitones = new Map<number, Interval>();
  if (forced) bySemitones.set(intervalSemitones(forced.interval), forced.interval);
  for (const iv of intervalsUpTo(forced ? 4 : level)) if (!bySemitones.has(intervalSemitones(iv))) bySemitones.set(intervalSemitones(iv), iv);
  const pool = [...bySemitones.values()];
  const interval = forced?.interval ?? rng.pick(pool);
  const low = rng.int(45, 62);
  return {
    low,
    high: low + intervalSemitones(interval),
    interval,
    mode: forced?.mode ?? rng.pick(modes),
    options: pool.sort((a, b) => intervalSemitones(a) - intervalSemitones(b)).map(intervalCode),
  };
}

const QUALITY_SEMITONES: Readonly<Record<ChordQuality, readonly number[]>> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
};

export interface ChordEarQuestion {
  readonly root: number;
  readonly quality: ChordQuality;
  readonly midis: number[];
  readonly options: ChordQuality[];
}

export function makeChordEarQuestion(seed: number, family: 'triads' | 'tetrads', forcedQuality?: ChordQuality): ChordEarQuestion {
  const rng = createRng(seed);
  const fam = forcedQuality ? (TRIADS.includes(forcedQuality) ? 'triads' : 'tetrads') : family;
  const options = [...(fam === 'triads' ? TRIADS : TETRADS)];
  const quality = forcedQuality ?? rng.pick(options);
  const root = rng.int(45, 57);
  return { root, quality, midis: QUALITY_SEMITONES[quality].map((s) => root + s), options };
}

export interface DictationQuestion {
  readonly tonic: number;
  readonly midis: number[];
}

/**
 * Ditado melódico curto: começa na tônica (dada), graus conjuntos e terças,
 * dentro de uma oitava acima da tônica.
 */
export function makeDictation(seed: number, length: number): DictationQuestion {
  const rng = createRng(seed);
  const tonic = rng.pick(TONICS);
  const degs = [0];
  for (let i = 1; i < length; i++) {
    const prev = degs[i - 1]!;
    let next = prev + rng.pick([-2, -1, -1, 1, 1, 2]);
    if (next < 0) next = prev + 1;
    if (next > 7) next = prev - 1;
    if (next === prev) next = prev + 1;
    degs.push(next);
  }
  const toMidi = (d: number) => tonic + (d === 7 ? 12 : MAJOR_SCALE[d]!);
  return { tonic, midis: degs.map(toMidi) };
}
