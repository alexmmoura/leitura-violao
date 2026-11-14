import { asSounding, pitchClass } from '../theory/pitch';
import { spellingsForMidi, isSimpleSpelling } from '../theory/spelling';
import type { FretLocation, Instrument } from '../instrument/instrument';
import type { PositionSpec } from '../instrument/position';
import { validLocations } from './constraints';
import { buildQuestion, type NoteQuestion, type NoteQuestionConfig } from './noteQuestion';
import { createRng, type Rng } from './rng';

/**
 * Teste de conclusão de posição — especificação §6.3 (item 7) e CA de Módulo C.
 *
 * Amostragem estratificada: todas as cordas representadas de forma equilibrada,
 * com pelo menos uma nota alterada por corda (quando a posição tiver uma).
 * Critério: acerto ≥ 95 % e tempo mediano ≤ 1,5 s.
 * As 2 frases melódicas previstas na especificação entram com o Módulo D (Fase 3).
 */
export const POSITION_TEST_SIZE = 40;
export const PASS_ACCURACY = 0.95;
export const PASS_MEDIAN_MS = 1500;

const NATURAL_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);

interface Item {
  readonly sounding: number;
  readonly loc: FretLocation;
  readonly accidental: boolean;
}

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function positionTestConfig(position: PositionSpec, inst: Instrument): NoteQuestionConfig {
  return {
    fifths: 0,
    accidentals: 'chromatic',
    strings: inst.strings.map((_, i) => i + 1),
    position,
    minFret: 0,
    maxFret: inst.frets,
    minWritten: 0,
    maxWritten: 200,
    answerMode: 'any',
  };
}

export function buildPositionTest(position: PositionSpec, inst: Instrument, seed: number, size = POSITION_TEST_SIZE): NoteQuestion[] {
  const rng = createRng(seed);
  const cfg = positionTestConfig(position, inst);
  const constraints = { strings: cfg.strings, minFret: 0, maxFret: inst.frets, position };

  // Itens = cada local (corda, casa) dentro da posição.
  const byString = new Map<number, Item[]>();
  const low = Math.min(...inst.strings.map((s) => s.openMidi));
  const high = Math.max(...inst.strings.map((s) => s.openMidi)) + inst.frets;
  for (let m = low; m <= high; m++) {
    for (const loc of validLocations(asSounding(m), inst, constraints)) {
      const list = byString.get(loc.string) ?? [];
      list.push({ sounding: m, loc, accidental: !NATURAL_PCS.has(pitchClass(m)) });
      byString.set(loc.string, list);
    }
  }
  const strings = [...byString.keys()].sort((a, b) => a - b);
  if (strings.length === 0) throw new Error('Posição sem notas.');

  // Cotas equilibradas por corda.
  const picked: Item[] = [];
  strings.forEach((s, idx) => {
    const quota = Math.floor(size / strings.length) + (idx < size % strings.length ? 1 : 0);
    const items = shuffle(rng, byString.get(s)!);
    const acc = items.find((i) => i.accidental);
    const ordered = acc ? [acc, ...items.filter((i) => i !== acc)] : items;
    for (let k = 0; k < quota; k++) picked.push(ordered[k % ordered.length]!);
  });

  // Embaralhar evitando o mesmo som duas vezes seguidas.
  const remaining = shuffle(rng, picked);
  const order: Item[] = [];
  while (remaining.length) {
    const last = order[order.length - 1];
    let idx = remaining.findIndex((x) => !last || x.sounding !== last.sounding);
    if (idx < 0) idx = 0;
    order.push(remaining.splice(idx, 1)[0]!);
  }

  return order.map((item, i) => {
    const spellings = spellingsForMidi(item.sounding - inst.transposition).filter(isSimpleSpelling);
    const natural = spellings.find((p) => p.alter === 0);
    const p = natural ?? rng.pick(spellings);
    return buildQuestion(p, cfg, inst, seed + i);
  });
}

export interface PositionTestOutcome {
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly medianMs: number | null;
  readonly passed: boolean;
}

export function evaluatePositionTest(results: readonly { correct: boolean; rtMs: number }[]): PositionTestOutcome {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const times = results.filter((r) => r.correct).map((r) => r.rtMs).sort((a, b) => a - b);
  const medianMs = times.length ? (times.length % 2 ? times[(times.length - 1) / 2]! : (times[times.length / 2 - 1]! + times[times.length / 2]!) / 2) : null;
  const accuracy = total ? correct / total : 0;
  return { total, correct, accuracy, medianMs, passed: total > 0 && accuracy >= PASS_ACCURACY && medianMs !== null && medianMs <= PASS_MEDIAN_MS };
}
