import { createRng } from '../exercise/rng';
import { median } from '../learning/metrics';

/**
 * Leitura rítmica (Módulo E) — especificação §6.5.
 * Aritmética inteira em semicolcheias: semínima = 4 unidades.
 *
 * Compassos simples (2/4, 3/4, 4/4): o tempo é a semínima, dividida em 2.
 * Compassos compostos (6/8, 9/8, 12/8): o tempo é a SEMÍNIMA PONTUADA (6 unidades),
 * dividida em 3 colcheias — por isso 6/8 tem 2 tempos, não 6.
 * Ligaduras: um evento com `tie` continua soando no seguinte (sem novo ataque).
 */
export interface RhythmEvent {
  /** Duração em semicolcheias. */
  readonly units: number;
  readonly rest: boolean;
  /** Ligado ao próximo evento: o próximo NÃO é um novo ataque. */
  readonly tie?: boolean;
}

/** Semínima (tempo dos compassos simples). Mantido por compatibilidade. */
export const UNITS_PER_BEAT = 4;

// ---------- Fórmulas de compasso ----------

export interface Meter {
  readonly num: number;
  readonly den: 4 | 8;
}
/** Número = n/4 (formato antigo, só compassos simples). */
export type MeterLike = Meter | number;

export const METERS: readonly Meter[] = [
  { num: 2, den: 4 },
  { num: 3, den: 4 },
  { num: 4, den: 4 },
  { num: 6, den: 8 },
  { num: 9, den: 8 },
  { num: 12, den: 8 },
];

export const toMeter = (m: MeterLike): Meter => (typeof m === 'number' ? { num: m, den: 4 } : m);
export const isCompound = (m: MeterLike): boolean => {
  const x = toMeter(m);
  return x.den === 8 && x.num % 3 === 0 && x.num > 3;
};
/** Tamanho do compasso em semicolcheias. */
export const measureSize = (m: MeterLike): number => {
  const x = toMeter(m);
  return x.num * (16 / x.den);
};
/** Tamanho do TEMPO em semicolcheias (6 nos compostos, 4 nos simples em /4). */
export const beatSize = (m: MeterLike): number => (isCompound(m) ? 6 : 16 / toMeter(m).den);
/** Tempos por compasso (o que o metrônomo conta). */
export const beatsPer = (m: MeterLike): number => measureSize(m) / beatSize(m);
/** Subdivisões do tempo (3 nos compostos, 2 nos simples). */
export const subdivisionOf = (m: MeterLike): number => (isCompound(m) ? 3 : 2);
export const meterLabel = (m: MeterLike): string => `${toMeter(m).num}/${toMeter(m).den}`;
export function parseMeter(s: string): Meter | null {
  const mm = /^(\d+)\/(4|8)$/.exec(s);
  return mm ? { num: Number(mm[1]), den: Number(mm[2]) as 4 | 8 } : null;
}

// ---------- Figuras ----------

export interface FigureInfo {
  readonly units: number;
  readonly vex: string; // duração no VexFlow (sem "d"/"r")
  readonly dotted: boolean;
  readonly name: string;
}

export const FIGURES: readonly FigureInfo[] = [
  { units: 16, vex: 'w', dotted: false, name: 'semibreve' },
  { units: 12, vex: 'h', dotted: true, name: 'mínima pontuada' },
  { units: 8, vex: 'h', dotted: false, name: 'mínima' },
  { units: 6, vex: 'q', dotted: true, name: 'semínima pontuada' },
  { units: 4, vex: 'q', dotted: false, name: 'semínima' },
  { units: 3, vex: '8', dotted: true, name: 'colcheia pontuada' },
  { units: 2, vex: '8', dotted: false, name: 'colcheia' },
  { units: 1, vex: '16', dotted: false, name: 'semicolcheia' },
];

export function figureFor(units: number): FigureInfo {
  const f = FIGURES.find((x) => x.units === units);
  if (!f) throw new RangeError(`Duração sem figura simples: ${units}`);
  return f;
}

export function figureName(e: RhythmEvent): string {
  const f = figureFor(e.units);
  if (!e.rest) return f.name;
  return `pausa de ${f.name}`;
}

const n = (units: number): RhythmEvent => ({ units, rest: false });
const r = (units: number): RhythmEvent => ({ units, rest: true });
const t = (units: number): RhythmEvent => ({ units, rest: false, tie: true });

/** Células dos compassos SIMPLES por nível — uma novidade por nível (princípio Sagreras). */
export const LEVEL_CELLS: readonly (readonly RhythmEvent[])[][] = [
  // 1: semibreve, mínima, semínima e pausas
  [[n(16)], [n(8)], [n(4)], [n(4)], [r(4)], [r(8)]],
  // 2: + colcheias e mínima pontuada
  [[n(2), n(2)], [n(12)]],
  // 3: + semínima pontuada + colcheia, contratempo
  [[n(6), n(2)], [r(2), n(2)]],
  // 4: + semicolcheias, síncope e ligadura sobre o tempo
  [[n(1), n(1), n(1), n(1)], [n(2), n(1), n(1)], [n(1), n(1), n(2)], [n(2), n(4), n(2)], [n(2), t(2), n(2), n(2)]],
];

/** Células dos compassos COMPOSTOS (tempo = semínima pontuada = 6). */
export const COMPOUND_CELLS: readonly (readonly RhythmEvent[])[][] = [
  // 1: semínima pontuada, semínima + colcheia, três colcheias, pausa
  [[n(6)], [n(6)], [n(4), n(2)], [n(2), n(2), n(2)], [r(6)], [n(12)]],
  // 2: + colcheia + semínima, pausa de colcheia
  [[n(2), n(4)], [r(2), n(2), n(2)], [n(4), r(2)]],
  // 3: + siciliana (colcheia pontuada, semicolcheia, colcheia) e semicolcheias
  [[n(3), n(1), n(2)], [n(1), n(1), n(2), n(2)], [n(2), n(2), n(1), n(1)]],
  // 4: + ligadura sobre o tempo (hemíola: três semínimas em 6/8)
  [[n(4), t(2), n(2), n(4)], [n(2), n(2), t(2), n(6)]],
];

export const LEVEL_LABEL = ['Semibreve, mínima, semínima e pausas', '+ colcheias e mínima pontuada', '+ semínima pontuada e contratempo', '+ semicolcheias, síncope e ligaduras'];
export const COMPOUND_LEVEL_LABEL = ['Semínima pontuada, semínima + colcheia, 3 colcheias', '+ colcheia + semínima e pausas', '+ siciliana e semicolcheias', '+ ligaduras sobre o tempo (hemíola)'];

export function cellsUpTo(level: number, meter: MeterLike = 4): (readonly RhythmEvent[])[] {
  const table = isCompound(meter) ? COMPOUND_CELLS : LEVEL_CELLS;
  return table.slice(0, Math.max(1, Math.min(level, table.length))).flat();
}

const total = (es: readonly RhythmEvent[]) => es.reduce((s, e) => s + e.units, 0);

/** Gera um compasso completo. Células de ≥ 1 tempo começam no tempo. */
export function generateMeasure(level: number, meter: MeterLike, seed: number): RhythmEvent[] {
  const rng = createRng(seed);
  const size = measureSize(meter);
  const beat = beatSize(meter);
  const cells = cellsUpTo(level, meter);
  const out: RhythmEvent[] = [];
  let pos = 0;
  let guard = 0;
  while (pos < size && guard++ < 100) {
    const fit = cells.filter((c) => {
      const tt = total(c);
      if (tt > size - pos) return false;
      if (tt >= beat && pos % beat !== 0) return false;
      if (tt === 16 && pos !== 0) return false;
      // em compassos de 4 tempos (4/4, 12/8) uma figura longa não esconde o meio do compasso
      if (tt >= 2 * beat && beatsPer(meter) === 4 && pos % (2 * beat) !== 0) return false;
      // não começar o compasso com pausa longa nem empilhar pausas
      if (c[0]!.rest && (out.length === 0 || out[out.length - 1]!.rest) && tt >= 4) return false;
      return true;
    });
    const cell = fit.length ? rng.pick(fit) : [n(Math.min(beat, size - pos))];
    out.push(...cell);
    pos += total(cell);
  }
  return out;
}

/**
 * Vários compassos; a partir do nível 3, às vezes liga a última nota de um compasso
 * à primeira do seguinte (ligadura sobre a barra — a vigência dos acidentes recomeça).
 */
export function generateMeasures(level: number, meter: MeterLike, count: number, seed: number): RhythmEvent[][] {
  const rng = createRng(seed);
  const ms = Array.from({ length: count }, () => generateMeasure(level, meter, rng.int(0, 2 ** 31)));
  if (level >= 3) {
    for (let i = 0; i < ms.length - 1; i++) {
      const last = ms[i]![ms[i]!.length - 1]!;
      const first = ms[i + 1]![0]!;
      if (!last.rest && !last.tie && !first.rest && rng.next() < 0.3) ms[i]![ms[i]!.length - 1] = { ...last, tie: true };
    }
  }
  return ms;
}

export function measureUnits(es: readonly RhythmEvent[]): number {
  return total(es);
}

/**
 * Instantes (ms) dos ataques. Pausas e continuações de ligadura não têm ataque.
 * `bpm` conta o TEMPO do compasso (semínima pontuada nos compostos).
 */
export function onsetsMs(measures: readonly (readonly RhythmEvent[])[], bpm: number, meter: MeterLike = 4): number[] {
  const unitMs = 60_000 / bpm / beatSize(meter);
  const out: number[] = [];
  let pos = 0;
  let tiedFromPrev = false;
  for (const m of measures) {
    for (const e of m) {
      if (!e.rest && !tiedFromPrev) out.push(pos * unitMs);
      tiedFromPrev = !e.rest && !!e.tie;
      pos += e.units;
    }
  }
  return out;
}

export interface TapEvaluation {
  readonly hits: { readonly expectedMs: number; readonly tapMs: number; readonly devMs: number }[];
  readonly misses: number[];
  readonly extras: number[];
  /** acertos − extras, sobre o total esperado, em [0, 1]. */
  readonly score: number;
  readonly medianAbsDevMs: number | null;
}

/**
 * Compara os toques com os ataques esperados (§6.5). Cada ataque aceita o toque
 * mais próximo ainda livre dentro de ±tolerância; o resto são omissões e extras.
 */
export function evaluateTaps(expectedMs: readonly number[], tapsMs: readonly number[], toleranceMs: number): TapEvaluation {
  const used = new Set<number>();
  const hits: TapEvaluation['hits'] = [];
  const misses: number[] = [];
  for (const exp of expectedMs) {
    let best = -1;
    let bestDev = Infinity;
    tapsMs.forEach((tp, i) => {
      const d = Math.abs(tp - exp);
      if (!used.has(i) && d <= toleranceMs && d < bestDev) {
        best = i;
        bestDev = d;
      }
    });
    if (best >= 0) {
      used.add(best);
      hits.push({ expectedMs: exp, tapMs: tapsMs[best]!, devMs: tapsMs[best]! - exp });
    } else misses.push(exp);
  }
  const extras = tapsMs.filter((_, i) => !used.has(i));
  const score = expectedMs.length ? Math.max(0, (hits.length - extras.length) / expectedMs.length) : 0;
  return { hits, misses, extras, score, medianAbsDevMs: median(hits.map((h) => Math.abs(h.devMs))) };
}

/** Tolerância por nível (§6.5): ±80 ms no início, apertando até ±40 ms. */
export function toleranceFor(level: number): number {
  return [80, 70, 55, 40][Math.max(0, Math.min(3, level - 1))]!;
}

// ---------- Reconhecimento ----------

export type RecognitionQuestion =
  | { readonly kind: 'duration'; readonly event: RhythmEvent; readonly answerBeats: number; readonly options: number[] }
  | { readonly kind: 'complete'; readonly measure: RhythmEvent[]; readonly meter: Meter; readonly complete: boolean };

/** Revisão: forçar a figura (duração) ou o tipo de pergunta (compasso completo?). */
export type RecognitionForce = { readonly kind: 'duration'; readonly event: RhythmEvent } | { readonly kind: 'complete' };

/**
 * Duração (em semínimas, a unidade fixa da pergunta) ou "o compasso está completo?".
 * Nos compostos, a figura perguntada vem do vocabulário composto.
 */
export function generateRecognition(level: number, meter: MeterLike, seed: number, force?: RecognitionForce): RecognitionQuestion {
  const rng = createRng(seed);
  const wantDuration = force ? force.kind === 'duration' : rng.next() < 0.55;
  if (wantDuration) {
    const forcedEvent = force?.kind === 'duration' ? force.event : null;
    const vocab = forcedEvent ? [...cellsUpTo(4, 4), ...cellsUpTo(4, { num: 6, den: 8 })] : cellsUpTo(level, meter);
    const pool = [...new Map([...(forcedEvent ? [forcedEvent] : []), ...vocab.flat()].map((e) => [`${e.units}${e.rest}`, { units: e.units, rest: e.rest }])).values()];
    const event = forcedEvent ?? rng.pick(pool);
    const options = [...new Set(pool.map((e) => e.units / UNITS_PER_BEAT))].sort((a, b) => b - a);
    return { kind: 'duration', event, answerBeats: event.units / UNITS_PER_BEAT, options };
  }
  const measure = generateMeasure(level, meter, rng.int(0, 2 ** 31)).map((e) => ({ units: e.units, rest: e.rest }));
  const complete = rng.next() < 0.5 || measure.length < 2;
  return { kind: 'complete', measure: complete ? measure : measure.slice(0, -1), meter: toMeter(meter), complete };
}

/** Rótulo de tempos: 1,5 → "1½". */
export function beatsLabel(b: number): string {
  const whole = Math.floor(b);
  const frac = b - whole;
  const f = frac === 0.5 ? '½' : frac === 0.25 ? '¼' : frac === 0.75 ? '¾' : '';
  return `${whole || (f ? '' : '0')}${f}`;
}
