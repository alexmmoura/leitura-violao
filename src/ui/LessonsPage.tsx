import { useEffect, useMemo, useState } from 'react';
import { audioContext } from '../audio/metronome';
import { makeGuitar } from '../core/instrument/instrument';
import { RHYTHM_LESSONS, rhythmLessonKc, SOLFEGE_KEYS, SOLFEGE_LESSON_COUNT, solfegeKc, solfegeLesson } from '../core/lessons/lessons';
import { melodyNotes } from '../core/melody/melody';
import { isCompound, meterLabel, subdivisionOf } from '../core/rhythm/rhythm';
import { buildScoreMelody } from '../core/score/score';
import { keyLabel } from '../core/theory/keySignature';
import { pitchName } from '../core/theory/pitch';
import { db } from '../data/db';
import type { Settings } from '../data/settings';
import MelodyStaff from './MelodyStaff';
import ReadingModeFieldset, { DEFAULT_READING_OPTIONS, type ReadingOptions } from './ReadingControls';
import ReadingSession from './ReadingSession';
import { Execution } from './RhythmPage';
import RhythmStaff from './RhythmStaff';

/**
 * Lições numeradas de solfejo (por tonalidade) e de leitura rítmica.
 * Uma lição fica "feita" (número verde) quando teve um resultado aprovado.
 */
function useDone(prefix: string, refresh: number): Set<string> {
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    db.attempts
      .where('kcId')
      .startsWith(prefix)
      .toArray()
      .then((rows) => setDone(new Set(rows.filter((r) => r.correct).map((r) => r.kcId))))
      .catch(() => undefined);
  }, [prefix, refresh]);
  return done;
}

const Back = ({ onClick, title }: { onClick: () => void; title: string }) => (
  <header className="sub-head">
    <button type="button" className="back" onClick={onClick} aria-label="Voltar">‹</button>
    <h1>{title}</h1>
  </header>
);

// ---------------------------------------------------------------- Solfejo
export function SolfegeLessonsPage({ settings }: { settings: Settings }) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const [key, setKey] = useState<number | null>(null);
  const [n, setN] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const done = useDone('obra:licao-solfejo-', refresh);
  const lessons = useMemo(
    () => (key === null ? [] : Array.from({ length: SOLFEGE_LESSON_COUNT }, (_, i) => {
      const l = solfegeLesson(key, i + 1);
      return { l, melody: buildScoreMelody(l.score, inst) };
    })),
    [key, inst],
  );

  if (key === null) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Solfejo</h1>
          <p className="muted">Lições numeradas: começam com 2 notas e vão até a oitava inteira. Escolha a tonalidade.</p>
        </header>
        <div className="tool-list">
          {SOLFEGE_KEYS.map((k) => {
            const count = Array.from({ length: SOLFEGE_LESSON_COUNT }, (_, i) => solfegeKc(k, i + 1)).filter((id) => done.has(id)).length;
            return (
              <button key={k} type="button" className="tool-card" onClick={() => setKey(k)}>
                <span className="tool-icon" aria-hidden>𝄞</span>
                <span>
                  <strong>{keyLabel(k)}</strong>
                  <span className="muted">{count}/{SOLFEGE_LESSON_COUNT} lições feitas</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (n === null) {
    return (
      <section className="page">
        <Back onClick={() => setKey(null)} title={`Solfejo — ${keyLabel(key)}`} />
        <div className="lesson-grid">
          {lessons.map(({ l, melody }) => {
            const names = [...new Set(melodyNotes(melody).map((e) => pitchName(e.pitch!, { naming: settings.naming, withOctave: false })))];
            return (
              <button key={l.n} type="button" className={`lesson-card${done.has(solfegeKc(key, l.n)) ? ' is-done' : ''}`} onClick={() => setN(l.n)}>
                <span className="lesson-head">
                  <span className="lesson-num">{l.n}</span>
                  <strong>{names.join(', ')}</strong>
                </span>
                <MelodyStaff melody={melody} label={`Lição ${l.n}`} />
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const cur = lessons[n - 1]!;
  return (
    <SolfegeRun
      key={`${key}-${n}`}
      title={`Solfejo ${n} — ${keyLabel(key)}`}
      melody={cur.melody}
      inst={inst}
      settings={settings}
      hasNext={n < SOLFEGE_LESSON_COUNT}
      onBack={() => {
        setRefresh((r) => r + 1);
        setN(null);
      }}
      onNext={() => {
        setRefresh((r) => r + 1);
        setN(Math.min(SOLFEGE_LESSON_COUNT, n + 1));
      }}
    />
  );
}

function SolfegeRun({ title, melody, inst, settings, onBack, onNext, hasNext }: { title: string; melody: ReturnType<typeof buildScoreMelody>; inst: ReturnType<typeof makeGuitar>; settings: Settings; onBack: () => void; onNext: () => void; hasNext: boolean }) {
  const [opts, setOpts] = useState<ReadingOptions>({ ...DEFAULT_READING_OPTIONS, sing: true, preRead: 0 });
  const [run, setRun] = useState<number | null>(null);
  const start = () => {
    if (opts.mode !== 'static') void audioContext().resume();
    setRun(Date.now());
  };
  return (
    <section className="page">
      <Back onClick={onBack} title={title} />
      <div className="config-grid">
        <ReadingModeFieldset o={opts} set={(p) => setOpts((o) => ({ ...o, ...p }))} compound={isCompound(melody.config.meter ?? 4)} />
      </div>
      <div className="actions">
        <button type="button" className="btn-primary" onClick={start}>{run ? 'Recomeçar' : 'Começar'}</button>
        {hasNext && <button type="button" onClick={onNext}>Próxima lição ›</button>}
      </div>
      {run ? (
        <ReadingSession key={run} melody={melody} mode={opts.mode} bpm={opts.bpm} inst={inst} settings={settings} module="D" lookAhead={opts.lookAhead} preReadSec={opts.preRead} clickDuring={opts.clickDuring} sing={opts.sing} onDone={hasNext ? onNext : start} continueLabel={hasNext ? 'Próxima lição' : 'Repetir'} />
      ) : (
        <>
          <MelodyStaff melody={melody} label={title} />
          <p className="muted small center">Com microfone: ligue-o e cante cada nota (vale qualquer oitava). Sem microfone: clique as notas no braço, ou desmarque “Cantar”.</p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Ritmo
export function RhythmLessonsPage({ settings }: { settings: Settings }) {
  const [n, setN] = useState<number | null>(null);
  const [bpm, setBpm] = useState(66);
  const [subdivide, setSubdivide] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const done = useDone('licao-ritmo:', refresh);

  if (n === null) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Leitura rítmica</h1>
          <p className="muted">{RHYTHM_LESSONS.length} lições em ordem de dificuldade. Bata o ritmo no botão, na tecla Espaço ou tocando no violão.</p>
        </header>
        <div className="lesson-grid is-rhythm">
          {RHYTHM_LESSONS.map((l) => (
            <button key={l.n} type="button" className={`lesson-card${done.has(rhythmLessonKc(l.n)) ? ' is-done' : ''}`} onClick={() => setN(l.n)}>
              <span className="lesson-head">
                <span className="lesson-num">{l.n}</span>
                <strong>{meterLabel(l.meter)}</strong>
              </span>
              <RhythmStaff measures={l.measures} meter={l.meter} label={`Lição ${l.n}`} />
            </button>
          ))}
        </div>
      </section>
    );
  }

  const l = RHYTHM_LESSONS[n - 1]!;
  const hasNext = n < RHYTHM_LESSONS.length;
  const back = () => {
    setRefresh((r) => r + 1);
    setN(null);
  };
  return (
    <section className="page">
      <Back onClick={back} title={`Leitura rítmica ${n} — ${meterLabel(l.meter)}`} />
      <div className="config-grid">
        <fieldset>
          <legend>Andamento</legend>
          <label className="small" htmlFor="lbpm">{bpm} bpm ({isCompound(l.meter) ? 'semínima pontuada' : 'semínima'})</label>
          <input id="lbpm" type="range" min={40} max={120} step={2} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          <label className="small"><input type="checkbox" checked={subdivide} onChange={(e) => setSubdivide(e.target.checked)} /> Marcar a subdivisão</label>
        </fieldset>
      </div>
      <Execution
        key={`${n}-${bpm}`}
        level={n <= 10 ? 1 : n <= 20 ? 3 : 2}
        meter={l.meter}
        bpm={bpm}
        bars={l.measures.length}
        fixed={l.measures}
        kcId={rhythmLessonKc(n)}
        clickDuring
        subdivision={subdivide ? subdivisionOf(l.meter) : 1}
        latencyMs={settings.latencyMs}
        micDeviceId={settings.micDeviceId}
        onNext={hasNext ? () => { setRefresh((r) => r + 1); setN(n + 1); } : back}
      />
    </section>
  );
}
