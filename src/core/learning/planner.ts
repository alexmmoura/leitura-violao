import type { Instrument } from '../instrument/instrument';
import { questionForKc, soundingOfKc, type CurriculumItem, type Question } from './curriculum';
import { canonicalKcId } from './kc';
import { fluencyMs } from './metrics';
import { MASTERY_TARGET_MS, type LearningModel } from './model';
import { createRng } from '../exercise/rng';

/**
 * Agendador de sessão ("Meu treinamento") — especificação §6.9 e §10.6.
 *
 * Prioridade: (1) reaprendizagem de itens errados nesta sessão, depois de 3–6 outros
 * itens; (2) revisões vencidas, menor R primeiro; (3) itens novos do currículo até o
 * limite diário (o limite encolhe se houver muitas revisões); (4) prática extra dos
 * itens mais fracos. Revisões e novos são intercalados (2 revisões : 1 novo).
 */
export interface PlannerOptions {
  readonly newPerDay: number;
  /** Itens novos já apresentados hoje (antes desta sessão). */
  readonly newIntroducedToday: number;
  readonly durationMs: number;
  readonly seed: number;
}

export type SlotKind = 'relearn' | 'review' | 'new' | 'extra';

export interface PlannedQuestion {
  readonly question: Question;
  readonly slot: SlotKind;
}

export interface PlannerSnapshot {
  readonly dueTotal: number;
  readonly dueLeft: number;
  readonly newBudget: number;
  readonly newIntroduced: number;
}

const MAX_RELEARNS_PER_ITEM = 2;

export class SessionPlanner {
  private readonly due: string[];
  private readonly newQueue: string[];
  private readonly relearn: { kcId: string; wait: number }[] = [];
  private readonly relearnCount = new Map<string, number>();
  private readonly startedAt: number;
  private readonly rng;
  private lastKc: string | null = null;
  private lastSounding: number | null = null;
  private reviewsSinceNew = 0;
  private newIntroduced = 0;
  readonly dueTotal: number;
  readonly newBudget: number;

  constructor(
    private readonly model: LearningModel,
    curriculum: readonly CurriculumItem[],
    private readonly inst: Instrument,
    private readonly opts: PlannerOptions,
    private readonly clock: () => number = Date.now,
  ) {
    this.startedAt = clock();
    this.rng = createRng(opts.seed);
    const now = this.startedAt;
    this.due = [...model.items.values()]
      .filter((it) => model.isDue(it, now) && questionForKc(it.kcId, inst, 0) !== null)
      .map((it) => ({ id: it.kcId, r: model.retrievability(it, now) ?? 0 }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.id);
    this.dueTotal = this.due.length;
    // Proteção contra sobrecarga: cada 10 revisões vencidas tiram 1 item novo.
    this.newBudget = Math.max(0, opts.newPerDay - opts.newIntroducedToday - Math.floor(this.dueTotal / 10));
    this.newQueue = curriculum.map((c) => c.kcId).filter((id) => !model.get(id));
  }

  snapshot(): PlannerSnapshot {
    return { dueTotal: this.dueTotal, dueLeft: this.due.length, newBudget: this.newBudget, newIntroduced: this.newIntroduced };
  }

  timeLeftMs(): number {
    return Math.max(0, this.opts.durationMs - (this.clock() - this.startedAt));
  }

  /** Informa o resultado da última questão e devolve a próxima (null = fim da sessão). */
  next(last?: { kcId: string; correct: boolean }): PlannedQuestion | null {
    if (last) {
      const id = canonicalKcId(last.kcId);
      for (const r of this.relearn) r.wait--;
      const count = this.relearnCount.get(id) ?? 0;
      if (!last.correct && count < MAX_RELEARNS_PER_ITEM) {
        this.relearn.push({ kcId: id, wait: 3 + this.rng.int(0, 3) });
        this.relearnCount.set(id, count + 1);
      }
    }
    if (this.timeLeftMs() <= 0) return null;

    const pick = (list: string[]): string | null => {
      const idx = list.findIndex((id) => this.acceptable(id));
      const i = idx >= 0 ? idx : list.length > 0 && list[0] !== this.lastKc ? 0 : -1;
      return i >= 0 ? list.splice(i, 1)[0]! : null;
    };

    let id: string | null = null;
    let slot: SlotKind = 'review';
    const readyIdx = this.relearn.findIndex((r) => r.wait <= 0 && r.kcId !== this.lastKc);
    if (readyIdx >= 0) {
      id = this.relearn.splice(readyIdx, 1)[0]!.kcId;
      slot = 'relearn';
    }
    const canNew = this.newIntroduced < this.newBudget && this.newQueue.length > 0;
    if (!id && this.due.length > 0 && !(canNew && this.reviewsSinceNew >= 2)) {
      id = pick(this.due);
      slot = 'review';
      if (id) this.reviewsSinceNew++;
    }
    if (!id && canNew) {
      id = this.newQueue.shift()!;
      slot = 'new';
      this.newIntroduced++;
      this.reviewsSinceNew = 0;
    }
    if (!id && this.due.length > 0) {
      id = this.due.shift()!;
      slot = 'review';
    }
    if (!id) {
      id = this.weakest();
      slot = 'extra';
    }
    if (!id) return null;

    const question = questionForKc(id, this.inst, this.rng.int(0, 2 ** 31));
    if (!question) return this.next();
    this.lastKc = id;
    this.lastSounding = soundingOfKc(id, this.inst);
    return { question, slot };
  }

  /** Evita repetir o item ou a mesma altura logo em seguida. */
  private acceptable(id: string): boolean {
    return id !== this.lastKc && soundingOfKc(id, this.inst) !== this.lastSounding;
  }

  /** Prática extra: itens já vistos com pior acerto recente ou tempo acima do alvo. */
  private weakest(): string | null {
    const scored = [...this.model.items.values()]
      .filter((it) => it.kcId !== this.lastKc && questionForKc(it.kcId, this.inst, 0) !== null)
      .map((it) => {
        const acc = it.stats.recent.length ? it.stats.recent.filter(Boolean).length / it.stats.recent.length : 0;
        const t = fluencyMs(it.fluency) ?? Infinity;
        const slow = Math.min(3, t / (MASTERY_TARGET_MS(it.kind) ?? 4000));
        return { id: it.kcId, score: acc - 0.2 * slow + this.rng.next() * 0.05 };
      })
      .sort((a, b) => a.score - b.score);
    const best = scored.find((s) => this.acceptable(s.id)) ?? scored[0];
    return best?.id ?? null;
  }
}
