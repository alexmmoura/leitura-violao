import { KIND_INFO, type ItemKind } from './kinds';
import { median } from './metrics';

/**
 * Do desempenho à nota FSRS — especificação §10.4.
 * A nota é DERIVADA automaticamente (sem autoavaliação):
 *   errado (ou com dica)            → Again (1)
 *   certo, tempo > alvo lento       → Hard  (2)
 *   certo, entre os alvos           → Good  (3)
 *   certo, tempo ≤ alvo rápido      → Easy  (4)
 * Itens pontuados (ritmo executado, frases) e sem tempo comparável seguem
 * regras próprias — ver gradeAttempt.
 */
export type Grade = 1 | 2 | 3 | 4;
export const GRADE_LABEL: Readonly<Record<Grade, string>> = { 1: 'Errei', 2: 'Difícil', 3: 'Bom', 4: 'Fácil' };

export type { ItemKind };
export type InputKind = 'mouse' | 'keyboard' | 'microphone' | 'midi';

export interface TimeTargets {
  readonly fastMs: number;
  readonly slowMs: number;
}

/**
 * Alvos pedagógicos absolutos dos itens cronometrados (HIPÓTESE inicial).
 * Escrever na pauta exige mais gestos que clicar no braço, por isso alvos maiores.
 */
export function pedagogicalTargets(kind: ItemKind): TimeTargets {
  const k = KIND_INFO[kind];
  return { fastMs: k.fastMs ?? 3000, slowMs: k.slowMs ?? 8000 };
}

/** Compatibilidade: alvos das notas. */
export const PEDAGOGICAL_TARGETS = {
  'staff>fretboard': pedagogicalTargets('staff>fretboard'),
  'fretboard>staff': pedagogicalTargets('fretboard>staff'),
} as const;

/** Mínimo de respostas corretas para personalizar os alvos. */
export const MIN_SAMPLES_FOR_PERSONAL = 20;

/**
 * Alvos pessoais: lento = 2 × mediana pessoal; rápido = 0,7 × mediana pessoal,
 * limitados pelos alvos pedagógicos (nunca mais frouxos que eles).
 */
export function personalTargets(kind: ItemKind, recentCorrectRts: readonly number[]): TimeTargets {
  const base = pedagogicalTargets(kind);
  if (recentCorrectRts.length < MIN_SAMPLES_FOR_PERSONAL) return base;
  const m = median(recentCorrectRts)!;
  return {
    fastMs: Math.min(base.fastMs, 0.7 * m),
    slowMs: Math.min(base.slowMs, Math.max(2 * m, base.fastMs)),
  };
}

export function deriveGrade(correct: boolean, rtMs: number, t: TimeTargets, hinted = false): Grade {
  if (!correct || hinted) return 1;
  if (rtMs > t.slowMs) return 2;
  if (rtMs <= t.fastMs) return 4;
  return 3;
}

/**
 * Nota FSRS de qualquer tipo de item:
 *  - timed: acerto + tempo (deriveGrade);
 *  - scored: certo → Bom (Fácil se pontuação ≥ 95 %); errado → Difícil se ≥ 70 % (passou raspando), senão Errei;
 *  - plain: certo → Bom; errado → Errei. (Tempo de reação não é comparável nesses itens.)
 */
export function gradeAttempt(kind: ItemKind, correct: boolean, rtMs: number, score: number | undefined, kindRts: readonly number[]): Grade {
  const g = KIND_INFO[kind].grading;
  if (g === 'timed') return deriveGrade(correct, rtMs, personalTargets(kind, kindRts));
  if (g === 'scored') {
    const s = score ?? (correct ? 1 : 0);
    if (correct) return s >= 0.95 ? 4 : 3;
    return s >= 0.7 ? 2 : 1;
  }
  return correct ? 3 : 1;
}
