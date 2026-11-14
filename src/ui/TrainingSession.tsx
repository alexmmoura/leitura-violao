import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { explainQuestion, locationLabel } from '../core/exercise/explain';
import { effectivePitch, evaluateStaffAnswer, type FretQuestion, type StaffAnswer } from '../core/exercise/fretQuestion';
import { targetOf, type NoteQuestion } from '../core/exercise/noteQuestion';
import { classifyLocation, ERROR_LABEL, evaluateAllLocations, type ErrorCode } from '../core/exercise/validate';
import { locationKey, locationsFor, sameLocation, type FretLocation, type Instrument } from '../core/instrument/instrument';
import type { FretWindow } from '../core/instrument/position';
import { keyAlterFor, type Fifths } from '../core/theory/keySignature';
import { diatonicIndex, LETTERS, pitchName, type Alter, type Letter } from '../core/theory/pitch';
import { db, localDay, type InputMethod, type ModuleId } from '../data/db';
import { audioTimeToPerf, mic, useMicNotes, useMicStatus } from '../audio/microphone';
import { useMidiLocations } from '../audio/midiInput';
import type { NoteEvent } from '../core/audio/tracker';
import { classifyPitch } from '../core/exercise/validate';
import { preferredSpelling } from '../core/theory/spelling';
import type { Settings } from '../data/settings';
import { secs } from './format';
import Fretboard, { type Mark } from './Fretboard';
import Staff, { type StaffNote } from './Staff';

/**
 * Executor de sessões de treino — usado pelo Módulo A/B (prática bidirecional)
 * e pelo teste de conclusão do Módulo C. Especificação §7.1 (ciclo da questão).
 */
export type SessionQuestion = NoteQuestion | FretQuestion;

export interface SessionResult {
  readonly ts: number;
  readonly kcId: string;
  readonly correct: boolean;
  readonly score: number;
  readonly error: ErrorCode | null;
  readonly rtMs: number;
}

interface AnswerView {
  correct: boolean;
  error: ErrorCode | null;
  rtMs: number;
  locations: FretLocation[];
  staff: StaffAnswer | null;
  explanation: string[];
}

interface Props {
  inst: Instrument;
  settings: Settings;
  fifths: Fifths;
  window: FretWindow | null;
  module: ModuleId;
  title: ReactNode;
  /** Total de questões (0 = sem fim). */
  total: number;
  /** Próxima questão; null encerra. `last` é o resultado da questão anterior. */
  nextQuestion: (prev: SessionQuestion | null, index: number, last?: SessionResult) => SessionQuestion | null;
  sessionConfig: unknown;
  /** Chamado ao terminar ou encerrar, com os resultados e o id da sessão. */
  onExit: (results: SessionResult[], sessionId: string, completed: boolean) => void;
  /** Conteúdo extra no resumo final. */
  summary?: (results: SessionResult[]) => ReactNode;
}

const DEFAULT_OCTAVE_CENTER = 4 * 7 + 6; // Si4 escrito: linha central da pauta

export default function TrainingSession(props: Props) {
  const { inst, settings, fifths, window: win, module, title, total, nextQuestion, sessionConfig, onExit, summary } = props;
  const [question, setQuestion] = useState<SessionQuestion | null>(null);
  const [view, setView] = useState<AnswerView | null>(null);
  const [selected, setSelected] = useState<FretLocation[]>([]);
  const [staffDraft, setStaffDraft] = useState<StaffAnswer | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [keyString, setKeyString] = useState<number | null>(null);
  const [keyFret, setKeyFret] = useState('');
  const shownAt = useRef(0);
  const sessionId = useRef<string>(crypto.randomUUID());
  const lastInput = useRef<InputMethod>('mouse');
  const answered = useRef(false);
  const buffer = useRef<{ string: number | null; fret: string }>({ string: null, fret: '' });
  const draftRef = useRef<StaffAnswer | null>(null);
  const finished = total > 0 && results.length >= total && view !== null;
  const opts = { naming: settings.naming, octaves: settings.octaves };

  const setBuffer = (string: number | null, fret: string) => {
    buffer.current = { string, fret };
    setKeyString(string);
    setKeyFret(fret);
  };
  const setDraft = (d: StaffAnswer | null) => {
    draftRef.current = d;
    setStaffDraft(d);
  };

  const advance = useCallback(
    (prev: SessionQuestion | null, index: number, last?: SessionResult) => {
      const q = nextQuestion(prev, index, last);
      if (!q) return false;
      answered.current = false;
      shownAt.current = performance.now();
      setQuestion(q);
      setView(null);
      setSelected([]);
      buffer.current = { string: null, fret: '' };
      setKeyString(null);
      setKeyFret('');
      draftRef.current = null;
      setStaffDraft(null);
      return true;
    },
    [nextQuestion],
  );

  // início da sessão (a ref evita consumir duas questões no duplo efeito do StrictMode)
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    db.sessions.add({ id: sessionId.current, startedAt: Date.now(), endedAt: null, module, config: sessionConfig }).catch(() => undefined);
    advance(null, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exit = useCallback(
    (completed: boolean) => {
      db.sessions.update(sessionId.current, { endedAt: Date.now() }).catch(() => undefined);
      onExit(results, sessionId.current, completed);
    },
    [onExit, results],
  );

  const next = useCallback(() => {
    if (!advance(question, results.length, results[results.length - 1])) exit(true);
  }, [advance, question, results, exit]);

  const onRendered = useCallback(() => {
    shownAt.current = performance.now();
  }, []);

  const record = (q: SessionQuestion, v: AnswerView, score: number, answer: FretLocation[] | { written: string }) => {
    const now = Date.now();
    const r: SessionResult = { ts: now, kcId: q.kcId, correct: v.correct, score, error: v.error, rtMs: v.rtMs };
    setResults((prev) => [...prev, r]);
    setView(v);
    db.attempts
      .add({
        ts: now,
        day: localDay(now),
        module,
        kcId: q.kcId,
        direction: q.kind,
        seed: q.seed,
        correct: v.correct,
        score,
        errorCode: v.error,
        rtMs: v.rtMs,
        inputMethod: lastInput.current,
        answer,
        written: pitchName(q.written, { naming: 'english' }),
        sessionId: sessionId.current,
      })
      .catch(() => undefined);
  };

  const submitLocations = (answer: FretLocation[]) => {
    if (!question || question.kind !== 'staff>fretboard' || answered.current || answer.length === 0) return;
    answered.current = true;
    const rtMs = Math.round(performance.now() - shownAt.current);
    const target = targetOf(question);
    if (question.answerMode === 'all') {
      const ev = evaluateAllLocations(target, answer, inst, question.constraints);
      const explanation = explainQuestion(question, inst, opts);
      if (!ev.correct) {
        if (ev.missing.length) explanation.push(`Faltaram: ${ev.missing.map(locationLabel).join('; ')}.`);
        if (ev.extra.length) explanation.push(`Marcados a mais: ${ev.extra.map(locationLabel).join('; ')}.`);
      }
      record(question, { correct: ev.correct, error: ev.correct ? null : 'OTHER', rtMs, locations: answer, staff: null, explanation }, ev.score, answer);
    } else {
      const a = answer[0]!;
      const c = classifyLocation(target, a, inst, question.constraints);
      const explanation = explainQuestion(question, inst, opts, c.correct ? undefined : a, c.error);
      record(question, { correct: c.correct, error: c.error ?? null, rtMs, locations: answer, staff: null, explanation }, c.correct ? 1 : 0, answer);
    }
  };

  const submitStaff = (a: StaffAnswer | null) => {
    if (!question || question.kind !== 'fretboard>staff' || answered.current || !a) return;
    answered.current = true;
    const rtMs = Math.round(performance.now() - shownAt.current);
    const r = evaluateStaffAnswer(question, a);
    const loc = question.location;
    const explanation = [
      `${locationLabel(loc)}: escreve-se ${pitchName(question.written, opts)} (soa uma oitava abaixo).`,
      `Você escreveu ${pitchName(r.given, opts)}.`,
    ];
    if (r.error === 'ENHARMONIC' && question.requireSpelling) explanation.push('Nesta tonalidade a nota tem nome próprio: use a grafia da armadura.');
    else if (r.error === 'ENHARMONIC') explanation.push('Use sustenido ou bemol simples; dobrados e Mi♯/Si♯/Fá♭/Dó♭ não são aceitos aqui.');
    else if (!r.correct && !question.requireSpelling && question.written.alter !== 0) explanation.push('Grafias enarmônicas simples (ex.: Fá♯/Sol♭) são aceitas quando a tonalidade não define o nome.');
    record(question, { correct: r.correct, error: r.error ?? null, rtMs, locations: [], staff: a, explanation }, r.correct ? 1 : 0, { written: pitchName(r.given, { naming: 'english' }) });
  };

  // ---------- resposta pelo violão (microfone, §15) ----------
  const micState = useMicStatus();
  const micOn = micState.status === 'on' || micState.status === 'test'; // 'test' = sinal sintético pela mesma cadeia
  const micUsable = question?.kind === 'staff>fretboard' && question.answerMode !== 'all';
  const [heard, setHeard] = useState<string | null>(null);

  const submitPitch = (n: NoteEvent) => {
    if (!question || question.kind !== 'staff>fretboard' || question.answerMode === 'all' || answered.current) return;
    answered.current = true;
    lastInput.current = 'microphone';
    const rtMs = Math.max(0, Math.round(audioTimeToPerf(n.onsetT) - shownAt.current));
    const c = classifyPitch(targetOf(question), n.midi);
    const heardName = pitchName(preferredSpelling(n.midi + 12), opts);
    setHeard(`${heardName} (${n.cents > 0 ? '+' : ''}${Math.round(n.cents)} cents)`);
    // a corda não é observável: só há local inequívoco se a região tiver um único lugar para a nota
    const locs = c.correct && question.valid.length === 1 ? [question.valid[0]!] : [];
    const explanation = explainQuestion(question, inst, opts);
    explanation.push(`Você tocou ${heardName} (escrita).`);
    if (c.correct && question.valid.length > 1) explanation.push('O microfone não distingue a corda: qualquer um dos locais válidos produz este som.');
    if (c.correct && question.answerMode === 'string') explanation.push('A corda pedida não pôde ser verificada pelo microfone — confira você mesmo.');
    record(question, { correct: c.correct, error: c.error ?? null, rtMs, locations: locs, staff: null, explanation }, c.correct ? 1 : 0, locs);
  };
  useMicNotes(submitPitch, micOn && micUsable && !view);
  useEffect(() => () => mic.stop(), []);
  // guitarra MIDI hexafônica: local exato (corda e casa)
  useMidiLocations(
    (loc) => {
      lastInput.current = 'midi';
      if (question?.kind !== 'staff>fretboard' || answered.current) return;
      if (question.answerMode === 'all') setSelected((s) => (s.some((x) => sameLocation(x, loc)) ? s : [...s, loc]));
      else submitLocations([loc]);
    },
    !view,
    inst,
    settings.midiString1Channel,
  );

  const onCellClick = (loc: FretLocation) => {
    if (!question || question.kind !== 'staff>fretboard' || answered.current) return;
    lastInput.current = 'mouse';
    if (question.answerMode === 'all') setSelected((s) => (s.some((x) => sameLocation(x, loc)) ? s.filter((x) => !sameLocation(x, loc)) : [...s, loc]));
    else submitLocations([loc]);
  };

  const onStaffPick = (letter: Letter, octave: number) => {
    if (!question || question.kind !== 'fretboard>staff' || answered.current) return;
    lastInput.current = 'mouse';
    const prev = draftRef.current;
    const keepAcc = prev && prev.letter === letter ? prev.accidental : null;
    setDraft({ letter, octave, accidental: keepAcc });
  };

  const setAccidental = (acc: Alter | null) => {
    const d = draftRef.current;
    if (!d || answered.current) return;
    setDraft({ ...d, accidental: d.accidental === acc ? null : acc });
  };

  // ---------- Teclado (§14.3) ----------
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (finished) {
      if (e.key === 'Enter' || e.key === 'Escape') exit(true);
      return;
    }
    if (answered.current) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      } else if (e.key === 'Escape') exit(false);
      return;
    }
    if (!question) return;

    if (question.kind === 'fretboard>staff') {
      lastInput.current = 'keyboard';
      const k = e.key.toLowerCase();
      const d = draftRef.current;
      if (e.key === 'Escape') {
        if (d) setDraft(null);
        else exit(false);
      } else if (/^[a-g]$/.test(k)) {
        const letter = k.toUpperCase() as Letter;
        // oitava mais próxima da seleção atual (ou da linha central)
        const center = d ? diatonicIndex({ ...d, alter: 0 }) : DEFAULT_OCTAVE_CENTER;
        const li = LETTERS.indexOf(letter);
        let best = 4;
        for (let o = 3; o <= 6; o++) if (Math.abs(o * 7 + li - center) < Math.abs(best * 7 + li - center)) best = o;
        setDraft({ letter, octave: best, accidental: d && d.letter === letter ? d.accidental : null });
      } else if (d && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        setDraft({ ...d, octave: Math.max(3, Math.min(6, d.octave + (e.key === 'ArrowUp' ? 1 : -1))) });
      } else if (e.key === '#' || e.key === '+') setAccidental(1);
      else if (e.key === '-') setAccidental(-1);
      else if (e.key === '=') setAccidental(0);
      else if (e.key === 'Backspace' && d) setDraft({ ...d, accidental: null });
      else if (e.key === 'Enter') {
        e.preventDefault();
        submitStaff(d);
      }
      return;
    }

    // pauta → braço: corda (1–6) → casa → Enter
    const { string: bs, fret: bf } = buffer.current;
    if (e.key === 'Escape') {
      if (bs === null) exit(false);
      else setBuffer(null, '');
      return;
    }
    if (e.key === 'Backspace') {
      if (bf) setBuffer(bs, bf.slice(0, -1));
      else setBuffer(null, '');
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      if (bs === null) {
        const s = Number(e.key);
        if (s >= 1 && s <= inst.strings.length) setBuffer(s, '');
      } else if (bf.length < 2) setBuffer(bs, bf + e.key);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      lastInput.current = 'keyboard';
      if (bs !== null && bf !== '') {
        const loc = { string: bs, fret: Number(bf) };
        setBuffer(null, '');
        if (loc.fret > inst.frets) return;
        if (question.answerMode === 'all') onCellClick(loc);
        else submitLocations([loc]);
      } else if (question.answerMode === 'all') submitLocations(selected);
    }
  };
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ---------- O que desenhar ----------
  const staffNotes: StaffNote[] = useMemo(() => {
    if (!question) return [];
    if (question.kind === 'staff>fretboard') return [{ pitch: question.written, accidental: question.shownAccidental }];
    const out: StaffNote[] = [];
    const draft = view?.staff ?? staffDraft;
    if (draft) {
      const p = effectivePitch(draft, fifths);
      out.push({ pitch: p, accidental: draft.accidental, tone: view ? (view.correct ? 'ok' : 'bad') : 'accent' });
    }
    if (view && !view.correct) {
      const exp = question.written;
      out.push({ pitch: exp, accidental: keyAlterFor(exp.letter, fifths) === exp.alter ? null : exp.alter, tone: 'ok' });
    }
    return out;
  }, [question, view, staffDraft, fifths]);

  const marks: Mark[] = useMemo(() => {
    if (!question) return [];
    if (question.kind === 'fretboard>staff') return [{ loc: question.location, kind: view ? (view.correct ? 'correct' : 'wrong') : 'selected' }];
    if (!view) return selected.map((loc) => ({ loc, kind: 'selected' as const }));
    const answerKeys = new Set(view.locations.map(locationKey));
    const validKeys = new Set(question.valid.map(locationKey));
    const out: Mark[] = [];
    for (const l of locationsFor(question.sounding, inst)) if (!validKeys.has(locationKey(l)) && !answerKeys.has(locationKey(l))) out.push({ loc: l, kind: 'muted' });
    for (const v of question.valid) out.push({ loc: v, kind: answerKeys.has(locationKey(v)) ? 'correct' : 'valid' });
    for (const a of view.locations) if (!validKeys.has(locationKey(a))) out.push({ loc: a, kind: 'wrong' });
    return out;
  }, [question, view, selected, inst]);

  const stats = useMemo(() => {
    const n = results.length;
    const ok = results.filter((h) => h.correct).length;
    const times = results.filter((h) => h.correct).map((h) => h.rtMs).sort((a, b) => a - b);
    const median = times.length ? times[Math.floor(times.length / 2)]! : null;
    const errors = new Map<ErrorCode, number>();
    for (const h of results) if (h.error) errors.set(h.error, (errors.get(h.error) ?? 0) + 1);
    return { n, ok, median, errors: [...errors.entries()].sort((a, b) => b[1] - a[1]) };
  }, [results]);

  const isStaffQ = question?.kind === 'fretboard>staff';
  const prompt = !question
    ? null
    : isStaffQ
      ? 'Escreva na pauta a nota marcada no braço'
      : question.answerMode === 'string'
        ? `Toque na corda ${question.constraints.requiredString}`
        : question.answerMode === 'all'
          ? 'Marque todos os locais e tecle Enter'
          : 'Encontre a nota no braço';

  return (
    <section className="page train">
      <header className="train-head">
        <div>{title}</div>
        <div className="progress" aria-label="Progresso">
          <div className="progress-bar">
            <span style={{ width: total ? `${(100 * results.length) / total}%` : '0%' }} />
          </div>
          <span>
            {results.length}
            {total ? `/${total}` : ''}
          </span>
        </div>
        <button type="button" className="btn-ghost" onClick={() => exit(finished)}>
          Encerrar (Esc)
        </button>
      </header>

      <div className="train-main">
        <div className="train-stage">
          <div className="prompt">{prompt && <span className={`tag${isStaffQ ? ' is-staff' : ''}`}>{prompt}</span>}</div>
          <Staff
            fifths={fifths}
            notes={staffNotes}
            onRendered={onRendered}
            onPick={isStaffQ && !view ? onStaffPick : undefined}
            label={isStaffQ ? 'Pauta: clique na linha ou espaço' : 'Nota a identificar'}
          />
          {isStaffQ && !view && (
            <div className="acc-bar" role="group" aria-label="Acidente">
              {(
                [
                  [-1, '♭', '-'],
                  [0, '♮', '='],
                  [1, '♯', '#'],
                ] as const
              ).map(([acc, sym, keyHint]) => (
                <button
                  key={acc}
                  type="button"
                  className={`chip${staffDraft?.accidental === acc ? ' is-on' : ''}`}
                  disabled={!staffDraft}
                  aria-pressed={staffDraft?.accidental === acc}
                  title={`Tecla ${keyHint}`}
                  onClick={() => setAccidental(acc)}
                >
                  {sym}
                </button>
              ))}
              <button type="button" className="btn-primary" disabled={!staffDraft} onClick={() => submitStaff(draftRef.current)}>
                Confirmar
              </button>
              <span className="muted small">{staffDraft ? pitchName(effectivePitch(staffDraft, fifths), opts) : 'clique numa linha ou espaço'}</span>
            </div>
          )}
          <Fretboard
            inst={inst}
            settings={settings}
            window={win}
            marks={marks}
            requiredString={question?.kind === 'staff>fretboard' ? question.constraints.requiredString : undefined}
            pendingString={keyString}
            onCellClick={!isStaffQ ? onCellClick : undefined}
            disabled={!!view || isStaffQ}
          />
          {micUsable && (
            <div className="mic-toggle">
              {micOn ? (
                <>
                  <span className="mic-heard">🎤 Toque a nota no violão{heard && view ? ` — ouvi ${heard}` : ''}</span>
                  <button type="button" className="btn-ghost" onClick={() => mic.stop()}>Voltar ao clique</button>
                </>
              ) : (
                <button type="button" onClick={() => void mic.start(settings.micDeviceId || undefined)}>
                  🎤 Responder tocando no violão
                </button>
              )}
              {micState.error && <span className="warn small">{micState.error}</span>}
            </div>
          )}
          <p className="kbd-hint">
            {isStaffQ ? (
              <>
                Teclado: letra da nota (<kbd>C</kbd>…<kbd>B</kbd>), <kbd>↑</kbd>/<kbd>↓</kbd> oitava, <kbd>#</kbd> <kbd>-</kbd> <kbd>=</kbd> acidentes, <kbd>Enter</kbd>.
              </>
            ) : (
              <>
                Teclado: corda <kbd>1</kbd>–<kbd>6</kbd>, depois a casa, <kbd>Enter</kbd>.
                {keyString !== null && (
                  <span className="kbd-buffer">
                    {' '}
                    → corda {keyString}
                    {keyFret !== '' ? `, casa ${keyFret}` : ''}
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        <aside className="train-side">
          <div className={`feedback${view ? (view.correct ? ' is-ok' : ' is-bad') : ''}`} aria-live="polite">
            {!view && <p className="muted">{isStaffQ ? 'Responda na pauta.' : 'Responda no braço.'}</p>}
            {view && (
              <>
                <p className="feedback-title">
                  {view.correct ? 'Correto' : view.error === 'OUT_OF_CONSTRAINTS' ? 'Nota certa, região errada' : 'Incorreto'}
                  <span className="rt">{secs(view.rtMs)}</span>
                </p>
                {view.error && view.error !== 'OUT_OF_CONSTRAINTS' && <p className="err-code">{ERROR_LABEL[view.error]}</p>}
                <ul>
                  {view.explanation.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
                {!finished && (
                  <button type="button" className="btn-primary" onClick={next}>
                    Próxima (Enter)
                  </button>
                )}
              </>
            )}
          </div>

          <div className="session-stats">
            <div>
              <span className="big">{stats.n ? Math.round((100 * stats.ok) / stats.n) : 0}%</span>
              <span className="muted">acerto ({stats.ok}/{stats.n})</span>
            </div>
            <div>
              <span className="big">{secs(stats.median)}</span>
              <span className="muted">tempo mediano</span>
            </div>
          </div>

          {finished && (
            <div className="summary">
              <h2>Sessão concluída</h2>
              {summary?.(results)}
              {stats.errors.length > 0 ? (
                <ul>
                  {stats.errors.map(([code, count]) => (
                    <li key={code}>
                      {ERROR_LABEL[code]}: {count}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhum erro.</p>
              )}
              <button type="button" className="btn-primary" onClick={() => exit(true)}>
                Voltar (Enter)
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
