import { useEffect, useMemo, useRef, useState } from 'react';
import { audioContext } from '../audio/metronome';
import { playEvents, stopPlayback, type PlayEvent } from '../audio/player';
import { locationLabel } from '../core/exercise/explain';
import { makeGuitar, type Instrument } from '../core/instrument/instrument';
import type { Melody } from '../core/melody/melody';
import { buildScoreMelody, newScoreId, noteAt, scoreNoteCount, ScoreError, splitIntoMeasures, type ScoreDef, type ScoreNote, type ScoreSource } from '../core/score/score';
import { parseTab } from '../core/score/tab';
import { isCompound, meterLabel, METERS, parseMeter, type Meter } from '../core/rhythm/rhythm';
import { keyLabel } from '../core/theory/keySignature';
import { pitchName } from '../core/theory/pitch';
import { preferredSpelling } from '../core/theory/spelling';
import { db, type ReadingSummary } from '../data/db';
import { readScoreFile } from '../data/scoreFiles';
import type { Settings } from '../data/settings';
import Fretboard from './Fretboard';
import MelodyStaff from './MelodyStaff';
import ReadingModeFieldset, { DEFAULT_READING_OPTIONS, type ReadingOptions } from './ReadingControls';
import ReadingSession from './ReadingSession';

/**
 * Minhas partituras — as músicas e exercícios do próprio aluno, de três jeitos:
 *  1. criar marcando as notas no braço virtual;
 *  2. colar uma tablatura em texto;
 *  3. importar MusicXML (.musicxml/.xml/.mxl) exportado do MuseScore, Guitar Pro etc.
 * Depois, praticar com os mesmos modos da Leitura (estático, contínuo, violão, solfejo).
 */
type View = { kind: 'list' } | { kind: 'editor'; edit?: ScoreDef } | { kind: 'tab' } | { kind: 'file' } | { kind: 'practice'; score: ScoreDef };

const SOURCE_LABEL: Record<ScoreSource, string> = { editor: 'criada no braço', tab: 'tablatura', musicxml: 'MusicXML' };
const KEYS = Array.from({ length: 15 }, (_, i) => i - 7);

function useScores() {
  const [list, setList] = useState<ScoreDef[] | null>(null);
  const reload = () => {
    db.scores
      .orderBy('createdAt')
      .reverse()
      .toArray()
      .then(setList)
      .catch(() => setList([]));
  };
  useEffect(reload, []);
  return { list, reload };
}

/** Pré-visualização da pauta, com a mensagem de erro se não der para montar. */
function usePreview(score: ScoreDef | null, inst: Instrument): { melody: Melody | null; error: string | null } {
  return useMemo(() => {
    if (!score || !score.measures.some((m) => m.some((n) => !n.rest))) return { melody: null, error: null };
    try {
      return { melody: buildScoreMelody(score, inst), error: null };
    } catch (e) {
      return { melody: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [score, inst]);
}

/** Toca a melodia (alturas soantes) num andamento dado. */
function playMelody(m: Melody, bpm: number, aRef: number) {
  const unitSec = 60 / bpm / 4;
  const ev: PlayEvent[] = [];
  for (const e of m.events) {
    if (e.rest || e.sounding === null) continue;
    if (e.tiedFromPrev && ev.length) {
      const last = ev[ev.length - 1]!;
      ev[ev.length - 1] = { ...last, dur: last.dur + e.units * unitSec };
      continue;
    }
    ev.push({ midi: e.sounding, at: e.onsetUnits * unitSec, dur: e.units * unitSec });
  }
  void playEvents(ev, aRef);
}

function MeterKeySelects({ fifths, meter, setFifths, setMeter }: { fifths: number; meter: Meter; setFifths: (f: number) => void; setMeter: (m: Meter) => void }) {
  return (
    <>
      <select value={fifths} onChange={(e) => setFifths(Number(e.target.value))} aria-label="Tonalidade">
        {KEYS.map((f) => (
          <option key={f} value={f}>
            {keyLabel(f)}
          </option>
        ))}
      </select>
      <select value={meterLabel(meter)} onChange={(e) => setMeter(parseMeter(e.target.value) ?? { num: 4, den: 4 })} aria-label="Compasso">
        {METERS.map((m) => (
          <option key={meterLabel(m)} value={meterLabel(m)}>
            {meterLabel(m)}
          </option>
        ))}
      </select>
    </>
  );
}

export default function ScoresPage({ settings }: { settings: Settings }) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const { list, reload } = useScores();

  const save = async (s: ScoreDef) => {
    await db.scores.put(s);
    reload();
    setView({ kind: 'list' });
  };

  return (
    <section className="page">
      <header className="page-head">
        <h1>Minhas partituras</h1>
        <p className="muted">
          Suas músicas e exercícios: crie marcando as notas no braço, cole uma tablatura ou importe um arquivo MusicXML. Depois pratique com os mesmos modos da
          leitura — clicando no braço, tocando no violão ou cantando.
        </p>
      </header>

      {view.kind === 'list' && (
        <>
          <div className="cards">
            <button type="button" className="card card-main" onClick={() => setView({ kind: 'editor' })}>
              <strong>✏️ Criar marcando no braço</strong>
              <span className="muted">Escolha a figura (semínima, colcheia…) e clique as notas no braço virtual. A pauta se escreve sozinha.</span>
            </button>
            <button type="button" className="card" onClick={() => setView({ kind: 'tab' })}>
              <strong>🎸 Colar tablatura</strong>
              <span className="muted">Cole uma tab em texto (de sites de cifras). O app transforma em partitura.</span>
            </button>
            <button type="button" className="card" onClick={() => setView({ kind: 'file' })}>
              <strong>📄 Importar arquivo MusicXML</strong>
              <span className="muted">.musicxml, .xml ou .mxl — exportados do MuseScore (grátis), Guitar Pro, Sibelius, Finale…</span>
            </button>
          </div>

          <h2>Salvas</h2>
          {list === null ? (
            <p className="muted">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="muted">Nenhuma ainda. Comece criando uma no braço ou colando uma tablatura.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Origem</th>
                  <th>Compasso · tonalidade</th>
                  <th className="num">Notas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                    </td>
                    <td>{SOURCE_LABEL[s.source]}</td>
                    <td>
                      {meterLabel(s.meter)} · {keyLabel(s.fifths)}
                    </td>
                    <td className="num">{scoreNoteCount(s)}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="btn-primary" onClick={() => setView({ kind: 'practice', score: s })}>
                          Praticar
                        </button>
                        <button type="button" onClick={() => setView({ kind: 'editor', edit: s })}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            if (confirm(`Excluir "${s.title}"? Isso não pode ser desfeito.`)) void db.scores.delete(s.id).then(reload);
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted small">As partituras ficam neste navegador e entram no backup (Configurações → Exportar backup).</p>
        </>
      )}

      {view.kind === 'editor' && <Editor inst={inst} settings={settings} edit={view.edit} onSave={save} onCancel={() => setView({ kind: 'list' })} />}
      {view.kind === 'tab' && <TabImport inst={inst} settings={settings} onSave={save} onCancel={() => setView({ kind: 'list' })} />}
      {view.kind === 'file' && <FileImport inst={inst} settings={settings} onSave={save} onCancel={() => setView({ kind: 'list' })} />}
      {view.kind === 'practice' && <Practice score={view.score} inst={inst} settings={settings} onBack={() => setView({ kind: 'list' })} />}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 1. Editor: marcar as notas no braço virtual
// ---------------------------------------------------------------------------

const DURATIONS: { units: number; label: string; sym: string }[] = [
  { units: 16, label: 'Semibreve', sym: '𝅝' },
  { units: 8, label: 'Mínima', sym: '𝅗𝅥' },
  { units: 4, label: 'Semínima', sym: '♩' },
  { units: 2, label: 'Colcheia', sym: '♪' },
  { units: 1, label: 'Semicolcheia', sym: '𝅘𝅥𝅯' },
];

/** Junta as figuras ligadas da mesma nota (para reeditar sem "picar" a música). */
function mergeTies(measures: readonly (readonly ScoreNote[])[]): ScoreNote[] {
  const out: ScoreNote[] = [];
  for (const n of measures.flat()) {
    const prev = out[out.length - 1];
    if (prev && prev.tie && !prev.rest && !n.rest && prev.written === n.written) {
      out[out.length - 1] = { ...prev, units: prev.units + n.units, tie: n.tie };
    } else out.push(n);
  }
  return out;
}

function Editor({ inst, settings, edit, onSave, onCancel }: { inst: Instrument; settings: Settings; edit?: ScoreDef; onSave: (s: ScoreDef) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(edit?.title ?? 'Minha música');
  const [fifths, setFifths] = useState(edit?.fifths ?? 0);
  const [meter, setMeter] = useState<Meter>(edit?.meter ?? { num: 4, den: 4 });
  const [units, setUnits] = useState(4);
  const [dotted, setDotted] = useState(false);
  const [notes, setNotes] = useState<ScoreNote[]>(() => (edit ? mergeTies(edit.measures) : []));
  const dur = dotted ? units * 1.5 : units;

  const draft: ScoreDef = useMemo(
    () => ({ id: edit?.id ?? 'rascunho', title, fifths, meter, measures: splitIntoMeasures(notes, meter), source: edit?.source ?? 'editor', createdAt: edit?.createdAt ?? Date.now() }),
    [edit, title, fifths, meter, notes],
  );
  const { melody, error } = usePreview(draft, inst);
  const last = notes[notes.length - 1];

  // atalhos: 1–5 figura, . pontuada, P pausa, Backspace desfaz
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const idx = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (idx >= 0) setUnits(DURATIONS[idx]!.units);
      else if (e.key === '.') setDotted((d) => !d);
      else if (e.key.toLowerCase() === 'p') setNotes((n) => [...n, { units: dur, rest: true, written: null }]);
      else if (e.key === 'Backspace') setNotes((n) => n.slice(0, -1));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dur]);

  return (
    <div className="score-editor">
      <div className="config-grid">
        <fieldset>
          <legend>Música</legend>
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título" placeholder="Título" />
          <MeterKeySelects fifths={fifths} meter={meter} setFifths={setFifths} setMeter={setMeter} />
        </fieldset>
        <fieldset>
          <legend>Figura da próxima nota (teclas 1–5)</legend>
          <div className="actions dur-row" role="group" aria-label="Figura">
            {DURATIONS.map((d) => (
              <button key={d.units} type="button" className={units === d.units ? 'is-selected' : ''} aria-pressed={units === d.units} onClick={() => setUnits(d.units)} title={d.label}>
                <span className="dur-sym">{d.sym}</span> {d.label}
              </button>
            ))}
          </div>
          <label className="small">
            <input type="checkbox" checked={dotted} onChange={(e) => setDotted(e.target.checked)} /> Pontuada (tecla .)
          </label>
        </fieldset>
        <fieldset>
          <legend>Editar</legend>
          <div className="actions">
            <button type="button" onClick={() => setNotes((n) => [...n, { units: dur, rest: true, written: null }])}>
              Pausa (P)
            </button>
            <button type="button" disabled={!last || last.rest} onClick={() => setNotes((n) => n.map((x, i) => (i === n.length - 1 ? { ...x, tie: !x.tie } : x)))}>
              {last?.tie ? 'Desligar' : 'Ligar à próxima'}
            </button>
            <button type="button" disabled={!notes.length} onClick={() => setNotes((n) => n.slice(0, -1))}>
              Desfazer (⌫)
            </button>
            <button type="button" className="btn-ghost" disabled={!notes.length} onClick={() => confirm('Apagar todas as notas?') && setNotes([])}>
              Limpar
            </button>
          </div>
        </fieldset>
      </div>

      <p className="kbd-hint">
        Clique no braço para escrever cada nota com a figura escolhida. {last && !last.rest && last.loc && <>Última: {pitchName(preferredSpelling(last.written!, fifths), { naming: settings.naming, octaves: settings.octaves })} ({locationLabel(last.loc)}).</>}
      </p>
      <Fretboard inst={inst} settings={settings} window={null} marks={last?.loc ? [{ loc: last.loc, kind: 'selected' }] : []} onCellClick={(loc) => setNotes((n) => [...n, noteAt(loc, inst, dur)])} />

      {melody ? <MelodyStaff melody={melody} showFingering label="Pré-visualização" /> : <p className="muted">{error ?? 'A pauta aparece aqui assim que você marcar a primeira nota.'}</p>}

      <div className="actions">
        <button type="button" className="btn-primary" disabled={!melody || !title.trim()} onClick={() => onSave({ ...draft, id: edit?.id ?? newScoreId(), title: title.trim(), createdAt: edit?.createdAt ?? Date.now() })}>
          Salvar
        </button>
        <button type="button" disabled={!melody} onClick={() => melody && playMelody(melody, 80, settings.aRef)}>
          🔊 Ouvir
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Tablatura colada
// ---------------------------------------------------------------------------

const TAB_EXAMPLE = `e|-------0-----|-----------|
B|-----1---1---|---3-------|
G|---2---------|-----2-----|
D|-0-----------|-------0---|
A|-------------|-----------|
E|-------------|-----------|`;

function TabImport({ inst, settings, onSave, onCancel }: { inst: Instrument; settings: Settings; onSave: (s: ScoreDef) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('Tablatura');
  const [fifths, setFifths] = useState(0);
  const [meter, setMeter] = useState<Meter>({ num: 4, den: 4 });
  const [units, setUnits] = useState(4);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { ok: parseTab(text, inst, units, meter), error: null };
    } catch (e) {
      return { ok: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [text, inst, units, meter]);
  const draft: ScoreDef | null = parsed?.ok ? { id: 'rascunho', title, fifths, meter, measures: parsed.ok.measures, source: 'tab', createdAt: Date.now(), warnings: parsed.ok.warnings } : null;
  const { melody, error } = usePreview(draft, inst);

  return (
    <div>
      <div className="config-grid">
        <fieldset>
          <legend>Música</legend>
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título" placeholder="Título" />
          <MeterKeySelects fifths={fifths} meter={meter} setFifths={setFifths} setMeter={setMeter} />
        </fieldset>
        <fieldset>
          <legend>Ritmo (a tab não traz)</legend>
          <select value={units} onChange={(e) => setUnits(Number(e.target.value))} aria-label="Figura">
            <option value={4}>Todas semínimas</option>
            <option value={2}>Todas colcheias</option>
            <option value={8}>Todas mínimas</option>
          </select>
          <p className="muted small">Depois de salvar, use Editar para ajustar figuras, pausas e ligaduras.</p>
        </fieldset>
      </div>
      <label className="small" htmlFor="tabtext">
        Cole a tablatura (blocos de 6 linhas, corda 1 — Mi aguda — em cima):
      </label>
      <textarea id="tabtext" className="tab-text" rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={TAB_EXAMPLE} spellCheck={false} />
      {parsed?.error && <p className="warn">{parsed.error}</p>}
      {error && <p className="warn">{error}</p>}
      {parsed?.ok && (
        <ul className="small muted">
          <li>{parsed.ok.notes} notas lidas.</li>
          {parsed.ok.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {melody && <MelodyStaff melody={melody} showFingering label="Pré-visualização" />}
      <div className="actions">
        <button type="button" className="btn-primary" disabled={!melody || !draft} onClick={() => draft && onSave({ ...draft, id: newScoreId(), title: title.trim() || 'Tablatura', createdAt: Date.now() })}>
          Salvar
        </button>
        <button type="button" disabled={!melody} onClick={() => melody && playMelody(melody, 80, settings.aRef)}>
          🔊 Ouvir
        </button>
        <button type="button" onClick={() => setText(TAB_EXAMPLE)}>
          Usar exemplo
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Arquivo MusicXML
// ---------------------------------------------------------------------------

function FileImport({ inst, settings, onSave, onCancel }: { inst: Instrument; settings: Settings; onSave: (s: ScoreDef) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<ScoreDef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { melody, error: buildError } = usePreview(draft, inst);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    setDraft(null);
    try {
      const s = await readScoreFile(f, inst);
      setDraft({ id: 'rascunho', title: s.title, fifths: s.fifths, meter: s.meter, measures: s.measures, source: 'musicxml', createdAt: Date.now(), warnings: s.warnings });
    } catch (e) {
      setError(e instanceof ScoreError || e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p>
        No <strong>MuseScore</strong> (gratuito): <em>Arquivo → Exportar → MusicXML</em>. No <strong>Guitar Pro</strong>: <em>Arquivo → Exportar → MusicXML</em>. Muitas
        partituras de domínio público também estão disponíveis em MusicXML.
      </p>
      <div className="actions">
        <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Lendo…' : 'Escolher arquivo…'}
        </button>
        <input ref={fileRef} type="file" accept=".musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      {error && <p className="warn">{error}</p>}
      {draft && (
        <>
          <div className="config-grid">
            <fieldset>
              <legend>Música</legend>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Título" />
              <span className="small muted">
                {meterLabel(draft.meter)} · {keyLabel(draft.fifths)} · {draft.measures.length} compassos · {scoreNoteCount(draft)} notas
              </span>
            </fieldset>
          </div>
          {draft.warnings?.length ? (
            <ul className="small muted">
              {draft.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {buildError && <p className="warn">{buildError}</p>}
          {melody && <MelodyStaff melody={melody} showFingering label="Pré-visualização" />}
          <div className="actions">
            <button type="button" className="btn-primary" disabled={!melody} onClick={() => onSave({ ...draft, id: newScoreId(), title: draft.title.trim() || 'Partitura', createdAt: Date.now() })}>
              Salvar
            </button>
            <button type="button" disabled={!melody} onClick={() => melody && playMelody(melody, 80, settings.aRef)}>
              🔊 Ouvir
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Praticar
// ---------------------------------------------------------------------------

function Practice({ score, inst, settings, onBack }: { score: ScoreDef; inst: Instrument; settings: Settings; onBack: () => void }) {
  const { melody, error } = usePreview(score, inst);
  const [opts, setOpts] = useState<ReadingOptions>({ ...DEFAULT_READING_OPTIONS, preRead: 0 });
  const [run, setRun] = useState<number | null>(null);
  const [history, setHistory] = useState<{ ts: number; s: ReadingSummary }[]>([]);

  const loadHistory = () => {
    db.attempts
      .where('kcId')
      .equals(`obra:${score.id}`)
      .toArray()
      .then((rows) => setHistory(rows.flatMap((r) => ('reading' in (r.answer as object) ? [{ ts: r.ts, s: (r.answer as { reading: ReadingSummary }).reading }] : [])).slice(-5).reverse()))
      .catch(() => setHistory([]));
  };
  useEffect(loadHistory, [score.id]);

  const start = () => {
    if (opts.mode !== 'static') void audioContext().resume();
    stopPlayback();
    setRun(Date.now());
  };

  return (
    <div>
      <div className="actions">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Voltar à lista
        </button>
        <strong>{score.title}</strong>
        <span className="muted small">
          {meterLabel(score.meter)} · {keyLabel(score.fifths)} · {scoreNoteCount(score)} notas
        </span>
      </div>
      {error && <p className="warn">{error}</p>}
      {melody && (
        <>
          <div className="config-grid">
            <ReadingModeFieldset o={opts} set={(p) => setOpts((o) => ({ ...o, ...p }))} compound={isCompound(score.meter)} />
          </div>
          <div className="actions">
            <button type="button" className="btn-primary" onClick={start}>
              {run ? 'Recomeçar' : 'Começar'}
            </button>
            <button type="button" onClick={() => playMelody(melody, opts.mode === 'static' ? 72 : opts.bpm * (isCompound(score.meter) ? 1.5 : 1), settings.aRef)}>
              🔊 Ouvir a música
            </button>
            {history.length > 0 && (
              <span className="muted small">
                Últimas: {history.map((h) => `${Math.round(h.s.notesInTime * 100)}%${h.s.bpm ? ` a ${h.s.bpm} bpm` : ''}`).join(' · ')}
              </span>
            )}
          </div>
          {run ? (
            <ReadingSession
              key={run}
              melody={melody}
              mode={opts.mode}
              bpm={opts.bpm}
              inst={inst}
              settings={settings}
              module="D"
              lookAhead={opts.lookAhead}
              preReadSec={opts.preRead}
              clickDuring={opts.clickDuring}
              sing={opts.sing}
              onDone={() => {
                setTimeout(loadHistory, 300);
                start();
              }}
              continueLabel="Tocar de novo"
            />
          ) : (
            <MelodyStaff melody={melody} label={score.title} />
          )}
        </>
      )}
    </div>
  );
}
