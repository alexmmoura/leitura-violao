/**
 * Representação de alturas — especificação §8.1 e §8.2.
 *
 * Duas camadas:
 *  - SpelledPitch (grafada): letra + alteração + oitava (índice científico, C4 = Dó central).
 *    Usada na notação, intervalos e enarmonia.
 *  - Número MIDI: altura absoluta, usada no braço, no áudio e nas comparações.
 *
 * Escrita × soante: o violão soa uma oitava abaixo do escrito. Os tipos de marca
 * (WrittenMidi / SoundingMidi) impedem, em tempo de compilação, que uma altura
 * escrita seja enviada ao braço/áudio ou que uma soante seja enviada à pauta.
 */

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const NATURAL_PC: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export type Alter = -2 | -1 | 0 | 1 | 2;
export const ALTERS: readonly Alter[] = [-2, -1, 0, 1, 2];

export interface SpelledPitch {
  readonly letter: Letter;
  readonly alter: Alter;
  /** Oitava no índice científico (C4 = Dó central). */
  readonly octave: number;
}

declare const pitchSpace: unique symbol;
/** Número MIDI de uma altura ESCRITA (como aparece na pauta). */
export type WrittenMidi = number & { readonly [pitchSpace]: 'written' };
/** Número MIDI de uma altura SOANTE (o que o instrumento produz). */
export type SoundingMidi = number & { readonly [pitchSpace]: 'sounding' };

export const asWritten = (n: number): WrittenMidi => n as WrittenMidi;
export const asSounding = (n: number): SoundingMidi => n as SoundingMidi;

export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter);
}

/** midi = 12 × (oitava + 1) + classe natural + alteração. */
export function spelledToMidi(p: SpelledPitch): number {
  return 12 * (p.octave + 1) + NATURAL_PC[p.letter] + p.alter;
}

export function writtenMidiOf(p: SpelledPitch): WrittenMidi {
  return asWritten(spelledToMidi(p));
}

/**
 * Único ponto de conversão escrita → soante (invariante da especificação §8.2).
 * Para o violão, transposition = −12.
 */
export function writtenToSounding(w: WrittenMidi, transposition: number): SoundingMidi {
  return asSounding(w + transposition);
}

export function soundingToWritten(s: SoundingMidi, transposition: number): WrittenMidi {
  return asWritten(s - transposition);
}

/** Índice diatônico absoluto (linha/espaço): cada passo = um grau na pauta. */
export function diatonicIndex(p: SpelledPitch): number {
  return p.octave * 7 + letterIndex(p.letter);
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function samePitch(a: SpelledPitch, b: SpelledPitch): boolean {
  return a.letter === b.letter && a.alter === b.alter && a.octave === b.octave;
}

// ---------- Frequência (temperamento igual) ----------

export function midiToFrequency(midi: number, aRef = 440): number {
  return aRef * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToMidi(freq: number, aRef = 440): number {
  return 69 + 12 * Math.log2(freq / aRef);
}

export function centsBetween(freq: number, reference: number): number {
  return 1200 * Math.log2(freq / reference);
}

// ---------- Nomes e exibição ----------

export type Naming = 'latin' | 'english';
/** 'scientific': C4 = Dó central. 'minus-one': Dó central = Dó3 (convenção de alguns softwares/tradições). */
export type OctaveConvention = 'scientific' | 'minus-one';

const LATIN: Readonly<Record<Letter, string>> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };
const ALTER_SYMBOL: Readonly<Record<Alter, string>> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

export function alterSymbol(alter: Alter): string {
  return ALTER_SYMBOL[alter];
}

export function letterName(letter: Letter, naming: Naming): string {
  return naming === 'latin' ? LATIN[letter] : letter;
}

export function pitchName(
  p: SpelledPitch,
  opts: { naming?: Naming; octaves?: OctaveConvention; withOctave?: boolean } = {},
): string {
  const { naming = 'latin', octaves = 'scientific', withOctave = true } = opts;
  const octave = octaves === 'scientific' ? p.octave : p.octave - 1;
  return `${letterName(p.letter, naming)}${alterSymbol(p.alter)}${withOctave ? octave : ''}`;
}

/** Lê um nome em notação inglesa gerado por pitchName (ex.: "F♯4", "B♭3"). */
export function parseEnglishPitchName(name: string): SpelledPitch | null {
  const m = /^([A-G])(𝄫|♭|♯|𝄪)?(-?\d+)$/u.exec(name);
  if (!m) return null;
  const alter = ({ '𝄫': -2, '♭': -1, '♯': 1, '𝄪': 2 } as Record<string, Alter>)[m[2] ?? ''] ?? 0;
  return { letter: m[1] as Letter, alter, octave: Number(m[3]) };
}

/** Chave no formato do VexFlow (ex.: "f#/4"). Recebe apenas a altura grafada ESCRITA. */
export function toVexKey(p: SpelledPitch): string {
  const acc = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }[p.alter];
  return `${p.letter.toLowerCase()}${acc}/${p.octave}`;
}

/** Símbolo de acidente do VexFlow. */
export function vexAccidental(alter: Alter): string {
  return { [-2]: 'bb', [-1]: 'b', 0: 'n', 1: '#', 2: '##' }[alter];
}
