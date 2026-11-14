import { useEffect, useRef } from 'react';
import { midiGuitarLocation, parseNoteOn } from '../core/instrument/midiGuitar';
import type { FretLocation, Instrument } from '../core/instrument/instrument';

/**
 * Entrada Web MIDI (opcional) para guitarras com captador hexafônico — §15.7.
 * Sem hardware MIDI, nada disto é usado.
 */
type Listener = (data: Uint8Array, timeStamp: number) => void;

let access: Promise<MIDIAccess> | null = null;
const listeners = new Set<Listener>();

export function midiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

/** Pede acesso ao MIDI (o navegador pode perguntar ao usuário) e devolve as entradas. */
export async function connectMidi(): Promise<string[]> {
  if (!midiSupported()) throw new Error('Este navegador não oferece Web MIDI.');
  if (!access) {
    access = navigator.requestMIDIAccess({ sysex: false });
    const a = await access;
    const bind = () => {
      for (const input of a.inputs.values()) {
        input.onmidimessage = (e: MIDIMessageEvent) => {
          if (!e.data) return;
          for (const l of listeners) l(e.data, e.timeStamp);
        };
      }
    };
    bind();
    a.onstatechange = bind;
  }
  const a = await access;
  return [...a.inputs.values()].map((i) => i.name ?? i.id);
}

/**
 * Recebe locais (corda, casa) tocados na guitarra MIDI enquanto `active`.
 * `timeStamp` está no relógio do performance.now (como os eventos de mouse).
 */
export function useMidiLocations(cb: (loc: FretLocation, timeStamp: number) => void, active: boolean, inst: Instrument, string1Channel: number) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active || string1Channel < 1 || !access) return;
    const l: Listener = (data, ts) => {
      const on = parseNoteOn(data);
      if (!on) return;
      const loc = midiGuitarLocation(on.channel, on.note, inst, string1Channel);
      if (loc) ref.current(loc, ts);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, [active, inst, string1Channel]);
}
