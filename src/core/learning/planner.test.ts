import { beforeAll, describe, expect, it } from 'vitest';
import { STANDARD_GUITAR, makeGuitar } from '../instrument/instrument';
import { buildCurriculum, locationsOfKc, questionForKc } from './curriculum';
import { parseKcId } from './kc';
import { createScheduler, LearningModel, type Scheduler } from './model';
import { SessionPlanner } from './planner';

const g = STANDARD_GUITAR;
let scheduler: Scheduler;
beforeAll(async () => {
  scheduler = await createScheduler();
});

const DAY = 86_400_000;
const T0 = Date.parse('2026-03-02T12:00:00Z');
const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);

describe('currículo', () => {
  const { items, stages } = buildCurriculum(g);

  it('começa pela posição aberta, cordas 1–3, sentido pauta → braço', () => {
    expect(stages[0]!.label).toContain('Posição aberta');
    expect(items[0]!.kcId.startsWith('pb:')).toBe(true);
    expect(items[0]!.kcId.endsWith('@open')).toBe(true);
    expect(stages.map((s) => s.label)).toContain('II posição · naturais');
  });

  it('ids únicos; todo item gera uma questão válida', () => {
    expect(new Set(items.map((i) => i.kcId)).size).toBe(items.length);
    for (const it of items) {
      const q = questionForKc(it.kcId, g, 1);
      expect(q, it.kcId).not.toBeNull();
      expect(q!.kcId).toBe(it.kcId);
    }
  });

  it('braço → pauta de um local só aparece depois do pauta → braço da mesma nota', () => {
    const seenSounding = new Set<number>();
    for (const it of items) {
      const ref = parseKcId(it.kcId)!;
      const q = questionForKc(it.kcId, g, 1)!;
      if (ref.kind === 'staff>fretboard') seenSounding.add(q.sounding);
      else expect(seenSounding.has(q.sounding), it.kcId).toBe(true);
    }
  });

  it('locais para o mapa de calor', () => {
    expect(locationsOfKc('pb:A4@p5', g)).toEqual([{ string: 4, fret: 7 }]);
    expect(locationsOfKc('bp:2:3@k0', g)).toEqual([{ string: 2, fret: 3 }]);
    expect(questionForKc('bp:1:22@k0', makeGuitar({ frets: 19 }), 1)).toBeNull();
  });
});

describe('agendador de sessão', () => {
  const { items } = buildCurriculum(g);
  const opts = { newPerDay: 10, newIntroducedToday: 0, durationMs: 10 * 60_000, seed: 5 };

  it('sem histórico: só itens novos, até o limite diário, depois prática extra', () => {
    const model = new LearningModel(scheduler);
    let now = T0;
    const p = new SessionPlanner(model, items, g, opts, () => now);
    const slots: string[] = [];
    let last: { kcId: string; correct: boolean } | undefined;
    for (let i = 0; i < 14; i++) {
      const q = p.next(last)!;
      slots.push(q.slot);
      model.apply({ ts: now, day: dayOf(now), kcId: q.question.kcId, correct: true, rtMs: 900 });
      last = { kcId: q.question.kcId, correct: true };
      now += 5000;
    }
    expect(slots.slice(0, 10).every((s) => s === 'new')).toBe(true);
    expect(slots.slice(10).every((s) => s === 'extra')).toBe(true);
  });

  it('erro → reaparece como reaprendizagem 3–6 itens depois, no máximo 2 vezes', () => {
    const model = new LearningModel(scheduler);
    let now = T0;
    const p = new SessionPlanner(model, items, g, { ...opts, newPerDay: 30 }, () => now);
    const first = p.next()!;
    const target = first.question.kcId;
    let last = { kcId: target, correct: false };
    const seq: { id: string; slot: string }[] = [];
    for (let i = 0; i < 20; i++) {
      const q = p.next(last)!;
      seq.push({ id: q.question.kcId, slot: q.slot });
      const wrong = q.question.kcId === target;
      last = { kcId: q.question.kcId, correct: !wrong };
      now += 1000;
    }
    const hits = seq.map((s, i) => ({ ...s, i })).filter((s) => s.id === target);
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => h.slot === 'relearn')).toBe(true);
    expect(hits[0]!.i).toBeGreaterThanOrEqual(2);
    expect(hits[0]!.i).toBeLessThanOrEqual(6);
  });

  it('revisões vencidas vêm primeiro (menor R) e reduzem o orçamento de novos', () => {
    const model = new LearningModel(scheduler);
    const ids = items.slice(0, 25).map((i) => i.kcId);
    ids.forEach((id, k) => model.apply({ ts: T0 + k, day: dayOf(T0), kcId: id, correct: true, rtMs: 1000 }));
    const later = T0 + 120 * DAY;
    const p = new SessionPlanner(model, items, g, opts, () => later);
    expect(p.dueTotal).toBe(25);
    expect(p.newBudget).toBe(10 - 2);
    const first = p.next()!;
    expect(first.slot).toBe('review');
    // 2 revisões : 1 novo
    const slots = [first.slot, ...Array.from({ length: 5 }, () => p.next({ kcId: 'x', correct: true })!.slot)];
    expect(slots).toEqual(['review', 'review', 'new', 'review', 'review', 'new']);
  });

  it('respeita o tempo da sessão', () => {
    const model = new LearningModel(scheduler);
    let now = T0;
    const p = new SessionPlanner(model, items, g, { ...opts, durationMs: 60_000 }, () => now);
    expect(p.next()).not.toBeNull();
    now += 61_000;
    expect(p.next({ kcId: 'x', correct: true })).toBeNull();
  });
});
