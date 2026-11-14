import { describe, expect, it } from 'vitest';
import { makeGuitar } from '../instrument/instrument';
import { melodyNotes } from '../melody/melody';
import { figureFor, measureSize } from '../rhythm/rhythm';
import { buildScoreMelody } from '../score/score';
import { RHYTHM_LESSONS, SOLFEGE_KEYS, SOLFEGE_LESSON_COUNT, solfegeLesson } from './lessons';

describe('lições numeradas', () => {
  it('ritmo: todo compasso fecha a conta e usa figuras desenháveis', () => {
    expect(RHYTHM_LESSONS.length).toBeGreaterThanOrEqual(40);
    for (const l of RHYTHM_LESSONS) {
      for (const m of l.measures) {
        expect(m.reduce((s, e) => s + e.units, 0), `lição ${l.n}`).toBe(measureSize(l.meter));
        for (const e of m) expect(() => figureFor(e.units)).not.toThrow();
      }
      expect(l.measures[0]!.some((e) => !e.rest)).toBe(true);
    }
  });

  it('solfejo: todas as lições montam, usam só as notas previstas e terminam na tônica', () => {
    const inst = makeGuitar();
    for (const k of SOLFEGE_KEYS) {
      for (let n = 1; n <= SOLFEGE_LESSON_COUNT; n++) {
        const l = solfegeLesson(k, n);
        const mel = buildScoreMelody(l.score, inst);
        const notes = melodyNotes(mel);
        const distinct = new Set(notes.map((x) => x.sounding));
        expect(distinct.size, `k${k} n${n}`).toBeLessThanOrEqual(l.size);
        // lições curtas (até 5 notas) usam o conjunto inteiro
        if (l.size <= 5) expect(distinct.size, `k${k} n${n}`).toBe(l.size);
        expect(distinct.size).toBeGreaterThanOrEqual(2);
        expect(notes[notes.length - 1]!.sounding).toBe(notes[0]!.sounding);
        // só notas da tonalidade: nenhum acidente desenhado
        expect(mel.events.every((e) => e.accidental === null)).toBe(true);
        for (const m of l.score.measures) expect(m.reduce((s, e) => s + e.units, 0)).toBe(measureSize(l.score.meter));
      }
    }
  });

  it('a mesma lição é sempre igual', () => {
    expect(solfegeLesson(0, 7).score.measures).toEqual(solfegeLesson(0, 7).score.measures);
    expect(solfegeLesson(0, 1).size).toBe(2);
    expect(solfegeLesson(0, 28).size).toBe(8);
  });
});
