import { diatonicIndex, LETTERS, NATURAL_PC, spelledToMidi, type Alter, type SpelledPitch } from './pitch';

/**
 * Intervalos — especificação §6.6.
 * A QUALIDADE depende da grafia: Dó–Ré♯ é 2ª aumentada e Dó–Mi♭ é 3ª menor,
 * embora soem igual. Por isso o cálculo usa a camada grafada, não só semitons.
 */
export type Quality = 'dd' | 'd' | 'm' | 'P' | 'M' | 'A' | 'AA';

export interface Interval {
  /** Número do intervalo (1 = uníssono, 8 = oitava, 10 = décima…). */
  readonly number: number;
  readonly quality: Quality;
}

export interface MeasuredInterval extends Interval {
  readonly semitones: number;
  readonly direction: 'asc' | 'desc' | 'unison';
}

/** Semitons do intervalo maior/justo de cada número simples (1–8). */
const BASE: Readonly<Record<number, number>> = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12 };
const PERFECT = new Set([1, 4, 5, 8]);

export function isPerfectClass(number: number): boolean {
  return PERFECT.has(simpleNumber(number));
}

/** Reduz um intervalo composto ao simples (9 → 2, 15 → 8). 8 permanece 8. */
export function simpleNumber(number: number): number {
  if (number <= 8) return number;
  return ((number - 2) % 7) + 2;
}

function baseSemitones(number: number): number {
  const octaves = number <= 8 ? 0 : Math.floor((number - 2) / 7);
  return BASE[simpleNumber(number)]! + 12 * octaves;
}

/** Semitons de um intervalo (número + qualidade). */
export function intervalSemitones(iv: Interval): number {
  const base = baseSemitones(iv.number);
  if (isPerfectClass(iv.number)) {
    return base + ({ dd: -2, d: -1, P: 0, A: 1, AA: 2 } as Record<string, number>)[iv.quality]!;
  }
  return base + ({ dd: -3, d: -2, m: -1, M: 0, A: 1, AA: 2 } as Record<string, number>)[iv.quality]!;
}

function qualityFor(number: number, semitones: number): Quality | null {
  const diff = semitones - baseSemitones(number);
  if (isPerfectClass(number)) return ({ [-2]: 'dd', [-1]: 'd', 0: 'P', 1: 'A', 2: 'AA' } as Record<number, Quality>)[diff] ?? null;
  return ({ [-3]: 'dd', [-2]: 'd', [-1]: 'm', 0: 'M', 1: 'A', 2: 'AA' } as Record<number, Quality>)[diff] ?? null;
}

/** Intervalo entre duas notas grafadas (sempre medido da mais grave para a mais aguda). */
export function intervalBetween(a: SpelledPitch, b: SpelledPitch): MeasuredInterval {
  const da = diatonicIndex(a);
  const db = diatonicIndex(b);
  const ma = spelledToMidi(a);
  const mb = spelledToMidi(b);
  const [lowD, highD, lowM, highM] = da < db || (da === db && ma <= mb) ? [da, db, ma, mb] : [db, da, mb, ma];
  const number = highD - lowD + 1;
  const semitones = highM - lowM;
  const quality = qualityFor(number, semitones);
  if (!quality) throw new RangeError(`Intervalo não representável: ${number}ª com ${semitones} semitons`);
  const direction = da === db && ma === mb ? 'unison' : da < db || (da === db && ma < mb) ? 'asc' : 'desc';
  return { number, quality, semitones, direction };
}

/** Transpõe uma nota grafada por um intervalo, mantendo a grafia correta. */
export function transpose(p: SpelledPitch, iv: Interval, direction: 'asc' | 'desc'): SpelledPitch {
  const steps = (iv.number - 1) * (direction === 'asc' ? 1 : -1);
  const d = diatonicIndex(p) + steps;
  const letter = LETTERS[((d % 7) + 7) % 7]!;
  const octave = Math.floor(d / 7);
  const target = spelledToMidi(p) + (direction === 'asc' ? 1 : -1) * intervalSemitones(iv);
  const alter = target - (12 * (octave + 1) + NATURAL_PC[letter]);
  if (alter < -2 || alter > 2) throw new RangeError('Transposição exigiria acidente além de dobrado');
  return { letter, alter: alter as Alter, octave };
}

const QUALITY_PT: Readonly<Record<Quality, string>> = {
  dd: 'duplamente diminuta',
  d: 'diminuta',
  m: 'menor',
  P: 'justa',
  M: 'maior',
  A: 'aumentada',
  AA: 'duplamente aumentada',
};

export function qualityName(q: Quality): string {
  return QUALITY_PT[q];
}

export function intervalName(iv: Interval): string {
  if (iv.number === 1) return iv.quality === 'P' ? 'uníssono' : `uníssono ${QUALITY_PT[iv.quality].replace('a', 'o')}`;
  if (iv.number === 8 && iv.quality === 'P') return 'oitava justa';
  return `${iv.number}ª ${QUALITY_PT[iv.quality]}`;
}

/** Código curto estável (para ids): "M3", "P5", "A4", "d5". */
export function intervalCode(iv: Interval): string {
  return `${iv.quality}${iv.number}`;
}

export function parseIntervalCode(code: string): Interval | null {
  const m = /^(dd|d|m|P|M|A|AA)(\d+)$/.exec(code);
  if (!m) return null;
  const iv = { quality: m[1] as Quality, number: Number(m[2]) };
  return qualityFor(iv.number, intervalSemitones(iv)) === iv.quality ? iv : null;
}

/** Intervalos por nível do Módulo F (currículo §5). */
export const INTERVAL_LEVELS: readonly (readonly string[])[] = [
  ['m2', 'M2', 'm3', 'M3'],
  ['P4', 'P5', 'P8'],
  ['m6', 'M6', 'm7', 'M7'],
  ['A4', 'd5', 'A2', 'd7', 'A5', 'd4'],
];

export function intervalsUpTo(level: number): Interval[] {
  return INTERVAL_LEVELS.slice(0, Math.max(1, Math.min(level, INTERVAL_LEVELS.length)))
    .flat()
    .map((c) => parseIntervalCode(c)!);
}
