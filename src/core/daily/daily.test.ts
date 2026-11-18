import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../instrument/instrument';
import { generateMelody } from '../melody/melody';
import { ladderKcIds, ladderState, READING_LADDER, readingPassed } from './ladder';
import { buildDailyPlan, freshDailyState, loadDailyState, progressionOn, studyStreak, type DailyInputs } from './plan';

const inputs: DailyInputs = { dueNotes: 10, newNotesLeft: 5, otherDue: [{ module: 'intervals', count: 4 }], nextRhythmLesson: 3 };

describe('plano do dia', () => {
  it('divide o tempo entre as atividades e soma perto do total', () => {
    const p = buildDailyPlan(15, inputs);
    expect(p.map((a) => a.id)).toEqual(['notes', 'reviews', 'reading', 'rhythm', 'repertoire']);
    const sum = p.reduce((s, a) => s + a.minutes, 0);
    expect(Math.abs(sum - 15)).toBeLessThanOrEqual(2);
    expect(p.find((a) => a.id === 'reviews')!.minutes).toBe(2); // 4 itens × 30 s
  });

  it('atividades desligadas saem e o tempo vai para as outras', () => {
    const p = buildDailyPlan(10, inputs, new Set(['rhythm', 'repertoire', 'reviews']));
    expect(p.map((a) => a.id)).toEqual(['notes', 'reading']);
    expect(p[0]!.minutes + p[1]!.minutes).toBe(10);
  });

  it('sem revisões vencidas e com todas as lições feitas, essas atividades não aparecem', () => {
    const p = buildDailyPlan(10, { ...inputs, otherDue: [], nextRhythmLesson: null });
    expect(p.map((a) => a.id)).toEqual(['notes', 'reading', 'repertoire']);
  });

  it('estado de outro dia é descartado', () => {
    const s = { ...freshDailyState('2026-11-17', 20), done: ['notes'] };
    expect(loadDailyState(JSON.stringify(s), '2026-11-18', 15)).toEqual(freshDailyState('2026-11-18', 15));
    expect(loadDailyState(JSON.stringify(s), '2026-11-17', 15).done).toEqual(['notes']);
    expect(loadDailyState('{lixo', '2026-11-18', 15).minutes).toBe(15);
  });

  it('nível fixado na edição desliga a progressão', () => {
    expect(progressionOn(freshDailyState('d', 15))).toBe(true);
    expect(progressionOn({ ...freshDailyState('d', 15), readingLevel: 2 })).toBe(false);
  });

  it('conta os dias seguidos de estudo', () => {
    expect(studyStreak(new Set(['2026-11-16', '2026-11-17', '2026-11-18']), '2026-11-18')).toBe(3);
    expect(studyStreak(new Set(['2026-11-16', '2026-11-17']), '2026-11-18')).toBe(2); // hoje ainda não estudou
    expect(studyStreak(new Set(['2026-11-15']), '2026-11-18')).toBe(0);
  });
});

describe('escada de dificuldade da leitura', () => {
  const ids = ladderKcIds();
  const at = (i: number, ok: boolean, ts: number) => ({ ts, kcId: ids[i]!, correct: ok });

  it('todo degrau gera uma frase', () => {
    for (const s of READING_LADDER) expect(() => generateMelody(s.config, STANDARD_GUITAR, 7)).not.toThrow();
    expect(new Set(ids).size).toBe(READING_LADDER.length);
  });

  it('sobe com 3 aprovadas seguidas e desce com 2 reprovadas', () => {
    expect(ladderState([]).level).toBe(0);
    expect(ladderState([at(0, true, 1), at(0, true, 2), at(0, true, 3)]).level).toBe(1);
    expect(ladderState([at(0, true, 1), at(0, false, 2), at(0, true, 3), at(0, true, 4)]).level).toBe(0);
    const up2 = [1, 2, 3].map((t) => at(0, true, t)).concat([4, 5, 6].map((t) => at(1, true, t)));
    expect(ladderState(up2).level).toBe(2);
    expect(ladderState([...up2, at(2, false, 7), at(2, false, 8)]).level).toBe(1);
  });

  it('frases de outros degraus não mexem na escada; nunca desce abaixo do primeiro', () => {
    expect(ladderState([at(5, true, 1), at(5, true, 2), at(5, true, 3)]).level).toBe(0);
    expect(ladderState([at(0, false, 1), at(0, false, 2), at(0, false, 3)]).level).toBe(0);
  });

  it('aprovação de frase', () => {
    expect(readingPassed({ notesInTime: 0.95, continuity: null })).toBe(true);
    expect(readingPassed({ notesInTime: 0.9, continuity: 0.8 })).toBe(false);
  });
});
