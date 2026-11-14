import { useEffect, useMemo, useRef, useState } from 'react';
import { createRng, randomSeed } from '../core/exercise/rng';
import { locationLabel } from '../core/exercise/explain';
import { locationsFor, makeGuitar, soundingAt, type FretLocation } from '../core/instrument/instrument';
import {
  intervalBetween,
  intervalCode,
  intervalName,
  intervalSemitones,
  intervalsUpTo,
  isPerfectClass,
  qualityName,
  transpose,
  type Interval,
  type Quality,
} from '../core/theory/intervals';
import { asSounding, pitchName, writtenMidiOf, writtenToSounding, type SpelledPitch } from '../core/theory/pitch';
import { isSimpleSpelling } from '../core/theory/spelling';
import { db, localDay } from '../data/db';
import type { Settings } from '../data/settings';
import Fretboard, { type Mark } from './Fretboard';
import Staff from './Staff';
import { ReviewBanner, useReviewQueue, type ReviewProps } from './review';
import { parseIntervalCode } from '../core/theory/intervals';

/**
 * Módulo F — intervalos (§6.6): reconhecer na pauta e localizar no braço.
 * A execução pelo microfone entra na Fase 4.
 */
type Mode = 'name' | 'locate';
type Dir = 'asc' | 'desc' | 'both';

interface Question {
  readonly seed: number;
  readonly a: SpelledPitch;
  readonly b: SpelledPitch;
  readonly iv: Interval;
  readonly dir: 'asc' | 'desc';
  /** Para "localizar": onde está a primeira nota. */
  readonly start: FretLocation;
}

const LEVEL_TEXT = ['2ªs e 3ªs', '+ 4ª, 5ª e 8ª justas', '+ 6ªs e 7ªs', '+ aumentados e diminutos'];
const LETTERS_POOL = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

function makeQuestion(level: number, dir: Dir, inst: ReturnType<typeof makeGuitar>, seed: number, forced?: { iv: Interval; dir: 'asc' | 'desc' }): Question {
  const rng = createRng(seed);
  const ivs = intervalsUpTo(level);
  for (let tries = 0; tries < 400; tries++) {
    const iv = forced?.iv ?? rng.pick(ivs);
    const d = forced?.dir ?? (dir === 'both' ? (rng.next() < 0.5 ? 'asc' : 'desc') : dir);
    const a: SpelledPitch = { letter: rng.pick(LETTERS_POOL), alter: rng.pick([0, 0, 0, 1, -1] as const), octave: rng.int(3, 5) };
    if (!isSimpleSpelling(a)) continue;
    let b: SpelledPitch;
    try {
      b = transpose(a, iv, d);
    } catch {
      continue;
    }
    if (!isSimpleSpelling(b) && Math.abs(b.alter) > 1) continue;
    const sa = writtenToSounding(writtenMidiOf(a), inst.transposition);
    const sb = writtenToSounding(writtenMidiOf(b), inst.transposition);
    const la = locationsFor(sa, inst).filter((l) => l.fret <= 12);
    if (!la.length || !locationsFor(sb, inst).length) continue;
    // escolhe um início que permita achar a 2ª nota perto (desenho na mão)
    const near = la.filter((l) => nearbyLocations(sb, l, inst).length > 0);
    if (!near.length) continue;
    return { seed, a, b, iv, dir: d, start: rng.pick(near) };
  }
  throw new Error('Sem intervalo possível');
}

/** Locais da 2ª nota a até 2 cordas e 5 casas da 1ª — o "desenho" do intervalo. */
function nearbyLocations(s: number, from: FretLocation, inst: ReturnType<typeof makeGuitar>): FretLocation[] {
  return locationsFor(asSounding(s), inst).filter((l) => Math.abs(l.string - from.string) <= 2 && Math.abs(l.fret - from.fret) <= 5);
}

function shapeHint(from: FretLocation, to: FretLocation): string {
  const ds = from.string - to.string; // positivo = corda mais aguda
  const df = to.fret - from.fret;
  const strings = ds === 0 ? 'mesma corda' : `${Math.abs(ds)} corda${Math.abs(ds) > 1 ? 's' : ''} ${ds > 0 ? 'acima (mais aguda)' : 'abaixo (mais grave)'}`;
  const frets = df === 0 ? 'mesma casa' : `${Math.abs(df)} casa${Math.abs(df) > 1 ? 's' : ''} ${df > 0 ? 'à frente' : 'atrás'}`;
  const crossesGB = (from.string >= 3 && to.string <= 2) || (from.string <= 2 && to.string >= 3);
  return `Desenho: ${strings}, ${frets}.${crossesGB && ds !== 0 ? ' Atravessa o par Sol–Si (3ª maior em vez de 4ª justa): o desenho se desloca 1 casa.' : ''}`;
}

function logInterval(kcId: string, correct: boolean, rtMs: number, choice: string) {
  const now = Date.now();
  db.attempts
    .add({ ts: now, day: localDay(now), module: 'F', kcId, direction: 'interval', seed: 0, correct, score: correct ? 1 : 0, errorCode: null, rtMs, inputMethod: 'mouse', answer: { choice }, written: '', sessionId: 'intervals' })
    .catch(() => undefined);
}

export default function IntervalsPage({ settings, review, onReviewDone }: { settings: Settings } & ReviewProps) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const [mode, setMode] = useState<Mode>('name');
  const [level, setLevel] = useState(1);
  const [dir, setDir] = useState<Dir>('asc');
  const [q, setQ] = useState<Question>(() => makeQuestion(1, 'asc', inst, randomSeed()));
  const [num, setNum] = useState<number | null>(null);
  const [answer, setAnswer] = useState<{ correct: boolean; text: string; loc?: FretLocation } | null>(null);
  const [score, setScore] = useState({ n: 0, ok: 0 });
  const shownAt = useRef(performance.now());
  const opts = { naming: settings.naming, octaves: settings.octaves };
  const rq = useReviewQueue(review);

  const show = (question: Question) => {
    setQ(question);
    setNum(null);
    setAnswer(null);
    shownAt.current = performance.now();
  };
  const regenerate = () => show(makeQuestion(level, dir, inst, randomSeed()));
  const next = () => (rq.active ? rq.advance() : regenerate());

  // prática livre: muda de configuração → nova questão (fora da revisão)
  useEffect(() => {
    if (!rq.active) regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, dir, mode, inst]);

  // revisão: cada item vencido vira uma questão forçada (mesmo intervalo, direção e tipo)
  useEffect(() => {
    if (!rq.current) {
      if (rq.finished) regenerate();
      return;
    }
    const [prefix, code, d] = rq.current.split(':');
    const iv = parseIntervalCode(code!);
    if (!iv) return rq.advance();
    setMode(prefix === 'intb' ? 'locate' : 'name');
    show(makeQuestion(4, dir, inst, randomSeed(), { iv, dir: d === 'desc' ? 'desc' : 'asc' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rq.current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (answer && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      } else if (!answer && mode === 'name' && /^[2-8]$/.test(e.key)) setNum(Number(e.key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const record = (correct: boolean, text: string, choice: string, loc?: FretLocation) => {
    setAnswer({ correct, text, loc });
    setScore((s) => ({ n: s.n + 1, ok: s.ok + (correct ? 1 : 0) }));
    logInterval(`${mode === 'name' ? 'int' : 'intb'}:${intervalCode(q.iv)}:${q.dir}`, correct, Math.round(performance.now() - shownAt.current), choice);
  };

  const chooseQuality = (quality: Quality) => {
    if (answer || num === null) return;
    const chosen: Interval = { number: num, quality };
    const correct = intervalCode(chosen) === intervalCode(q.iv);
    const m = intervalBetween(q.a, q.b);
    record(
      correct,
      `${pitchName(q.a, opts)} → ${pitchName(q.b, opts)}: ${intervalName(q.iv)} ${q.dir === 'asc' ? 'ascendente' : 'descendente'} (${m.semitones} ${m.semitones === 1 ? 'semitom' : 'semitons'}). Contam-se as letras (${q.iv.number} notas) para o número; os semitons dão a qualidade.`,
      intervalCode(chosen),
    );
  };

  const onLocate = (loc: FretLocation) => {
    if (answer) return;
    const target = writtenToSounding(writtenMidiOf(q.b), inst.transposition);
    const got = soundingAt(loc, inst);
    const correct = got === target;
    const best = nearbyLocations(target, q.start, inst).sort((x, y) => Math.abs(x.fret - q.start.fret) + Math.abs(x.string - q.start.string) - (Math.abs(y.fret - q.start.fret) + Math.abs(y.string - q.start.string)))[0];
    record(
      correct,
      `${intervalName(q.iv)} ${q.dir === 'asc' ? 'acima' : 'abaixo'} de ${pitchName(q.a, opts)} = ${pitchName(q.b, opts)} (${intervalSemitones(q.iv)} ${intervalSemitones(q.iv) === 1 ? 'semitom' : 'semitons'}).${best ? ` Mais perto: ${locationLabel(best)}. ${shapeHint(q.start, best)}` : ''}`,
      `${loc.string}:${loc.fret}`,
      loc,
    );
  };

  const qualities: Quality[] = num === null ? [] : isPerfectClass(num) ? ['d', 'P', 'A'] : ['d', 'm', 'M', 'A'];
  const staffNotes = mode === 'name' || answer ? [
    { pitch: q.a, accidental: q.a.alter !== 0 ? q.a.alter : null },
    { pitch: q.b, accidental: q.b.alter !== 0 ? q.b.alter : null, tone: answer ? (answer.correct ? ('ok' as const) : ('bad' as const)) : undefined },
  ] : [{ pitch: q.a, accidental: q.a.alter !== 0 ? q.a.alter : null }];

  const marks: Mark[] = [];
  if (mode === 'locate') {
    marks.push({ loc: q.start, kind: 'selected', label: '1' });
    if (answer?.loc) marks.push({ loc: answer.loc, kind: answer.correct ? 'correct' : 'wrong' });
    if (answer && !answer.correct) {
      for (const l of nearbyLocations(writtenToSounding(writtenMidiOf(q.b), inst.transposition), q.start, inst)) marks.push({ loc: l, kind: 'valid' });
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Intervalos</h1>
        <p className="muted">Módulo F — a qualidade depende da grafia: Dó–Ré♯ é 2ª aumentada; Dó–Mi♭ é 3ª menor.</p>
      </header>
      <ReviewBanner q={rq} naming={settings.naming} onExit={onReviewDone} />

      <div className="config-grid">
        <fieldset>
          <legend>Exercício</legend>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Exercício">
            <option value="name">Pauta → nome do intervalo</option>
            <option value="locate">Nome → localizar no braço</option>
          </select>
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Nível">
            {LEVEL_TEXT.map((t, i) => (
              <option key={i} value={i + 1}>Nível {i + 1}: {t}</option>
            ))}
          </select>
          <select value={dir} onChange={(e) => setDir(e.target.value as Dir)} aria-label="Direção">
            <option value="asc">Ascendentes</option>
            <option value="desc">Descendentes</option>
            <option value="both">Os dois</option>
          </select>
        </fieldset>
      </div>

      <div className="train-stage">
        <p className="prompt">
          <span className="tag">
            {mode === 'name'
              ? 'Qual é o intervalo?'
              : `Encontre a ${intervalName(q.iv)} ${q.dir === 'asc' ? 'acima' : 'abaixo'} da nota marcada (perto dela)`}
          </span>
        </p>
        <Staff fifths={0} notes={staffNotes} label="Intervalo" />

        {mode === 'name' && !answer && (
          <div className="iv-answer">
            <div className="actions answer-row" role="group" aria-label="Número">
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button key={n} type="button" className={num === n ? 'chip is-on' : 'chip'} onClick={() => setNum(n)}>
                  {n === 8 ? '8ª' : `${n}ª`}
                </button>
              ))}
            </div>
            <div className="actions answer-row" role="group" aria-label="Qualidade">
              {qualities.map((ql) => (
                <button key={ql} type="button" onClick={() => chooseQuality(ql)}>
                  {qualityName(ql)}
                </button>
              ))}
              {num === null && <span className="muted small">escolha o número (teclas 2–8)</span>}
            </div>
          </div>
        )}

        {mode === 'locate' && <Fretboard inst={inst} settings={settings} window={null} marks={marks} onCellClick={(l) => onLocate(l)} disabled={!!answer} />}

        {answer && (
          <div className={`feedback ${answer.correct ? 'is-ok' : 'is-bad'}`}>
            <p className="feedback-title">{answer.correct ? 'Correto' : 'Incorreto'}</p>
            <p>{answer.text}</p>
            <button type="button" className="btn-primary" onClick={next}>Próximo (Enter)</button>
          </div>
        )}
        <p className="muted small">Nesta série: {score.ok}/{score.n}</p>
      </div>
    </section>
  );
}
