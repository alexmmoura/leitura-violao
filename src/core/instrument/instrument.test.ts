import { describe, expect, it } from 'vitest';
import { asSounding, asWritten, spelledToMidi, writtenToSounding } from '../theory/pitch';
import { locationsFor, makeGuitar, soundingAt, STANDARD_GUITAR, type FretLocation } from './instrument';
import { midiGuitarLocation, parseNoteOn } from './midiGuitar';
import { fingerFor, fixedPosition, fretWindow, inPosition, OPEN_POSITION, positionFromFinger2, positionLabel, roman } from './position';

const g = STANDARD_GUITAR; // 19 casas
const fromWritten = (letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', octave: number) =>
  writtenToSounding(asWritten(spelledToMidi({ letter, alter: 0, octave })), g.transposition);

describe('mapeamento L(s) — exemplos da especificação §8.4', () => {
  it('E3 escrito → só corda 6 solta', () => {
    expect(locationsFor(fromWritten('E', 3), g)).toEqual([{ string: 6, fret: 0 }]);
  });
  it('C4 escrito → (5,3) e (6,8)', () => {
    expect(locationsFor(fromWritten('C', 4), g)).toEqual([
      { string: 5, fret: 3 },
      { string: 6, fret: 8 },
    ]);
  });
  it('E5 escrito → 5 locais; (6,24) excluído com 19 casas', () => {
    expect(locationsFor(fromWritten('E', 5), g)).toEqual([
      { string: 1, fret: 0 },
      { string: 2, fret: 5 },
      { string: 3, fret: 9 },
      { string: 4, fret: 14 },
      { string: 5, fret: 19 },
    ]);
    expect(locationsFor(fromWritten('E', 5), makeGuitar({ frets: 24 }))).toContainEqual({ string: 6, fret: 24 });
  });
  it('G4 escrito → (3,0) (4,5) (5,10) (6,15)', () => {
    expect(locationsFor(fromWritten('G', 4), g)).toEqual([
      { string: 3, fret: 0 },
      { string: 4, fret: 5 },
      { string: 5, fret: 10 },
      { string: 6, fret: 15 },
    ]);
  });
});

describe('CA-NUC-1: L(s) coincide com força bruta para MIDI 40–83', () => {
  it('todas as alturas', () => {
    for (let m = 40; m <= 83; m++) {
      const brute: FretLocation[] = [];
      for (let s = 1; s <= 6; s++) for (let f = 0; f <= 19; f++) if (soundingAt({ string: s, fret: f }, g) === m) brute.push({ string: s, fret: f });
      expect(locationsFor(asSounding(m), g)).toEqual(brute);
    }
    expect(locationsFor(asSounding(39), g)).toEqual([]);
    expect(locationsFor(asSounding(84), g)).toEqual([]);
  });
});

describe('CA-NUC-6: outras afinações são só dados', () => {
  it('Ré drop altera apenas a corda 6', () => {
    const dropD = makeGuitar({ tuning: [64, 59, 55, 50, 45, 38] });
    expect(soundingAt({ string: 6, fret: 0 }, dropD)).toBe(38);
    expect(locationsFor(asSounding(38), dropD)).toEqual([{ string: 6, fret: 0 }]);
    expect(locationsFor(asSounding(45), dropD)).toEqual([
      { string: 5, fret: 0 },
      { string: 6, fret: 7 },
    ]);
  });
  it('capotraste limita as casas', () => {
    const capo2 = makeGuitar({ capo: 2 });
    expect(locationsFor(asSounding(40), capo2)).toEqual([]);
    expect(locationsFor(asSounding(42), capo2)).toContainEqual({ string: 6, fret: 2 });
  });
});

describe('guitarra MIDI hexafônica (§15.7)', () => {
  it('canal → corda, nota → casa', () => {
    expect(midiGuitarLocation(1, 64, g, 1)).toEqual({ string: 1, fret: 0 });
    expect(midiGuitarLocation(4, 57, g, 1)).toEqual({ string: 4, fret: 7 });
    expect(midiGuitarLocation(6, 40, g, 1)).toEqual({ string: 6, fret: 0 });
    expect(midiGuitarLocation(11, 45, g, 6)).toEqual({ string: 6, fret: 5 }); // corda 1 no canal 6
    expect(midiGuitarLocation(7, 50, g, 1)).toBeNull(); // canal sem corda
    expect(midiGuitarLocation(1, 63, g, 1)).toBeNull(); // abaixo da corda solta
    expect(midiGuitarLocation(1, 64, g, 0)).toBeNull(); // desligado
  });
  it('decodifica note-on', () => {
    expect(parseNoteOn([0x90, 64, 100])).toEqual({ channel: 1, note: 64, velocity: 100 });
    expect(parseNoteOn([0x95, 50, 1])).toEqual({ channel: 6, note: 50, velocity: 1 });
    expect(parseNoteOn([0x90, 64, 0])).toBeNull();
    expect(parseNoteOn([0x80, 64, 64])).toBeNull();
    expect(parseNoteOn([0xb0, 7, 100])).toBeNull();
  });
});

describe('posições (Leavitt, §8.5)', () => {
  it('janelas', () => {
    expect(fretWindow(fixedPosition(5), 19)).toMatchObject({ min: 5, max: 8 });
    expect(fretWindow(fixedPosition(5, { stretch1: true, stretch4: true }), 19)).toMatchObject({ min: 4, max: 9, baseMin: 5, baseMax: 8 });
    expect(fretWindow(OPEN_POSITION, 19)).toMatchObject({ min: 1, max: 4, openStrings: true });
  });
  it('dedos por casa, inclusive aberturas', () => {
    const v = fixedPosition(5, { stretch1: true, stretch4: true });
    expect(fingerFor({ string: 1, fret: 5 }, v, 19)).toBe(1);
    expect(fingerFor({ string: 1, fret: 8 }, v, 19)).toBe(4);
    expect(fingerFor({ string: 1, fret: 4 }, v, 19)).toBe(1);
    expect(fingerFor({ string: 1, fret: 9 }, v, 19)).toBe(4);
    expect(fingerFor({ string: 1, fret: 10 }, v, 19)).toBeNull();
    expect(fingerFor({ string: 1, fret: 0 }, OPEN_POSITION, 19)).toBe(0);
  });
  it('regra do dedo 2', () => {
    expect(positionFromFinger2(13)).toBe(12);
  });
  it('rótulos', () => {
    expect(roman(12)).toBe('XII');
    expect(roman(9)).toBe('IX');
    expect(positionLabel(fixedPosition(7, { stretch4: true }))).toBe('VII posição (abertura dedo 4)');
  });
});

describe('CA-NUC-5: unicidade dentro da posição (§8.6)', () => {
  const duplicates = (spec: Parameters<typeof inPosition>[1]) => {
    const dup: number[] = [];
    for (let m = 40; m <= 83; m++) {
      const inside = locationsFor(asSounding(m), g).filter((l) => inPosition(l, spec, g.frets));
      if (inside.length > 1) dup.push(m);
    }
    return dup;
  };
  it('sem aberturas e sem cordas soltas: no máximo um local por altura', () => {
    for (let p = 1; p <= 12; p++) expect(duplicates(fixedPosition(p))).toEqual([]);
  });
  it('com abertura do dedo 4: só o par Sol–Si duplica', () => {
    for (let p = 1; p <= 12; p++) {
      const spec = fixedPosition(p, { stretch4: true });
      const dup = duplicates(spec);
      expect(dup).toHaveLength(1);
      const locs = locationsFor(asSounding(dup[0]!), g).filter((l) => inPosition(l, spec, g.frets));
      expect(locs.map((l) => l.string).sort()).toEqual([2, 3]);
    }
  });
  it('posição aberta: Si (corda 3 casa 4 = corda 2 solta) é a duplicata clássica', () => {
    expect(duplicates(OPEN_POSITION)).toContain(59);
  });
});
