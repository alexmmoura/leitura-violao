import { displayedAccidental, type AlterSource } from '../theory/accidentals';
import { keyAlterFor, type Fifths } from '../theory/keySignature';
import {
  ALTERS,
  LETTERS,
  pitchName,
  writtenMidiOf,
  writtenToSounding,
  type Alter,
  type SpelledPitch,
  type SoundingMidi,
  type WrittenMidi,
} from '../theory/pitch';
import { isSimpleSpelling } from '../theory/spelling';
import type { FretLocation, Instrument } from '../instrument/instrument';
import type { PositionSpec } from '../instrument/position';
import { pbId } from '../learning/kc';
import { validLocations, type Constraints } from './constraints';
import { createRng } from './rng';
import type { Target } from './validate';

/**
 * Gerador de questões do Módulo A / flashcard sentido 1 (pauta → braço).
 * Especificação §6.1, §7.1 e §9.1.
 */
export type AnswerMode = 'any' | 'all' | 'string';
export type AccidentalMode = 'diatonic' | 'chromatic';

export interface NoteQuestionConfig {
  readonly fifths: Fifths;
  /** 'diatonic': só notas da tonalidade (em Dó = naturais). 'chromatic': inclui acidentes ocorrentes. */
  readonly accidentals: AccidentalMode;
  readonly strings: readonly number[];
  readonly position: PositionSpec;
  readonly minFret: number;
  readonly maxFret: number;
  /** Faixa de alturas ESCRITAS (MIDI) admitidas. */
  readonly minWritten: number;
  readonly maxWritten: number;
  readonly answerMode: AnswerMode;
}

export interface NoteQuestion {
  readonly kind: 'staff>fretboard';
  readonly seed: number;
  readonly written: SpelledPitch;
  readonly writtenMidi: WrittenMidi;
  readonly sounding: SoundingMidi;
  /** Acidente a desenhar (null = armadura basta; 0 = bequadro). */
  readonly shownAccidental: Alter | null;
  readonly alterSource: AlterSource;
  readonly constraints: Constraints;
  readonly valid: FretLocation[];
  readonly answerMode: AnswerMode;
  /** Identificador estável do item de conhecimento (especificação §10.3). */
  readonly kcId: string;
}

export function targetOf(q: NoteQuestion): Target {
  return { sounding: q.sounding, alter: q.written.alter, alterSource: q.alterSource };
}

export function baseConstraints(cfg: NoteQuestionConfig): Constraints {
  return { strings: cfg.strings, minFret: cfg.minFret, maxFret: cfg.maxFret, position: cfg.position };
}

/** Todas as alturas escritas candidatas que têm pelo menos um local válido (invariante V ≠ ∅). */
export function candidatePool(cfg: NoteQuestionConfig, inst: Instrument): SpelledPitch[] {
  const c = baseConstraints(cfg);
  const pool: SpelledPitch[] = [];
  for (let octave = 1; octave <= 8; octave++) {
    for (const letter of LETTERS) {
      for (const alter of ALTERS) {
        const p: SpelledPitch = { letter, alter, octave };
        const keyAlter = keyAlterFor(letter, cfg.fifths);
        if (cfg.accidentals === 'diatonic' && alter !== keyAlter) continue;
        if (cfg.accidentals === 'chromatic' && alter !== keyAlter && !isSimpleSpelling(p)) continue;
        if (cfg.accidentals === 'chromatic' && Math.abs(alter - keyAlter) > 1) continue;
        const w = writtenMidiOf(p);
        if (w < cfg.minWritten || w > cfg.maxWritten) continue;
        const s = writtenToSounding(w, inst.transposition);
        if (validLocations(s, inst, c).length > 0) pool.push(p);
      }
    }
  }
  return pool;
}

/**
 * Item de conhecimento: a nota escrita na região (posição). Restringir cordas ou
 * pedir uma corda específica não muda o item — muda só a dificuldade da questão.
 */
export function kcIdFor(p: SpelledPitch, c: Constraints, answerMode: AnswerMode = 'any'): string {
  return pbId(p, c.position, answerMode === 'all');
}

export function buildQuestion(p: SpelledPitch, cfg: NoteQuestionConfig, inst: Instrument, seed: number, requiredString?: number): NoteQuestion {
  const writtenMidi = writtenMidiOf(p);
  const sounding = writtenToSounding(writtenMidi, inst.transposition);
  const constraints: Constraints = { ...baseConstraints(cfg), ...(requiredString ? { requiredString } : {}) };
  const valid = validLocations(sounding, inst, constraints);
  if (valid.length === 0) throw new Error(`Exercício sem resposta válida: ${pitchName(p)}`);
  const shown = displayedAccidental(p.letter, p.alter, cfg.fifths);
  const alterSource: AlterSource = shown !== null ? 'explicit' : p.alter !== 0 ? 'key' : 'none';
  return {
    kind: 'staff>fretboard',
    seed,
    written: p,
    writtenMidi,
    sounding,
    shownAccidental: shown,
    alterSource,
    constraints,
    valid,
    answerMode: cfg.answerMode,
    kcId: kcIdFor(p, constraints, cfg.answerMode),
  };
}

/**
 * Gera uma questão a partir de uma semente. `avoid` evita repetir o mesmo item em seguida.
 * Lança erro se a configuração não admite nenhuma nota (a UI deve impedir isso antes).
 */
export function generateNoteQuestion(cfg: NoteQuestionConfig, inst: Instrument, seed: number, avoid?: string): NoteQuestion {
  const rng = createRng(seed);
  const pool = candidatePool(cfg, inst);
  if (pool.length === 0) throw new Error('Nenhuma nota disponível com essas configurações.');
  let p = rng.pick(pool);
  if (avoid && pool.length > 1) {
    for (let i = 0; i < 8 && kcIdFor(p, baseConstraints(cfg), cfg.answerMode) === avoid; i++) p = rng.pick(pool);
  }
  let requiredString: number | undefined;
  if (cfg.answerMode === 'string') {
    const s = writtenToSounding(writtenMidiOf(p), inst.transposition);
    requiredString = rng.pick(validLocations(s, inst, baseConstraints(cfg))).string;
  }
  return buildQuestion(p, cfg, inst, seed, requiredString);
}
