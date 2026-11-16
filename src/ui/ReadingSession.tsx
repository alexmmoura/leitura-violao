import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioContext, eventToAudioTime, scheduleClicks, type ClickPlan } from '../audio/metronome';
import { locationLabel } from '../core/exercise/explain';
import { soundingAt, type FretLocation, type Instrument } from '../core/instrument/instrument';
import { inPosition, positionLabel } from '../core/instrument/position';
import { median } from '../core/learning/metrics';
import { melodyMeter, melodyNotes, type Melody } from '../core/melody/melody';
import { evaluateReading, type ReadingEvaluation } from '../core/melody/sightReading';
import { beatSize, beatsPer } from '../core/rhythm/rhythm';
import { pitchName } from '../core/theory/pitch';
import { db, localDay, type ModuleId, type ReadingSummary } from '../data/db';
import type { Settings } from '../data/settings';
import { secs } from './format';
import Fretboard, { type Mark } from './Fretboard';
import { audioTimeToPerf, mic, useMicNotes, useMicStatus } from '../audio/microphone';
import type { NoteEvent } from '../core/audio/tracker';
import { useMidiLocations } from '../audio/midiInput';
import MelodyStaff, { type EventMark } from './MelodyStaff';
import { melodic, playEvents } from '../audio/player';

/**
 * Sessão de leitura de uma frase — Módulo D (§6.4) e métricas de C3 (§11.4).
 *
 *  - static: nota a nota, no seu tempo; a frase avança mesmo após erro (não se corrige parando);
 *  - continuous: o cursor anda com o metrônomo e NÃO espera; respostas por clique no braço;
 *  - guitar: toque no violão real com o cursor; com o microfone ligado, alturas e tempo são
 *    verificados; sem ele, autoavaliação.
 */
export type ReadingMode = 'static' | 'continuous' | 'guitar';

export interface ReadingOutcome {
  readonly summary: ReadingSummary;
  readonly evaluation: ReadingEvaluation | null;
}

interface Props {
  melody: Melody;
  mode: ReadingMode;
  bpm: number;
  inst: Instrument;
  settings: Settings;
  module: ModuleId;
  /** Máscara das notas já passadas (treina o olhar à frente). */
  lookAhead?: boolean;
  preReadSec?: number;
  clickDuring?: boolean;
  onDone?: (o: ReadingOutcome) => void;
  /** Rótulo do botão de continuar após o resultado. */
  continueLabel?: string;
  /** Solfejo: o microfone ouve a VOZ e aceita a nota certa em qualquer oitava. */
  sing?: boolean;
}

/** Estado ao vivo de cada nota nos modos com metrônomo ('-' = ainda não decidida). */
type LiveStatus = 'ok' | 'timing' | 'wrong-pitch' | 'missed' | '-';
const LIVE_CODE: Record<LiveStatus, string> = { ok: 'o', timing: 't', 'wrong-pitch': 'w', missed: 'm', '-': '-' };
const LIVE_FROM: Record<string, LiveStatus> = { o: 'ok', t: 'timing', w: 'wrong-pitch', m: 'missed', '-': '-' };

type Status = 'ok' | 'bad' | 'region';

function logReading(module: ModuleId, kcId: string, summary: ReadingSummary, correct: boolean, rtMs: number) {
  const now = Date.now();
  db.attempts
    .add({
      ts: now,
      day: localDay(now),
      module,
      kcId,
      direction: 'reading',
      seed: summary.seed,
      correct,
      score: summary.notesInTime,
      errorCode: null,
      rtMs,
      inputMethod: 'mouse',
      answer: { reading: summary },
      written: '',
      sessionId: 'reading',
    })
    .catch(() => undefined);
}

export default function ReadingSession({ melody, mode, bpm, inst, settings, module, lookAhead = false, preReadSec = 0, clickDuring = true, onDone, continueLabel, sing = false }: Props) {
  const notes = useMemo(() => melodyNotes(melody), [melody]);
  /** Mesma nota? No solfejo vale qualquer oitava (cada voz canta na sua região). */
  const same = useCallback((a: number, b: number) => (sing ? (((a - b) % 12) + 12) % 12 === 0 : a === b), [sing]);
  const c = melody.config;
  const allowed = useCallback(
    (l: FretLocation) => c.strings.includes(l.string) && (inPosition(l, c.region, inst.frets) || (!!c.shiftTo && inPosition(l, c.shiftTo, inst.frets))),
    [c, inst.frets],
  );
  const regionLabel = `${positionLabel(c.region)}${c.shiftTo ? ` → ${positionLabel(c.shiftTo)}` : ''}`;
  // o bpm conta o TEMPO do compasso: semínima nos simples, semínima pontuada nos compostos
  const meter = melodyMeter(c);
  const unitsPerBeat = beatSize(meter);
  const beatsPerBar = beatsPer(meter);
  const beatMs = 60_000 / bpm;
  const unitMs = beatMs / unitsPerBeat;
  const totalUnits = melody.events.reduce((s, e) => s + e.units, 0);

  // ---------- estado comum ----------
  const [phase, setPhase] = useState<'pre' | 'run' | 'done'>(preReadSec > 0 && mode !== 'static' ? 'pre' : 'run');
  const [preLeft, setPreLeft] = useState(preReadSec);
  const [outcome, setOutcome] = useState<ReadingOutcome | null>(null);

  // ---------- estático ----------
  const [k, setK] = useState(0);
  const [statuses, setStatuses] = useState<{ status: Status; loc: FretLocation | null; ms: number }[]>([]);
  const noteShownAt = useRef(performance.now());

  // ---------- contínuo / violão ----------
  const [cursorUnits, setCursorUnits] = useState<number | null>(null);
  const [lastClick, setLastClick] = useState<{ loc: FretLocation; ok: boolean } | null>(null);
  const [liveCodes, setLiveCodes] = useState('');
  const [showName, setShowName] = useState(() => {
    try {
      return localStorage.getItem('lv-show-note-name') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('lv-show-note-name', showName ? '1' : '0');
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  }, [showName]);
  const plan = useRef<ClickPlan | null>(null);
  const responses = useRef<{ tMs: number; sounding: number; loc: FretLocation | null }[]>([]);
  const raf = useRef(0);

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    plan.current?.stop();
  }, []);

  // pré-leitura
  useEffect(() => {
    if (phase !== 'pre') return;
    if (preLeft <= 0) {
      setPhase('run');
      return;
    }
    const t = setTimeout(() => setPreLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, preLeft]);

  const finish = useCallback(
    (summary: ReadingSummary, evaluation: ReadingEvaluation | null, rtMs: number) => {
      const correct = summary.continuity === null ? summary.notesInTime >= 0.9 : summary.notesInTime >= 0.85 && summary.continuity >= 0.9;
      // partituras próprias ("obra:…") têm histórico próprio, fora das revisões do currículo
      logReading(module, melody.materialKey.startsWith('obra:') ? melody.materialKey : `leitura:${melody.materialKey}`, summary, correct, Math.round(rtMs));
      const o = { summary, evaluation };
      setOutcome(o);
      setPhase('done');
    },
    [module, melody.materialKey],
  );

  // ---------- modo estático ----------
  const onStaticClick = (loc: FretLocation) => {
    if (phase !== 'run' || k >= notes.length) return;
    const exp = notes[k]!;
    const sounding = soundingAt(loc, inst);
    answerStatic(sounding === exp.sounding ? (allowed(loc) ? 'ok' : 'region') : 'bad', loc, performance.now());
  };
  /** Pelo microfone só a altura é verificável (a região não). */
  const onStaticPitch = (n: NoteEvent) => {
    if (phase !== 'run' || k >= notes.length) return;
    const ok = same(n.midi, notes[k]!.sounding!);
    answerStatic(ok ? 'ok' : 'bad', ok ? melody.fingering.notes[k]!.loc : null, audioTimeToPerf(n.onsetT));
  };
  const answerStatic = (status: Status, loc: FretLocation | null, atPerf: number) => {
    const ms = Math.max(0, atPerf - noteShownAt.current);
    const next = [...statuses, { status, loc, ms }];
    setStatuses(next);
    noteShownAt.current = performance.now();
    if (k + 1 >= notes.length) {
      const ok = next.filter((s) => s.status === 'ok').length;
      const pitchOk = next.filter((s) => s.status !== 'bad').length;
      finish(
        { mode: 'static', materialKey: melody.materialKey, seed: melody.seed, bpm: null, notes: notes.length, notesInTime: ok / notes.length, pitchAccuracy: pitchOk / notes.length, continuity: null, selfAssessed: false },
        null,
        median(next.map((s) => s.ms)) ?? 0,
      );
    }
    setK(k + 1);
  };

  // ---------- modos com metrônomo ----------
  const startTimed = useCallback(async () => {
    responses.current = [];
    setLastClick(null);
    const beats = c.measures * beatsPerBar;
    const p = await scheduleClicks(bpm, beatsPerBar, beats, clickDuring);
    plan.current = p;
    const ctx = audioContext();
    const endAt = p.startAt + beats * p.beatSec + 0.35;
    const expected = notes.map((n) => ({ onsetMs: n.onsetUnits * unitMs, sounding: n.sounding! }));
    // tolerância = 1 semicolcheia (¼ de semínima), igual em compassos simples e compostos
    const tol = Math.max(120, unitMs);
    // janela de cada nota (a mesma da avaliação): depois dela, sem resposta = perdida
    const closeAt = expected.map((e, i) => e.onsetMs + Math.min(beatMs / 2, i < expected.length - 1 ? (expected[i + 1]!.onsetMs - e.onsetMs) / 2 : beatMs / 2));
    let lastLive = '';
    const loop = () => {
      const t = ctx.currentTime;
      // cores AO VIVO: cada nota fica verde/amarela/vermelha assim que é decidida
      const nowMs = (t - p.startAt) * 1000;
      const ev0 = evaluateReading(expected, responses.current, beatMs, tol, totalUnits * unitMs, sing);
      const live = ev0.perNote.map((pn, i) => LIVE_CODE[pn.status !== 'missed' ? pn.status : nowMs > closeAt[i]! ? 'missed' : '-']).join('');
      if (live !== lastLive) {
        lastLive = live;
        setLiveCodes(live);
      }
      if (t >= endAt) {
        setCursorUnits(null);
        // "no violão" passa a ser VERIFICADO quando o microfone esteve ligado
        if (mode === 'continuous' || micUsed.current) {
          const ev = evaluateReading(expected, responses.current, beatMs, tol, totalUnits * unitMs, sing);
          finish(
            { mode, materialKey: melody.materialKey, seed: melody.seed, bpm, notes: notes.length, notesInTime: ev.notesInTime, pitchAccuracy: ev.pitchAccuracy, continuity: ev.continuity, selfAssessed: false },
            ev,
            ev.medianAbsDevMs ?? 0,
          );
        } else {
          setPhase('done');
        }
        return;
      }
      const u = (t - p.startAt) / (p.beatSec / unitsPerBeat);
      setCursorUnits(u);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, [c.measures, beatsPerBar, unitsPerBeat, bpm, clickDuring, mode, notes, unitMs, beatMs, totalUnits, finish, melody.materialKey, melody.seed, sing]);

  const started = useRef(false);
  useEffect(() => {
    if (phase === 'run' && mode !== 'static' && !started.current) {
      started.current = true;
      void startTimed();
    }
  }, [phase, mode, startTimed]);

  const onTimedClick = (loc: FretLocation, timeStamp: number) => {
    if (mode !== 'continuous' || !plan.current || phase !== 'run') return;
    const tMs = (eventToAudioTime(timeStamp) - plan.current.startAt) * 1000 - (Number.isFinite(settings.latencyMs) ? settings.latencyMs : 0);
    const sounding = soundingAt(loc, inst);
    responses.current.push({ tMs, sounding, loc });
    setLastClick({ loc, ok: notes.some((n) => n.sounding === sounding && Math.abs(n.onsetUnits * unitMs - tMs) <= beatMs / 2) });
  };

  // ---------- microfone ----------
  const micState = useMicStatus();
  const micOn = micState.status === 'on' || micState.status === 'test'; // 'test' = sinal sintético pela mesma cadeia
  const micUsed = useRef(false);
  useEffect(() => {
    if (micOn) micUsed.current = true;
  }, [micOn]);
  useMicNotes(onStaticPitch, micOn && mode === 'static' && phase === 'run');
  useMicNotes(
    (n) => {
      if (!plan.current) return;
      micUsed.current = true;
      // quem toca acompanha o clique que OUVE, e o som sai com atraso (latência de saída):
      // desconta esse atraso para o julgamento do tempo ficar justo
      const ctx = audioContext();
      const outMs = ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000;
      responses.current.push({ tMs: (n.onsetT - plan.current.startAt) * 1000 - outMs, sounding: n.midi, loc: null });
      setLastClick(null);
    },
    micOn && mode !== 'static' && phase === 'run',
  );
  // (o microfone continua ligado entre frases; a página o desliga ao sair)
  // guitarra MIDI hexafônica: local exato, também no modo contínuo
  useMidiLocations(
    (loc, ts) => {
      if (mode === 'static') onStaticClick(loc);
      else if (mode === 'continuous') onTimedClick(loc, ts);
    },
    phase === 'run',
    inst,
    settings.midiString1Channel,
  );

  const selfAssess = (continuity: number) => {
    finish(
      { mode: 'guitar', materialKey: melody.materialKey, seed: melody.seed, bpm, notes: notes.length, notesInTime: continuity, pitchAccuracy: continuity, continuity, selfAssessed: true },
      null,
      0,
    );
  };

  // ---------- marcas visuais ----------
  const eventMarks = useMemo(() => {
    const m = new Map<number, EventMark>();
    melody.events.forEach((e, i) => {
      if (mode === 'static') {
        if (e.noteIndex >= 0 && e.noteIndex < statuses.length) m.set(i, statuses[e.noteIndex]!.status === 'ok' ? 'ok' : statuses[e.noteIndex]!.status === 'region' ? 'warn' : 'bad');
        else if (e.noteIndex === k && phase === 'run') m.set(i, 'current');
        return;
      }
      if (phase === 'done' && outcome?.evaluation && e.noteIndex >= 0) {
        const st = outcome.evaluation.perNote[e.noteIndex]!.status;
        m.set(i, st === 'ok' ? 'ok' : st === 'timing' ? 'warn' : 'bad');
        return;
      }
      if (cursorUnits === null || phase !== 'run') return;
      const end = e.onsetUnits + e.units;
      const live = e.noteIndex >= 0 ? LIVE_FROM[liveCodes[e.noteIndex] ?? '-'] : '-';
      if (lookAhead && cursorUnits >= end) m.set(i, 'masked');
      else if (live && live !== '-') m.set(i, live === 'ok' ? 'ok' : live === 'timing' ? 'warn' : 'bad');
      else if (cursorUnits >= e.onsetUnits && cursorUnits < end) m.set(i, 'current');
    });
    return m;
  }, [melody.events, mode, statuses, k, phase, outcome, cursorUnits, lookAhead, liveCodes]);
  // a pauta só é redesenhada quando alguma marca muda (não a cada quadro do cursor)
  const marksKey = [...eventMarks].map(([i, v]) => `${i}${v}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableMarks = useMemo(() => eventMarks, [marksKey]);
  /** Placar ao vivo (modos com metrônomo). */
  const liveScore = useMemo(() => {
    const ok = [...liveCodes].filter((x) => x === 'o').length;
    const warn = [...liveCodes].filter((x) => x === 't').length;
    const bad = [...liveCodes].filter((x) => x === 'w' || x === 'm').length;
    return { ok, warn, bad };
  }, [liveCodes]);

  const fbMarks: Mark[] = useMemo(() => {
    if (mode === 'static') {
      const last = statuses[statuses.length - 1];
      const out: Mark[] = [];
      if (last) {
        const exp = notes[statuses.length - 1]!;
        if (last.loc) out.push({ loc: last.loc, kind: last.status === 'ok' ? 'correct' : 'wrong' });
        if (last.status !== 'ok') out.push({ loc: melody.fingering.notes[statuses.length - 1]!.loc, kind: 'valid', label: pitchName(exp.pitch!, { naming: settings.naming, withOctave: false }) });
      }
      if (phase === 'done') return melody.fingering.notes.map((fn) => ({ loc: fn.loc, kind: 'valid' as const, label: String(fn.finger) }));
      return out;
    }
    if (lastClick && phase === 'run') return [{ loc: lastClick.loc, kind: lastClick.ok ? 'correct' : 'wrong' }];
    if (phase === 'done') return melody.fingering.notes.map((fn) => ({ loc: fn.loc, kind: 'valid' as const, label: String(fn.finger) }));
    return [];
  }, [mode, statuses, notes, melody.fingering.notes, phase, lastClick, settings.naming]);

  const beatNow = cursorUnits === null ? null : Math.floor(cursorUnits / unitsPerBeat);
  // nome da nota da vez (opcional: ver para conferir, esconder para forçar a memória)
  const nowEvent =
    mode === 'static'
      ? notes[k]
      : cursorUnits === null
        ? undefined
        : melody.events.find((e) => !e.rest && cursorUnits >= e.onsetUnits && cursorUnits < e.onsetUnits + e.units);
  const nowName = nowEvent?.pitch ? pitchName(nowEvent.pitch, { naming: settings.naming, withOctave: false }) : null;

  return (
    <div className="reading">
      <div className="reading-head">
        <span>
          <strong>{regionLabel}</strong> · {mode === 'static' ? 'nota a nota' : `${bpm} bpm`} · {notes.length} notas
        </span>
        {mode !== 'static' && phase === 'run' && (
          <span className="beat-dots" aria-hidden>
            {Array.from({ length: beatsPerBar }, (_, i) => (
              <span key={i} className={`beat-dot${beatNow !== null && ((beatNow % beatsPerBar) + beatsPerBar) % beatsPerBar === i ? ' is-on' : ''}${i === 0 ? ' is-accent' : ''}`} />
            ))}
            <span className="muted small">{beatNow !== null && beatNow < 0 ? 'contagem…' : ''}</span>
          </span>
        )}
        {mode !== 'static' && phase === 'run' && (mode === 'continuous' || micOn) && (
          <span className="live-score" aria-live="polite">
            <span className="ok">✔ {liveScore.ok}</span>
            {liveScore.warn > 0 && <span className="warn">≈ {liveScore.warn}</span>}
            <span className="bad">✖ {liveScore.bad}</span>
          </span>
        )}
      </div>

      {phase !== 'done' && (
        <div className="mic-toggle">
          {micOn ? (
            <>
              <span className="mic-heard">
                🎤 {sing ? 'Cantando (solfejo): vale a nota certa em qualquer oitava' : 'Tocando no violão: o microfone verifica as alturas'}
                {mode !== 'static' ? ' e o tempo' : ''}.
              </span>
              <button type="button" className="btn-ghost" onClick={() => mic.stop()}>Desligar microfone</button>
            </>
          ) : (
            <button type="button" onClick={() => void mic.start(settings.micDeviceId || undefined)}>
              🎤 {sing ? 'Cantar a frase (solfejo, microfone)' : 'Ler tocando no violão (microfone)'}
            </button>
          )}
          {notes[0] && (
            <button
              type="button"
              className="btn-ghost"
              title="Toca a primeira nota da frase, para afinar a voz ou conferir o início"
              onClick={() => void playEvents(melodic([notes[0]!.sounding!], 1.2), settings.aRef)}
            >
              🔊 Nota inicial
            </button>
          )}
          <button type="button" className="btn-ghost" aria-pressed={showName} title="Mostra ou esconde o nome da nota da vez" onClick={() => setShowName((v) => !v)}>
            {showName ? '🙈 Esconder nome da nota' : '👁 Mostrar nome da nota'}
          </button>
          {micState.error && <span className="warn small">{micState.error}</span>}
        </div>
      )}

      {phase === 'pre' && (
        <div className="preread">
          <strong>Pré-leitura: {preLeft} s</strong> — confira armadura, compasso, ritmos difíceis, região e onde a mão muda de posição.
          <button type="button" onClick={() => setPreLeft(0)}>Começar já</button>
        </div>
      )}

      <MelodyStaff melody={melody} marks={stableMarks} showFingering={phase === 'done'} label="Frase para ler" fit />
      {showName && phase === 'run' && <p className="now-note" aria-live="off">{nowName ?? '·'}</p>}

      <Fretboard
        inst={inst}
        settings={settings}
        window={null}
        marks={fbMarks}
        onCellClick={mode === 'static' ? (loc) => onStaticClick(loc) : mode === 'continuous' ? onTimedClick : undefined}
        disabled={phase !== 'run' || mode === 'guitar'}
      />

      {phase === 'run' && (
        <p className="kbd-hint">
          {mode === 'static' &&
            (sing && micOn
              ? 'Cante cada nota (dizendo o nome, se quiser), na ordem — ou clique no braço. A frase segue mesmo se você errar.'
              : 'Clique no braço o local de cada nota, na ordem (ou toque/cante com o microfone). A frase segue mesmo se você errar.')}
          {mode === 'continuous' && 'Clique cada nota no braço, no tempo. As notas ficam verdes/vermelhas na hora. O cursor não espera — se perder uma nota, siga para a próxima.'}
          {mode === 'guitar' && (sing ? 'Cante acompanhando o cursor, sem parar.' : 'Toque no seu violão acompanhando o cursor, sem parar.')}
        </p>
      )}

      {phase === 'done' && mode === 'guitar' && !outcome && (
        <div className="feedback">
          <p className="feedback-title">Como foi?</p>
          <div className="actions">
            <button type="button" onClick={() => selfAssess(1)}>Toquei sem parar</button>
            <button type="button" onClick={() => selfAssess(0.8)}>Parei 1–2 vezes</button>
            <button type="button" onClick={() => selfAssess(0.5)}>Parei várias vezes</button>
          </div>
          <p className="muted small">Autoavaliação, porque o microfone estava desligado. Ligue-o antes de começar para o app verificar alturas e tempo.</p>
        </div>
      )}

      {outcome && <OutcomeView o={outcome} notes={notes.length} statuses={statuses} onContinue={onDone ? () => onDone(outcome) : undefined} continueLabel={continueLabel} />}
      {phase === 'done' && mode === 'static' && statuses.some((s) => s.status !== 'ok') && (
        <p className="small">
          Erros:{' '}
          {statuses
            .map((s, i) => ({ s, i }))
            .filter((x) => x.s.status !== 'ok')
            .map((x) => `${pitchName(notes[x.i]!.pitch!, { naming: settings.naming, octaves: settings.octaves })} → ${x.s.loc ? `você marcou ${locationLabel(x.s.loc)}` : 'nota errada (microfone)'}${x.s.status === 'region' ? ' (fora da região)' : ''}`)
            .join('; ')}
        </p>
      )}
    </div>
  );
}

function OutcomeView({ o, notes, statuses, onContinue, continueLabel }: { o: ReadingOutcome; notes: number; statuses: { ms: number }[]; onContinue?: () => void; continueLabel?: string }) {
  const s = o.summary;
  const good = s.continuity === null ? s.notesInTime >= 0.9 : s.notesInTime >= 0.85 && s.continuity >= 0.9;
  return (
    <div className={`feedback ${good ? 'is-ok' : 'is-bad'}`}>
      <p className="feedback-title">
        {s.mode === 'static' ? `${Math.round(s.notesInTime * 100)}% certas` : `${Math.round(s.notesInTime * 100)}% no tempo`}
        {s.continuity !== null && <span className="rt">continuidade {Math.round(s.continuity * 100)}%{s.selfAssessed ? ' (autoavaliação)' : ''}</span>}
      </p>
      {s.mode === 'static' && (
        <p>
          {Math.round(s.notesInTime * notes)}/{notes} na primeira tentativa · tempo mediano por nota {secs(median(statuses.map((x) => x.ms)))}
        </p>
      )}
      {o.evaluation && (
        <p>
          Altura certa {Math.round(o.evaluation.pitchAccuracy * 100)}% · desvio mediano {o.evaluation.medianAbsDevMs === null ? '–' : `${Math.round(o.evaluation.medianAbsDevMs)} ms`}
          {o.evaluation.recovery !== null && ` · recuperação após erro: ${o.evaluation.recovery.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} nota(s)`}
          {o.evaluation.extras > 0 && ` · ${o.evaluation.extras} clique(s) a mais`}
        </p>
      )}
      <p className="muted small">Digitação sugerida (dedos) agora aparece na pauta e no braço — é uma referência, não a única resposta.</p>
      {onContinue && (
        <button type="button" className="btn-primary" onClick={onContinue}>
          {continueLabel ?? 'Continuar'}
        </button>
      )}
    </div>
  );
}
