import { describe, expect, it } from 'vitest';
import { intervalBetween, intervalCode, intervalName, intervalSemitones, intervalsUpTo, parseIntervalCode, simpleNumber, transpose } from './intervals';
import type { SpelledPitch } from './pitch';

const sp = (letter: SpelledPitch['letter'], alter: SpelledPitch['alter'], octave: number): SpelledPitch => ({ letter, alter, octave });

describe('intervalos (§6.6)', () => {
  it('a qualidade depende da grafia', () => {
    expect(intervalCode(intervalBetween(sp('C', 0, 4), sp('D', 1, 4)))).toBe('A2');
    expect(intervalCode(intervalBetween(sp('C', 0, 4), sp('E', -1, 4)))).toBe('m3');
    expect(intervalBetween(sp('C', 0, 4), sp('D', 1, 4)).semitones).toBe(3);
  });
  it('casos clássicos', () => {
    const cases: [SpelledPitch, SpelledPitch, string][] = [
      [sp('C', 0, 4), sp('G', 0, 4), 'P5'],
      [sp('B', 0, 3), sp('F', 0, 4), 'd5'],
      [sp('F', 0, 4), sp('B', 0, 4), 'A4'],
      [sp('E', 0, 4), sp('F', 0, 4), 'm2'],
      [sp('C', 0, 4), sp('C', 0, 5), 'P8'],
      [sp('A', 0, 3), sp('F', 1, 4), 'M6'],
      [sp('C', 1, 4), sp('B', -1, 4), 'd7'],
      [sp('C', 0, 4), sp('D', 0, 5), 'M9'],
      [sp('G', 0, 4), sp('G', 0, 4), 'P1'],
    ];
    for (const [a, b, code] of cases) expect(intervalCode(intervalBetween(a, b)), `${code}`).toBe(code);
  });
  it('direção e ordem não mudam a medida', () => {
    const up = intervalBetween(sp('C', 0, 4), sp('A', 0, 4));
    const down = intervalBetween(sp('A', 0, 4), sp('C', 0, 4));
    expect(intervalCode(up)).toBe('M6');
    expect(intervalCode(down)).toBe('M6');
    expect(up.direction).toBe('asc');
    expect(down.direction).toBe('desc');
  });
  it('transposição mantém a grafia e é inversa da medida (todas as combinações)', () => {
    const roots = [sp('C', 0, 4), sp('F', 1, 3), sp('B', -1, 4), sp('E', 0, 3), sp('A', -1, 4)];
    for (const r of roots) {
      for (const iv of intervalsUpTo(4)) {
        for (const dir of ['asc', 'desc'] as const) {
          let t: SpelledPitch;
          try {
            t = transpose(r, iv, dir);
          } catch {
            continue; // exigiria triplo acidente
          }
          const m = intervalBetween(r, t);
          expect(intervalCode(m)).toBe(intervalCode(iv));
          expect(m.direction).toBe(dir);
        }
      }
    }
    expect(transpose(sp('E', 0, 4), parseIntervalCode('M3')!, 'asc')).toEqual(sp('G', 1, 4));
    expect(transpose(sp('F', 0, 4), parseIntervalCode('P4')!, 'asc')).toEqual(sp('B', -1, 4));
  });
  it('semitons, nomes e códigos', () => {
    expect(intervalSemitones({ number: 4, quality: 'A' })).toBe(6);
    expect(intervalSemitones({ number: 5, quality: 'd' })).toBe(6);
    expect(intervalSemitones({ number: 10, quality: 'M' })).toBe(16);
    expect(simpleNumber(9)).toBe(2);
    expect(simpleNumber(15)).toBe(8);
    expect(intervalName({ number: 3, quality: 'M' })).toBe('3ª maior');
    expect(intervalName({ number: 8, quality: 'P' })).toBe('oitava justa');
    expect(parseIntervalCode('M5')).toBeNull(); // 5ª não é maior
    expect(intervalsUpTo(1).map(intervalCode)).toEqual(['m2', 'M2', 'm3', 'M3']);
  });
});
