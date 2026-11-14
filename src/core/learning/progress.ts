import type { FretLocation, Instrument } from '../instrument/instrument';
import { locationsOfKc } from './curriculum';
import { median, wilsonLower } from './metrics';
import { MASTERY_ORDER, type ItemState, type LearningModel, type MasteryState } from './model';
import type { ItemKind } from './rating';

/**
 * Mapa de calor e indicadores de evolução — especificação §8 e §11.3–11.5.
 */
export type HeatDirection = 'both' | ItemKind;

export interface CellAgg {
  readonly n: number;
  readonly correct: number;
  readonly rts: number[];
  readonly items: number;
  readonly due: number;
  /** Estado de domínio de cada item mapeado para a célula. */
  readonly states: MasteryState[];
}

export function aggregateCells(model: LearningModel, inst: Instrument, now: number, dir: HeatDirection = 'both'): Map<string, CellAgg> {
  const cells = new Map<string, { n: number; correct: number; rts: number[]; items: number; due: number; states: MasteryState[] }>();
  for (const item of model.items.values()) {
    if (dir !== 'both' && item.kind !== dir) continue;
    const state = model.mastery(item);
    const due = model.isDue(item, now) ? 1 : 0;
    for (const loc of locationsOfKc(item.kcId, inst)) {
      const key = `${loc.string}:${loc.fret}`;
      const c = cells.get(key) ?? { n: 0, correct: 0, rts: [], items: 0, due: 0, states: [] };
      c.n += item.stats.n;
      c.correct += item.stats.correct;
      c.rts.push(...item.stats.recentRt);
      c.items++;
      c.due += due;
      c.states.push(state);
      cells.set(key, c);
    }
  }
  return cells;
}

/**
 * Estado da célula = o PIOR estado entre os itens treinados que a usam
 * (uma célula só é "dominada" se tudo o que passa por ela estiver dominado).
 */
export function cellState(c: CellAgg | undefined): MasteryState {
  if (!c) return 'untrained';
  const trained = c.states.filter((s) => s !== 'untrained');
  if (trained.length === 0) return 'untrained';
  return trained.reduce((worst, s) => (MASTERY_ORDER.indexOf(s) < MASTERY_ORDER.indexOf(worst) ? s : worst));
}

export interface GroupStat {
  readonly label: string;
  readonly n: number;
  readonly wilson: number;
  readonly accuracy: number;
  readonly medianMs: number | null;
}

function groupStat(label: string, cs: CellAgg[]): GroupStat {
  const n = cs.reduce((s, c) => s + c.n, 0);
  const correct = cs.reduce((s, c) => s + c.correct, 0);
  return { label, n, wilson: wilsonLower(correct, n), accuracy: n ? correct / n : 0, medianMs: median(cs.flatMap((c) => c.rts)) };
}

/** Desempenho por corda e por região do braço (§8). */
export function groupStats(cells: Map<string, CellAgg>, inst: Instrument): { byString: GroupStat[]; byRegion: GroupStat[] } {
  const entries = [...cells.entries()].map(([k, c]) => {
    const [s, f] = k.split(':').map(Number) as [number, number];
    return { loc: { string: s, fret: f } as FretLocation, c };
  });
  const byString = inst.strings.map((_, i) => groupStat(`Corda ${i + 1}`, entries.filter((e) => e.loc.string === i + 1).map((e) => e.c)));
  const regions: [string, number, number][] = [
    ['Casas 0–4', 0, 4],
    ['Casas 5–9', 5, 9],
    ['Casas 10–14', 10, 14],
    ['Casas 15+', 15, 99],
  ];
  const byRegion = regions.map(([label, a, b]) => groupStat(label, entries.filter((e) => e.loc.fret >= a && e.loc.fret <= b).map((e) => e.c)));
  return { byString, byRegion };
}

export interface WeekStat {
  readonly weekStart: string;
  readonly n: number;
  readonly accuracy: number;
  readonly medianMs: number | null;
  readonly days: number;
}

/** Segunda-feira (AAAA-MM-DD) da semana de um dia local AAAA-MM-DD. */
export function weekStartOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7; // 0 = segunda
  date.setUTCDate(date.getUTCDate() - dow);
  return date.toISOString().slice(0, 10);
}

/** Evolução semanal (§11.5): tentativas, acerto, tempo mediano e dias praticados. */
export function weeklyStats(attempts: readonly { day: string; correct: boolean; rtMs: number }[], weeks = 8): WeekStat[] {
  const by = new Map<string, { n: number; ok: number; rts: number[]; days: Set<string> }>();
  for (const a of attempts) {
    const w = weekStartOf(a.day);
    const e = by.get(w) ?? { n: 0, ok: 0, rts: [], days: new Set<string>() };
    e.n++;
    if (a.correct) {
      e.ok++;
      e.rts.push(a.rtMs);
    }
    e.days.add(a.day);
    by.set(w, e);
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-weeks)
    .map(([weekStart, e]) => ({ weekStart, n: e.n, accuracy: e.ok / e.n, medianMs: median(e.rts), days: e.days.size }));
}

/** Itens que mais precisam de atenção: vencidos/instáveis primeiro, depois menor acerto. */
export function weakItems(model: LearningModel, now: number, limit = 10): ItemState[] {
  const rank = (it: ItemState) => {
    const st = model.mastery(it);
    const acc = it.stats.recent.length ? it.stats.recent.filter(Boolean).length / it.stats.recent.length : 0;
    return (st === 'unstable' ? 0 : 1) + (model.isDue(it, now) || model.isForgetting(it, now) ? 0 : 0.5) + acc;
  };
  return [...model.items.values()]
    .filter((it) => it.stats.n >= 3)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit);
}
