import { describe, expect, it } from 'vitest';
import { resolveMeasure, displayedAccidental, type NotatedNote } from './accidentals';
import { keyAlterFor, keyLabel, vexKeySpec } from './keySignature';
import {
  asWritten,
  centsBetween,
  diatonicIndex,
  frequencyToMidi,
  midiToFrequency,
  parseEnglishPitchName,
  pitchName,
  spelledToMidi,
  toVexKey,
  writtenToSounding,
  type SpelledPitch,
} from './pitch';
import { areEnharmonic, preferredSpelling, spellingsForMidi } from './spelling';

const sp = (letter: SpelledPitch['letter'], alter: SpelledPitch['alter'], octave: number): SpelledPitch => ({ letter, alter, octave });

describe('pitch', () => {
  it('converte grafia em MIDI (índice científico)', () => {
    expect(spelledToMidi(sp('C', 0, 4))).toBe(60);
    expect(spelledToMidi(sp('A', 0, 4))).toBe(69);
    expect(spelledToMidi(sp('E', 0, 2))).toBe(40);
    expect(spelledToMidi(sp('B', 1, 3))).toBe(60); // Si♯3 = Dó4
    expect(spelledToMidi(sp('C', -1, 4))).toBe(59); // Dó♭4 = Si3
    expect(spelledToMidi(sp('F', 2, 4))).toBe(67); // Fá𝄪 = Sol
  });

  it('escrita → soante: violão soa uma oitava abaixo', () => {
    expect(writtenToSounding(asWritten(52), -12)).toBe(40); // E3 escrito = E2 soante (corda 6)
    expect(writtenToSounding(asWritten(76), -12)).toBe(64); // E5 escrito = E4 soante (corda 1)
  });

  it('frequência e cents', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToFrequency(40)).toBeCloseTo(82.4069, 3);
    expect(midiToFrequency(64)).toBeCloseTo(329.6276, 3);
    expect(frequencyToMidi(440)).toBeCloseTo(69, 9);
    expect(centsBetween(440 * Math.pow(2, 1 / 12), 440)).toBeCloseTo(100, 6);
    expect(midiToFrequency(69, 415)).toBeCloseTo(415, 6);
  });

  it('índice diatônico conta linhas e espaços', () => {
    expect(diatonicIndex(sp('G', 0, 4)) - diatonicIndex(sp('E', 0, 4))).toBe(2); // Mi→Sol = terça
    expect(diatonicIndex(sp('C', 0, 5)) - diatonicIndex(sp('B', 0, 4))).toBe(1);
  });

  it('nomes nas duas convenções', () => {
    expect(pitchName(sp('F', 1, 4))).toBe('Fá♯4');
    expect(pitchName(sp('F', 1, 4), { naming: 'english' })).toBe('F♯4');
    expect(pitchName(sp('C', 0, 4), { octaves: 'minus-one' })).toBe('Dó3');
    expect(toVexKey(sp('B', -1, 3))).toBe('bb/3');
    for (const p of [sp('F', 1, 4), sp('B', -1, 3), sp('C', 0, 6), sp('E', -2, 5), sp('G', 2, 2)]) {
      expect(parseEnglishPitchName(pitchName(p, { naming: 'english' }))).toEqual(p);
    }
    expect(parseEnglishPitchName('H4')).toBeNull();
  });
});

describe('armaduras', () => {
  it('alteração por letra', () => {
    expect(keyAlterFor('F', 1)).toBe(1);
    expect(keyAlterFor('C', 1)).toBe(0);
    expect(keyAlterFor('B', -1)).toBe(-1);
    expect(keyAlterFor('E', -1)).toBe(0);
    expect(keyAlterFor('E', -2)).toBe(-1);
    expect(keyAlterFor('B', 7)).toBe(1);
    expect(keyAlterFor('F', -7)).toBe(-1);
  });
  it('nomes', () => {
    expect(vexKeySpec(0)).toBe('C');
    expect(vexKeySpec(3)).toBe('A');
    expect(vexKeySpec(-2)).toBe('Bb');
    expect(keyLabel(2)).toContain('2 sustenidos');
    expect(keyLabel(-1)).toContain('1 bemol');
    expect(keyLabel(-3)).toContain('3 bemóis');
    expect(() => vexKeySpec(8)).toThrow();
  });
});

describe('vigência de acidentes (§9.2)', () => {
  const n = (letter: NotatedNote['letter'], octave: number, explicit: NotatedNote['explicit'] = null, tiedFrom?: NotatedNote['tiedFrom']): NotatedNote =>
    tiedFrom === undefined ? { letter, octave, explicit } : { letter, octave, explicit, tiedFrom };

  it('acidente vale até o fim do compasso na mesma oitava', () => {
    const r = resolveMeasure([n('F', 4, 1), n('F', 4)], 0);
    expect(r.map((x) => x.alter)).toEqual([1, 1]);
    expect(r[1]!.source).toBe('measure');
  });
  it('acidente NÃO se propaga para outra oitava', () => {
    const r = resolveMeasure([n('F', 4, 1), n('F', 5)], 0);
    expect(r[1]).toEqual({ alter: 0, source: 'none' });
  });
  it('armadura vale em todas as oitavas', () => {
    const r = resolveMeasure([n('F', 4), n('F', 5), n('F', 3)], 1);
    expect(r.map((x) => x.alter)).toEqual([1, 1, 1]);
    expect(r.every((x) => x.source === 'key')).toBe(true);
  });
  it('bequadro cancela armadura até a barra', () => {
    const r = resolveMeasure([n('F', 4, 0), n('F', 4), n('F', 5)], 1);
    expect(r.map((x) => x.alter)).toEqual([0, 0, 1]);
  });
  it('novo acidente substitui o anterior', () => {
    const r = resolveMeasure([n('C', 5, 1), n('C', 5, 0), n('C', 5)], 0);
    expect(r.map((x) => x.alter)).toEqual([1, 0, 0]);
  });
  it('ligadura através da barra herda a alteração', () => {
    const r = resolveMeasure([n('G', 4, null, 1), n('G', 4)], 0);
    expect(r[0]).toEqual({ alter: 1, source: 'tie' });
    expect(r[1]).toEqual({ alter: 0, source: 'none' });
  });
  it('acidente explícito vence a ligadura', () => {
    const r = resolveMeasure([n('G', 4, 0, 1)], 0);
    expect(r[0]).toEqual({ alter: 0, source: 'explicit' });
  });
  it('acidente desenhado só quando difere da armadura', () => {
    expect(displayedAccidental('F', 1, 1)).toBeNull();
    expect(displayedAccidental('F', 0, 1)).toBe(0); // bequadro
    expect(displayedAccidental('C', 1, 1)).toBe(1);
    expect(displayedAccidental('C', 0, 0)).toBeNull();
  });
});

describe('grafia (§8.3)', () => {
  it('lista enarmônicos', () => {
    const names = spellingsForMidi(61).map((p) => pitchName(p, { naming: 'english' }));
    expect(names).toEqual(expect.arrayContaining(['C♯4', 'D♭4', 'B𝄪3']));
  });
  it('prefere a grafia diatônica da tonalidade', () => {
    expect(preferredSpelling(66, 1)).toEqual(sp('F', 1, 4)); // Sol maior
    expect(preferredSpelling(70, -1)).toEqual(sp('B', -1, 4)); // Fá maior
    expect(preferredSpelling(66, -1)).toEqual(sp('G', -1, 4)); // cromática em tom com bemóis
    expect(preferredSpelling(66, 0, 'down')).toEqual(sp('G', -1, 4));
    expect(preferredSpelling(66, 0)).toEqual(sp('F', 1, 4));
  });
  it('enarmonia', () => {
    expect(areEnharmonic(sp('F', 1, 4), sp('G', -1, 4))).toBe(true);
    expect(areEnharmonic(sp('F', 1, 4), sp('F', 1, 4))).toBe(false);
  });
});
