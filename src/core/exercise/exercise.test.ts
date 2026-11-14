import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR, type FretLocation } from '../instrument/instrument';
import { fixedPosition, OPEN_POSITION, WHOLE_NECK } from '../instrument/position';
import { asSounding } from '../theory/pitch';
import type { Constraints } from './constraints';
import { explainQuestion } from './explain';
import { buildQuestion, candidatePool, generateNoteQuestion, targetOf, type NoteQuestionConfig } from './noteQuestion';
import { createRng } from './rng';
import { classifyLocation, classifyPitch, evaluateAllLocations, type Target } from './validate';

const g = STANDARD_GUITAR;
const ALL = [1, 2, 3, 4, 5, 6];
const whole: Constraints = { strings: ALL, minFret: 0, maxFret: 19, position: WHOLE_NECK };
const posV: Constraints = { strings: ALL, minFret: 0, maxFret: 19, position: fixedPosition(5) };
const loc = (string: number, fret: number): FretLocation => ({ string, fret });
const t = (sounding: number, alter: Target['alter'] = 0, alterSource: Target['alterSource'] = 'none'): Target => ({
  sounding: asSounding(sounding),
  alter,
  alterSource,
});

describe('validação de local (§9.3)', () => {
  it('qualquer local válido é aceito, não só o primeiro', () => {
    // E5 escrito = 64 soante
    for (const l of [loc(1, 0), loc(2, 5), loc(3, 9), loc(4, 14), loc(5, 19)]) {
      expect(classifyLocation(t(64), l, g, whole).correct).toBe(true);
    }
  });
  it('altura certa fora da posição → OUT_OF_CONSTRAINTS (CA-EXE-2)', () => {
    // A4 escrito = A3 soante = 57; na V posição só (4,7) é válido
    const r = classifyLocation(t(57), loc(5, 12), g, posV);
    expect(r.correct).toBe(false);
    expect(r.error).toBe('OUT_OF_CONSTRAINTS');
    expect(r.valid).toEqual([loc(4, 7)]);
  });
  it('armadura ignorada', () => {
    // F#4 escrito (Sol maior) = 54 soante; resposta em F (53) = corda 4 casa 3
    const r = classifyLocation(t(54, 1, 'key'), loc(4, 3), g, whole);
    expect(r.error).toBe('KEY_ACCIDENTAL');
  });
  it('acidente ocorrente ignorado', () => {
    expect(classifyLocation(t(54, 1, 'explicit'), loc(4, 3), g, whole).error).toBe('LOCAL_ACCIDENTAL');
  });
  it('erro de oitava', () => {
    expect(classifyLocation(t(64), loc(4, 2), g, whole).error).toBe('OCTAVE'); // E3 soante em vez de E4
  });
  it('corda vizinha', () => {
    // alvo G3 (55) em (3,0); resposta (4,0) = D3
    expect(classifyLocation(t(55), loc(4, 0), g, { ...whole, position: OPEN_POSITION }).error).toBe('STRING');
  });
  it('casa vizinha', () => {
    expect(classifyLocation(t(57), loc(3, 3), g, { ...whole, position: OPEN_POSITION }).error).toBe('FRET');
  });
  it('erro de terça (linha/espaço)', () => {
    // alvo E4 (64) = (1,0); resposta G4 (67) = (1,3) não é casa vizinha
    expect(classifyLocation(t(64), loc(1, 3), g, { ...whole, strings: [1] }).error).toBe('LINE_SPACE');
  });
});

describe('classificação só pela altura (microfone)', () => {
  it('categorias', () => {
    expect(classifyPitch(t(64), 64)).toEqual({ correct: true });
    expect(classifyPitch(t(64), 52).error).toBe('OCTAVE');
    expect(classifyPitch(t(54, 1, 'key'), 53).error).toBe('KEY_ACCIDENTAL');
    expect(classifyPitch(t(54, 1, 'explicit'), 53).error).toBe('LOCAL_ACCIDENTAL');
    expect(classifyPitch(t(64), 67).error).toBe('LINE_SPACE');
    expect(classifyPitch(t(64), 65).error).toBe('STEP');
    expect(classifyPitch(t(64), 70).error).toBe('OTHER');
  });
});

describe('modo "todos os locais"', () => {
  it('pontuação parcial e penalidade por extras', () => {
    const all = evaluateAllLocations(t(55), [loc(3, 0), loc(4, 5), loc(5, 10), loc(6, 15)], g, whole);
    expect(all.correct).toBe(true);
    expect(all.score).toBe(1);
    const partial = evaluateAllLocations(t(55), [loc(3, 0), loc(4, 5), loc(1, 1)], g, whole);
    expect(partial.correct).toBe(false);
    expect(partial.missing).toHaveLength(2);
    expect(partial.extra).toEqual([loc(1, 1)]);
    expect(partial.score).toBeCloseTo(0.25, 9);
  });
});

const baseCfg: NoteQuestionConfig = {
  fifths: 0,
  accidentals: 'diatonic',
  strings: ALL,
  position: OPEN_POSITION,
  minFret: 0,
  maxFret: 19,
  minWritten: 52,
  maxWritten: 84,
  answerMode: 'any',
};

describe('gerador (§7.1, CA-EXE)', () => {
  it('posição aberta, naturais: E3 a A5 escritos', () => {
    const pool = candidatePool(baseCfg, g);
    expect(pool.every((p) => p.alter === 0)).toBe(true);
    const midis = pool.map((p) => p.octave * 12 + p.letter.charCodeAt(0));
    expect(midis.length).toBe(new Set(midis).size);
    expect(pool[0]).toEqual({ letter: 'E', alter: 0, octave: 3 });
  });

  it('CA-EXE-1: nunca gera exercício com V vazio (10.000 gerações em várias configurações)', () => {
    const rng = createRng(42);
    const configs: NoteQuestionConfig[] = [];
    for (let p = 1; p <= 12; p++)
      for (const fifths of [-3, 0, 2])
        for (const mode of ['any', 'string', 'all'] as const)
          configs.push({ ...baseCfg, fifths, accidentals: 'chromatic', position: fixedPosition(p, { stretch4: p % 2 === 0 }), answerMode: mode, strings: p % 3 === 0 ? [1, 2, 3] : ALL });
    for (let i = 0; i < 10_000; i++) {
      const cfg = configs[i % configs.length]!;
      if (candidatePool(cfg, g).length === 0) continue;
      const q = generateNoteQuestion(cfg, g, rng.int(0, 2 ** 31));
      expect(q.valid.length).toBeGreaterThan(0);
      if (q.answerMode === 'string') expect(q.valid.every((l) => l.string === q.constraints.requiredString)).toBe(true);
    }
  });

  it('CA-EXE-4: mesma semente ⇒ mesmo exercício', () => {
    const a = generateNoteQuestion({ ...baseCfg, accidentals: 'chromatic' }, g, 123456);
    const b = generateNoteQuestion({ ...baseCfg, accidentals: 'chromatic' }, g, 123456);
    expect(a).toEqual(b);
  });

  it('acidentes: em Sol maior, Fá♯ vem da armadura e não é desenhado', () => {
    const q = buildQuestion({ letter: 'F', alter: 1, octave: 4 }, { ...baseCfg, fifths: 1 }, g, 1);
    expect(q.shownAccidental).toBeNull();
    expect(q.alterSource).toBe('key');
    const nat = buildQuestion({ letter: 'F', alter: 0, octave: 4 }, { ...baseCfg, fifths: 1, accidentals: 'chromatic' }, g, 1);
    expect(nat.shownAccidental).toBe(0); // bequadro desenhado
  });

  it('CA-EXE-3: a explicação lista as localizações válidas', () => {
    const q = buildQuestion({ letter: 'A', alter: 0, octave: 4 }, { ...baseCfg, position: fixedPosition(5) }, g, 1);
    const r = classifyLocation(targetOf(q), loc(3, 2), g, q.constraints);
    const text = explainQuestion(q, g, { naming: 'latin', octaves: 'scientific' }, loc(3, 2), r.error).join(' ');
    expect(text).toContain('corda 4, casa 7');
    expect(text).toContain('fora da região');
  });
});
