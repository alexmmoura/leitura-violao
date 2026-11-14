import type { FretLocation, Instrument } from '../instrument/instrument';
import { soundingAt } from '../instrument/instrument';
import type { Chord } from '../theory/chords';
import { pitchClass, spelledToMidi } from '../theory/pitch';

/**
 * Sistema CAGED como MAPA HARMÔNICO — especificação §3.4 e §6.7.
 * Cinco formas móveis derivadas dos acordes abertos C, A, G, E, D. Cada forma é
 * ligada a uma posição de Leavitt ("a forma de Mi do acorde de Lá vive na V posição"),
 * para que os dois sistemas se reforcem em vez de competir.
 *
 * Moldes na afinação padrão (casas da corda 6 → 1; null = corda não tocada).
 */
export type CagedShape = 'C' | 'A' | 'G' | 'E' | 'D';
export const CAGED_ORDER: readonly CagedShape[] = ['C', 'A', 'G', 'E', 'D'];

interface Template {
  /** casas, da corda 6 à corda 1 */
  readonly frets: readonly (number | null)[];
  /** corda onde está a fundamental que define a forma */
  readonly rootString: number;
}

const MAJOR: Readonly<Record<CagedShape, Template>> = {
  C: { frets: [null, 3, 2, 0, 1, 0], rootString: 5 },
  A: { frets: [null, 0, 2, 2, 2, 0], rootString: 5 },
  G: { frets: [3, 2, 0, 0, 0, 3], rootString: 6 },
  E: { frets: [0, 2, 2, 1, 0, 0], rootString: 6 },
  D: { frets: [null, null, 0, 2, 3, 2], rootString: 4 },
};
/** Formas menores usuais (Am, Em, Dm); C e G menores não são formas práticas. */
const MINOR: Partial<Record<CagedShape, Template>> = {
  A: { frets: [null, 0, 2, 2, 1, 0], rootString: 5 },
  E: { frets: [0, 2, 2, 0, 0, 0], rootString: 6 },
  D: { frets: [null, null, 0, 2, 3, 1], rootString: 4 },
};

export interface CagedVoicing {
  readonly shape: CagedShape;
  readonly locs: FretLocation[];
  /** Deslocamento em casas a partir do acorde aberto (0 = o próprio acorde aberto). */
  readonly shift: number;
  /** Posição de Leavitt correspondente (casa do dedo 1 ≈ menor casa presa da forma). */
  readonly position: number;
}

export function cagedShapes(chord: Chord, inst: Instrument): CagedVoicing[] {
  const table = chord.quality === 'maj' ? MAJOR : chord.quality === 'min' ? MINOR : null;
  if (!table) return [];
  const rootPc = pitchClass(spelledToMidi(chord.root));
  const out: CagedVoicing[] = [];
  for (const shape of CAGED_ORDER) {
    const t = table[shape];
    if (!t) continue;
    const openRootFret = t.frets[6 - t.rootString]!;
    const openRootPc = pitchClass(soundingAt({ string: t.rootString, fret: openRootFret }, inst));
    const shift = (((rootPc - openRootPc) % 12) + 12) % 12;
    const locs: FretLocation[] = [];
    t.frets.forEach((f, i) => {
      if (f !== null) locs.push({ string: 6 - i, fret: f + shift });
    });
    if (locs.some((l) => l.fret > inst.frets)) continue;
    const fretted = locs.map((l) => l.fret).filter((f) => f > 0);
    // com deslocamento, a "pestana" (casas 0 do molde) vira o dedo 1
    const position = shift === 0 ? (fretted.length ? Math.min(...fretted) : 1) : Math.max(1, shift);
    out.push({ shape, locs, shift, position });
  }
  return out.sort((a, b) => a.position - b.position);
}

export const SHAPE_LABEL: Readonly<Record<CagedShape, string>> = { C: 'forma de Dó', A: 'forma de Lá', G: 'forma de Sol', E: 'forma de Mi', D: 'forma de Ré' };
