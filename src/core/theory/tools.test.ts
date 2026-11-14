import { describe, expect, it } from 'vitest';
import { chordLabel, chordsContaining, chordType, CIRCLE, harmonicField, identifyChords, inversions, noteName, PROGRESSIONS, progressionChords, SCALES, scalePcs, substitutions } from './tools';

describe('ferramentas de harmonia', () => {
  it('escalas', () => {
    const major = SCALES.find((s) => s.id === 'major')!;
    expect(scalePcs(0, major).map((p) => noteName(p))).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(scalePcs(5, major).map((p) => noteName(p, true))).toEqual(['F', 'G', 'A', 'B♭', 'C', 'D', 'E']);
    expect(noteName(1, true, true)).toBe('Ré♭');
  });

  it('campo harmônico maior e menor', () => {
    expect(harmonicField(0).map((f) => chordLabel(f.chord))).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
    expect(harmonicField(0, false, true).map((f) => chordLabel(f.chord))).toEqual(['C7M', 'Dm7', 'Em7', 'F7M', 'G7', 'Am7', 'Bm7(♭5)']);
    expect(harmonicField(9, true).map((f) => chordLabel(f.chord))).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G']);
    expect(harmonicField(0).map((f) => f.fn).join('')).toBe('TSTSDTD');
  });

  it('identifica acordes e inversões', () => {
    expect(chordLabel(identifyChords([0, 4, 7])[0]!)).toBe('C');
    expect(chordLabel(identifyChords([4, 7, 0], 4)[0]!)).toBe('C/E');
    const am7 = identifyChords([9, 0, 4, 7]).map((c) => chordLabel(c));
    expect(am7).toContain('Am7');
    expect(am7).toContain('C6');
    expect(identifyChords([0, 4])).toEqual([]);
    expect(inversions({ root: 0, type: chordType('') }).map((c) => chordLabel(c))).toEqual(['C/E', 'C/G']);
  });

  it('similaridade: acordes que contêm as notas', () => {
    const names = chordsContaining([0, 4]).map((c) => chordLabel(c));
    expect(names).toContain('C');
    expect(names).toContain('Am');
    expect(names).toContain('F7M');
    expect(names).not.toContain('G');
  });

  it('substituições e progressões', () => {
    const dom = substitutions(7, 'D').map((s) => chordLabel(s.chord, true));
    expect(dom).toContain('G7');
    expect(dom).toContain('D♭7'); // SubV7
    expect(dom).toContain('Bm7(♭5)');
    expect(substitutions(0, 'T').map((s) => chordLabel(s.chord))).toContain('Am7');
    expect(progressionChords(PROGRESSIONS[0]!, 0).map((x) => chordLabel(x.chord))).toEqual(['Dm', 'G7', 'C']);
  });

  it('ciclo das quintas', () => {
    expect(CIRCLE.map((c) => noteName(c.pc, c.fifths < 0)).join(' ')).toBe('C G D A E B F♯ D♭ A♭ E♭ B♭ F');
    expect(CIRCLE[1]).toMatchObject({ fifths: 1, minorPc: 4 });
  });
});
