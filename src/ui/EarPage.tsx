import { useEffect, useMemo, useState } from 'react';
import { cadence, harmonic, melodic, playEvents, stopPlayback, type PlayEvent } from '../audio/player';
import { randomSeed } from '../core/exercise/rng';
import { DEGREE_LABEL, makeChordEarQuestion, makeDegreeQuestion, makeDictation, makeIntervalEarQuestion } from '../core/harmony/ear';
import { locationsFor, makeGuitar, soundingAt, type FretLocation } from '../core/instrument/instrument';
import { QUALITY_LABEL } from '../core/theory/chords';
import { intervalName, parseIntervalCode } from '../core/theory/intervals';
import { asSounding, pitchName } from '../core/theory/pitch';
import { preferredSpelling } from '../core/theory/spelling';
import { db, localDay } from '../data/db';
import type { Settings } from '../data/settings';
import Fretboard, { type Mark } from './Fretboard';
import { ReviewBanner, useReviewQueue, type ReviewProps } from './review';
import type { ChordQuality } from '../core/theory/chords';

/**
 * Módulo H — percepção (§6.8). Todo som é sintetizado localmente (funciona offline).
 */
type Mode = 'degree' | 'interval' | 'chord' | 'dictation';

function logEar(kcId: string, correct: boolean, choice: string) {
  const now = Date.now();
  db.attempts
    .add({ ts: now, day: localDay(now), module: 'H', kcId, direction: 'ear', seed: 0, correct, score: correct ? 1 : 0, errorCode: null, rtMs: 0, inputMethod: 'mouse', answer: { choice }, written: '', sessionId: 'ear' })
    .catch(() => undefined);
}

export default function EarPage({ settings, review, onReviewDone }: { settings: Settings } & ReviewProps) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const [mode, setMode] = useState<Mode>('degree');
  const [level, setLevel] = useState(2);
  const [seed, setSeed] = useState(randomSeed);
  const [answer, setAnswer] = useState<{ ok: boolean; text: string } | null>(null);
  const [score, setScore] = useState({ n: 0, ok: 0 });
  const [dict, setDict] = useState<FretLocation[]>([]);
  const naming = { naming: settings.naming, octaves: settings.octaves };
  const name = (m: number) => pitchName(preferredSpelling(m), naming);
  const rq = useReviewQueue(review);
  const forced = rq.current?.split(':') ?? null; // ex.: ['ouvido-int', 'M3', 'harmonic']

  // perguntas derivadas da semente (reprodutíveis); na revisão, forçadas pelo item vencido
  const degreeQ = useMemo(
    () => makeDegreeQuestion(seed, forced?.[0] === 'grau' ? [Number(forced[1]) - 1] : level <= 1 ? [0, 2, 4] : level === 2 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, level, rq.current],
  );
  const intervalQ = useMemo(() => {
    const iv = forced?.[0] === 'ouvido-int' ? parseIntervalCode(forced[1]!) : null;
    const m = forced?.[2] === 'desc' || forced?.[2] === 'harmonic' ? forced[2] : 'asc';
    return makeIntervalEarQuestion(seed, Math.min(4, level + 1), level <= 2 ? ['asc'] : ['asc', 'desc', 'harmonic'], iv ? { interval: iv, mode: m } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, level, rq.current]);
  const chordQ = useMemo(
    () => makeChordEarQuestion(seed, level <= 2 ? 'triads' : 'tetrads', forced?.[0] === 'ouvido-acorde' ? (forced[1] as ChordQuality) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, level, rq.current],
  );
  const dictQ = useMemo(
    () => makeDictation(seed, forced?.[0] === 'ditado' ? Number(forced[1]) : Math.min(5, level + 2)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, level, rq.current],
  );

  // revisão: o tipo de exercício segue o item atual
  useEffect(() => {
    if (!forced) return;
    const m: Record<string, Mode> = { grau: 'degree', 'ouvido-int': 'interval', 'ouvido-acorde': 'chord', ditado: 'dictation' };
    const target = m[forced[0]!];
    if (!target) return rq.advance();
    setMode(target);
    setSeed(randomSeed());
    setAnswer(null);
    setDict([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rq.current]);

  const events = (): PlayEvent[] => {
    switch (mode) {
      case 'degree':
        return [...cadence(degreeQ.tonic), { midi: degreeQ.midi, at: 3.6, dur: 1.4 }];
      case 'interval':
        return intervalQ.mode === 'harmonic'
          ? harmonic([intervalQ.low, intervalQ.high], 0, 1.8, 0)
          : melodic(intervalQ.mode === 'asc' ? [intervalQ.low, intervalQ.high] : [intervalQ.high, intervalQ.low], 0.8);
      case 'chord':
        return harmonic(chordQ.midis, 0, 2);
      case 'dictation':
        return [...cadence(dictQ.tonic), ...melodic(dictQ.midis, 0.7).map((e) => ({ ...e, at: e.at + 3.6 }))];
    }
  };
  const play = () => void playEvents(events(), settings.aRef);

  const next = () => {
    if (rq.active) return rq.advance();
    setSeed(randomSeed());
    setAnswer(null);
    setDict([]);
  };
  // toca automaticamente cada pergunta nova
  useEffect(() => {
    play();
    return stopPlayback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, mode, level]);

  const record = (ok: boolean, kc: string, choice: string, text: string) => {
    setAnswer({ ok, text });
    setScore((s) => ({ n: s.n + 1, ok: s.ok + (ok ? 1 : 0) }));
    logEar(kc, ok, choice);
  };

  const onDictClick = (loc: FretLocation) => {
    if (answer) return;
    const sel = [...dict, loc];
    setDict(sel);
    void playEvents([{ midi: soundingAt(loc, inst), at: 0, dur: 0.6 }], settings.aRef);
    if (sel.length === dictQ.midis.length) {
      const got = sel.map((l) => soundingAt(l, inst));
      const ok = got.every((m, i) => m === dictQ.midis[i]);
      const hits = got.filter((m, i) => m === dictQ.midis[i]).length;
      record(ok, `ditado:${dictQ.midis.length}`, got.join(' '), `${hits}/${dictQ.midis.length} notas certas. A melodia era: ${dictQ.midis.map(name).join(' – ')} (soantes).`);
    }
  };

  const dictMarks: Mark[] = [
    ...dict.map((loc, i) => ({ loc, kind: (answer ? (soundingAt(loc, inst) === dictQ.midis[i] ? 'correct' : 'wrong') : 'selected') as Mark['kind'], label: String(i + 1) })),
    ...(dict.length === 0 ? locationsFor(asSounding(dictQ.tonic), inst).filter((l) => l.fret <= 12).map((loc) => ({ loc, kind: 'muted' as const, label: '1' })) : []),
  ];

  return (
    <section className="page">
      <header className="page-head">
        <h1>Treinamento auditivo</h1>
        <p className="muted">Módulo H — ouvir em contexto tonal, reconhecer intervalos e acordes, e escrever no braço o que você ouve.</p>
      </header>
      <ReviewBanner q={rq} naming={settings.naming} onExit={onReviewDone} />

      <div className="config-grid compact">
        <select value={mode} onChange={(e) => { setMode(e.target.value as Mode); next(); }} aria-label="Exercício">
          <option value="degree">Grau da escala (após cadência)</option>
          <option value="interval">Intervalos</option>
          <option value="chord">Qualidade do acorde</option>
          <option value="dictation">Ditado melódico no braço</option>
        </select>
        <select value={level} onChange={(e) => { setLevel(Number(e.target.value)); next(); }} aria-label="Nível">
          <option value={1}>Nível 1</option>
          <option value={2}>Nível 2</option>
          <option value={3}>Nível 3</option>
          <option value={4}>Nível 4</option>
        </select>
        <button type="button" onClick={play}>🔊 Ouvir de novo</button>
      </div>

      <div className="train-stage">
        {mode === 'degree' && (
          <>
            <p className="prompt"><span className="tag">Depois da cadência, qual grau soou?</span></p>
            <div className="actions answer-row">
              {DEGREE_LABEL.map((l, d) => (
                <button
                  key={d}
                  type="button"
                  disabled={!!answer}
                  className={answer ? (d === degreeQ.degree ? 'is-right' : '') : ''}
                  onClick={() => record(d === degreeQ.degree, `grau:${degreeQ.degree + 1}`, String(d + 1), `Era o grau ${DEGREE_LABEL[degreeQ.degree]} (${name(degreeQ.midi)} na tonalidade de ${name(degreeQ.tonic).replace(/\d+$/, '')} maior).`)}
                >
                  {l}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === 'interval' && (
          <>
            <p className="prompt">
              <span className="tag">Qual intervalo? ({intervalQ.mode === 'harmonic' ? 'harmônico' : intervalQ.mode === 'asc' ? 'ascendente' : 'descendente'})</span>
            </p>
            <div className="actions answer-row">
              {intervalQ.options.map((code) => {
                const iv = parseIntervalCode(code)!;
                const right = code === `${intervalQ.interval.quality}${intervalQ.interval.number}`;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={!!answer}
                    className={answer && right ? 'is-right' : ''}
                    onClick={() => record(right, `ouvido-int:${code}:${intervalQ.mode}`, code, `Era ${intervalName(intervalQ.interval)} (${name(intervalQ.low)} e ${name(intervalQ.high)}).`)}
                  >
                    {intervalName(iv)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {mode === 'chord' && (
          <>
            <p className="prompt"><span className="tag">Que tipo de acorde soou?</span></p>
            <div className="actions answer-row">
              {chordQ.options.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={!!answer}
                  className={answer && q === chordQ.quality ? 'is-right' : ''}
                  onClick={() => record(q === chordQ.quality, `ouvido-acorde:${chordQ.quality}`, q, `Era ${QUALITY_LABEL[chordQ.quality]} (fundamental ${name(chordQ.root)}).`)}
                >
                  {QUALITY_LABEL[q]}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === 'dictation' && (
          <>
            <p className="prompt">
              <span className="tag">Toque no braço as {dictQ.midis.length} notas que ouviu, em ordem. A 1ª é a tônica (marcada).</span>
            </p>
            <Fretboard inst={inst} settings={settings} window={null} marks={dictMarks} onCellClick={answer ? undefined : onDictClick} disabled={!!answer} />
            <div className="actions center">
              <button type="button" disabled={!dict.length || !!answer} onClick={() => setDict((d) => d.slice(0, -1))}>Desfazer</button>
            </div>
          </>
        )}

        {answer && (
          <div className={`feedback ${answer.ok ? 'is-ok' : 'is-bad'}`}>
            <p className="feedback-title">{answer.ok ? 'Correto' : 'Incorreto'}</p>
            <p>{answer.text}</p>
            <div className="actions">
              <button type="button" onClick={play}>Ouvir de novo</button>
              <button type="button" className="btn-primary" onClick={next}>Próximo</button>
            </div>
          </div>
        )}
        <p className="muted small">Nesta série: {score.ok}/{score.n}</p>
      </div>
    </section>
  );
}
