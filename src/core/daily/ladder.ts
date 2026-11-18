import { fixedPosition, OPEN_POSITION, WHOLE_NECK } from '../instrument/position';
import { materialKey, type MelodyConfig } from '../melody/melody';

/**
 * Escada de dificuldade da leitura de frases na "Sessão de hoje".
 *
 * Cada degrau é uma configuração de frase (região, tonalidade, ritmo, saltos).
 * O degrau atual NÃO é guardado: é recalculado do registro de tentativas, como
 * todo o resto do app (§13.2). Regra:
 *  - 3 frases aprovadas seguidas no degrau atual → sobe um degrau;
 *  - 2 reprovadas seguidas → desce um degrau (nunca abaixo do primeiro).
 */
export interface LadderStep {
  readonly label: string;
  readonly config: MelodyConfig;
}

const ALL = [1, 2, 3, 4, 5, 6] as const;
const step = (label: string, c: Omit<MelodyConfig, 'strings' | 'measures' | 'beats'> & { measures?: number }): LadderStep => ({
  label,
  config: { strings: ALL, measures: c.measures ?? 4, beats: 4, ...c },
});

export const READING_LADDER: readonly LadderStep[] = [
  step('Posição aberta, Dó maior, graus conjuntos', { fifths: 0, region: OPEN_POSITION, rhythmLevel: 0, maxLeap: 1, chromatic: false }),
  step('Posição aberta, Dó maior, até terças', { fifths: 0, region: OPEN_POSITION, rhythmLevel: 0, maxLeap: 2, chromatic: false }),
  step('Posição aberta, com ritmo (mínimas e pausas)', { fifths: 0, region: OPEN_POSITION, rhythmLevel: 1, maxLeap: 2, chromatic: false }),
  step('Posição aberta, Sol maior', { fifths: 1, region: OPEN_POSITION, rhythmLevel: 1, maxLeap: 2, chromatic: false }),
  step('Posição aberta, Fá maior, com colcheias', { fifths: -1, region: OPEN_POSITION, rhythmLevel: 2, maxLeap: 2, chromatic: false }),
  step('II posição, Dó maior', { fifths: 0, region: fixedPosition(2), rhythmLevel: 2, maxLeap: 2, chromatic: false }),
  step('V posição, Dó maior', { fifths: 0, region: fixedPosition(5), rhythmLevel: 2, maxLeap: 2, chromatic: false }),
  step('V posição, Sol maior, até quintas', { fifths: 1, region: fixedPosition(5), rhythmLevel: 2, maxLeap: 4, chromatic: false }),
  step('V posição, Ré maior, contratempo', { fifths: 2, region: fixedPosition(5), rhythmLevel: 3, maxLeap: 4, chromatic: false }),
  step('VII posição, Lá maior', { fifths: 3, region: fixedPosition(7), rhythmLevel: 3, maxLeap: 4, chromatic: false }),
  step('V posição, Si♭ maior, com acidentes', { fifths: -2, region: fixedPosition(5), rhythmLevel: 3, maxLeap: 4, chromatic: true }),
  step('Braço inteiro, semicolcheias e síncopes', { fifths: 0, region: WHOLE_NECK, rhythmLevel: 4, maxLeap: 4, chromatic: true }),
  step('Braço inteiro, saltos de oitava, Mi♭ maior', { fifths: -3, region: WHOLE_NECK, rhythmLevel: 4, maxLeap: 7, chromatic: true }),
];

export const LADDER_UP = 3;
export const LADDER_DOWN = 2;

/** Ids de item ("leitura:<material>") de cada degrau, na ordem. */
export const ladderKcIds = (ladder: readonly LadderStep[] = READING_LADDER) => ladder.map((s) => `leitura:${materialKey(s.config)}`);

export interface LadderAttempt {
  readonly ts: number;
  readonly kcId: string;
  readonly correct: boolean;
}

export interface LadderState {
  /** Índice do degrau atual (0 = primeiro). */
  readonly level: number;
  /** Aprovadas seguidas no degrau atual. */
  readonly streak: number;
  /** Reprovadas seguidas no degrau atual. */
  readonly misses: number;
}

/** Reaplica a regra de subir/descer sobre as tentativas (em qualquer ordem). */
export function ladderState(attempts: readonly LadderAttempt[], ladder: readonly LadderStep[] = READING_LADDER): LadderState {
  const ids = ladderKcIds(ladder);
  let level = 0;
  let streak = 0;
  let misses = 0;
  for (const a of [...attempts].sort((x, y) => x.ts - y.ts)) {
    if (a.kcId !== ids[level]) continue; // frases de outros degraus (ou da tela de leitura) não movem a escada
    if (a.correct) {
      misses = 0;
      if (++streak >= LADDER_UP && level < ladder.length - 1) {
        level++;
        streak = 0;
      }
    } else {
      streak = 0;
      if (++misses >= LADDER_DOWN && level > 0) {
        level--;
        misses = 0;
      }
    }
  }
  return { level, streak, misses };
}

/** Uma frase lida conta como aprovada — mesma regra usada no registro. */
export function readingPassed(s: { notesInTime: number; continuity: number | null }): boolean {
  return s.continuity === null ? s.notesInTime >= 0.9 : s.notesInTime >= 0.85 && s.continuity >= 0.9;
}
