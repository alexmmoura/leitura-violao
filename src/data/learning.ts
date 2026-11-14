import { useCallback, useEffect, useState } from 'react';
import { canonicalKcId } from '../core/learning/kc';
import { createScheduler, LearningModel, type Scheduler } from '../core/learning/model';
import { db, localDay, type AttemptRecord } from './db';

/**
 * Carrega o registro de tentativas e reconstrói o modelo de aprendizagem
 * (FSRS + fluência + domínio). Nada é guardado além do registro: o estado
 * é sempre recalculável (especificação §13.2).
 */
const schedulers = new Map<number, Promise<Scheduler>>();
export function getScheduler(retention: number): Promise<Scheduler> {
  let p = schedulers.get(retention);
  if (!p) {
    p = createScheduler(retention);
    schedulers.set(retention, p);
  }
  return p;
}

export interface LearningData {
  model: LearningModel;
  attempts: AttemptRecord[];
  /** Itens cuja PRIMEIRA tentativa de todas foi hoje (contam no limite diário de novos). */
  newToday: number;
}

export function computeNewToday(attempts: readonly AttemptRecord[], today = localDay()): number {
  const firstDay = new Map<string, string>();
  for (const a of [...attempts].sort((x, y) => x.ts - y.ts)) {
    const id = canonicalKcId(a.kcId);
    if (!firstDay.has(id)) firstDay.set(id, a.day);
  }
  let n = 0;
  for (const d of firstDay.values()) if (d === today) n++;
  return n;
}

export function useLearningData(retention: number): { data: LearningData | null; reload: () => void } {
  const [data, setData] = useState<LearningData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([getScheduler(retention), db.attempts.orderBy('ts').toArray()])
      .then(([scheduler, attempts]) => {
        if (!alive) return;
        const model = LearningModel.replay(scheduler, attempts, retention);
        setData({ model, attempts, newToday: computeNewToday(attempts) });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [retention, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, reload };
}
