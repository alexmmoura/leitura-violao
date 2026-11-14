import { keyAlterFor, type Fifths } from '../theory/keySignature';
import {
  diatonicIndex,
  pitchName,
  spelledToMidi,
  writtenMidiOf,
  type Alter,
  type Letter,
  type SpelledPitch,
  type SoundingMidi,
  type WrittenMidi,
} from '../theory/pitch';
import { areEnharmonic, isSimpleSpelling } from '../theory/spelling';
import type { FretLocation, Instrument } from '../instrument/instrument';
import { baseConstraints, candidatePool, type NoteQuestionConfig } from './noteQuestion';
import { createRng } from './rng';
import { bpId } from '../learning/kc';
import { validLocations } from './constraints';
import type { ErrorCode } from './validate';

/**
 * Flashcard sentido 2: braço → pauta — especificação §6.2 e §8.3.
 * Uma casa acende; o estudante escreve a nota na pauta (posição + acidente).
 *
 * Grafia: uma casa não determina a grafia. Regra adotada:
 *  - com armadura (fifths ≠ 0) e nota diatônica, exige-se a grafia da tonalidade;
 *  - nos demais casos, qualquer grafia enarmônica simples é aceita.
 */
export interface FretQuestion {
  readonly kind: 'fretboard>staff';
  readonly seed: number;
  readonly location: FretLocation;
  /** Grafia esperada (de referência). */
  readonly written: SpelledPitch;
  readonly writtenMidi: WrittenMidi;
  readonly sounding: SoundingMidi;
  readonly fifths: Fifths;
  readonly requireSpelling: boolean;
  readonly kcId: string;
}

/** Resposta na pauta: posição (letra + oitava escrita) e acidente desenhado (null = nenhum). */
export interface StaffAnswer {
  readonly letter: Letter;
  readonly octave: number;
  readonly accidental: Alter | null;
}

/** Altura efetiva da resposta: acidente desenhado ou, na falta dele, a armadura. */
export function effectivePitch(a: StaffAnswer, fifths: Fifths): SpelledPitch {
  return { letter: a.letter, octave: a.octave, alter: a.accidental ?? keyAlterFor(a.letter, fifths) };
}

export function buildFretQuestion(p: SpelledPitch, location: FretLocation, fifths: Fifths, inst: Instrument, seed: number): FretQuestion {
  const writtenMidi = writtenMidiOf(p);
  const sounding = (writtenMidi + inst.transposition) as SoundingMidi;
  const diatonic = keyAlterFor(p.letter, fifths) === p.alter;
  return {
    kind: 'fretboard>staff',
    seed,
    location,
    written: p,
    writtenMidi,
    sounding,
    fifths,
    requireSpelling: fifths !== 0 && diatonic,
    kcId: bpId(location, fifths),
  };
}

export function generateFretQuestion(cfg: NoteQuestionConfig, inst: Instrument, seed: number, avoid?: string): FretQuestion {
  const rng = createRng(seed);
  const pool = candidatePool(cfg, inst);
  if (pool.length === 0) throw new Error('Nenhuma nota disponível com essas configurações.');
  let q: FretQuestion | null = null;
  for (let i = 0; i < 8; i++) {
    const p = rng.pick(pool);
    const locs = validLocations((writtenMidiOf(p) + inst.transposition) as SoundingMidi, inst, baseConstraints(cfg));
    q = buildFretQuestion(p, rng.pick(locs), cfg.fifths, inst, seed);
    if (q.kcId !== avoid) break;
  }
  return q!;
}

export interface StaffResult {
  readonly correct: boolean;
  readonly error?: ErrorCode;
  readonly given: SpelledPitch;
}

export function evaluateStaffAnswer(q: FretQuestion, a: StaffAnswer): StaffResult {
  const given = effectivePitch(a, q.fifths);
  const exp = q.written;
  const sameSpelling = given.letter === exp.letter && given.alter === exp.alter && given.octave === exp.octave;
  if (sameSpelling) return { correct: true, given };

  const givenMidi = spelledToMidi(given);
  if (givenMidi === q.writtenMidi && areEnharmonic(given, exp)) {
    if (!q.requireSpelling && isSimpleSpelling(given)) return { correct: true, given };
    return { correct: false, error: 'ENHARMONIC', given };
  }

  const dDiatonic = diatonicIndex(given) - diatonicIndex(exp);
  if (dDiatonic === 0) {
    // posição certa na pauta, alteração errada
    return { correct: false, error: exp.alter !== 0 && keyAlterFor(exp.letter, q.fifths) === exp.alter ? 'KEY_ACCIDENTAL' : 'LOCAL_ACCIDENTAL', given };
  }
  if (given.letter === exp.letter && dDiatonic % 7 === 0) return { correct: false, error: 'OCTAVE', given };
  if (Math.abs(dDiatonic) === 2) return { correct: false, error: 'LINE_SPACE', given };
  if (Math.abs(dDiatonic) === 1) return { correct: false, error: 'STEP', given };
  return { correct: false, error: 'OTHER', given };
}

export function describeStaffAnswer(a: StaffAnswer, fifths: Fifths, opts: Parameters<typeof pitchName>[1] = {}): string {
  return pitchName(effectivePitch(a, fifths), opts);
}
