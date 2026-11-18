import { MASTERY_ORDER, type LearningModel, type MasteryState } from '../learning/model';
import { LEVELS, PIECES, pieceKcId, type Level, type Piece } from './pieces';

/**
 * Progressão do repertório, no estilo Anki:
 *  - cada obra é um item do FSRS ("repertorio:<id>"): quem acerta bem volta cada vez
 *    mais tarde, quem erra volta logo;
 *  - no modo automático o nível sobe sozinho quando a maior parte do nível foi aprovada;
 *  - a próxima obra é: 1) uma revisão vencida (a mais esquecida primeiro); 2) uma obra
 *    nova do nível; 3) a mais fraca do nível (para praticar mais).
 */
export type PieceStatus = 'new' | 'learning' | 'due' | 'scheduled' | 'mastered';

export const PIECE_STATUS_LABEL: Readonly<Record<PieceStatus, string>> = {
  new: 'nova',
  learning: 'aprendendo',
  due: 'revisar hoje',
  scheduled: 'em dia',
  mastered: 'dominada',
};

export interface PieceState {
  readonly piece: Piece;
  readonly status: PieceStatus;
  /** Próxima revisão (ms), se já foi tocada. */
  readonly dueAt: number | null;
  /** Aprovada: a última tentativa foi um acerto, ou já está em consolidação. */
  readonly passed: boolean;
  readonly attempts: number;
  /** Probabilidade estimada de ainda saber ler bem (FSRS), null se nunca tocada. */
  readonly r: number | null;
  readonly mastery: MasteryState;
  readonly lastTs: number;
}

/** Fração de obras aprovadas no nível para o nível seguinte abrir no modo automático. */
export const LEVEL_UP_SHARE = 0.8;

export function pieceStates(model: LearningModel | null, now: number, pieces: readonly Piece[] = PIECES): PieceState[] {
  return pieces.map((piece) => {
    const it = model?.get(pieceKcId(piece.id));
    if (!model || !it || it.stats.n === 0) {
      return { piece, status: 'new', dueAt: null, passed: false, attempts: 0, r: null, mastery: 'untrained', lastTs: 0 };
    }
    const mastery = model.mastery(it);
    const last = it.stats.recent[it.stats.recent.length - 1] ?? false;
    const passed = last || MASTERY_ORDER.indexOf(mastery) >= MASTERY_ORDER.indexOf('consolidating');
    const due = model.isDue(it, now);
    const status: PieceStatus = due ? 'due' : mastery === 'mastered' || mastery === 'automated' ? 'mastered' : !last ? 'learning' : 'scheduled';
    return {
      piece,
      status,
      dueAt: it.card ? new Date(it.card.dueAt).getTime() : null,
      passed,
      attempts: it.stats.n,
      r: model.retrievability(it, now),
      mastery,
      lastTs: it.stats.lastTs,
    };
  });
}

/** Nível atual no modo automático: o menor nível que ainda não foi aprovado em ≥ 80 %. */
export function autoLevel(states: readonly PieceState[]): Level {
  for (const level of LEVELS) {
    const here = states.filter((s) => s.piece.level === level);
    if (here.length === 0) continue;
    const ok = here.filter((s) => s.passed).length;
    if (ok / here.length < LEVEL_UP_SHARE) return level;
  }
  return 5;
}

export type PickReason = 'due' | 'new' | 'weak';

export const PICK_REASON_LABEL: Readonly<Record<PickReason, string>> = {
  due: 'revisão do dia',
  new: 'obra nova',
  weak: 'para praticar mais',
};

export interface Pick {
  readonly piece: Piece;
  readonly reason: PickReason;
}

/**
 * Próxima obra. `level` = 'auto' usa o nível automático e também traz revisões
 * vencidas dos níveis anteriores; um nível fixo fica só nele. `avoid` = obra que
 * acabou de ser tocada (não repete se houver outra opção).
 */
export function nextPiece(states: readonly PieceState[], level: Level | 'auto', avoid?: string): Pick | null {
  const auto = level === 'auto';
  const lv = auto ? autoLevel(states) : level;
  const inScope = (s: PieceState) => (auto ? s.piece.level <= lv : s.piece.level === lv);
  const fresh = (xs: PieceState[]) => {
    const others = xs.filter((s) => s.piece.id !== avoid);
    return others.length > 0 ? others : xs;
  };

  const due = fresh(states.filter((s) => inScope(s) && s.status === 'due')).sort((a, b) => (a.r ?? 0) - (b.r ?? 0));
  if (due[0]) return { piece: due[0].piece, reason: 'due' };

  const fresh2 = fresh(states.filter((s) => s.piece.level === lv && s.status === 'new'));
  if (fresh2[0]) return { piece: fresh2[0].piece, reason: 'new' };

  // as mais fracas: primeiro as não aprovadas, depois a menor chance de lembrar, depois a tocada há mais tempo
  const weak = fresh(states.filter((s) => s.piece.level === lv)).sort(
    (a, b) => Number(a.passed) - Number(b.passed) || (a.r ?? 0) - (b.r ?? 0) || a.lastTs - b.lastTs,
  );
  return weak[0] ? { piece: weak[0].piece, reason: 'weak' } : null;
}
