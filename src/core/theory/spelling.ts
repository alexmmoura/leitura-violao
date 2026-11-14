import { keyAlterFor, type Fifths } from './keySignature';
import { ALTERS, LETTERS, NATURAL_PC, spelledToMidi, type Alter, type SpelledPitch } from './pitch';

/**
 * Grafia (camada MIDI → grafada) — especificação §8.3.
 * MIDI → grafia NÃO é função: exige contexto.
 */

/** Todas as grafias possíveis (alteração de −2 a +2) para um número MIDI. */
export function spellingsForMidi(midi: number, maxAbsAlter: 1 | 2 = 2): SpelledPitch[] {
  const out: SpelledPitch[] = [];
  for (const letter of LETTERS) {
    for (const alter of ALTERS) {
      if (Math.abs(alter) > maxAbsAlter) continue;
      const base = midi - NATURAL_PC[letter] - alter;
      if (base % 12 !== 0) continue;
      const octave = base / 12 - 1;
      out.push({ letter, alter, octave });
    }
  }
  return out;
}

/** Grafias "simples": sem dobrados e sem Mi♯, Si♯, Fá♭, Dó♭. */
export function isSimpleSpelling(p: SpelledPitch): boolean {
  if (Math.abs(p.alter) > 1) return false;
  if (p.alter === 1 && (p.letter === 'E' || p.letter === 'B')) return false;
  if (p.alter === -1 && (p.letter === 'F' || p.letter === 'C')) return false;
  return true;
}

export type Direction = 'up' | 'down' | 'none';

/**
 * Grafia preferida:
 *  1. se a nota é diatônica na armadura, a grafia da tonalidade;
 *  2. senão, sustenido em tonalidades com sustenidos / subindo; bemol com bemóis / descendo;
 *  3. em Dó maior sem direção, sustenido (as duas são aceitas na validação).
 */
export function preferredSpelling(midi: number, fifths: Fifths = 0, direction: Direction = 'none'): SpelledPitch {
  const options = spellingsForMidi(midi, 2);
  const diatonic = options.find((p) => keyAlterFor(p.letter, fifths) === p.alter);
  if (diatonic) return diatonic;
  const simple = options.filter(isSimpleSpelling);
  const wantFlat = direction === 'down' || (direction === 'none' && fifths < 0);
  const pick = simple.find((p) => (wantFlat ? p.alter === -1 : p.alter === 1)) ?? simple[0] ?? options[0];
  if (!pick) throw new Error(`Sem grafia para MIDI ${midi}`);
  return pick;
}

/** Duas grafias são enarmônicas se soam igual com grafias diferentes. */
export function areEnharmonic(a: SpelledPitch, b: SpelledPitch): boolean {
  return spelledToMidi(a) === spelledToMidi(b) && (a.letter !== b.letter || a.alter !== b.alter);
}

export function withAlter(p: SpelledPitch, alter: Alter): SpelledPitch {
  return { ...p, alter };
}
