import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioContext, eventToAudioTime, scheduleClicks, type ClickPlan } from '../audio/metronome';
import { mic, useMicNotes, useMicStatus } from '../audio/microphone';
import { randomSeed } from '../core/exercise/rng';
import { median } from '../core/learning/metrics';
import {
  beatsLabel,
  beatsPer,
  COMPOUND_LEVEL_LABEL,
  evaluateTaps,
  figureName,
  generateMeasures,
  generateRecognition,
  isCompound,
  LEVEL_LABEL,
  measureSize,
  measureUnits,
  meterLabel,
  METERS,
  onsetsMs,
  parseMeter,
  subdivisionOf,
  toleranceFor,
  UNITS_PER_BEAT,
  type Meter,
  type RecognitionQuestion,
  type RhythmEvent,
  type TapEvaluation,
} from '../core/rhythm/rhythm';
import { db, localDay } from '../data/db';
import type { Settings } from '../data/settings';
import RhythmStaff from './RhythmStaff';
import { ReviewBanner, useReviewQueue, type ReviewProps } from './review';
import type { RecognitionForce } from '../core/rhythm/rhythm';

/**
 * Módulo E — leitura rítmica (versão básica da Fase 2): execução com metrônomo
 * (toques na barra de espaço), reconhecimento de figuras/compassos e calibração
 * de latência. Especificação §6.5.
 */
type Mode = 'exec' | 'recog';
type Phase = 'idle' | 'playing' | 'done';

const SESSION_ID = crypto.randomUUID();

function logAttempt(kcId: string, correct: boolean, score: number, rtMs: number, answer: { expectedMs: number[]; tapsMs: number[] } | { choice: string }) {
  const now = Date.now();
  db.attempts
    .add({ ts: now, day: localDay(now), module: 'E', kcId, direction: 'rhythm', seed: 0, correct, score, errorCode: null, rtMs, inputMethod: 'keyboard', answer, written: '', sessionId: SESSION_ID })
    .catch(() => undefined);
}

export default function RhythmPage({ settings, update, review, onReviewDone }: { settings: Settings; update: (p: Partial<Settings>) => void } & ReviewProps) {
  const [mode, setMode] = useState<Mode>('exec');
  const [level, setLevel] = useState(1);
  const [meterStr, setMeterStr] = useState('4/4');
  const meter: Meter = useMemo(() => parseMeter(meterStr) ?? { num: 4, den: 4 }, [meterStr]);
  const compound = isCompound(meter);
  const [bpm, setBpm] = useState(70);
  const [bars, setBars] = useState(2);
  const [clickDuring, setClickDuring] = useState(true);
  const [subdivide, setSubdivide] = useState(false);
  const rq = useReviewQueue(review);
  const cur = rq.current;

  // revisão: "ritmo:dur:6r" | "ritmo:compasso:n2:4/4" | "ritmo:exec:n1:3/4"
  const force = useMemo<RecognitionForce | undefined>(() => {
    if (!cur) return undefined;
    const p = cur.split(':');
    if (p[1] === 'dur') return { kind: 'duration', event: { units: Number(p[2]!.replace('r', '')), rest: p[2]!.endsWith('r') } };
    if (p[1] === 'compasso') return { kind: 'complete' };
    return undefined;
  }, [cur]);
  useEffect(() => {
    if (!cur) return;
    const p = cur.split(':');
    if (p[1] === 'dur') setMode('recog');
    else if (p[1] === 'compasso' || p[1] === 'exec') {
      setMode(p[1] === 'exec' ? 'exec' : 'recog');
      setLevel(Number(p[2]!.slice(1)) || 1);
      setMeterStr(parseMeter(p[3] ?? '') ? p[3]! : '4/4');
    } else rq.advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);
  const onNext = rq.active ? rq.advance : undefined;

  return (
    <section className="page">
      <header className="page-head">
        <h1>Ritmo</h1>
        <p className="muted">Módulo E — conte, reconheça e toque. Ritmo primeiro sem altura; a integração com as notas vem na leitura de melodias.</p>
      </header>
      <ReviewBanner q={rq} naming={settings.naming} onExit={onReviewDone} />

      <div className="config-grid">
        <fieldset>
          <legend>Exercício</legend>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Tipo de exercício">
            <option value="exec">Execução com metrônomo</option>
            <option value="recog">Reconhecimento</option>
          </select>
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Nível">
            {(compound ? COMPOUND_LEVEL_LABEL : LEVEL_LABEL).map((l, i) => (
              <option key={i} value={i + 1}>Nível {i + 1}: {l}</option>
            ))}
          </select>
        </fieldset>
        <fieldset>
          <legend>Compasso e andamento</legend>
          <select value={meterStr} onChange={(e) => setMeterStr(e.target.value)} aria-label="Fórmula de compasso">
            {METERS.map((m) => (
              <option key={meterLabel(m)} value={meterLabel(m)}>
                {meterLabel(m)}
                {isCompound(m) ? ` (composto: ${beatsPer(m)} tempos de semínima pontuada)` : ''}
              </option>
            ))}
          </select>
          {mode === 'exec' && (
            <>
              <label className="small" htmlFor="bpm">
                Andamento: {bpm} bpm ({compound ? 'semínima pontuada' : 'semínima'})
              </label>
              <input id="bpm" type="range" min={compound ? 30 : 40} max={compound ? 100 : 140} step={2} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
            </>
          )}
        </fieldset>
        {mode === 'exec' && (
          <fieldset>
            <legend>Opções</legend>
            <select value={bars} onChange={(e) => setBars(Number(e.target.value))} aria-label="Compassos">
              {[1, 2, 3, 4].map((b) => (
                <option key={b} value={b}>{b} compasso{b > 1 ? 's' : ''}</option>
              ))}
            </select>
            <div className="checks">
              <label><input type="checkbox" checked={clickDuring} onChange={(e) => setClickDuring(e.target.checked)} /> Metrônomo durante o exercício (senão, só a contagem)</label>
              <label><input type="checkbox" checked={subdivide} onChange={(e) => setSubdivide(e.target.checked)} /> Marcar a subdivisão ({compound ? '3' : '2'} por tempo)</label>
            </div>
            <Calibration settings={settings} update={update} />
          </fieldset>
        )}
      </div>

      {mode === 'exec' ? (
        <Execution
          key={`${level}-${meterStr}-${bars}-${cur ?? ''}`}
          level={level}
          meter={meter}
          bpm={bpm}
          bars={bars}
          clickDuring={clickDuring}
          subdivision={subdivide ? subdivisionOf(meter) : 1}
          latencyMs={settings.latencyMs}
          micDeviceId={settings.micDeviceId}
          onNext={onNext}
        />
      ) : (
        <Recognition key={`${level}-${meterStr}-${cur ?? ''}`} level={level} meter={meter} force={force} onNext={onNext} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- execução

/** Campo onde se digita texto (aí o Espaço é do campo, não do ritmo). */
function isTypingField(t: EventTarget | null): boolean {
  if (t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return true;
  if (t instanceof HTMLElement && t.isContentEditable) return true;
  return t instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button'].includes(t.type);
}

export function Execution({
  level,
  meter,
  bpm,
  bars: barsProp,
  fixed,
  kcId,
  clickDuring,
  subdivision,
  latencyMs,
  micDeviceId,
  onNext,
}: {
  level: number;
  meter: Meter;
  bpm: number;
  bars: number;
  /** Lição: compassos fixos (em vez de gerar) e id próprio no registro. */
  fixed?: RhythmEvent[][];
  kcId?: string;
  clickDuring: boolean;
  subdivision: number;
  latencyMs: number;
  micDeviceId: string;
  onNext?: () => void;
}) {
  const beats = beatsPer(meter);
  const bars = fixed ? fixed.length : barsProp;
  const [measures, setMeasures] = useState<RhythmEvent[][]>(() => fixed ?? generateMeasures(level, meter, bars, randomSeed()));
  const [phase, setPhase] = useState<Phase>('idle');
  // Com o microfone, cada ataque no violão (qualquer nota, inclusive repetida) é um toque.
  const micState = useMicStatus();
  const micOn = micState.status === 'on' || micState.status === 'test'; // 'test' = sinal sintético pela mesma cadeia
  useMicNotes((n) => {
    if (!plan.current) return;
    taps.current.push((n.onsetT - plan.current.startAt) * 1000);
  }, micOn && phase === 'playing');
  const [beatNow, setBeatNow] = useState<number | null>(null);
  const [result, setResult] = useState<TapEvaluation | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const plan = useRef<ClickPlan | null>(null);
  const taps = useRef<number[]>([]);
  const raf = useRef<number>(0);
  const expected = useMemo(() => onsetsMs(measures, bpm, meter), [measures, bpm, meter]);
  const tol = toleranceFor(level);

  const finish = useCallback(() => {
    cancelAnimationFrame(raf.current);
    plan.current?.stop();
    const ev = evaluateTaps(expected, taps.current, tol);
    setResult(ev);
    setPhase('done');
    setBeatNow(null);
    setHistory((h) => [...h, ev.score]);
    logAttempt(kcId ?? `ritmo:exec:n${level}:${meterLabel(meter)}`, ev.score >= 0.8, ev.score, Math.round(ev.medianAbsDevMs ?? 0), { expectedMs: expected, tapsMs: taps.current });
  }, [expected, tol, level, meter, kcId]);

  const start = useCallback(async () => {
    taps.current = [];
    setResult(null);
    const total = bars * beats;
    const p = await scheduleClicks(bpm, beats, total, clickDuring, subdivision);
    plan.current = p;
    setPhase('playing');
    const ctx = audioContext();
    const endAt = p.startAt + total * p.beatSec + Math.max(0.4, tol / 1000);
    const loop = () => {
      const t = ctx.currentTime;
      if (t >= endAt) return finish();
      const b = Math.floor((t - (p.startAt - p.countInBeats * p.beatSec)) / p.beatSec);
      setBeatNow(b);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, [bars, beats, bpm, clickDuring, subdivision, tol, finish]);

  const next = () => {
    if (onNext && phase === 'done') return onNext();
    if (!fixed) setMeasures(generateMeasures(level, meter, bars, randomSeed()));
    setPhase('idle');
    setResult(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // só campos de DIGITAR ficam com a tecla; no controle de andamento ou na caixa de
      // marcar (que ficam com o foco depois de usados com o mouse) o Espaço continua batendo
      if (isTypingField(e.target)) return;
      if (e.code !== 'Space' && e.key !== 'j' && e.key !== 'f') {
        if (e.key === 'Enter' && phase === 'done') next();
        return;
      }
      e.preventDefault();
      if (e.repeat) return;
      if (phase === 'idle' && e.code === 'Space') void start();
      else if (phase === 'done' && e.code === 'Space') void start();
      else if (phase === 'playing' && plan.current) {
        const tSec = eventToAudioTime(e.timeStamp);
        const t = (tSec - plan.current.startAt) * 1000 - (Number.isFinite(latencyMs) ? latencyMs : 0);
        if (Number.isFinite(t)) taps.current.push(t);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    plan.current?.stop();
  }, []);

  const countIn = beatNow !== null && beatNow < beats;
  const totalMs = bars * beats * (60_000 / bpm);

  return (
    <div className="train-stage rhythm-stage">
      <RhythmStaff measures={measures} meter={meter} label="Ritmo a executar" />
      <div className="beat-dots" aria-hidden>
        {Array.from({ length: beats }, (_, i) => (
          <span key={i} className={`beat-dot${beatNow !== null && beatNow >= 0 && beatNow % beats === i ? ' is-on' : ''}${i === 0 ? ' is-accent' : ''}`} />
        ))}
        <span className="muted small">{phase === 'playing' ? (countIn ? 'contagem…' : 'toque!') : ''}</span>
      </div>
      <div className="mic-toggle">
        {micOn ? (
          <>
            <span className="mic-heard">🎤 Toque o ritmo numa corda do violão (cada ataque conta).</span>
            <button type="button" className="btn-ghost" onClick={() => mic.stop()}>Voltar ao teclado</button>
          </>
        ) : (
          <button type="button" onClick={() => void mic.start(micDeviceId || undefined)}>🎤 Tocar no violão em vez do teclado</button>
        )}
      </div>
      <button
        type="button"
        className="tap-pad"
        onPointerDown={(e) => {
          if (phase !== 'playing') return void start();
          if (!plan.current) return;
          const t = (eventToAudioTime(e.timeStamp) - plan.current.startAt) * 1000 - (Number.isFinite(latencyMs) ? latencyMs : 0);
          if (Number.isFinite(t)) taps.current.push(t);
        }}
      >
        {phase === 'playing' ? (countIn ? 'contagem…' : 'BATA AQUI ou tecle Espaço em cada nota') : phase === 'done' ? 'Repetir (Espaço)' : 'Começar (Espaço)'}
      </button>
      {phase === 'idle' && (
        <p className="kbd-hint">
          Toque no botão acima ou tecle <kbd>Espaço</kbd> para começar: 1 compasso de contagem, depois {micOn ? 'toque cada nota no violão' : <>toque <kbd>Espaço</kbd> em cada nota</>} (pausas e notas ligadas: não toque).
          {isCompound(meter) && ` Em ${meterLabel(meter)}, cada clique é uma semínima pontuada (3 colcheias).`}
        </p>
      )}
      {phase === 'done' && result && (
        <div className={`feedback ${result.score >= 0.8 ? 'is-ok' : 'is-bad'}`}>
          <p className="feedback-title">
            {Math.round(result.score * 100)}% <span className="rt">tolerância ±{tol} ms</span>
          </p>
          <p>
            {result.hits.length}/{expected.length} ataques no tempo · desvio mediano {result.medianAbsDevMs === null ? '–' : `${Math.round(result.medianAbsDevMs)} ms`} · {result.misses.length} omitido(s) ·{' '}
            {result.extras.length} a mais
            {result.hits.length > 0 && ` · tendência: ${(() => {
              const m = median(result.hits.map((h) => h.devMs))!;
              return Math.abs(m) < 15 ? 'no tempo' : m > 0 ? `atrasado ${Math.round(m)} ms` : `adiantado ${Math.round(-m)} ms`;
            })()}`}
          </p>
          <Timeline expected={expected} result={result} totalMs={totalMs} tol={tol} />
          <div className="actions">
            <button type="button" onClick={() => void start()}>Repetir (Espaço)</button>
            <button type="button" className="btn-primary" onClick={next}>{onNext ? 'Próximo (Enter)' : 'Novo ritmo (Enter)'}</button>
            {history.length > 1 && <span className="muted small">Nesta série: {history.map((s) => `${Math.round(s * 100)}%`).join(' · ')}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({ expected, result, totalMs, tol }: { expected: number[]; result: TapEvaluation; totalMs: number; tol: number }) {
  const W = 800;
  // toques fora da janela (ex.: durante a contagem) ficam presos às bordas
  const x = (ms: number) => Math.max(6, Math.min(W - 6, 10 + ((ms + 200) / (totalMs + 400)) * (W - 20)));
  const hitExp = new Set(result.hits.map((h) => h.expectedMs));
  return (
    <svg className="timeline" viewBox={`0 0 ${W} 60`} role="img" aria-label="Linha do tempo: ataques esperados e toques">
      <line x1={10} x2={W - 10} y1={30} y2={30} className="tl-axis" />
      {expected.map((e, i) => (
        <g key={`e${i}`}>
          <rect x={x(e - tol)} width={x(e + tol) - x(e - tol)} y={18} height={24} className="tl-window" />
          <line x1={x(e)} x2={x(e)} y1={14} y2={46} className={hitExp.has(e) ? 'tl-exp is-hit' : 'tl-exp is-miss'} />
        </g>
      ))}
      {result.hits.map((h, i) => (
        <circle key={`h${i}`} cx={x(h.tapMs)} cy={30} r={5} className="tl-tap is-hit" />
      ))}
      {result.extras.map((t, i) => (
        <circle key={`x${i}`} cx={x(t)} cy={30} r={5} className="tl-tap is-extra" />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- calibração

function Calibration({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const [state, setState] = useState<'idle' | 'running'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const plan = useRef<ClickPlan | null>(null);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    if (state !== 'running') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || !plan.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      taps.current.push((eventToAudioTime(e.timeStamp) - plan.current.startAt) * 1000);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [state]);

  const run = async () => {
    taps.current = [];
    setMsg('Toque Espaço junto com cada clique, depois da contagem (8 cliques)…');
    const p = await scheduleClicks(80, 4, 8, true);
    plan.current = p;
    setState('running');
    const beatMs = p.beatSec * 1000;
    const waitMs = (p.startAt - audioContext().currentTime) * 1000 + 8 * beatMs + 400;
    setTimeout(() => {
      setState('idle');
      const devs = taps.current
        .map((t) => {
          const k = Math.round(t / beatMs);
          return k >= 0 && k < 8 ? t - k * beatMs : null;
        })
        .filter((d): d is number => d !== null && Math.abs(d) < 250);
      if (devs.length < 5) {
        setMsg('Poucos toques válidos — tente de novo.');
        return;
      }
      const m = Math.round(median(devs)!);
      update({ latencyMs: m });
      setMsg(`Compensação ajustada para ${m} ms (mediana de ${devs.length} toques).`);
    }, waitMs);
  };

  return (
    <div className="calib">
      <button type="button" disabled={state === 'running'} onClick={() => void run()}>
        Calibrar latência
      </button>
      <span className="muted small"> atual: {settings.latencyMs} ms</span>
      {msg && <p className="small">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- reconhecimento

function Recognition({ level, meter, force, onNext }: { level: number; meter: Meter; force?: RecognitionForce; onNext?: () => void }) {
  const [q, setQ] = useState<RecognitionQuestion>(() => generateRecognition(level, meter, randomSeed(), force));
  // compassos em /8 contam colcheias; em /4, semínimas
  const unitName = meter.den === 8 ? 'colcheias' : 'tempos';
  const per = 16 / meter.den;
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState({ n: 0, ok: 0 });
  const shownAt = useRef(performance.now());

  const correctChoice = q.kind === 'duration' ? String(q.answerBeats) : q.complete ? 'yes' : 'no';
  const choose = (c: string) => {
    if (answer) return;
    setAnswer(c);
    const ok = c === correctChoice;
    setScore((s) => ({ n: s.n + 1, ok: s.ok + (ok ? 1 : 0) }));
    const kc = q.kind === 'duration' ? `ritmo:dur:${q.event.units}${q.event.rest ? 'r' : ''}` : `ritmo:compasso:n${level}:${meterLabel(meter)}`;
    logAttempt(kc, ok, ok ? 1 : 0, Math.round(performance.now() - shownAt.current), { choice: c });
  };
  const next = () => {
    if (onNext && answer) return onNext();
    setQ(generateRecognition(level, meter, randomSeed()));
    setAnswer(null);
    shownAt.current = performance.now();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (answer && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const measures = q.kind === 'duration' ? [[q.event]] : [q.measure];
  const units = q.kind === 'complete' ? measureUnits(q.measure) : 0;

  return (
    <div className="train-stage rhythm-stage">
      <p className="prompt">
        <span className="tag">{q.kind === 'duration' ? 'Quantos tempos (semínima = 1) dura esta figura?' : `Este compasso de ${meterLabel(meter)} está completo?`}</span>
      </p>
      <RhythmStaff
        measures={measures}
        meter={
          q.kind === 'duration'
            ? q.event.units % 4 === 0
              ? { num: Math.max(1, q.event.units / UNITS_PER_BEAT), den: 4 }
              : q.event.units % 2 === 0
                ? { num: q.event.units / 2, den: 8 }
                : { num: Math.max(1, Math.ceil(q.event.units / UNITS_PER_BEAT)), den: 4 }
            : meter
        }
        allowIncomplete
        label="Figura ou compasso"
      />
      <div className="actions answer-row">
        {q.kind === 'duration'
          ? q.options.map((o) => (
              <button key={o} type="button" className={answer ? (String(o) === correctChoice ? 'is-right' : answer === String(o) ? 'is-wrong' : '') : ''} onClick={() => choose(String(o))}>
                {beatsLabel(o)}
              </button>
            ))
          : (
            <>
              <button type="button" className={answer ? (correctChoice === 'yes' ? 'is-right' : answer === 'yes' ? 'is-wrong' : '') : ''} onClick={() => choose('yes')}>Completo</button>
              <button type="button" className={answer ? (correctChoice === 'no' ? 'is-right' : answer === 'no' ? 'is-wrong' : '') : ''} onClick={() => choose('no')}>Incompleto</button>
            </>
          )}
      </div>
      {answer && (
        <div className={`feedback ${answer === correctChoice ? 'is-ok' : 'is-bad'}`}>
          <p className="feedback-title">{answer === correctChoice ? 'Correto' : 'Incorreto'}</p>
          <p>
            {q.kind === 'duration'
              ? `${figureName(q.event)[0]!.toUpperCase()}${figureName(q.event).slice(1)}: ${beatsLabel(q.answerBeats)} tempo${q.answerBeats > 1 ? 's' : ''}.`
              : `O compasso soma ${beatsLabel(units / per)} de ${meter.num} ${unitName}${q.complete ? '.' : ` — faltam ${beatsLabel(meter.num - units / per)}.`}${isCompound(meter) ? ` Em ${meterLabel(meter)} são ${beatsPer(meter)} tempos de semínima pontuada (= ${measureSize(meter) / 2} colcheias).` : ''}`}
          </p>
          <button type="button" className="btn-primary" onClick={next}>Próxima (Enter)</button>
        </div>
      )}
      <p className="muted small">Nesta série: {score.ok}/{score.n}</p>
    </div>
  );
}
