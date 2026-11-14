import { useCallback, useMemo, useRef, useState } from 'react';
import { buildCurriculum } from '../core/learning/curriculum';
import { MASTERY_LABEL, MASTERY_ORDER, type MasteryState } from '../core/learning/model';
import { SessionPlanner, type SlotKind } from '../core/learning/planner';
import { randomSeed } from '../core/exercise/rng';
import { makeGuitar } from '../core/instrument/instrument';
import { localDay } from '../data/db';
import { useLearningData } from '../data/learning';
import type { Settings } from '../data/settings';
import { secs } from './format';
import TrainingSession, { type SessionQuestion, type SessionResult } from './TrainingSession';
import ReadingSession from './ReadingSession';
import { generateMelody, type Melody } from '../core/melody/melody';
import { parsePositionKey } from '../core/learning/kc';
import { OPEN_POSITION } from '../core/instrument/position';
import { KIND_INFO, MODULE_LABEL, type ModuleKey } from '../core/learning/kinds';
import { dueByModule } from '../core/learning/reviews';
import { describeKc } from './review';

/**
 * "Meu treinamento" — sessões de 5, 10, 20 ou 30 minutos montadas pelo agendador
 * (revisões vencidas + itens novos do currículo + reaprendizagem). Especificação §6.9.
 */
const DURATIONS = [5, 10, 20, 30];
const SLOT_LABEL: Record<SlotKind, string> = { review: 'Revisão', new: 'Novo', relearn: 'Reaprender', extra: 'Prática extra' };

interface Summary {
  results: SessionResult[];
  newIntroduced: number;
  reviews: number;
}

export default function MyTrainingPage({ settings, onReview }: { settings: Settings; onReview?: (module: ModuleKey, ids: string[]) => void }) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const curriculum = useMemo(() => buildCurriculum(inst), [inst]);
  const { data, reload } = useLearningData(settings.retention);
  const [running, setRunning] = useState<{ key: number; minutes: number } | null>(null);
  const [slot, setSlot] = useState<SlotKind | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const planner = useRef<SessionPlanner | null>(null);
  const slotCounts = useRef<Record<SlotKind, number>>({ review: 0, new: 0, relearn: 0, extra: 0 });

  const overview = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const { model } = data;
    const counts = Object.fromEntries(MASTERY_ORDER.map((s) => [s, 0])) as Record<MasteryState, number>;
    let due = 0;
    let forgetting = 0;
    for (const it of model.items.values()) {
      counts[model.mastery(it)]++;
      // aqui "vencidas" = notas (as que esta sessão revisa); os outros módulos aparecem à parte
      if (KIND_INFO[it.kind].module === 'notes' && model.isDue(it, now)) due++;
      if (model.isForgetting(it, now)) forgetting++;
    }
    const otherDue = [...dueByModule(model, now).entries()].filter(([mod]) => mod !== 'notes');
    const seen = new Set(model.items.keys());
    const stages = curriculum.stages.map((st) => {
      const ids = curriculum.items.filter((i) => i.stage === st.index).map((i) => i.kcId);
      const started = ids.filter((id) => seen.has(id)).length;
      const solid = ids.filter((id) => {
        const s = model.mastery(model.get(id));
        return s === 'mastered' || s === 'automated';
      }).length;
      return { ...st, total: ids.length, started, solid };
    });
    const current = stages.find((s) => s.started < s.total) ?? stages[stages.length - 1];
    const newLeft = Math.max(0, settings.newPerDay - data.newToday);
    return { counts, due, forgetting, stages, current, newLeft, otherDue };
  }, [data, curriculum, settings.newPerDay]);

  const start = (minutes: number) => {
    if (!data) return;
    planner.current = new SessionPlanner(data.model, curriculum.items, inst, {
      newPerDay: settings.newPerDay,
      newIntroducedToday: data.newToday,
      durationMs: minutes * 60_000,
      seed: randomSeed(),
    });
    slotCounts.current = { review: 0, new: 0, relearn: 0, extra: 0 };
    setSummary(null);
    setRunning({ key: Date.now(), minutes });
  };

  const nextQuestion = useCallback(
    (_prev: SessionQuestion | null, _index: number, last?: SessionResult): SessionQuestion | null => {
      const p = planner.current;
      if (!p || !data) return null;
      // atualiza o modelo em memória com a resposta anterior (mesma regra do recálculo)
      if (last) data.model.apply({ ts: last.ts, day: localDay(last.ts), kcId: last.kcId, correct: last.correct, rtMs: last.rtMs });
      const planned = p.next(last ? { kcId: last.kcId, correct: last.correct } : undefined);
      if (!planned) return null;
      slotCounts.current[planned.slot]++;
      setSlot(planned.slot);
      return planned.question;
    },
    [data],
  );

  const onExit = useCallback(
    (results: SessionResult[]) => {
      const snap = planner.current?.snapshot();
      setRunning(null);
      setSlot(null);
      if (results.length) setSummary({ results, newIntroduced: snap?.newIntroduced ?? 0, reviews: slotCounts.current.review });
      reload();
    },
    [reload],
  );

  // Aplicação musical no fim da sessão (§6.9): uma frase na região da etapa atual.
  const [application, setApplication] = useState<{ melody: Melody; key: number } | null>(null);
  const startApplication = () => {
    const stage = overview?.current;
    if (!stage) return;
    const pb = curriculum.items.find((i) => i.stage === stage.index && i.kcId.startsWith('pb:'));
    const region = pb ? parsePositionKey(pb.kcId.split('@')[1]!) : null;
    try {
      const melody = generateMelody(
        { fifths: 0, region: region ?? OPEN_POSITION, strings: [1, 2, 3, 4, 5, 6], measures: 4, beats: 4, rhythmLevel: 0, maxLeap: 2, chromatic: stage.label.includes('acidentes') },
        inst,
        randomSeed(),
      );
      setApplication({ melody, key: Date.now() });
    } catch {
      setApplication(null);
    }
  };

  if (application) {
    return (
      <section className="page">
        <header className="train-head">
          <div>
            <strong>Aplicação</strong> · leia a frase com as notas que você acabou de treinar
          </div>
          <button type="button" className="btn-ghost" onClick={() => setApplication(null)}>Voltar</button>
        </header>
        <ReadingSession
          key={application.key}
          melody={application.melody}
          mode="static"
          bpm={60}
          inst={inst}
          settings={settings}
          module="D"
          continueLabel="Concluir"
          onDone={() => setApplication(null)}
        />
      </section>
    );
  }

  if (running && data) {
    const left = planner.current?.timeLeftMs() ?? 0;
    return (
      <TrainingSession
        key={running.key}
        inst={inst}
        settings={settings}
        fifths={0}
        window={null}
        module="A"
        title={
          <>
            <strong>Meu treinamento</strong> · {running.minutes} min · {slot && <span className={`slot slot-${slot}`}>{SLOT_LABEL[slot]}</span>}{' '}
            <span className="muted">restam ~{Math.ceil(left / 60_000)} min</span>
          </>
        }
        total={0}
        nextQuestion={nextQuestion}
        sessionConfig={{ myTraining: true, minutes: running.minutes }}
        onExit={onExit}
      />
    );
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Meu treinamento</h1>
        <p className="muted">Sessões montadas automaticamente: revisões no momento certo (FSRS), itens novos em ordem pedagógica e reforço do que você errou.</p>
      </header>

      {!data || !overview ? (
        <p className="muted">Carregando histórico…</p>
      ) : (
        <>
          <div className="kpis">
            <div><span className="big">{overview.due}</span><span className="muted">notas para revisar</span></div>
            <div><span className="big">{overview.newLeft}</span><span className="muted">itens novos disponíveis hoje</span></div>
            <div><span className="big">{overview.counts.mastered + overview.counts.automated}</span><span className="muted">itens dominados</span></div>
            <div><span className="big">{overview.forgetting}</span><span className="muted">itens esquecendo</span></div>
          </div>

          <div className="durations" role="group" aria-label="Duração da sessão">
            {DURATIONS.map((m) => (
              <button key={m} type="button" className={m === 10 ? 'btn-primary' : ''} onClick={() => start(m)}>
                {m} min
              </button>
            ))}
          </div>

          {summary && (
            <>
              <SessionSummary s={summary} />
              <div className="actions">
                <button type="button" className="btn-primary" onClick={startApplication}>
                  Aplicação: ler uma frase
                </button>
                <span className="muted small">Toda sessão termina em música, não em flashcard.</span>
              </div>
            </>
          )}

          <div className="other-reviews">
            <h2>Revisões dos outros módulos</h2>
            {overview.otherDue.length === 0 ? (
              <p className="muted small">Nada vencido em intervalos, ritmo, leitura, acordes ou percepção. Os itens desses módulos entram aqui conforme você os pratica.</p>
            ) : (
              <div className="review-cards">
                {overview.otherDue.map(([mod, items]) => (
                  <div key={mod} className="review-card">
                    <strong>{MODULE_LABEL[mod]}</strong>
                    <span className="muted small">{items.length} item(ns) vencido(s)</span>
                    <ul className="small">
                      {items.slice(0, 3).map((it) => (
                        <li key={it.kcId}>{describeKc(it.kcId, settings.naming)}</li>
                      ))}
                      {items.length > 3 && <li className="muted">…</li>}
                    </ul>
                    <button type="button" className="btn-primary" disabled={!onReview} onClick={() => onReview?.(mod, items.map((i) => i.kcId))}>
                      Revisar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="two-col">
            <div>
              <h2>Etapa atual</h2>
              {overview.current && (
                <p>
                  <strong>{overview.current.label}</strong> — {overview.current.started}/{overview.current.total} itens iniciados, {overview.current.solid} dominados.
                </p>
              )}
              <h2>Estados de domínio</h2>
              <ul className="states">
                {MASTERY_ORDER.filter((s) => s !== 'untrained').map((s) => (
                  <li key={s}>
                    <span className={`dot hm-${s}`} /> {MASTERY_LABEL[s]}: <strong>{overview.counts[s]}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>Currículo</h2>
              <table className="small">
                <tbody>
                  {overview.stages.slice(0, 10).map((s) => (
                    <tr key={s.index} className={s === overview.current ? 'is-current' : ''}>
                      <td>{s.label}</td>
                      <td className="num">{s.started}/{s.total}</td>
                      <td className="num">{s.solid} ✓</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="muted small">
            Uma sessão termina quando o tempo acaba (a questão em andamento é concluída) e é seguida de uma frase de aplicação.
          </p>
        </>
      )}
    </section>
  );
}

function SessionSummary({ s }: { s: Summary }) {
  const n = s.results.length;
  const ok = s.results.filter((r) => r.correct).length;
  const times = s.results.filter((r) => r.correct).map((r) => r.rtMs).sort((a, b) => a - b);
  const med = times.length ? times[Math.floor(times.length / 2)]! : null;
  return (
    <div className="summary">
      <h2>Última sessão</h2>
      <p>
        {n} questões · acerto {Math.round((100 * ok) / Math.max(1, n))}% · tempo mediano {secs(med)} · {s.reviews} revisões · {s.newIntroduced} itens novos.
      </p>
    </div>
  );
}
