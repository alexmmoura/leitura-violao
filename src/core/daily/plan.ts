import type { ModuleKey } from '../learning/kinds';

/**
 * "Sessão de hoje" — o treino do dia montado sozinho, como a tela inicial do
 * Yousician: um botão de começar, e a opção de editar o tempo e as atividades.
 *
 * O tempo escolhido é dividido entre as atividades ligadas, por peso; as que não
 * têm nada a fazer hoje (sem revisões vencidas, todas as lições feitas) saem e o
 * tempo delas vai para as outras.
 */
export type ActivityId = 'notes' | 'reviews' | 'reading' | 'repertoire' | 'rhythm';

export const ACTIVITY_ORDER: readonly ActivityId[] = ['notes', 'reviews', 'reading', 'rhythm', 'repertoire'];

export const ACTIVITY_LABEL: Readonly<Record<ActivityId, string>> = {
  notes: 'Notas no braço',
  reviews: 'Revisões dos outros módulos',
  reading: 'Leitura de frases',
  rhythm: 'Leitura rítmica',
  repertoire: 'Obra clássica',
};

const WEIGHT: Readonly<Record<ActivityId, number>> = { notes: 4, reviews: 2, reading: 2, rhythm: 1.5, repertoire: 2 };
/** Minutos estimados por unidade (frase, lição, obra, item de revisão). */
const UNIT_MIN: Readonly<Record<Exclude<ActivityId, 'notes'>, number>> = { reviews: 0.5, reading: 2, rhythm: 2, repertoire: 4 };

export const DAILY_DURATIONS = [5, 10, 15, 20, 30, 45] as const;

export interface DailyInputs {
  /** Notas vencidas para revisar. */
  readonly dueNotes: number;
  /** Itens novos de notas que ainda cabem hoje. */
  readonly newNotesLeft: number;
  /** Revisões vencidas dos outros módulos (sem "notes"). */
  readonly otherDue: readonly { readonly module: ModuleKey; readonly count: number }[];
  /** Próxima lição rítmica ainda não aprovada (null = todas feitas). */
  readonly nextRhythmLesson: number | null;
}

export interface PlannedActivity {
  readonly id: ActivityId;
  readonly minutes: number;
  /** Quantas frases/lições/obras/itens (para "notes", é o tempo que manda). */
  readonly units: number;
}

/** Atividades que fazem sentido hoje (as demais ficam de fora mesmo se ligadas). */
export function availableActivities(i: DailyInputs): Set<ActivityId> {
  const s = new Set<ActivityId>(['notes', 'reading', 'repertoire']);
  if (i.otherDue.some((d) => d.count > 0)) s.add('reviews');
  if (i.nextRhythmLesson !== null) s.add('rhythm');
  return s;
}

export function buildDailyPlan(totalMinutes: number, inputs: DailyInputs, disabled: ReadonlySet<ActivityId> = new Set()): PlannedActivity[] {
  const avail = availableActivities(inputs);
  const on = ACTIVITY_ORDER.filter((id) => avail.has(id) && !disabled.has(id));
  if (on.length === 0) return [];
  const reviewItems = inputs.otherDue.reduce((s, d) => s + d.count, 0);

  // revisões não ocupam mais que o necessário; o que sobra é dividido pelos pesos
  const out = new Map<ActivityId, number>();
  let rest = totalMinutes;
  let pool = on;
  if (on.includes('reviews')) {
    const share = (totalMinutes * WEIGHT.reviews) / on.reduce((s, id) => s + WEIGHT[id], 0);
    const need = Math.max(1, Math.ceil(reviewItems * UNIT_MIN.reviews));
    const m = Math.min(share, need);
    out.set('reviews', m);
    rest -= m;
    pool = on.filter((id) => id !== 'reviews');
  }
  const w = pool.reduce((s, id) => s + WEIGHT[id], 0);
  for (const id of pool) out.set(id, (rest * WEIGHT[id]) / w);

  return on.map((id) => {
    const minutes = Math.max(1, Math.round(out.get(id)!));
    const units = id === 'notes' ? 0 : id === 'reviews' ? reviewItems : Math.max(1, Math.round(minutes / UNIT_MIN[id]));
    return { id, minutes, units };
  });
}

// ---------------------------------------------------------------- estado do dia

/** Edição do plano de hoje e o que já foi feito. Vale só para o dia indicado. */
export interface DailyState {
  readonly day: string;
  readonly minutes: number;
  readonly disabled: readonly ActivityId[];
  /** Nível fixo escolhido na edição (ausente = automático, com progressão). */
  readonly readingLevel?: number;
  readonly repertoireLevel?: number;
  readonly done: readonly ActivityId[];
  readonly edited: boolean;
}

export const freshDailyState = (day: string, minutes: number): DailyState => ({ day, minutes, disabled: [], done: [], edited: false });

/** Estado salvo, ou um novo se for de outro dia / inválido. */
export function loadDailyState(raw: string | null, day: string, defaultMinutes: number): DailyState {
  try {
    const s = raw ? (JSON.parse(raw) as DailyState) : null;
    if (s && s.day === day && typeof s.minutes === 'number' && Array.isArray(s.done) && Array.isArray(s.disabled)) return s;
  } catch {
    /* estado corrompido: começa de novo */
  }
  return freshDailyState(day, defaultMinutes);
}

/** A progressão de dificuldade fica ligada quando o nível não foi fixado na edição. */
export const progressionOn = (s: DailyState) => s.readingLevel === undefined && s.repertoireLevel === undefined;

// ---------------------------------------------------------------- sua semana

/** Dias seguidos com estudo, terminando hoje (ou ontem, se hoje ainda não estudou). */
export function studyStreak(days: ReadonlySet<string>, today: string): number {
  const d = new Date(`${today}T12:00:00`);
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!days.has(key(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(key(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
