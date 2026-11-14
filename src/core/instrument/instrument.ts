import { asSounding, type SoundingMidi } from '../theory/pitch';

/**
 * Modelo de instrumento — especificação §8.4.
 * Outras afinações, número de cordas e instrumentos são apenas DADOS.
 */
export interface StringDef {
  /** Altura soante da corda solta. */
  readonly openMidi: SoundingMidi;
  /** Espessura relativa, só para desenho. */
  readonly gauge: number;
}

export interface Instrument {
  readonly id: string;
  readonly name: string;
  /** Semitons somados à altura escrita para obter a soante (violão: −12). */
  readonly transposition: number;
  /** Índice 0 = corda 1 (a mais aguda). */
  readonly strings: readonly StringDef[];
  readonly frets: number;
  readonly capo: number;
}

/** Corda (1 = mais aguda) e casa absoluta (0 = solta). */
export interface FretLocation {
  readonly string: number;
  readonly fret: number;
}

export const STANDARD_TUNING: readonly number[] = [64, 59, 55, 50, 45, 40];

export function makeGuitar(opts: { frets?: number; capo?: number; tuning?: readonly number[]; name?: string } = {}): Instrument {
  const tuning = opts.tuning ?? STANDARD_TUNING;
  return {
    id: 'guitar',
    name: opts.name ?? 'Violão (afinação padrão)',
    transposition: -12,
    strings: tuning.map((m, i) => ({ openMidi: asSounding(m), gauge: 1 + i * 0.45 })),
    frets: opts.frets ?? 19,
    capo: opts.capo ?? 0,
  };
}

export const STANDARD_GUITAR: Instrument = makeGuitar();

export function stringCount(inst: Instrument): number {
  return inst.strings.length;
}

function openOf(inst: Instrument, string: number): SoundingMidi {
  const s = inst.strings[string - 1];
  if (!s) throw new RangeError(`Corda ${string} inexistente`);
  return s.openMidi;
}

export function isPlayable(loc: FretLocation, inst: Instrument): boolean {
  return loc.string >= 1 && loc.string <= inst.strings.length && loc.fret >= inst.capo && loc.fret <= inst.frets;
}

/** Altura soante de um local. */
export function soundingAt(loc: FretLocation, inst: Instrument): SoundingMidi {
  return asSounding(openOf(inst, loc.string) + loc.fret);
}

/**
 * L(s) = { (i, c) | c = s − solta[i], capotraste ≤ c ≤ casas } — TODAS as localizações,
 * da corda 1 para a 6.
 */
export function locationsFor(s: SoundingMidi, inst: Instrument): FretLocation[] {
  const out: FretLocation[] = [];
  inst.strings.forEach((str, i) => {
    const fret = s - str.openMidi;
    if (fret >= inst.capo && fret <= inst.frets) out.push({ string: i + 1, fret });
  });
  return out;
}

export function lowestSounding(inst: Instrument): SoundingMidi {
  return asSounding(Math.min(...inst.strings.map((s) => s.openMidi)) + inst.capo);
}

export function highestSounding(inst: Instrument): SoundingMidi {
  return asSounding(Math.max(...inst.strings.map((s) => s.openMidi)) + inst.frets);
}

export function sameLocation(a: FretLocation, b: FretLocation): boolean {
  return a.string === b.string && a.fret === b.fret;
}

export function locationKey(l: FretLocation): string {
  return `${l.string}:${l.fret}`;
}
