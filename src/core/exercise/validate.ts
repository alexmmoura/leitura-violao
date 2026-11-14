import type { AlterSource } from '../theory/accidentals';
import { locationKey, locationsFor, sameLocation, soundingAt, type FretLocation, type Instrument } from '../instrument/instrument';
import type { Alter, SoundingMidi } from '../theory/pitch';
import { validLocations, type Constraints } from './constraints';

/**
 * Comparação de respostas e taxonomia de erros — especificação §9.3 e §9.4.
 */
export type ErrorCode =
  | 'OUT_OF_CONSTRAINTS' // altura certa, local fora das restrições (E-FORA-POSIÇÃO)
  | 'KEY_ACCIDENTAL' // ignorou a armadura
  | 'LOCAL_ACCIDENTAL' // ignorou o acidente ocorrente
  | 'OCTAVE' // classe certa, oitava errada
  | 'STRING' // mesma casa, corda vizinha
  | 'FRET' // mesma corda, casa ±1
  | 'LINE_SPACE' // erro de terça (leu linha/espaço vizinho)
  | 'STEP' // erro de um grau
  | 'ENHARMONIC' // altura certa, grafia errada para o contexto
  | 'OTHER';

export const ERROR_LABEL: Readonly<Record<ErrorCode, string>> = {
  OUT_OF_CONSTRAINTS: 'Nota certa, local fora das restrições',
  KEY_ACCIDENTAL: 'Armadura ignorada',
  LOCAL_ACCIDENTAL: 'Acidente ocorrente ignorado',
  OCTAVE: 'Erro de oitava',
  STRING: 'Corda vizinha',
  FRET: 'Casa vizinha',
  LINE_SPACE: 'Linha/espaço trocado (terça)',
  STEP: 'Nota vizinha (um grau)',
  ENHARMONIC: 'Grafia enarmônica (som certo, nome errado para a tonalidade)',
  OTHER: 'Outro erro',
};

export interface Target {
  readonly sounding: SoundingMidi;
  /** Alteração efetiva da nota escrita e de onde ela veio. */
  readonly alter: Alter;
  readonly alterSource: AlterSource;
}

export interface LocationResult {
  readonly correct: boolean;
  readonly error?: ErrorCode;
  readonly answerSounding: SoundingMidi;
  /** Todas as localizações da altura no instrumento. */
  readonly all: FretLocation[];
  /** Localizações válidas sob as restrições. */
  readonly valid: FretLocation[];
}

export function classifyLocation(target: Target, answer: FretLocation, inst: Instrument, c: Constraints): LocationResult {
  const all = locationsFor(target.sounding, inst);
  const valid = validLocations(target.sounding, inst, c);
  const answerSounding = soundingAt(answer, inst);
  const base = { answerSounding, all, valid };

  if (valid.some((v) => sameLocation(v, answer))) return { ...base, correct: true };
  return { ...base, correct: false, error: errorFor(target, answer, answerSounding, valid.length ? valid : all) };
}

function errorFor(target: Target, answer: FretLocation, answerSounding: SoundingMidi, refs: FretLocation[]): ErrorCode {
  const delta = answerSounding - target.sounding;
  if (delta === 0) return 'OUT_OF_CONSTRAINTS';

  if (target.alter !== 0 && answerSounding === target.sounding - target.alter) {
    if (target.alterSource === 'key') return 'KEY_ACCIDENTAL';
    if (target.alterSource === 'explicit' || target.alterSource === 'measure' || target.alterSource === 'tie') return 'LOCAL_ACCIDENTAL';
  }
  if (delta % 12 === 0) return 'OCTAVE';
  if (refs.some((v) => v.fret === answer.fret && Math.abs(v.string - answer.string) === 1)) return 'STRING';
  if (refs.some((v) => v.string === answer.string && Math.abs(v.fret - answer.fret) === 1)) return 'FRET';
  const abs = Math.abs(delta);
  if (abs === 3 || abs === 4) return 'LINE_SPACE';
  if (abs === 1 || abs === 2) return 'STEP';
  return 'OTHER';
}

/**
 * Classificação só pela ALTURA (entrada pelo microfone, §15.1): o microfone não diz
 * em que corda/casa a nota foi tocada, então não há E-CORDA/E-CASA/E-FORA-POSIÇÃO.
 */
export function classifyPitch(target: Target, heard: number): { correct: boolean; error?: ErrorCode } {
  const delta = heard - target.sounding;
  if (delta === 0) return { correct: true };
  if (target.alter !== 0 && heard === target.sounding - target.alter) {
    return { correct: false, error: target.alterSource === 'key' ? 'KEY_ACCIDENTAL' : 'LOCAL_ACCIDENTAL' };
  }
  if (delta % 12 === 0) return { correct: false, error: 'OCTAVE' };
  const abs = Math.abs(delta);
  if (abs === 3 || abs === 4) return { correct: false, error: 'LINE_SPACE' };
  if (abs === 1 || abs === 2) return { correct: false, error: 'STEP' };
  return { correct: false, error: 'OTHER' };
}

export interface AllLocationsResult {
  readonly correct: boolean;
  /** Acerto parcial em [0, 1]: (marcados ∩ V − marcados ∉ V) / |V|, mínimo 0. */
  readonly score: number;
  readonly missing: FretLocation[];
  readonly extra: FretLocation[];
  readonly valid: FretLocation[];
}

/** Modo "todos os locais". */
export function evaluateAllLocations(target: Target, answers: readonly FretLocation[], inst: Instrument, c: Constraints): AllLocationsResult {
  const valid = validLocations(target.sounding, inst, c);
  const validKeys = new Set(valid.map(locationKey));
  const answerKeys = new Set(answers.map(locationKey));
  const hits = answers.filter((a) => validKeys.has(locationKey(a)));
  const extra = answers.filter((a) => !validKeys.has(locationKey(a)));
  const missing = valid.filter((v) => !answerKeys.has(locationKey(v)));
  const score = valid.length === 0 ? 0 : Math.max(0, (hits.length - extra.length) / valid.length);
  return { correct: missing.length === 0 && extra.length === 0, score, missing, extra, valid };
}
