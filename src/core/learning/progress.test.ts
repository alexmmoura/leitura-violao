import { beforeAll, describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../instrument/instrument';
import { createScheduler, LearningModel, type Scheduler } from './model';
import { aggregateCells, cellState, groupStats, weekStartOf, weeklyStats } from './progress';

let scheduler: Scheduler;
beforeAll(async () => {
  scheduler = await createScheduler();
});
const T0 = Date.parse('2026-03-02T12:00:00Z'); // segunda-feira
const DAY = 86_400_000;
const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);

describe('mapa de calor', () => {
  it('diferencia "não treinado" de "baixo acerto" e mapeia itens para células', () => {
    const m = new LearningModel(scheduler);
    // A4 escrito na V posição → corda 4, casa 7; 6 erros em 2 dias
    for (let d = 0; d < 2; d++) for (let k = 0; k < 3; k++) m.apply({ ts: T0 + d * DAY + k, day: dayOf(T0 + d * DAY), kcId: 'pb:A4@p5', correct: false, rtMs: 3000 });
    m.apply({ ts: T0, day: dayOf(T0), kcId: 'bp:1:0@k0', correct: true, rtMs: 900 });
    const cells = aggregateCells(m, STANDARD_GUITAR, T0 + DAY);
    expect(cellState(cells.get('4:7'))).toBe('unstable');
    expect(cellState(cells.get('1:0'))).toBe('acquiring');
    expect(cellState(cells.get('2:3'))).toBe('untrained');
    expect(cells.get('4:7')!.n).toBe(6);
    expect(aggregateCells(m, STANDARD_GUITAR, T0, 'fretboard>staff').has('4:7')).toBe(false);

    const g = groupStats(cells, STANDARD_GUITAR);
    expect(g.byString[3]!.n).toBe(6);
    expect(g.byString[3]!.accuracy).toBe(0);
    expect(g.byString[0]!.accuracy).toBe(1);
    expect(g.byRegion[1]!.label).toBe('Casas 5–9');
    expect(g.byRegion[1]!.n).toBe(6);
  });
});

describe('evolução semanal', () => {
  it('semana começa na segunda', () => {
    expect(weekStartOf('2026-03-02')).toBe('2026-03-02');
    expect(weekStartOf('2026-03-08')).toBe('2026-03-02');
    expect(weekStartOf('2026-03-09')).toBe('2026-03-09');
  });
  it('agrega por semana', () => {
    const w = weeklyStats([
      { day: '2026-03-02', correct: true, rtMs: 1000 },
      { day: '2026-03-03', correct: false, rtMs: 3000 },
      { day: '2026-03-10', correct: true, rtMs: 800 },
    ]);
    expect(w).toEqual([
      { weekStart: '2026-03-02', n: 2, accuracy: 0.5, medianMs: 1000, days: 2 },
      { weekStart: '2026-03-09', n: 1, accuracy: 1, medianMs: 800, days: 1 },
    ]);
  });
});
