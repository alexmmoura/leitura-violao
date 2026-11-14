import { median } from '../learning/metrics';

/**
 * Métricas de leitura à primeira vista (C3) — especificação §11.4.
 * Parar é o erro mais grave: a música não espera.
 */
export interface ExpectedNote {
  readonly onsetMs: number;
  readonly sounding: number;
}

export interface ReadingResponse {
  readonly tMs: number;
  readonly sounding: number;
}

export type NoteStatus = 'ok' | 'timing' | 'wrong-pitch' | 'missed';

export interface ReadingEvaluation {
  readonly perNote: { readonly status: NoteStatus; readonly devMs: number | null }[];
  /** Notas certas em altura E no tempo. */
  readonly notesInTime: number;
  /** Notas certas em altura (com resposta associada), independentemente do tempo. */
  readonly pitchAccuracy: number;
  readonly medianAbsDevMs: number | null;
  /** 1 − (tempo parado / duração). Parada = 2+ notas seguidas sem resposta, ou um buraco > 1 tempo. */
  readonly continuity: number;
  /** Média de notas até voltar a acertar no tempo depois de um erro. */
  readonly recovery: number | null;
  readonly extras: number;
}

/**
 * `anyOctave`: compara só o nome da nota (solfejo — cada voz canta na sua região).
 */
export function evaluateReading(
  expected: readonly ExpectedNote[],
  responses: readonly ReadingResponse[],
  beatMs: number,
  toleranceMs: number,
  totalMs: number,
  anyOctave = false,
): ReadingEvaluation {
  const same = (a: number, b: number) => (anyOctave ? (((a - b) % 12) + 12) % 12 === 0 : a === b);
  const used = new Set<number>();
  const perNote: ReadingEvaluation['perNote'] = expected.map((e, i) => {
    const prevGap = i > 0 ? e.onsetMs - expected[i - 1]!.onsetMs : beatMs;
    const nextGap = i < expected.length - 1 ? expected[i + 1]!.onsetMs - e.onsetMs : beatMs;
    const before = Math.min(beatMs / 2, prevGap / 2);
    const after = Math.min(beatMs / 2, nextGap / 2);
    let best = -1;
    let bestD = Infinity;
    responses.forEach((r, j) => {
      const d = r.tMs - e.onsetMs;
      if (used.has(j) || d < -before || d > after) return;
      // prefere a resposta de altura certa; entre iguais, a mais próxima
      const score = Math.abs(d) + (same(r.sounding, e.sounding) ? 0 : 10_000);
      if (score < bestD) {
        bestD = score;
        best = j;
      }
    });
    if (best < 0) return { status: 'missed', devMs: null };
    used.add(best);
    const r = responses[best]!;
    const dev = r.tMs - e.onsetMs;
    if (!same(r.sounding, e.sounding)) return { status: 'wrong-pitch', devMs: dev };
    return { status: Math.abs(dev) <= toleranceMs ? 'ok' : 'timing', devMs: dev };
  });

  const n = expected.length || 1;
  const ok = perNote.filter((p) => p.status === 'ok').length;
  const pitchOk = perNote.filter((p) => p.status === 'ok' || p.status === 'timing').length;

  // paradas
  let stopMs = 0;
  let i = 0;
  while (i < perNote.length) {
    if (perNote[i]!.status !== 'missed') {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < perNote.length && perNote[j + 1]!.status === 'missed') j++;
    const start = expected[i]!.onsetMs;
    const end = j + 1 < expected.length ? expected[j + 1]!.onsetMs : totalMs;
    const span = end - start;
    if (j > i || span > beatMs) stopMs += span;
    i = j + 1;
  }

  // recuperação
  const recoveries: number[] = [];
  for (let k = 0; k < perNote.length; k++) {
    if (perNote[k]!.status === 'ok' || (k > 0 && perNote[k - 1]!.status !== 'ok')) continue;
    let m = k + 1;
    while (m < perNote.length && perNote[m]!.status !== 'ok') m++;
    if (m < perNote.length) recoveries.push(m - k);
  }

  return {
    perNote,
    notesInTime: ok / n,
    pitchAccuracy: pitchOk / n,
    medianAbsDevMs: median(perNote.filter((p) => p.devMs !== null && p.status !== 'wrong-pitch').map((p) => Math.abs(p.devMs!))),
    continuity: Math.max(0, 1 - stopMs / Math.max(1, totalMs)),
    recovery: recoveries.length ? recoveries.reduce((a, b) => a + b, 0) / recoveries.length : null,
    extras: responses.length - used.size,
  };
}

export const SUSTAIN_NOTES_IN_TIME = 0.85;
export const SUSTAIN_CONTINUITY = 0.9;

export interface ReadingRecord {
  readonly ts: number;
  readonly bpm: number;
  readonly notesInTime: number;
  readonly continuity: number;
}

/**
 * Andamento sustentável (§11.4): maior andamento em que o aluno mantém notas no
 * tempo ≥ 85 % e continuidade ≥ 90 % em 3 frases NOVAS seguidas (o andamento
 * creditado é o menor dos três).
 */
export function sustainableBpm(history: readonly ReadingRecord[]): number | null {
  const sorted = [...history].sort((a, b) => a.ts - b.ts);
  let best: number | null = null;
  for (let i = 2; i < sorted.length; i++) {
    const w = sorted.slice(i - 2, i + 1);
    if (w.every((r) => r.notesInTime >= SUSTAIN_NOTES_IN_TIME && r.continuity >= SUSTAIN_CONTINUITY)) {
      const bpm = Math.min(...w.map((r) => r.bpm));
      if (best === null || bpm > best) best = bpm;
    }
  }
  return best;
}
