import type { FretLocation, Instrument } from './instrument';

/**
 * Guitarra MIDI com captador hexafônico — especificação §15.7.
 * No "modo mono" desses sistemas, cada corda transmite num canal MIDI próprio,
 * então o canal identifica a corda e a nota identifica a casa: é a única forma
 * confiável de saber ONDE a nota foi tocada.
 *
 * `string1Channel`: canal (1–16) da corda 1; as demais seguem em sequência.
 */
export function midiGuitarLocation(channel: number, note: number, inst: Instrument, string1Channel: number): FretLocation | null {
  if (string1Channel < 1) return null;
  const string = channel - string1Channel + 1;
  const def = inst.strings[string - 1];
  if (!def) return null;
  const fret = note - def.openMidi;
  if (fret < inst.capo || fret > inst.frets) return null;
  return { string, fret };
}

export interface MidiNoteOn {
  readonly channel: number;
  readonly note: number;
  readonly velocity: number;
}

/** Decodifica uma mensagem MIDI; devolve só note-on reais (velocidade > 0). */
export function parseNoteOn(data: ArrayLike<number>): MidiNoteOn | null {
  if (data.length < 3) return null;
  const status = data[0]!;
  if ((status & 0xf0) !== 0x90) return null;
  const velocity = data[2]!;
  if (velocity === 0) return null; // note-on com velocidade 0 = note-off
  return { channel: (status & 0x0f) + 1, note: data[1]!, velocity };
}
