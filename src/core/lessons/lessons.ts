import { createRng } from '../exercise/rng';
import { measureSize, parseMeter, type Meter, type RhythmEvent } from '../rhythm/rhythm';
import type { ScoreDef, ScoreNote } from '../score/score';

/**
 * Lições numeradas, em ordem de dificuldade:
 *  - leitura rítmica: padrões fixos, escritos à mão;
 *  - solfejo: por tonalidade, com o conjunto de notas crescendo (2 notas, 3, … até a oitava).
 *    São geradas por semente fixa: a lição 7 de Dó maior é sempre a mesma.
 */
export interface RhythmLesson {
  readonly n: number;
  readonly meter: Meter;
  readonly measures: RhythmEvent[][];
}

/** "4 r4 | 6 2~ | 2 4 2": números = semicolcheias; r = pausa; ~ = ligada à próxima. */
function parsePattern(s: string): RhythmEvent[][] {
  return s.split('|').map((m) =>
    m
      .trim()
      .split(/\s+/)
      .map((tok) => {
        const rest = tok.startsWith('r');
        const tie = tok.endsWith('~');
        return { units: Number(tok.replace(/[r~]/g, '')), rest, ...(tie ? { tie: true } : {}) };
      }),
  );
}

const RHYTHM_SOURCE: readonly [string, string][] = [
  ['2/4', '8 | 8'],
  ['2/4', '4 4 | 8'],
  ['2/4', '4 r4 | 4 4'],
  ['2/4', 'r4 4 | 4 r4'],
  ['2/4', '4 2 2 | 4 4'],
  ['2/4', '2 2 4 | 2 2 4'],
  ['2/4', '2 2 2 2 | 4 4'],
  ['2/4', '4 2 2 | 2 2 4'],
  ['2/4', 'r2 2 4 | 4 r4'],
  ['2/4', '2 r2 2 r2 | 4 4'],
  ['2/4', '6 2 | 4 4'],
  ['2/4', '6 2 | 2 2 4'],
  ['2/4', '2 4 2 | 4 4'],
  ['2/4', '4 1 1 1 1 | 4 4'],
  ['2/4', '2 1 1 4 | 2 1 1 4'],
  ['2/4', '1 1 2 4 | 1 1 2 4'],
  ['2/4', '3 1 4 | 3 1 4'],
  ['2/4', '4 3 1 | 3 1 4'],
  ['2/4', '1 2 1 4 | 4 4'],
  ['2/4', '4 4~ | 4 4'],
  ['3/4', '12 | 12'],
  ['3/4', '4 4 4 | 12'],
  ['3/4', '8 4 | 4 8'],
  ['3/4', '4 2 2 4 | 8 4'],
  ['3/4', '6 2 4 | 4 4 4'],
  ['3/4', '4 r4 4 | 2 2 2 2 4'],
  ['4/4', '16 | 8 8'],
  ['4/4', '4 4 8 | 4 4 4 4'],
  ['4/4', '4 2 2 4 4 | 8 8'],
  ['4/4', '6 2 4 4 | 6 2 8'],
  ['4/4', '2 4 2 4 4 | 4 4 8'],
  ['4/4', '4 r4 2 2 4 | r4 4 4 r4'],
  ['4/4', '3 1 4 3 1 4 | 8 8'],
  ['4/4', '4 4~ 4 4 | 4 2 2 8'],
  ['6/8', '6 6 | 12'],
  ['6/8', '4 2 4 2 | 6 6'],
  ['6/8', '2 2 2 6 | 2 2 2 6'],
  ['6/8', '4 2 2 2 2 | 6 6'],
  ['6/8', '2 4 2 4 | 4 2 6'],
  ['6/8', '3 1 2 6 | 2 2 2 4 2'],
];

export const RHYTHM_LESSONS: readonly RhythmLesson[] = RHYTHM_SOURCE.map(([meter, pattern], i) => ({ n: i + 1, meter: parseMeter(meter)!, measures: parsePattern(pattern) }));

// ---------- Solfejo ----------
/** Tonalidades oferecidas, das mais simples às com mais acidentes. */
export const SOLFEGE_KEYS: readonly number[] = [0, 1, -1, 2, -2, 3, -3];
export const SOLFEGE_LESSON_COUNT = 28;
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];

/** Tônica ESCRITA (MIDI) da tonalidade, numa região confortável da pauta. */
function tonicWritten(fifths: number): number {
  const pc = (((fifths * 7) % 12) + 12) % 12;
  return pc > 6 ? 48 + pc : 60 + pc;
}

export interface SolfegeLesson {
  readonly n: number;
  readonly fifths: number;
  /** Quantas notas da escala a lição usa (2 a 8). */
  readonly size: number;
  readonly score: ScoreDef;
}

export function solfegeLesson(fifths: number, n: number): SolfegeLesson {
  // tenta sementes até a lição usar TODAS as notas do seu conjunto (inclusive a mais aguda)
  let best = buildLesson(fifths, n, 0);
  for (let attempt = 1; attempt < 40 && best.used < best.lesson.size; attempt++) {
    const cand = buildLesson(fifths, n, attempt);
    if (cand.used > best.used) best = cand;
  }
  return best.lesson;
}

function buildLesson(fifths: number, n: number, attempt: number): { lesson: SolfegeLesson; used: number } {
  const size = 2 + Math.floor((n - 1) / 4);
  const variant = (n - 1) % 4;
  const meter: Meter = variant === 3 ? { num: 4, den: 4 } : { num: 2, den: 4 };
  const rng = createRng(1000 + (fifths + 7) * 100 + n + attempt * 7919);
  const tonic = tonicWritten(fifths);
  const half = (): number[] => {
    if (variant === 0) return [4, 4];
    if (variant === 1 || variant === 3) return rng.pick([[4, 4], [4, 4], [8]]);
    return rng.pick([[4, 4], [2, 2, 4], [4, 2, 2], [2, 2, 2, 2]]);
  };
  const BARS = size >= 5 ? 8 : 4; // mais notas pedem frases mais longas
  const rhythm: number[][] = [];
  for (let b = 0; b < BARS - 1; b++) rhythm.push(variant === 3 ? [...half(), ...half()] : half());
  rhythm.push([measureSize(meter)]); // nota final longa, na tônica
  const total = rhythm.flat().length;

  let idx = 0;
  const seen = new Set<number>();
  const measures: ScoreNote[][] = [];
  let k = 0;
  for (const bar of rhythm) {
    const notes: ScoreNote[] = [];
    for (const units of bar) {
      if (k === total - 1) idx = 0;
      else if (k > 0) {
        const left = total - 1 - k; // notas até a final
        const up = k < total / 2 ? 0.7 : 0.3;
        let step = rng.next() < up ? 1 : -1;
        if (variant === 3 && size >= 4 && rng.next() < 0.3) step *= 2;
        if (rng.next() < 0.12) step = 0;
        let next = idx + step;
        if (next < 0 || next >= size) next = idx - step;
        next = Math.max(0, Math.min(size - 1, next));
        // garante que dá para descer até a tônica a tempo
        if (next > left) next = Math.max(0, Math.min(idx, left));
        idx = next;
      }
      seen.add(idx);
      notes.push({ units, rest: false, written: tonic + MAJOR[idx]! });
      k++;
    }
    measures.push(notes);
  }
  const score: ScoreDef = { id: `licao-solfejo-k${fifths}-n${n}`, title: `Solfejo ${n}`, fifths, meter, measures, source: 'editor', createdAt: 0 };
  return { lesson: { n, fifths, size, score }, used: seen.size };
}

export const solfegeKc = (fifths: number, n: number) => `obra:licao-solfejo-k${fifths}-n${n}`;
export const rhythmLessonKc = (n: number) => `licao-ritmo:${n}`;
