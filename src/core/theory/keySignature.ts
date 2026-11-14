import type { Alter, Letter } from './pitch';

/**
 * Armadura representada pelo número de quintas: −7 (7 bemóis) … +7 (7 sustenidos).
 */
export type Fifths = number;

const SHARP_ORDER: readonly Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: readonly Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Alteração que a armadura impõe à letra (vale em todas as oitavas). */
export function keyAlterFor(letter: Letter, fifths: Fifths): Alter {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0;
  return 0;
}

const MAJOR_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MAJOR_LATIN = ['Dó♭', 'Sol♭', 'Ré♭', 'Lá♭', 'Mi♭', 'Si♭', 'Fá', 'Dó', 'Sol', 'Ré', 'Lá', 'Mi', 'Si', 'Fá♯', 'Dó♯'];
const MINOR_LATIN = ['Lá♭', 'Mi♭', 'Si♭', 'Fá', 'Dó', 'Sol', 'Ré', 'Lá', 'Mi', 'Si', 'Fá♯', 'Dó♯', 'Sol♯', 'Ré♯', 'Lá♯'];

export function assertFifths(fifths: Fifths): void {
  if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7) {
    throw new RangeError(`Armadura inválida: ${fifths}`);
  }
}

/** Nome da tonalidade maior aceito por Stave.addKeySignature do VexFlow. */
export function vexKeySpec(fifths: Fifths): string {
  assertFifths(fifths);
  return MAJOR_NAMES[fifths + 7]!;
}

export function keyLabel(fifths: Fifths): string {
  assertFifths(fifths);
  const n = Math.abs(fifths);
  const word = fifths > 0 ? (n > 1 ? 'sustenidos' : 'sustenido') : n > 1 ? 'bemóis' : 'bemol';
  const acc = fifths === 0 ? 'sem acidentes' : `${n} ${word}`;
  return `${MAJOR_LATIN[fifths + 7]} maior / ${MINOR_LATIN[fifths + 7]} menor (${acc})`;
}
