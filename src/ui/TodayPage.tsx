import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioContext } from '../audio/metronome';
import { ladderState, READING_LADDER, readingPassed, type LadderAttempt } from '../core/daily/ladder';
import {
  ACTIVITY_LABEL,
  ACTIVITY_ORDER,
  availableActivities,
  buildDailyPlan,
  DAILY_DURATIONS,
  freshDailyState,
  loadDailyState,
  progressionOn,
  studyStreak,
  type ActivityId,
  type DailyInputs,
  type DailyState,
  type PlannedActivity,
} from '../core/daily/plan';
import { randomSeed } from '../core/exercise/rng';
import { makeGuitar, type Instrument } from '../core/instrument/instrument';
import { KIND_INFO, MODULE_LABEL, type ModuleKey } from '../core/learning/kinds';
import { dueByModule } from '../core/learning/reviews';
import { RHYTHM_LESSONS, rhythmLessonKc } from '../core/lessons/lessons';
import { generateMelody, type Melody } from '../core/melody/melody';
import { LEVELS, pieceKcId, pieceScore, type Level, type Piece } from '../core/repertoire/pieces';
import { autoLevel, nextPiece, pieceStates } from '../core/repertoire/progression';
import { meterLabel } from '../core/rhythm/rhythm';
import { buildScoreMelody } from '../core/score/score';
import { localDay } from '../data/db';
import { useLearningData, type LearningData } from '../data/learning';
import type { Settings } from '../data/settings';
import ChordsPage from './ChordsPage';
import EarPage from './EarPage';
import IntervalsPage from './IntervalsPage';
import MyTrainingPage from './MyTrainingPage';
import ReadingPage from './ReadingPage';
import ReadingSession from './ReadingSession';
import RepertoirePage from './RepertoirePage';
import RhythmPage, { Execution } from './RhythmPage';

/**
 * "Sessão de hoje" — cartão da tela inicial + execução em sequência.
 *
 * Sem editar: o tempo padrão, todas as atividades e níveis AUTOMÁTICOS (a leitura
 * sobe e desce numa escada de dificuldade; as obras sobem de nível como no Anki;
 * as lições rítmicas seguem a ordem). Editando: tempo, atividades e, se quiser,
 * um nível fixo — aí aquela atividade para de progredir sozinha.
 * O que já foi feito hoje fica guardado: dá para parar e continuar depois.
 */
const STORE = 'claves-hoje';

function readState(day: string, minutes: number): DailyState {
  try {
    return loadDailyState(localStorage.getItem(STORE), day, minutes);
  } catch {
    return freshDailyState(day, minutes);
  }
}
function writeState(s: DailyState) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    /* sem armazenamento: o plano vale só enquanto a tela estiver aberta */
  }
}

function useDailyState(defaultMinutes: number): [DailyState, (f: (s: DailyState) => DailyState) => void] {
  const [state, setState] = useState(() => readState(localDay(), defaultMinutes));
  // se o padrão mudar e o plano de hoje não foi editado, acompanha
  useEffect(() => {
    setState((s) => (s.edited || s.minutes === defaultMinutes ? s : { ...s, minutes: defaultMinutes }));
  }, [defaultMinutes]);
  // grava na hora (não no próximo render): a tela seguinte lê o estado ao abrir
  const update = useCallback(
    (f: (s: DailyState) => DailyState) => {
      const cur = readState(localDay(), defaultMinutes);
      const n = f(cur);
      writeState(n);
      setState(n);
    },
    [defaultMinutes],
  );
  return [state, update];
}

interface Context {
  inputs: DailyInputs;
  ladderLevel: number;
  ladderAttempts: LadderAttempt[];
  repLevel: Level;
  reviewIds: Map<ModuleKey, string[]>;
  week: { streak: number; questions: number; accuracy: number | null };
}

function buildContext(data: LearningData, settings: Settings): Context {
  const now = Date.now();
  const { model, attempts } = data;
  let dueNotes = 0;
  for (const it of model.items.values()) if (KIND_INFO[it.kind].module === 'notes' && model.isDue(it, now)) dueNotes++;
  const due = [...dueByModule(model, now).entries()].filter(([m]) => m !== 'notes');
  const passedRhythm = new Set(attempts.filter((a) => a.correct && a.kcId.startsWith('licao-ritmo:')).map((a) => a.kcId));
  const nextRhythm = RHYTHM_LESSONS.find((l) => !passedRhythm.has(rhythmLessonKc(l.n)))?.n ?? null;
  const ladderAttempts = attempts.filter((a) => a.kcId.startsWith('leitura:')).map((a) => ({ ts: a.ts, kcId: a.kcId, correct: a.correct }));

  const weekAgo = now - 7 * 86_400_000;
  const recent = attempts.filter((a) => a.ts >= weekAgo);
  return {
    inputs: {
      dueNotes,
      newNotesLeft: Math.max(0, settings.newPerDay - data.newToday),
      otherDue: due.map(([module, items]) => ({ module, count: items.length })),
      nextRhythmLesson: nextRhythm,
    },
    ladderLevel: ladderState(ladderAttempts).level,
    ladderAttempts,
    repLevel: autoLevel(pieceStates(model, now)),
    reviewIds: new Map(due.map(([m, items]) => [m, items.map((i) => i.kcId)])),
    week: {
      streak: studyStreak(new Set(attempts.map((a) => a.day)), localDay()),
      questions: recent.length,
      accuracy: recent.length ? recent.filter((a) => a.correct).length / recent.length : null,
    },
  };
}

function detail(a: PlannedActivity, c: Context, s: DailyState): string {
  const i = c.inputs;
  switch (a.id) {
    case 'notes':
      return `${i.dueNotes} para revisar · ${i.newNotesLeft} novas`;
    case 'reviews':
      return i.otherDue.map((d) => `${MODULE_LABEL[d.module]} ${d.count}`).join(' · ');
    case 'reading': {
      const lv = s.readingLevel ?? c.ladderLevel;
      return `${a.units} ${a.units === 1 ? 'frase' : 'frases'} · degrau ${lv + 1}/${READING_LADDER.length}: ${READING_LADDER[lv]!.label}`;
    }
    case 'rhythm':
      return `${a.units} ${a.units === 1 ? 'lição' : 'lições'} a partir da ${i.nextRhythmLesson}`;
    case 'repertoire':
      return `${a.units} ${a.units === 1 ? 'obra' : 'obras'} · nível ${s.repertoireLevel ?? c.repLevel}`;
  }
}

// ================================================================ cartão da tela inicial

export function TodayCard({ settings, update, onStart }: { settings: Settings; update: (p: Partial<Settings>) => void; onStart: () => void }) {
  const { data } = useLearningData(settings.retention);
  const [state, setState] = useDailyState(settings.dailyMinutes);
  const [editing, setEditing] = useState(false);
  const ctx = useMemo(() => (data ? buildContext(data, settings) : null), [data, settings]);

  if (!ctx) {
    return (
      <div className="today-card">
        <p className="muted">Montando a sessão de hoje…</p>
      </div>
    );
  }

  const plan = buildDailyPlan(state.minutes, ctx.inputs, new Set(state.disabled));
  const left = plan.filter((a) => !state.done.includes(a.id));
  const doneCount = plan.length - left.length;
  const auto = progressionOn(state);
  const avail = availableActivities(ctx.inputs);

  const start = () => {
    void audioContext().resume();
    if (left.length === 0) setState((s) => ({ ...s, done: [] }));
    onStart();
  };
  const toggle = (id: ActivityId) =>
    setState((s) => ({ ...s, edited: true, disabled: s.disabled.includes(id) ? s.disabled.filter((x) => x !== id) : [...s.disabled, id] }));

  return (
    <div className="today">
      <div className="today-card">
        <div className="today-head">
          <div>
            <h2>Sessão de hoje · {state.minutes} min</h2>
            <span className={`badge${auto ? ' is-ok' : ''}`}>{auto ? 'Dificuldade automática' : 'Nível fixo (sem progressão)'}</span>
          </div>
          <div className="actions">
            <button type="button" className="btn-primary today-play" onClick={start} disabled={plan.length === 0}>
              ▶ {doneCount === 0 ? 'Começar' : left.length === 0 ? 'Fazer de novo' : `Continuar (${doneCount}/${plan.length})`}
            </button>
            <button type="button" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
              {editing ? 'Pronto' : '✎ Editar'}
            </button>
          </div>
        </div>

        <ol className="today-list">
          {plan.map((a) => (
            <li key={a.id} className={state.done.includes(a.id) ? 'is-done' : ''}>
              <span className="today-check" aria-hidden>{state.done.includes(a.id) ? '✓' : ''}</span>
              <span className="today-text">
                <strong>{ACTIVITY_LABEL[a.id]}</strong>
                <span className="muted small">{detail(a, ctx, state)}</span>
              </span>
              <span className="muted small">~{a.minutes} min</span>
            </li>
          ))}
          {plan.length === 0 && <li className="muted">Nenhuma atividade ligada. Use “Editar” para escolher.</li>}
        </ol>

        {editing && (
          <div className="today-edit">
            <fieldset>
              <legend>Quanto tempo você tem hoje?</legend>
              <div className="level-pick" role="radiogroup" aria-label="Duração">
                {DAILY_DURATIONS.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={state.minutes === m} className={`level-btn${state.minutes === m ? ' is-on' : ''}`} onClick={() => setState((s) => ({ ...s, edited: true, minutes: m }))}>
                    {m} min
                  </button>
                ))}
              </div>
              {state.minutes !== settings.dailyMinutes && (
                <button type="button" className="btn-ghost small" onClick={() => update({ dailyMinutes: state.minutes })}>
                  Usar {state.minutes} min como padrão
                </button>
              )}
            </fieldset>

            <fieldset>
              <legend>Atividades</legend>
              {ACTIVITY_ORDER.map((id) => (
                <label key={id} className={avail.has(id) ? '' : 'muted'}>
                  <input type="checkbox" checked={!state.disabled.includes(id)} disabled={!avail.has(id)} onChange={() => toggle(id)} /> {ACTIVITY_LABEL[id]}
                  {!avail.has(id) && <span className="small"> — nada para hoje</span>}
                </label>
              ))}
            </fieldset>

            <fieldset>
              <legend>Dificuldade</legend>
              <label className="small" htmlFor="today-rl">Leitura de frases</label>
              <select
                id="today-rl"
                value={state.readingLevel ?? 'auto'}
                onChange={(e) => {
                  const v = e.target.value;
                  setState((s) => ({ ...s, edited: true, readingLevel: v === 'auto' ? undefined : Number(v) }));
                }}
              >
                <option value="auto">Automática (agora: degrau {ctx.ladderLevel + 1})</option>
                {READING_LADDER.map((st, i) => (
                  <option key={i} value={i}>Degrau {i + 1}: {st.label}</option>
                ))}
              </select>
              <label className="small" htmlFor="today-pl">Obras clássicas</label>
              <select
                id="today-pl"
                value={state.repertoireLevel ?? 'auto'}
                onChange={(e) => {
                  const v = e.target.value;
                  setState((s) => ({ ...s, edited: true, repertoireLevel: v === 'auto' ? undefined : Number(v) }));
                }}
              >
                <option value="auto">Automática (agora: nível {ctx.repLevel})</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>Nível {l}</option>
                ))}
              </select>
              <p className="muted small field-hint">Com nível fixo, a atividade não sobe nem desce sozinha.</p>
            </fieldset>

            <div className="actions">
              <button type="button" className="btn-ghost" onClick={() => setState((s) => ({ ...freshDailyState(s.day, settings.dailyMinutes), done: s.done }))}>
                Voltar ao plano automático
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="today-week">
        <div><span className="big">{ctx.week.streak}</span><span className="muted small">{ctx.week.streak === 1 ? 'dia seguido' : 'dias seguidos'}</span></div>
        <div><span className="big">{ctx.week.questions}</span><span className="muted small">exercícios nos últimos 7 dias</span></div>
        <div><span className="big">{ctx.week.accuracy === null ? '—' : `${Math.round(ctx.week.accuracy * 100)}%`}</span><span className="muted small">de acerto na semana</span></div>
      </div>
    </div>
  );
}

// ================================================================ execução

export default function TodayPage({ settings, onExit }: { settings: Settings; onExit: () => void }) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const { data, reload } = useLearningData(settings.retention);
  const [state, setState] = useDailyState(settings.dailyMinutes);
  // o plano é congelado ao começar (as revisões feitas não mudam a ordem no meio)
  const [snap, setSnap] = useState<{ ctx: Context; plan: PlannedActivity[] } | null>(null);
  const [changes, setChanges] = useState<string[]>([]);

  useEffect(() => {
    if (!data || snap) return;
    const ctx = buildContext(data, settings);
    setSnap({ ctx, plan: buildDailyPlan(state.minutes, ctx.inputs, new Set(state.disabled)) });
  }, [data, snap, settings, state.minutes, state.disabled]);

  if (!snap) return <p className="muted">Montando a sessão de hoje…</p>;
  const { ctx, plan } = snap;
  const current = plan.find((a) => !state.done.includes(a.id)) ?? null;
  const step = current ? plan.indexOf(current) + 1 : plan.length;

  const finish = (id: ActivityId, note?: string) => {
    if (note) setChanges((c) => [...c, note]);
    setState((s) => ({ ...s, done: s.done.includes(id) ? s.done : [...s.done, id] }));
    reload();
    window.scrollTo(0, 0);
  };

  if (!current) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Sessão de hoje concluída</h1>
          <p className="muted">
            {plan.length} {plan.length === 1 ? 'atividade' : 'atividades'} em cerca de {state.minutes} min. Amanhã o plano é montado de novo com as revisões do dia.
          </p>
        </header>
        {changes.length > 0 && (
          <ul className="today-changes">
            {changes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        )}
        <div className="actions">
          <button type="button" className="btn-primary" onClick={onExit}>Voltar ao início</button>
        </div>
      </section>
    );
  }

  return (
    <section className="page today-run">
      <div className="focus-bar today-bar">
        <span className="focus-summary">
          <strong>Sessão de hoje</strong> · etapa {step} de {plan.length} · {ACTIVITY_LABEL[current.id]} · ~{current.minutes} min
        </span>
        <button type="button" className="btn-ghost" onClick={() => finish(current.id)}>Pular etapa</button>
        <button type="button" className="btn-ghost" onClick={onExit}>Parar por hoje</button>
      </div>
      <ol className="today-steps" aria-label="Etapas">
        {plan.map((a) => (
          <li key={a.id} className={state.done.includes(a.id) ? 'is-done' : a === current ? 'is-current' : ''}>{ACTIVITY_LABEL[a.id]}</li>
        ))}
      </ol>

      {current.id === 'notes' && <MyTrainingPage key="notes" settings={settings} autoStartMinutes={current.minutes} onFinished={() => finish('notes')} />}
      {current.id === 'reviews' && <ReviewsRun settings={settings} ids={ctx.reviewIds} onDone={() => finish('reviews')} />}
      {current.id === 'reading' && (
        <ReadingRun inst={inst} settings={settings} units={current.units} fixed={state.readingLevel} start={ctx.ladderAttempts} onDone={(note) => finish('reading', note)} />
      )}
      {current.id === 'rhythm' && <RhythmRun settings={settings} units={current.units} first={ctx.inputs.nextRhythmLesson ?? 1} onDone={() => finish('rhythm')} />}
      {current.id === 'repertoire' && data && (
        <RepertoireRun inst={inst} settings={settings} data={data} units={current.units} fixed={state.repertoireLevel as Level | undefined} onDone={() => finish('repertoire')} />
      )}
    </section>
  );
}

/** Revisões vencidas de cada módulo, uma fila depois da outra, na própria tela do módulo. */
function useOnce(cond: boolean, f: () => void) {
  const fired = useRef(false);
  useEffect(() => {
    if (cond && !fired.current) {
      fired.current = true;
      f();
    }
  });
}

function ReviewsRun({ settings, ids, onDone }: { settings: Settings; ids: Map<ModuleKey, string[]>; onDone: () => void }) {
  const mods = [...ids.keys()];
  const [i, setI] = useState(0);
  const mod = mods[i];
  useOnce(!mod, onDone);
  if (!mod) return null;
  const props = { settings, review: ids.get(mod)!, onReviewDone: () => setI((x) => x + 1) };
  const k = `${mod}-${i}`;
  switch (mod) {
    case 'intervals':
      return <IntervalsPage key={k} {...props} />;
    case 'rhythm':
      return <RhythmPage key={k} {...props} update={() => undefined} />;
    case 'reading':
      return <ReadingPage key={k} {...props} />;
    case 'repertoire':
      return <RepertoirePage key={k} {...props} />;
    case 'chords':
      return <ChordsPage key={k} {...props} />;
    case 'ear':
      return <EarPage key={k} {...props} />;
    default:
      return <button type="button" onClick={props.onReviewDone}>Continuar</button>;
  }
}

/** Frases na escada de dificuldade: o degrau é recalculado a cada frase. */
function ReadingRun({
  inst,
  settings,
  units,
  fixed,
  start,
  onDone,
}: {
  inst: Instrument;
  settings: Settings;
  units: number;
  fixed: number | undefined;
  start: LadderAttempt[];
  onDone: (note?: string) => void;
}) {
  const [log, setLog] = useState<LadderAttempt[]>(start);
  const [n, setN] = useState(0);
  const firstLevel = useMemo(() => fixed ?? ladderState(start).level, []); // eslint-disable-line react-hooks/exhaustive-deps
  const level = fixed ?? ladderState(log).level;
  const [run, setRun] = useState<{ melody: Melody; key: number; level: number } | null>(null);

  useEffect(() => {
    if (run && run.level === level && run.key === n) return;
    try {
      setRun({ melody: generateMelody(READING_LADDER[level]!.config, inst, randomSeed()), key: n, level });
    } catch {
      setRun(null);
    }
  }, [level, n]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!run) return <p className="muted">Gerando a frase…</p>;
  const last = n + 1 >= units;
  const moved = level !== firstLevel;
  return (
    <>
      <p className="muted small">
        Frase {n + 1} de {units} · degrau {level + 1}/{READING_LADDER.length}: {READING_LADDER[level]!.label}
        {fixed === undefined && moved && <strong> · {level > firstLevel ? 'subiu de degrau' : 'desceu um degrau para firmar'}</strong>}
        {fixed === undefined && <> · 3 frases aprovadas seguidas sobem um degrau</>}
      </p>
      <ReadingSession
        key={`${run.key}-${run.level}`}
        melody={run.melody}
        mode="static"
        bpm={60}
        inst={inst}
        settings={settings}
        module="D"
        continueLabel={last ? 'Concluir leitura' : 'Próxima frase'}
        onDone={(o) => {
          const correct = readingPassed(o.summary);
          const next = [...log, { ts: Date.now(), kcId: `leitura:${run.melody.materialKey}`, correct }];
          setLog(next);
          if (last) {
            const end = fixed ?? ladderState(next).level;
            onDone(end !== firstLevel ? `Leitura: degrau ${firstLevel + 1} → ${end + 1} (${READING_LADDER[end]!.label})` : undefined);
          } else setN((x) => x + 1);
        }}
      />
    </>
  );
}

/** Lições rítmicas em ordem; a próxima é a primeira ainda não aprovada. */
function RhythmRun({ settings, units, first, onDone }: { settings: Settings; units: number; first: number; onDone: () => void }) {
  const [k, setK] = useState(0);
  const [n, setN] = useState(first);
  const l = RHYTHM_LESSONS[n - 1];
  useOnce(!l, onDone);
  if (!l) return null;
  return (
    <>
      <p className="muted small">
        Lição {l.n} de {RHYTHM_LESSONS.length} · {meterLabel(l.meter)} · {k + 1} de {units} hoje
      </p>
      <Execution
        key={`${n}-${k}`}
        level={n <= 10 ? 1 : n <= 20 ? 3 : 2}
        meter={l.meter}
        bpm={66}
        bars={l.measures.length}
        fixed={l.measures}
        kcId={rhythmLessonKc(n)}
        clickDuring
        subdivision={1}
        latencyMs={settings.latencyMs}
        micDeviceId={settings.micDeviceId}
        onNext={() => {
          if (k + 1 >= units || n >= RHYTHM_LESSONS.length) return onDone();
          setK((x) => x + 1);
          setN((x) => x + 1);
        }}
      />
    </>
  );
}

/** Obras no nível automático (tipo Anki) ou no nível fixado na edição. */
function RepertoireRun({
  inst,
  settings,
  data,
  units,
  fixed,
  onDone,
}: {
  inst: Instrument;
  settings: Settings;
  data: LearningData;
  units: number;
  fixed: Level | undefined;
  onDone: () => void;
}) {
  const [played, setPlayed] = useState<string[]>([]);
  // o modelo é o do início da etapa; a obra tocada entra no FSRS e conta no nível amanhã
  const states = useMemo(() => pieceStates(data.model, Date.now()), [data]);
  const pick = useMemo(() => {
    const pool = states.filter((s) => !played.includes(s.piece.id));
    return nextPiece(pool.length ? pool : states, fixed ?? 'auto', played[played.length - 1]);
  }, [states, played, fixed]);
  const run = useMemo<{ piece: Piece; melody: Melody } | null>(() => {
    if (!pick) return null;
    try {
      return { piece: pick.piece, melody: { ...buildScoreMelody(pieceScore(pick.piece), inst), materialKey: pieceKcId(pick.piece.id) } };
    } catch {
      return null;
    }
  }, [pick, inst]);

  useOnce(!run, onDone);
  if (!run) return null;
  const last = played.length + 1 >= units;
  return (
    <>
      <p className="muted small">
        <strong>{run.piece.title}</strong> · {run.piece.composer} · nível {run.piece.level} · obra {played.length + 1} de {units}
      </p>
      <ReadingSession
        key={run.piece.id}
        melody={run.melody}
        mode="static"
        bpm={60}
        inst={inst}
        settings={settings}
        module="D"
        continueLabel={last ? 'Concluir' : 'Próxima obra'}
        onDone={() => {
          if (last) onDone();
          else setPlayed((p) => [...p, run.piece.id]);
        }}
      />
    </>
  );
}
