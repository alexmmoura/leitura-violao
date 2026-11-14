import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../instrument/instrument';
import { fixedPosition, inPosition, OPEN_POSITION } from '../instrument/position';
import { spelledToMidi, type SpelledPitch } from '../theory/pitch';
import { buildFretQuestion, evaluateStaffAnswer, generateFretQuestion, type StaffAnswer } from './fretQuestion';
import type { NoteQuestionConfig } from './noteQuestion';
import { buildPositionTest, evaluatePositionTest } from './positionTest';
import { createRng } from './rng';

const g = STANDARD_GUITAR;
const sp = (letter: SpelledPitch['letter'], alter: SpelledPitch['alter'], octave: number): SpelledPitch => ({ letter, alter, octave });
const ans = (letter: StaffAnswer['letter'], octave: number, accidental: StaffAnswer['accidental'] = null): StaffAnswer => ({ letter, octave, accidental });

describe('braço → pauta (§8.3)', () => {
  it('corda 4 casa 4 em Dó maior: Fá♯4 e Sol♭4 escritos são aceitos', () => {
    const q = buildFretQuestion(sp('F', 1, 4), { string: 4, fret: 4 }, 0, g, 1);
    expect(q.sounding).toBe(54);
    expect(evaluateStaffAnswer(q, ans('F', 4, 1)).correct).toBe(true);
    expect(evaluateStaffAnswer(q, ans('G', 4, -1)).correct).toBe(true);
  });
  it('em Sol maior, Fá♯ é diatônico: exige a grafia da tonalidade', () => {
    const q = buildFretQuestion(sp('F', 1, 4), { string: 4, fret: 4 }, 1, g, 1);
    expect(q.requireSpelling).toBe(true);
    expect(evaluateStaffAnswer(q, ans('F', 4)).correct).toBe(true); // armadura faz o Fá virar Fá♯
    const r = evaluateStaffAnswer(q, ans('G', 4, -1));
    expect(r.correct).toBe(false);
    expect(r.error).toBe('ENHARMONIC');
  });
  it('bequadro em Sol maior → armadura ignorada', () => {
    const q = buildFretQuestion(sp('F', 1, 4), { string: 4, fret: 4 }, 1, g, 1);
    expect(evaluateStaffAnswer(q, ans('F', 4, 0)).error).toBe('KEY_ACCIDENTAL');
  });
  it('erros de oitava, terça e grau', () => {
    const q = buildFretQuestion(sp('E', 0, 5), { string: 1, fret: 0 }, 0, g, 1);
    expect(evaluateStaffAnswer(q, ans('E', 4)).error).toBe('OCTAVE');
    expect(evaluateStaffAnswer(q, ans('G', 5)).error).toBe('LINE_SPACE');
    expect(evaluateStaffAnswer(q, ans('F', 5)).error).toBe('STEP');
    expect(evaluateStaffAnswer(q, ans('B', 5)).error).toBe('OTHER');
  });
  it('dobrados nunca são aceitos sem exigência explícita', () => {
    const q = buildFretQuestion(sp('G', 0, 4), { string: 4, fret: 5 }, 0, g, 1);
    const r = evaluateStaffAnswer(q, ans('F', 4, 2));
    expect(r.correct).toBe(false);
    expect(r.error).toBe('ENHARMONIC');
  });
  it('o local gerado sempre produz a altura esperada', () => {
    const cfg: NoteQuestionConfig = {
      fifths: -2, accidentals: 'chromatic', strings: [1, 2, 3, 4, 5, 6], position: fixedPosition(5, { stretch4: true }),
      minFret: 0, maxFret: 19, minWritten: 0, maxWritten: 200, answerMode: 'any',
    };
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const q = generateFretQuestion(cfg, g, rng.int(0, 2 ** 31));
      expect(g.strings[q.location.string - 1]!.openMidi + q.location.fret).toBe(q.sounding);
      expect(spelledToMidi(q.written) - 12).toBe(q.sounding);
      expect(inPosition(q.location, cfg.position, g.frets)).toBe(true);
    }
  });
});

describe('teste de conclusão de posição (§6.3)', () => {
  for (const [name, spec] of [
    ['V posição', fixedPosition(5)],
    ['II posição com aberturas', fixedPosition(2, { stretch1: true, stretch4: true })],
    ['posição aberta', OPEN_POSITION],
  ] as const) {
    it(`${name}: 40 itens, cordas equilibradas, acidente em cada corda, sem repetição imediata`, () => {
      const test = buildPositionTest(spec, g, 99);
      expect(test).toHaveLength(40);
      const perString = new Map<number, number>();
      const accPerString = new Map<number, number>();
      for (const q of test) {
        expect(q.valid.length).toBeGreaterThan(0);
        // o local que originou o item é o da corda contada
        const s = q.valid[0]!.string;
        perString.set(s, (perString.get(s) ?? 0) + 1);
        if (q.written.alter !== 0) accPerString.set(s, (accPerString.get(s) ?? 0) + 1);
      }
      expect(perString.size).toBe(6);
      for (let i = 1; i < test.length; i++) expect(test[i]!.sounding).not.toBe(test[i - 1]!.sounding);
      expect(accPerString.size).toBeGreaterThanOrEqual(5);
      expect(buildPositionTest(spec, g, 99)).toEqual(test); // reprodutível
    });
  }

  it('critério de aprovação: ≥ 95 % e mediana ≤ 1,5 s', () => {
    const ok = (n: number, ms: number) => Array.from({ length: n }, () => ({ correct: true, rtMs: ms }));
    const bad = (n: number) => Array.from({ length: n }, () => ({ correct: false, rtMs: 5000 }));
    expect(evaluatePositionTest([...ok(38, 1200), ...bad(2)]).passed).toBe(true);
    expect(evaluatePositionTest([...ok(37, 1200), ...bad(3)]).passed).toBe(false);
    expect(evaluatePositionTest(ok(40, 1600)).passed).toBe(false);
    expect(evaluatePositionTest([]).passed).toBe(false);
  });
});
