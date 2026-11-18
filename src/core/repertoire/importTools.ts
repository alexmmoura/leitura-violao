import { measureSize, isCompound, type Meter } from '../rhythm/rhythm';
import { splitUnits, type ScoreNote } from '../score/score';
import { keyAlterFor } from '../theory/keySignature';
import { LETTERS, NATURAL_PC, spelledToMidi, type Alter, type SpelledPitch } from '../theory/pitch';
import type { Level } from './pieces';

/**
 * Ferramentas para trazer obras baixadas (MusicXML, ABC) para o repertório:
 * transpor para o violão, medir a dificuldade (nível 1–5) e escrever na
 * notação compacta (./notation.ts).
 */

/** Tonalidades confortáveis no violão: Fá, Dó, Sol, Ré, Lá, Mi maiores (e relativas menores). */
export const GUITAR_FIFTHS = { min: -1, max: 4 } as const;
/** Região escrita confortável: Mi3 (corda 6 solta) a Lá5 (corda 1, casa 5). */
export const COMFORT = { low: 52, high: 81 } as const;
/** Limite do braço (19 casas): Si6 escrito. */
export const HARD_HIGH = 95;

/** Transpõe uma nota grafada por `d` quintas (mantendo a grafia correta) e `oct` oitavas. */
export function transposeSpelled(p: SpelledPitch, d: number, oct = 0): SpelledPitch {
  let s = (((7 * d) % 12) + 12) % 12;
  if (s > 5) s -= 12; // intervalo mais curto: −6…+5 semitons
  const steps = Math.round((s * 7) / 12);
  const li = LETTERS.indexOf(p.letter) + steps;
  const letter = LETTERS[((li % 7) + 7) % 7]!;
  const octave = p.octave + Math.floor(li / 7) + oct;
  const target = spelledToMidi(p) + s + 12 * oct;
  const alter = target - (12 * (octave + 1) + NATURAL_PC[letter]);
  if (alter < -2 || alter > 2) throw new Error('transposição impossível de grafar');
  return { letter, alter: alter as Alter, octave };
}

/** Quantas quintas mover para cair numa tonalidade boa de violão (0 se já está). */
export function guitarKeyShift(fifths: number): number {
  if (fifths < GUITAR_FIFTHS.min) return GUITAR_FIFTHS.min - fifths;
  if (fifths > GUITAR_FIFTHS.max) return GUITAR_FIFTHS.max - fifths;
  return 0;
}

const notesOf = (ms: readonly (readonly ScoreNote[])[]) => ms.flat().filter((n) => !n.rest && n.spelled);

export interface GuitarVersion {
  readonly fifths: number;
  readonly measures: ScoreNote[][];
  /** Semitons de transposição (0 = tonalidade original). */
  readonly semitones: number;
}

/**
 * Versão para violão: tonalidade confortável e oitava que cabe no braço
 * (prefere a região Mi3–Lá5). null se não couber de jeito nenhum.
 */
export function forGuitar(fifths: number, measures: readonly (readonly ScoreNote[])[]): GuitarVersion | null {
  const d = guitarKeyShift(fifths);
  let best: { cost: number; oct: number } | null = null;
  const base = notesOf(measures).map((n) => spelledToMidi(transposeSpelled(n.spelled!, d)));
  if (base.length === 0) return null;
  for (const oct of [0, -1, 1, -2, 2]) {
    const lo = Math.min(...base) + 12 * oct;
    const hi = Math.max(...base) + 12 * oct;
    if (lo < COMFORT.low || hi > HARD_HIGH) continue;
    const cost = Math.max(0, hi - COMFORT.high) + Math.abs(oct) * 0.5;
    if (!best || cost < best.cost) best = { cost, oct };
  }
  if (!best) return null;
  const oct = best.oct;
  const out = measures.map((bar) =>
    bar.map((n): ScoreNote => {
      if (n.rest || !n.spelled) return { units: n.units, rest: true, written: null };
      const sp = transposeSpelled(n.spelled, d, oct);
      return { units: n.units, rest: false, tie: !!n.tie, written: spelledToMidi(sp), spelled: sp };
    }),
  );
  let s = (((7 * d) % 12) + 12) % 12;
  if (s > 5) s -= 12;
  return { fifths: fifths + d, measures: out, semitones: s + 12 * oct };
}

export interface Difficulty {
  readonly notes: number;
  readonly minUnit: number;
  readonly sixteenths: number;
  readonly eighths: number;
  /** Notas por compasso (densidade). */
  readonly perMeasure: number;
  readonly dotted: number;
  readonly accidentals: number;
  readonly maxLeap: number;
  readonly low: number;
  readonly high: number;
  readonly rests: number;
}

export function measureDifficulty(fifths: number, measures: readonly (readonly ScoreNote[])[]): Difficulty {
  const all = measures.flat();
  const ns = notesOf(measures);
  const midis = ns.map((n) => spelledToMidi(n.spelled!));
  let maxLeap = 0;
  for (let k = 1; k < midis.length; k++) maxLeap = Math.max(maxLeap, Math.abs(midis[k]! - midis[k - 1]!));
  return {
    notes: ns.length,
    minUnit: Math.min(...all.map((n) => n.units)),
    sixteenths: all.filter((n) => n.units === 1 || n.units === 3).length,
    eighths: all.filter((n) => n.units === 2).length,
    perMeasure: ns.length / Math.max(1, measures.length),
    dotted: all.filter((n) => n.units === 3 || n.units === 6 || n.units === 12).length,
    accidentals: ns.filter((n) => n.spelled!.alter !== keyAlterFor(n.spelled!.letter, fifths)).length,
    maxLeap,
    low: Math.min(...midis),
    high: Math.max(...midis),
    rests: all.filter((n) => n.rest).length,
  };
}

/** Nível 1–5 pelas mesmas ideias dos níveis do repertório escrito à mão. */
export function levelOf(fifths: number, meter: Meter, d: Difficulty): Level {
  const k = Math.abs(fifths);
  const n = Math.max(1, d.notes);
  const share16 = d.sixteenths / n;
  const share8 = d.eighths / n;
  void isCompound(meter);
  // 1: notas longas (poucas colcheias), sem acidentes, saltos pequenos, região média
  if (d.sixteenths === 0 && share8 <= 0.25 && d.accidentals === 0 && k <= 2 && d.maxLeap <= 7 && d.high <= 79 && d.notes <= 64) return 1;
  // 2: colcheias, até 2 acidentes, até 3 alterações na armadura
  if (d.sixteenths === 0 && d.accidentals <= 2 && k <= 3 && d.maxLeap <= 9 && d.high <= 81 && d.perMeasure <= 6) return 2;
  // 3: algumas semicolcheias, mais acidentes
  if (share16 <= 0.2 && d.accidentals <= 6 && d.high <= 84 && d.perMeasure <= 8) return 3;
  // 4: semicolcheias frequentes, região aguda
  if (share16 <= 0.75 && d.accidentals <= 12 && d.high <= 88 && d.notes <= 200) return 4;
  return 5;
}

const ACC: Readonly<Record<number, string>> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };
const DUR: Readonly<Record<number, string>> = { 16: 'w', 12: 'h.', 8: 'h', 6: 'q.', 4: 'q', 3: 'e.', 2: 'e', 1: 's' };

/** Escreve compassos na notação compacta. */
export function toNotation(measures: readonly (readonly ScoreNote[])[]): string {
  return measures
    .map((bar) =>
      bar
        .flatMap((n) => {
          const parts = DUR[n.units] ? [n.units] : splitUnits(n.units);
          return parts.map((u, i) => {
            if (n.rest || !n.spelled) return `r${DUR[u]}`;
            const p = n.spelled;
            const tie = i < parts.length - 1 || n.tie ? '~' : '';
            return `${p.letter}${ACC[p.alter]}${p.octave}${DUR[u]}${tie}`;
          });
        })
        .join(' '),
    )
    .join(' | ');
}

/** Corta obras longas: no máximo `max` compassos (para a leitura caber numa sessão). */
export function excerpt(measures: readonly (readonly ScoreNote[])[], meter: Meter, max = 32): ScoreNote[][] {
  const ms = measures.map((b) => [...b]);
  if (ms.length <= max) return ms;
  const cut = ms.slice(0, max);
  // evita terminar com uma ligadura pendurada
  const last = cut[cut.length - 1]!;
  const tail = last[last.length - 1];
  if (tail && tail.tie) last[last.length - 1] = { ...tail, tie: false };
  void measureSize(meter);
  return cut;
}
