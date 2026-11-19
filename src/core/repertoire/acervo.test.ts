import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../instrument/instrument';
import { buildScoreMelody } from '../score/score';
import { parseAbcTune } from '../score/abc';
import { forGuitar, transposeSpelled } from './importTools';
import { LEVELS, loadAcervo, PIECES, pieceScore } from './pieces';

describe('acervo baixado (domínio público)', () => {
  it('tem obras em todos os níveis, ids únicos e sem colidir com as escritas à mão', async () => {
    const acervo = await loadAcervo();
    expect(acervo.length).toBeGreaterThan(1000);
    const ids = new Set([...PIECES, ...acervo].map((p) => p.id));
    expect(ids.size).toBe(PIECES.length + acervo.length);
    for (const l of LEVELS) expect(acervo.filter((p) => p.level === l).length).toBeGreaterThanOrEqual(30);
  });

  it('toda obra converte, fecha os compassos e é tocável no violão', async () => {
    const acervo = await loadAcervo();
    const bad: string[] = [];
    for (const p of acervo) {
      try {
        buildScoreMelody(pieceScore(p), STANDARD_GUITAR);
      } catch (e) {
        bad.push(`${p.id}: ${(e as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it('as obras transpostas ficam entre Fá e Mi maior (boas para violão)', async () => {
    // obras originais de violão ("violao-…") ficam na tonalidade em que foram escritas
    const acervo = (await loadAcervo()).filter((p) => !p.id.startsWith('violao-'));
    expect(acervo.every((p) => p.fifths >= -1 && p.fifths <= 4)).toBe(true);
  });
});

describe('transposição e ABC', () => {
  it('transpõe mantendo a grafia certa', () => {
    // Mi♭ maior → Fá maior (+2 quintas = +2 semitons): Mi♭4 vira Fá4, Si♭4 vira Dó5
    expect(transposeSpelled({ letter: 'E', alter: -1, octave: 4 }, 2)).toEqual({ letter: 'F', alter: 0, octave: 4 });
    expect(transposeSpelled({ letter: 'B', alter: -1, octave: 4 }, 2)).toEqual({ letter: 'C', alter: 0, octave: 5 });
    // Si maior → Mi maior (−1 quinta = +5 semitons): Ré♯ vira Sol♯
    expect(transposeSpelled({ letter: 'D', alter: 1, octave: 4 }, -1)).toEqual({ letter: 'G', alter: 1, octave: 4 });
  });

  it('lê uma melodia ABC com anacruse, ritmo pontuado e acidentes', () => {
    const t = parseAbcTune(['X:1', 'T:Teste', 'M:2/4', 'L:1/8', 'K:G', 'D | G>A B=c | d2 z2 |]'].join('\n'));
    expect(t.fifths).toBe(1);
    const units = t.measures.map((m) => m.map((n) => n.units));
    expect(units).toEqual([[2], [3, 1, 2, 2], [4, 4]]);
    expect(t.measures[1]![3]!.spelled).toEqual({ letter: 'C', alter: 0, octave: 5 });
  });

  it('melodia grave demais sobe uma oitava para caber no violão', () => {
    const low = [[{ units: 4, rest: false, written: 40, spelled: { letter: 'E' as const, alter: 0 as const, octave: 2 } }]];
    const g = forGuitar(0, low)!;
    expect(g.measures[0]![0]!.spelled!.octave).toBeGreaterThanOrEqual(3);
  });
});
