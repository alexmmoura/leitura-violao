import { describe, expect, it } from 'vitest';
import { locationsFor, STANDARD_GUITAR } from '../instrument/instrument';
import { createScheduler, LearningModel } from '../learning/model';
import { kindOfKc } from '../learning/kinds';
import { melodyNotes } from '../melody/melody';
import { buildScoreMelody, ScoreError } from '../score/score';
import { parseNotation } from './notation';
import { LEVELS, PIECES, pieceKcId, pieceScore } from './pieces';
import { autoLevel, nextPiece, pieceStates } from './progression';

const g = STANDARD_GUITAR;
const DAY = 86_400_000;

describe('notação compacta', () => {
  it('lê notas, pausas, pontuadas e ligaduras', () => {
    const [bar] = parseNotation('C4q. D4e re F#4e~ F#4q', { num: 4, den: 4 });
    expect(bar!.map((n) => n.units)).toEqual([6, 2, 2, 2, 4]);
    expect(bar![2]!.rest).toBe(true);
    expect(bar![3]!.spelled).toEqual({ letter: 'F', alter: 1, octave: 4 });
    expect(bar![3]!.tie).toBe(true);
  });
  it('compasso do meio que não fecha o tempo é erro', () => {
    expect(() => parseNotation('C4q | C4q D4q | C4w', { num: 4, den: 4 })).toThrow(ScoreError);
    expect(() => parseNotation('C4x', { num: 4, den: 4 })).toThrow(ScoreError);
  });
  it('anacruse e último compasso incompleto são aceitos', () => {
    expect(parseNotation('A4q | C5h D5q | A4h', { num: 3, den: 4 })).toHaveLength(3);
  });
});

describe('repertório', () => {
  it('ids únicos e todos os níveis de 1 a 5 com obras', () => {
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
    for (const l of LEVELS) expect(PIECES.filter((p) => p.level === l).length).toBeGreaterThanOrEqual(3);
  });

  it.each(PIECES.map((p) => [p.id, p] as const))('%s: converte, fecha os compassos e é tocável no violão', (_, p) => {
    const melody = buildScoreMelody(pieceScore(p), g); // lança se algo não for tocável
    expect(melodyNotes(melody).length).toBeGreaterThan(3);
    expect(melody.fingering.notes.length).toBe(melodyNotes(melody).length);
  });

  it('nível 1 cabe na posição aberta (casas 0 a 4)', () => {
    for (const p of PIECES.filter((x) => x.level === 1)) {
      const m = buildScoreMelody(pieceScore(p), g);
      for (const n of melodyNotes(m)) expect(locationsFor(n.sounding!, g).some((l) => l.fret <= 4), `${p.id}`).toBe(true);
    }
  });

  it('as obras viram itens próprios do FSRS', () => {
    expect(kindOfKc(pieceKcId('greensleeves'))).toBe('repertoire');
  });
});

describe('progressão estilo Anki', () => {
  const attempt = (id: string, ts: number, correct: boolean) => ({
    ts,
    day: new Date(ts).toISOString().slice(0, 10),
    kcId: pieceKcId(id),
    correct,
    rtMs: 1500,
    score: correct ? 1 : 0.4,
  });

  it('sem histórico: nível 1 e a primeira obra nova do nível', () => {
    const states = pieceStates(null, Date.now());
    expect(autoLevel(states)).toBe(1);
    const pick = nextPiece(states, 'auto');
    expect(pick?.reason).toBe('new');
    expect(pick?.piece.level).toBe(1);
  });

  it('o nível sobe sozinho quando ~80 % do nível foi aprovado', async () => {
    const sched = await createScheduler();
    const t0 = Date.UTC(2026, 0, 1);
    const level1 = PIECES.filter((p) => p.level === 1);
    const model = LearningModel.replay(sched, level1.map((p, i) => attempt(p.id, t0 + i * 1000, true)));
    const states = pieceStates(model, t0 + DAY / 2);
    expect(autoLevel(states)).toBe(2);
    expect(nextPiece(states, 'auto')?.piece.level).toBe(2);
    // nível escolhido à mão continua valendo
    expect(nextPiece(states, 3)?.piece.level).toBe(3);
  });

  it('revisões vencidas vêm antes das obras novas, e quem errou volta antes de quem acertou', async () => {
    const sched = await createScheduler();
    const t0 = Date.UTC(2026, 0, 1);
    const [a, b] = PIECES.filter((p) => p.level === 1);
    const model = LearningModel.replay(sched, [attempt(a!.id, t0, true), attempt(b!.id, t0 + 1000, false)]);
    const itA = model.get(pieceKcId(a!.id))!;
    const itB = model.get(pieceKcId(b!.id))!;
    expect(new Date(itB.card!.dueAt).getTime()).toBeLessThan(new Date(itA.card!.dueAt).getTime());
    const later = new Date(itB.card!.dueAt).getTime() + 1000;
    const pick = nextPiece(pieceStates(model, later), 'auto');
    expect(pick?.reason).toBe('due');
    expect(pick?.piece.id).toBe(b!.id);
  });

  it('não repete a obra que acabou de ser tocada quando há outra opção', () => {
    const states = pieceStates(null, Date.now());
    const first = nextPiece(states, 1)!;
    expect(nextPiece(states, 1, first.piece.id)?.piece.id).not.toBe(first.piece.id);
  });
});
