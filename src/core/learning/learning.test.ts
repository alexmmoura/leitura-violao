import { beforeAll, describe, expect, it } from 'vitest';
import { fixedPosition, OPEN_POSITION } from '../instrument/position';
import { bpId, canonicalKcId, parseKcId, parsePositionKey, pbId } from './kc';
import { fluencyMs, median, updateFluency, EMPTY_FLUENCY, wilsonLower } from './metrics';
import { createScheduler, LearningModel, type AttemptLike, type Scheduler } from './model';
import { deriveGrade, gradeAttempt, PEDAGOGICAL_TARGETS, personalTargets } from './rating';
import { kindOfKc, qualityFromSymbol } from './kinds';
import { dueByModule } from './reviews';

let scheduler: Scheduler;
beforeAll(async () => {
  scheduler = await createScheduler();
});

const DAY = 86_400_000;
const T0 = Date.parse('2026-03-02T12:00:00Z');
const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const att = (kcId: string, dayIndex: number, correct: boolean, rtMs = 1000, minute = 0): AttemptLike => {
  const ts = T0 + dayIndex * DAY + minute * 60_000;
  return { ts, day: dayOf(ts), kcId, correct, rtMs };
};

describe('métricas', () => {
  it('Wilson: um acerto isolado não parece domínio', () => {
    expect(wilsonLower(1, 1)).toBeCloseTo(0.2065, 3);
    expect(wilsonLower(20, 20)).toBeCloseTo(0.8389, 3);
    expect(wilsonLower(0, 0)).toBe(0);
  });
  it('mediana', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it('fluência converge para o tempo típico', () => {
    let f = EMPTY_FLUENCY;
    for (let i = 0; i < 30; i++) f = updateFluency(f, 800);
    expect(fluencyMs(f)).toBeCloseTo(800, 0);
  });
});

describe('nota FSRS derivada (§10.4)', () => {
  const t = PEDAGOGICAL_TARGETS['staff>fretboard'];
  it('mapeamento', () => {
    expect(deriveGrade(false, 500, t)).toBe(1);
    expect(deriveGrade(true, 500, t, true)).toBe(1);
    expect(deriveGrade(true, t.slowMs + 1, t)).toBe(2);
    expect(deriveGrade(true, (t.fastMs + t.slowMs) / 2, t)).toBe(3);
    expect(deriveGrade(true, t.fastMs, t)).toBe(4);
  });
  it('alvos pessoais só com amostra suficiente e nunca mais frouxos que os pedagógicos', () => {
    expect(personalTargets('staff>fretboard', [900, 1000])).toEqual(t);
    const fast = Array.from({ length: 25 }, () => 800);
    const p = personalTargets('staff>fretboard', fast);
    expect(p.fastMs).toBeCloseTo(560, 6);
    expect(p.slowMs).toBe(1600);
    const slow = Array.from({ length: 25 }, () => 5000);
    expect(personalTargets('staff>fretboard', slow)).toEqual({ fastMs: t.fastMs, slowMs: t.slowMs });
  });
});

describe('ids de itens (§10.3)', () => {
  it('canônicos e legados', () => {
    const id = pbId({ letter: 'F', alter: 1, octave: 4 }, fixedPosition(5));
    expect(id).toBe('pb:F♯4@p5');
    expect(parseKcId(id)).toMatchObject({ kind: 'staff>fretboard', posKey: 'p5' });
    expect(bpId({ string: 4, fret: 4 }, 0)).toBe('bp:4:4@k0');
    expect(canonicalKcId('pauta>braco:E5|s123456|f0-19|open')).toBe('pb:E5@open');
    expect(canonicalKcId('pauta>braco:C4|s56|f0-19|p2a4|c5')).toBe('pb:C4@p2a4');
    expect(canonicalKcId('braco>pauta:5:2|k1')).toBe('bp:5:2@k1');
  });
  it('posição ida e volta', () => {
    for (const p of [OPEN_POSITION, fixedPosition(7, { stretch1: true, stretch4: true, allowOpen: true }), fixedPosition(12)]) {
      expect(parsePositionKey(pbId({ letter: 'C', alter: 0, octave: 4 }, p).split('@')[1]!)).toEqual(p);
    }
  });
});

describe('itens de todos os módulos', () => {
  it('tipos reconhecidos pelo prefixo', () => {
    expect(kindOfKc('int:M3:asc')).toBe('interval-name');
    expect(kindOfKc('intb:P5:desc')).toBe('interval-locate');
    expect(kindOfKc('ritmo:dur:6')).toBe('rhythm-figure');
    expect(kindOfKc('ritmo:compasso:n2:4/4')).toBe('rhythm-measure');
    expect(kindOfKc('ritmo:exec:n1:3/4')).toBe('rhythm-exec');
    expect(kindOfKc('leitura:p5|k0|r0|s2|m4x4')).toBe('reading');
    expect(kindOfKc('acorde:min7:drop2:1')).toBe('chord-build');
    expect(kindOfKc('ouvido-acorde:dim')).toBe('ear-chord');
    expect(kindOfKc('ditado:4')).toBe('dictation');
    expect(kindOfKc('xyz')).toBeNull();
  });
  it('acordes viram itens independentes da fundamental (inclusive registros antigos)', () => {
    expect(qualityFromSymbol('F♯m7♭5')).toBe('m7b5');
    expect(qualityFromSymbol('B♭°7')).toBe('dim7');
    expect(qualityFromSymbol('C7M')).toBe('maj7');
    expect(qualityFromSymbol('G7')).toBe('dom7');
    expect(qualityFromSymbol('A')).toBe('maj');
    expect(canonicalKcId('acorde:Dm7:drop2:1')).toBe('acorde:min7:drop2:1');
    expect(canonicalKcId('acorde:A:livre:x')).toBe('acorde:maj:livre:x');
    expect(canonicalKcId('ident:E♭+')).toBe('ident:aug');
    expect(canonicalKcId('conducao:G7')).toBe('conducao:dom7');
    expect(canonicalKcId('acorde:min7:drop2:1')).toBe('acorde:min7:drop2:1');
  });
  it('notas FSRS: pontuadas e só-acerto', () => {
    expect(gradeAttempt('rhythm-exec', true, 30, 0.97, [])).toBe(4);
    expect(gradeAttempt('rhythm-exec', true, 30, 0.85, [])).toBe(3);
    expect(gradeAttempt('rhythm-exec', false, 30, 0.75, [])).toBe(2);
    expect(gradeAttempt('reading', false, 0, 0.4, [])).toBe(1);
    expect(gradeAttempt('ear-degree', true, 0, undefined, [])).toBe(3);
    expect(gradeAttempt('ear-degree', false, 0, undefined, [])).toBe(1);
    expect(gradeAttempt('interval-name', true, 2000, undefined, [])).toBe(4); // ≤ alvo rápido de 3 s
    expect(gradeAttempt('interval-name', true, 9000, undefined, [])).toBe(2);
  });
  it('itens sem tempo comparável chegam a "Dominado" sem exigência de tempo', () => {
    const m = new LearningModel(scheduler);
    let day = 0;
    for (let i = 0; i < 14; i++) {
      m.apply({ ...att('ouvido-acorde:dim', day, true, 0), score: 1 });
      day += Math.max(1, Math.round(i * 1.6));
    }
    expect(['mastered', 'automated']).toContain(m.mastery(m.get('ouvido-acorde:dim')));
    expect(m.get('ouvido-acorde:dim')!.kind).toBe('ear-chord');
  });
});

describe('modelo de aprendizagem', () => {
  const id = 'pb:E5@open';

  it('CA-SRS-1: só a primeira tentativa do dia atualiza o FSRS', () => {
    const m = new LearningModel(scheduler);
    expect(m.apply(att(id, 0, true, 1000, 0))).not.toBeNull();
    const cardAfterFirst = m.get(id)!.card;
    expect(m.apply(att(id, 0, false, 1000, 5))).toBeNull();
    expect(m.get(id)!.card).toEqual(cardAfterFirst);
    expect(m.get(id)!.stats.n).toBe(2);
    expect(m.apply(att(id, 1, true, 1000))).not.toBeNull();
  });

  it('CA-SRS-4: reaplicar o registro produz exatamente o mesmo estado', () => {
    const log = [att(id, 0, true), att(id, 0, false, 2000, 3), att(id, 2, true, 900), att('bp:1:0@k0', 2, false), att(id, 5, true, 700)];
    const a = LearningModel.replay(scheduler, log);
    const b = LearningModel.replay(scheduler, [...log].reverse());
    expect([...a.items.entries()]).toEqual([...b.items.entries()]);
  });

  it('CA-SRS-3: estados de domínio — 1/1 nunca é "Dominado"; não treinado ≠ instável', () => {
    const m = new LearningModel(scheduler);
    expect(m.mastery(undefined)).toBe('untrained');
    m.apply(att(id, 0, true, 800));
    expect(m.mastery(m.get(id))).toBe('acquiring');

    const bad = new LearningModel(scheduler);
    for (let d = 0; d < 3; d++) for (let k = 0; k < 3; k++) bad.apply(att(id, d, false, 3000, k));
    expect(bad.mastery(bad.get(id))).toBe('unstable');

    // prática espaçada, rápida e correta por várias semanas → dominado/automatizado
    const good = new LearningModel(scheduler);
    let day = 0;
    for (let i = 0; i < 12; i++) {
      good.apply(att(id, day, true, 700));
      day += Math.max(1, Math.round(i * 1.6));
    }
    const st = good.mastery(good.get(id));
    expect(['mastered', 'automated']).toContain(st);
  });

  it('retrievability cai com o tempo e item vence', () => {
    const m = new LearningModel(scheduler);
    m.apply(att(id, 0, true, 1000));
    const item = m.get(id)!;
    const r1 = m.retrievability(item, T0 + 1 * DAY)!;
    const r30 = m.retrievability(item, T0 + 30 * DAY)!;
    expect(r1).toBeGreaterThan(r30);
    expect(m.isDue(item, T0 + 60 * DAY)).toBe(true);
    expect(m.isDue(item, T0)).toBe(false);
  });

  it('ids desconhecidos são ignorados', () => {
    const m = new LearningModel(scheduler);
    expect(m.apply(att('xyz', 0, true))).toBeNull();
    expect(m.items.size).toBe(0);
  });

  it('itens de outros módulos entram no FSRS e vencem', () => {
    const m = new LearningModel(scheduler);
    expect(m.apply({ ...att('ritmo:exec:n1:4/4', 0, true), score: 0.9 })).toBe(3);
    expect(m.isDue(m.get('ritmo:exec:n1:4/4')!, T0 + 60 * DAY)).toBe(true);
  });

  it('fila de revisões por módulo, menor R primeiro', () => {
    const m = new LearningModel(scheduler);
    m.apply(att('int:M3:asc', 0, true, 2000));
    m.apply(att('int:P5:asc', 0, false, 2000));
    m.apply(att('ouvido-acorde:dim', 0, true));
    m.apply(att('pb:E5@open', 0, true));
    const due = dueByModule(m, T0 + 90 * DAY);
    expect([...due.keys()].sort()).toEqual(['ear', 'intervals', 'notes']);
    expect(due.get('intervals')!.map((i) => i.kcId)).toEqual(['int:P5:asc', 'int:M3:asc']); // o errado tem R menor
    expect(dueByModule(m, T0).size).toBe(0);
  });
});
