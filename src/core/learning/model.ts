import { DefaultScheduler } from 'ts-fsrs';
import { canonicalKcId } from './kc';
import { KIND_INFO, kindOfKc, type ItemKind } from './kinds';
import { EMPTY_FLUENCY, median, updateFluency, wilsonLower, type Fluency } from './metrics';
import { gradeAttempt, type Grade } from './rating';

/**
 * Modelo de aprendizagem — especificação §10 e §11.
 *
 * Todo estado é DERIVADO do registro imutável de tentativas: reaplicar o mesmo
 * registro produz o mesmo estado (CA-SRS-4). Regras:
 *  - só a PRIMEIRA tentativa do dia de cada item atualiza o FSRS (CA-SRS-1);
 *  - todas as tentativas atualizam contagens e fluência;
 *  - a nota FSRS é derivada de acerto + tempo (CA-SRS-2).
 */
export const DEFAULT_RETENTION = 0.9;

/** FSRS-7 fixado explicitamente (o padrão da biblioteca pode mudar entre versões). */
export function createScheduler(desiredRetention = DEFAULT_RETENTION) {
  return DefaultScheduler({ version: 'FSRS-7', desiredRetention, enableFuzz: false, enableShortTerm: false });
}

export type Scheduler = Awaited<ReturnType<typeof createScheduler>>;
export type FsrsCard = ReturnType<Scheduler['review']>['card'];

export interface AttemptLike {
  readonly ts: number;
  readonly day: string;
  readonly kcId: string;
  readonly correct: boolean;
  readonly rtMs: number;
  /** Pontuação contínua em [0,1] (itens 'scored'). */
  readonly score?: number;
}

export interface ItemStats {
  readonly n: number;
  readonly correct: number;
  readonly days: readonly string[];
  /** Últimos 20 resultados (true = acerto), mais recente no fim. */
  readonly recent: readonly boolean[];
  /** Tempos das últimas 10 respostas corretas. */
  readonly recentRt: readonly number[];
  readonly lastTs: number;
  readonly lastDay: string;
}

export interface ItemState {
  readonly kcId: string;
  readonly kind: ItemKind;
  readonly card: FsrsCard | null;
  readonly stats: ItemStats;
  readonly fluency: Fluency;
  readonly lastGrade: Grade | null;
}

export type MasteryState = 'untrained' | 'acquiring' | 'unstable' | 'consolidating' | 'mastered' | 'automated';

export const MASTERY_LABEL: Readonly<Record<MasteryState, string>> = {
  untrained: 'Não treinado',
  acquiring: 'Em aquisição',
  unstable: 'Instável',
  consolidating: 'Consolidando',
  mastered: 'Dominado',
  automated: 'Automatizado',
};
export const MASTERY_ORDER: readonly MasteryState[] = ['untrained', 'acquiring', 'unstable', 'consolidating', 'mastered', 'automated'];

/**
 * Alvos de domínio (§1.3: mediana ≤ 1,5 s na pauta → braço). HIPÓTESE inicial.
 * Itens sem tempo comparável (pontuados ou só acerto) não têm alvo de tempo.
 */
export const MASTERY_TARGET_MS = (kind: ItemKind): number | null => KIND_INFO[kind].masteryMs ?? null;
export const AUTOMATED_TARGET_MS = (kind: ItemKind): number | null => KIND_INFO[kind].automatedMs ?? null;

export const MASTERED_WILSON = 0.75;

const EMPTY_STATS: ItemStats = { n: 0, correct: 0, days: [], recent: [], recentRt: [], lastTs: 0, lastDay: '' };
const RECENT_KIND_RTS = 50;
const DAY_MS = 86_400_000;

export class LearningModel {
  readonly items = new Map<string, ItemState>();
  private readonly kindRts = new Map<ItemKind, number[]>();

  constructor(
    readonly scheduler: Scheduler,
    readonly retention = DEFAULT_RETENTION,
  ) {}

  static replay(scheduler: Scheduler, attempts: readonly AttemptLike[], retention = DEFAULT_RETENTION): LearningModel {
    const m = new LearningModel(scheduler, retention);
    for (const a of [...attempts].sort((x, y) => x.ts - y.ts)) m.apply(a);
    return m;
  }

  /** Aplica uma tentativa. Retorna a nota FSRS usada, ou null se não atualizou o FSRS. */
  apply(a: AttemptLike): Grade | null {
    const kcId = canonicalKcId(a.kcId);
    const kind = kindOfKc(kcId);
    if (!kind) return null;
    const prev = this.items.get(kcId) ?? { kcId, kind, card: null, stats: EMPTY_STATS, fluency: EMPTY_FLUENCY, lastGrade: null };

    const firstOfDay = prev.stats.lastDay !== a.day;
    const kindRts = this.kindRts.get(kind) ?? [];
    let card = prev.card;
    let grade: Grade | null = null;
    if (firstOfDay) {
      grade = gradeAttempt(kind, a.correct, a.rtMs, a.score, kindRts);
      const now = new Date(a.ts);
      // cardId fixo = id do item: sem isso o ts-fsrs gera um UUID e o recálculo deixaria de ser determinístico.
      const base = card ?? this.scheduler.newCard({ now, cardId: kcId });
      card = this.scheduler.review({ card: base, grade, now }).card;
    }

    const s = prev.stats;
    const stats: ItemStats = {
      n: s.n + 1,
      correct: s.correct + (a.correct ? 1 : 0),
      days: s.days.includes(a.day) ? s.days : [...s.days, a.day],
      recent: [...s.recent, a.correct].slice(-20),
      recentRt: a.correct ? [...s.recentRt, a.rtMs].slice(-10) : s.recentRt,
      lastTs: a.ts,
      lastDay: a.day,
    };
    if (a.correct) this.kindRts.set(kind, [...kindRts, a.rtMs].slice(-RECENT_KIND_RTS));
    this.items.set(kcId, {
      kcId,
      kind,
      card,
      stats,
      fluency: a.correct ? updateFluency(prev.fluency, a.rtMs) : prev.fluency,
      lastGrade: grade ?? prev.lastGrade,
    });
    return grade;
  }

  get(kcId: string): ItemState | undefined {
    return this.items.get(canonicalKcId(kcId));
  }

  /** Probabilidade estimada de lembrar agora (R), ou null para item sem revisão. */
  retrievability(item: ItemState, now: number): number | null {
    const c = item.card;
    if (!c || !c.lastReviewAt) return null;
    const elapsed = Math.max(0, (now - new Date(c.lastReviewAt).getTime()) / DAY_MS);
    return this.scheduler.model.forgettingCurve(c, elapsed);
  }

  isDue(item: ItemState, now: number): boolean {
    return !!item.card && new Date(item.card.dueAt).getTime() <= now;
  }

  /**
   * Estado de domínio — especificação §11.2 (nunca "dominado" após um acerto).
   *
   * Correção em relação à v0.1 da especificação: lá se pedia Wilson ≥ 0,85 com
   * ≥ 8 tentativas, o que é matematicamente impossível numa janela de 20
   * (20/20 ⇒ 0,839). Critérios adotados:
   *  - Instável: acerto recente < 70 % ou as 2 últimas erradas;
   *  - Dominado: Wilson (últimas 20) ≥ 0,75 — exige ao menos 12 acertos seguidos
   *    ou 19/20 —, ≥ 3 dias, mediana ≤ alvo, estabilidade FSRS ≥ 7 dias.
   */
  mastery(item: ItemState | undefined): MasteryState {
    if (!item || item.stats.n === 0) return 'untrained';
    const s = item.stats;
    if (s.n < 5 || s.days.length < 2) return 'acquiring';
    const okRecent = s.recent.filter(Boolean).length;
    const accuracy = okRecent / s.recent.length;
    const lastTwoWrong = s.recent.length >= 2 && !s.recent[s.recent.length - 1] && !s.recent[s.recent.length - 2];
    if (accuracy < 0.7 || lastTwoWrong) return 'unstable';
    const w = wilsonLower(okRecent, s.recent.length);
    const med = median(s.recentRt);
    const stability = item.card?.stability ?? 0;
    const target = MASTERY_TARGET_MS(item.kind);
    const fastEnough = target === null || (med !== null && med <= target);
    const mastered = w >= MASTERED_WILSON && s.n >= 8 && s.days.length >= 3 && fastEnough && stability >= 7;
    if (!mastered) return 'consolidating';
    const auto = AUTOMATED_TARGET_MS(item.kind);
    if ((auto === null || (med !== null && med <= auto)) && stability >= 30) return 'automated';
    return 'mastered';
  }

  /** "Esquecendo": já consolidado, mas R abaixo da retenção-alvo. */
  isForgetting(item: ItemState | undefined, now: number): boolean {
    if (!item) return false;
    const st = this.mastery(item);
    if (MASTERY_ORDER.indexOf(st) < MASTERY_ORDER.indexOf('consolidating')) return false;
    const r = this.retrievability(item, now);
    return r !== null && r < this.retention;
  }
}
