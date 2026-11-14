import { useCallback, useEffect, useMemo, useState } from 'react';
import { locationLabel } from '../core/exercise/explain';
import type { NoteQuestion } from '../core/exercise/noteQuestion';
import { buildPositionTest, evaluatePositionTest, PASS_ACCURACY, PASS_MEDIAN_MS, POSITION_TEST_SIZE, type PositionTestOutcome } from '../core/exercise/positionTest';
import { randomSeed } from '../core/exercise/rng';
import { locationsFor, makeGuitar } from '../core/instrument/instrument';
import { fingerFor, fixedPosition, fretWindow, inPosition, OPEN_POSITION, positionKey, positionLabel, roman, type PositionSpec } from '../core/instrument/position';
import { asSounding, pitchName } from '../core/theory/pitch';
import { preferredSpelling } from '../core/theory/spelling';
import { db, type PositionTestRecord } from '../data/db';
import type { Settings } from '../data/settings';
import Fretboard, { type Mark } from './Fretboard';
import { secs } from './format';
import Staff from './Staff';
import ReadingSession from './ReadingSession';
import TrainingSession, { type SessionResult } from './TrainingSession';
import { generateMelody, type Melody, type MelodyConfig } from '../core/melody/melody';

/** Cada frase do teste precisa de ≥ 90 % de notas certas na 1ª tentativa. */
const PHRASE_PASS = 0.9;

/**
 * Módulo C — aula, mapa e teste de conclusão de cada posição. Especificação §6.3.
 */
export default function PositionsPage({ settings }: { settings: Settings }) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const [choice, setChoice] = useState<number>(2); // 0 = aberta
  const [stretch1, setStretch1] = useState(false);
  const [stretch4, setStretch4] = useState(false);
  const [test, setTest] = useState<{ key: number; questions: NoteQuestion[] } | null>(null);
  const [outcome, setOutcome] = useState<PositionTestOutcome | null>(null);
  const [history, setHistory] = useState<PositionTestRecord[]>([]);

  const spec: PositionSpec = useMemo(() => (choice === 0 ? OPEN_POSITION : fixedPosition(choice, { stretch1, stretch4 })), [choice, stretch1, stretch4]);
  const win = fretWindow(spec, inst.frets);
  const pKey = positionKey(spec);

  const loadHistory = useCallback(() => {
    db.positionTests.where('positionKey').equals(pKey).reverse().sortBy('ts').then(setHistory).catch(() => setHistory([]));
  }, [pKey]);
  useEffect(() => {
    loadHistory();
    setOutcome(null);
  }, [loadHistory]);

  const notes = useMemo(() => {
    const out: { midi: number; locs: ReturnType<typeof locationsFor> }[] = [];
    for (let m = 40; m <= 40 + 24 + inst.frets; m++) {
      const locs = locationsFor(asSounding(m), inst).filter((l) => inPosition(l, spec, inst.frets));
      if (locs.length) out.push({ midi: m, locs });
    }
    return out;
  }, [inst, spec]);

  const staffNotes = useMemo(() => {
    const written = (m: number) => preferredSpelling(m - inst.transposition);
    const ends = [notes[0], notes[notes.length - 1]].filter((n): n is (typeof notes)[number] => !!n);
    return ends.map((n) => {
      const p = written(n.midi);
      return { pitch: p, accidental: p.alter !== 0 ? p.alter : null };
    });
  }, [notes, inst.transposition]);

  const nextQuestion = useCallback((_prev: unknown, index: number) => test?.questions[index] ?? null, [test]);

  // Etapa 2 do teste: 2 frases na posição (modo estático), depois das 40 notas.
  const [phrases, setPhrases] = useState<{ notes: PositionTestOutcome; sessionId: string; melodies: Melody[]; index: number; results: number[] } | null>(null);

  const save = useCallback(
    (o: PositionTestOutcome, sessionId: string, phraseAccuracy: number | null) => {
      const passed = o.passed && phraseAccuracy !== null && phraseAccuracy >= PHRASE_PASS;
      setOutcome({ ...o, passed });
      setPhraseResult(phraseAccuracy);
      db.positionTests
        .add({ ts: Date.now(), positionKey: pKey, label: positionLabel(spec), total: o.total, correct: o.correct, accuracy: o.accuracy, medianMs: o.medianMs, passed, sessionId, phraseAccuracy })
        .then(loadHistory)
        .catch(() => undefined);
    },
    [pKey, spec, loadHistory],
  );
  const [phraseResult, setPhraseResult] = useState<number | null>(null);

  const onExit = useCallback(
    (results: SessionResult[], sessionId: string, completed: boolean) => {
      setTest(null);
      if (!completed || results.length < POSITION_TEST_SIZE) return;
      const o = evaluatePositionTest(results);
      try {
        const seed = randomSeed();
        const cfg: MelodyConfig = { fifths: 0, region: spec, strings: [1, 2, 3, 4, 5, 6], measures: 4, beats: 4, rhythmLevel: 0, maxLeap: 2, chromatic: false };
        const melodies = [generateMelody(cfg, inst, seed), generateMelody({ ...cfg, rhythmLevel: 1 }, inst, seed + 1)];
        setPhrases({ notes: o, sessionId, melodies, index: 0, results: [] });
      } catch {
        save(o, sessionId, null);
      }
    },
    [spec, inst, save],
  );

  if (phrases) {
    const m = phrases.melodies[phrases.index]!;
    return (
      <section className="page">
        <header className="train-head">
          <div>
            <strong>Teste de conclusão</strong> · {positionLabel(spec)} · etapa 2: frase {phrases.index + 1} de {phrases.melodies.length}
          </div>
          <button type="button" className="btn-ghost" onClick={() => { save(phrases.notes, phrases.sessionId, null); setPhrases(null); }}>
            Encerrar
          </button>
        </header>
        <ReadingSession
          key={`${phrases.sessionId}-${phrases.index}`}
          melody={m}
          mode="static"
          bpm={60}
          inst={inst}
          settings={settings}
          module="C"
          continueLabel={phrases.index + 1 < phrases.melodies.length ? 'Próxima frase' : 'Ver resultado'}
          onDone={(r) => {
            const results = [...phrases.results, r.summary.notesInTime];
            if (phrases.index + 1 < phrases.melodies.length) setPhrases({ ...phrases, index: phrases.index + 1, results });
            else {
              save(phrases.notes, phrases.sessionId, Math.min(...results));
              setPhrases(null);
            }
          }}
        />
      </section>
    );
  }

  if (test) {
    return (
      <TrainingSession
        key={test.key}
        inst={inst}
        settings={settings}
        fifths={0}
        window={win}
        module="C"
        title={
          <>
            <strong>Teste de conclusão</strong> · {positionLabel(spec)}
          </>
        }
        total={test.questions.length}
        nextQuestion={nextQuestion}
        sessionConfig={{ positionTest: pKey }}
        onExit={onExit}
        summary={(r) => <OutcomeLine o={evaluatePositionTest(r)} />}
      />
    );
  }

  const marks: Mark[] = notes.flatMap((n) => n.locs.map((loc) => ({ loc, kind: 'valid' as const, label: String(fingerFor(loc, spec, inst.frets) ?? '') })));
  const written = (m: number) => preferredSpelling(m - inst.transposition);
  const dupes = notes.filter((n) => n.locs.length > 1);
  const lowest = notes[0];
  const highest = notes[notes.length - 1];
  const best = history.find((h) => h.passed);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Treinamento por posição</h1>
        <p className="muted">Módulo C — mapa e teste de cada posição segundo o sistema de William Leavitt.</p>
      </header>

      <div className="config-grid">
        <fieldset>
          <legend>Posição</legend>
          <select value={choice} onChange={(e) => setChoice(Number(e.target.value))} aria-label="Posição">
            <option value={0}>Posição aberta</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {roman(p)} posição
              </option>
            ))}
          </select>
          {choice > 0 && (
            <div className="checks">
              <label><input type="checkbox" checked={stretch1} onChange={(e) => setStretch1(e.target.checked)} /> Abertura do dedo 1 (casa {choice - 1})</label>
              <label><input type="checkbox" checked={stretch4} onChange={(e) => setStretch4(e.target.checked)} /> Abertura do dedo 4 (casa {choice + 4})</label>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>Teste de conclusão</legend>
          <p className="small muted">
            {POSITION_TEST_SIZE} notas (todas as cordas, com acidentes). Aprovação: acerto ≥ {Math.round(PASS_ACCURACY * 100)}% e tempo mediano ≤ {secs(PASS_MEDIAN_MS)}.
            Depois, 2 frases curtas na posição: cada uma com ≥ {Math.round(PHRASE_PASS * 100)}% das notas certas na 1ª tentativa.
          </p>
          <div className="actions">
            <button type="button" className="btn-primary" onClick={() => setTest({ key: Date.now(), questions: buildPositionTest(spec, inst, randomSeed()) })}>
              Fazer o teste
            </button>
            {best ? <span className="badge is-ok">Concluída</span> : history.length > 0 ? <span className="badge">Ainda não aprovada</span> : null}
          </div>
          {outcome && <OutcomeLine o={outcome} />}
          {outcome && (
            <p className="small">
              Frases: {phraseResult === null ? 'não concluídas' : `pior frase com ${Math.round(phraseResult * 100)}% certas`}.
            </p>
          )}
          {history.length > 0 && (
            <table className="small">
              <tbody>
                {history.slice(0, 5).map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.ts).toLocaleDateString('pt-BR')}</td>
                    <td className="num">{Math.round(h.accuracy * 100)}%</td>
                    <td className="num">{secs(h.medianMs)}</td>
                    <td className="num">{h.phraseAccuracy === undefined ? '' : h.phraseAccuracy === null ? 'frases –' : `frases ${Math.round(h.phraseAccuracy * 100)}%`}</td>
                    <td>{h.passed ? '✓ aprovado' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </fieldset>
      </div>

      <article className="lesson">
        <h2>{positionLabel(spec)}</h2>
        {choice === 0 ? (
          <p>
            Cordas soltas e dedos 1–4 nas casas 1–4. É a região dos primeiros estudos (no espírito de Sagreras): as cordas soltas servem de âncora.
            Atenção à duplicata clássica: o Si da corda 3, casa 4, soa igual à corda 2 solta.
          </p>
        ) : (
          <p>
            A posição é a casa do dedo 1: aqui, o dedo 1 fica na casa {choice} e os dedos 2, 3 e 4 nas casas seguintes (janela base {win.baseMin}–{win.baseMax}).
            Com aberturas, identifique a posição pelo dedo 2 (casa do dedo 2 − 1). Sem aberturas, cada nota tem um único lugar nesta janela — por isso a
            leitura por posição é tão eficiente.
          </p>
        )}
        {lowest && highest && (
          <p>
            Extensão escrita: <strong>{pitchName(written(lowest.midi), settings)}</strong> a <strong>{pitchName(written(highest.midi), settings)}</strong> ({notes.length} alturas
            diferentes). Os números nas marcas indicam o dedo.
          </p>
        )}
        {dupes.length > 0 && (
          <p className="warn">
            Notas com dois lugares nesta janela: {dupes.map((d) => `${pitchName(written(d.midi), settings)} (${d.locs.map(locationLabel).join(' / ')})`).join('; ')}.
          </p>
        )}
        {staffNotes.length > 0 && (
          <div className="lesson-staff">
            <Staff fifths={0} notes={staffNotes} label="Nota mais grave e mais aguda da posição" />
          </div>
        )}
      </article>

      <Fretboard inst={inst} settings={{ ...settings, showNoteNames: false }} window={win} marks={marks} />
    </section>
  );
}

function OutcomeLine({ o }: { o: PositionTestOutcome }) {
  return (
    <p className={`outcome ${o.passed ? 'is-ok' : 'is-bad'}`}>
      {o.passed ? 'Aprovado' : 'Não aprovado'} — acerto {Math.round(o.accuracy * 100)}% ({o.correct}/{o.total}), tempo mediano{' '}
      {secs(o.medianMs)}.
    </p>
  );
}
