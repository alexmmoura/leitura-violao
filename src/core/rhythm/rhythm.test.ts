import { describe, expect, it } from 'vitest';
import { createRng } from '../exercise/rng';
import {
  beatSize,
  beatsLabel,
  beatsPer,
  cellsUpTo,
  evaluateTaps,
  figureFor,
  generateMeasure,
  generateMeasures,
  generateRecognition,
  isCompound,
  measureSize,
  measureUnits,
  meterLabel,
  METERS,
  onsetsMs,
  parseMeter,
  subdivisionOf,
  toleranceFor,
} from './rhythm';

describe('figuras', () => {
  it('unidades em semicolcheias', () => {
    expect(figureFor(4).name).toBe('semínima');
    expect(figureFor(6)).toMatchObject({ vex: 'q', dotted: true });
    expect(() => figureFor(5)).toThrow();
    expect(beatsLabel(1.5)).toBe('1½');
    expect(beatsLabel(0.25)).toBe('¼');
    expect(beatsLabel(3)).toBe('3');
  });
});

describe('gerador de compassos', () => {
  it('sempre soma exatamente o compasso e respeita o vocabulário do nível (2.000 compassos)', () => {
    const rng = createRng(3);
    for (let i = 0; i < 2000; i++) {
      const level = 1 + (i % 4);
      const beats = 2 + (i % 3);
      const m = generateMeasure(level, beats, rng.int(0, 2 ** 31));
      expect(measureUnits(m)).toBe(beats * 4);
      const allowed = new Set(cellsUpTo(level).flat().map((e) => e.units));
      for (const e of m) expect(allowed.has(e.units)).toBe(true);
      expect(m[0]!.rest && m[0]!.units >= 4).toBe(false);
    }
  });
  it('nível 1 não tem colcheias', () => {
    const rng = createRng(9);
    for (let i = 0; i < 300; i++) expect(generateMeasure(1, 4, rng.int(0, 2 ** 31)).every((e) => e.units >= 4)).toBe(true);
  });
  it('reprodutível', () => {
    expect(generateMeasure(4, 4, 77)).toEqual(generateMeasure(4, 4, 77));
  });
});

describe('ataques e avaliação dos toques', () => {
  const m = [
    { units: 4, rest: false },
    { units: 4, rest: true },
    { units: 2, rest: false },
    { units: 2, rest: false },
    { units: 4, rest: false },
  ];
  it('pausas não têm ataque', () => {
    expect(onsetsMs([m], 60)).toEqual([0, 2000, 2500, 3000]);
  });
  it('acertos, omissões e extras', () => {
    const ev = evaluateTaps([0, 2000, 2500, 3000], [15, 1960, 2700, 3010, 3500], 80);
    expect(ev.hits.map((h) => h.devMs)).toEqual([15, -40, 10]);
    expect(ev.misses).toEqual([2500]);
    expect(ev.extras).toEqual([2700, 3500]);
    expect(ev.score).toBeCloseTo((3 - 2) / 4, 9);
    expect(ev.medianAbsDevMs).toBe(15);
  });
  it('um toque não serve para dois ataques', () => {
    const ev = evaluateTaps([0, 100], [50], 80);
    expect(ev.hits).toHaveLength(1);
    expect(ev.misses).toHaveLength(1);
  });
  it('tolerância aperta com o nível', () => {
    expect(toleranceFor(1)).toBe(80);
    expect(toleranceFor(4)).toBe(40);
  });
});

describe('reconhecimento', () => {
  it('perguntas coerentes (simples e compostos)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 600; i++) {
      const meter = METERS[i % METERS.length]!;
      const q = generateRecognition(1 + (i % 4), meter, rng.int(0, 2 ** 31));
      if (q.kind === 'duration') expect(q.options).toContain(q.answerBeats);
      else expect(measureUnits(q.measure) === measureSize(meter)).toBe(q.complete);
    }
  });
});

describe('compassos compostos', () => {
  it('6/8 tem 2 tempos de semínima pontuada; 9/8, 3; 12/8, 4', () => {
    expect([measureSize({ num: 6, den: 8 }), beatSize({ num: 6, den: 8 }), beatsPer({ num: 6, den: 8 })]).toEqual([12, 6, 2]);
    expect(beatsPer({ num: 9, den: 8 })).toBe(3);
    expect(beatsPer({ num: 12, den: 8 })).toBe(4);
    expect(beatsPer(3)).toBe(3); // 3/4 (formato antigo)
    expect(isCompound({ num: 3, den: 8 })).toBe(false);
    expect(subdivisionOf({ num: 6, den: 8 })).toBe(3);
    expect(parseMeter('12/8')).toEqual({ num: 12, den: 8 });
    expect(meterLabel(4)).toBe('4/4');
  });
  it('compassos compostos somam certo, usam só o vocabulário composto e respeitam o tempo (2.000 compassos)', () => {
    const rng = createRng(17);
    for (let i = 0; i < 2000; i++) {
      const meter = METERS[3 + (i % 3)]!;
      const level = 1 + (i % 4);
      const m = generateMeasure(level, meter, rng.int(0, 2 ** 31));
      expect(measureUnits(m)).toBe(measureSize(meter));
      const allowed = new Set(cellsUpTo(level, meter).flat().map((e) => e.units));
      for (const e of m) expect(allowed.has(e.units)).toBe(true);
      // regra de escrita: só figuras de tempos inteiros, começando no tempo, podem conter uma
      // fronteira de tempo; em 12/8 nada esconde o meio do compasso
      let pos = 0;
      for (const e of m) {
        const crosses = Math.floor(pos / 6) !== Math.floor((pos + e.units - 1) / 6);
        if (crosses) {
          expect(pos % 6, `${JSON.stringify(m)}`).toBe(0);
          expect(e.units % 6).toBe(0);
        }
        if (beatsPer(meter) === 4 && e.units >= 12) expect(pos % 12).toBe(0);
        pos += e.units;
      }
    }
  });
  it('ataques: em 6/8 a 60 bpm (semínima pontuada) cada colcheia dura 333 ms', () => {
    const m = [
      { units: 2, rest: false },
      { units: 2, rest: false },
      { units: 2, rest: false },
      { units: 6, rest: false },
    ];
    expect(onsetsMs([m], 60, { num: 6, den: 8 }).map(Math.round)).toEqual([0, 333, 667, 1000]);
  });
});

describe('ligaduras', () => {
  it('continuação de ligadura não é ataque (dentro do compasso e sobre a barra)', () => {
    const a = [{ units: 2, rest: false }, { units: 2, rest: false, tie: true }, { units: 2, rest: false }, { units: 2, rest: false }];
    expect(onsetsMs([a], 60)).toEqual([0, 500, 1500]);
    // a 2ª semínima do compasso 1 é ataque; a mínima do compasso 2 é só a continuação
    const m1 = [{ units: 4, rest: false }, { units: 4, rest: false, tie: true }];
    const m2 = [{ units: 8, rest: false }];
    expect(onsetsMs([m1, m2], 60)).toEqual([0, 1000]);
  });
  it('ligaduras sobre a barra só a partir do nível 3, nunca a partir de pausa', () => {
    const rng = createRng(5);
    let ties = 0;
    for (let i = 0; i < 300; i++) {
      const ms = generateMeasures(3 + (i % 2), METERS[i % METERS.length]!, 4, rng.int(0, 2 ** 31));
      for (let k = 0; k < ms.length - 1; k++) {
        const last = ms[k]![ms[k]!.length - 1]!;
        if (last.tie) {
          ties++;
          expect(last.rest).toBe(false);
          expect(ms[k + 1]![0]!.rest).toBe(false);
        }
      }
      expect(ms[ms.length - 1]![ms[ms.length - 1]!.length - 1]!.tie ?? false).toBe(false);
    }
    expect(ties).toBeGreaterThan(20);
    for (let i = 0; i < 100; i++) {
      for (const m of generateMeasures(2, 4, 4, i)) expect(m.some((e) => e.tie)).toBe(false);
    }
  });
});
