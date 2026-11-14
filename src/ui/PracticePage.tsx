import { useCallback, useMemo, useState } from 'react';
import { generateFretQuestion } from '../core/exercise/fretQuestion';
import { candidatePool, generateNoteQuestion, type NoteQuestionConfig } from '../core/exercise/noteQuestion';
import { createRng, randomSeed } from '../core/exercise/rng';
import { makeGuitar } from '../core/instrument/instrument';
import { fixedPosition, fretWindow, OPEN_POSITION, positionLabel, roman, WHOLE_NECK, type PositionSpec } from '../core/instrument/position';
import { keyLabel } from '../core/theory/keySignature';
import { spelledToMidi } from '../core/theory/pitch';
import type { Settings } from '../data/settings';
import Fretboard from './Fretboard';
import TrainingSession, { type SessionQuestion } from './TrainingSession';

/**
 * Módulos A e B — reconhecimento configurável nos dois sentidos (§6.1, §6.2).
 * O agendamento espaçado (FSRS) entra na Fase 2; aqui a escolha é aleatória.
 */
type PositionChoice = 'whole' | 'open' | `p${number}`;
type DirectionChoice = 'staff>fretboard' | 'fretboard>staff' | 'mixed';

interface UiConfig {
  direction: DirectionChoice;
  position: PositionChoice;
  stretch1: boolean;
  stretch4: boolean;
  allowOpen: boolean;
  strings: number[];
  accidentals: NoteQuestionConfig['accidentals'];
  fifths: number;
  answerMode: NoteQuestionConfig['answerMode'];
  length: number; // 0 = sem fim
}

const DEFAULT_UI: UiConfig = {
  direction: 'staff>fretboard',
  position: 'open',
  stretch1: false,
  stretch4: false,
  allowOpen: false,
  strings: [1, 2, 3, 4, 5, 6],
  accidentals: 'diatonic',
  fifths: 0,
  answerMode: 'any',
  length: 20,
};

const DIRECTION_LABEL: Record<DirectionChoice, string> = {
  'staff>fretboard': 'Pauta → braço',
  'fretboard>staff': 'Braço → pauta',
  mixed: 'Misto (os dois sentidos intercalados)',
};

function toPositionSpec(c: UiConfig): PositionSpec {
  if (c.position === 'whole') return WHOLE_NECK;
  if (c.position === 'open') return OPEN_POSITION;
  return fixedPosition(Number(c.position.slice(1)), { stretch1: c.stretch1, stretch4: c.stretch4, allowOpen: c.allowOpen });
}

export default function PracticePage({ settings }: { settings: Settings }) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const [ui, setUi] = useState<UiConfig>(DEFAULT_UI);
  const [runKey, setRunKey] = useState<number | null>(null);

  const cfg: NoteQuestionConfig = useMemo(
    () => ({
      fifths: ui.fifths,
      accidentals: ui.accidentals,
      strings: ui.strings,
      position: toPositionSpec(ui),
      minFret: 0,
      maxFret: inst.frets,
      // E3 escrito (corda 6 solta) até a casa mais aguda da corda 1, escrita.
      minWritten: 52,
      maxWritten: 76 + inst.frets,
      answerMode: ui.direction === 'staff>fretboard' ? ui.answerMode : 'any',
    }),
    [ui, inst.frets],
  );
  const poolSize = useMemo(() => candidatePool(cfg, inst).length, [cfg, inst]);
  const win = useMemo(() => (cfg.position.kind === 'whole' ? null : fretWindow(cfg.position, inst.frets)), [cfg.position, inst.frets]);

  const nextQuestion = useCallback(
    (prev: SessionQuestion | null, index: number): SessionQuestion | null => {
      if (ui.length > 0 && index >= ui.length) return null;
      const seed = randomSeed();
      const dir = ui.direction === 'mixed' ? (createRng(seed).next() < 0.5 ? 'staff>fretboard' : 'fretboard>staff') : ui.direction;
      // Intercalação: nunca a mesma altura duas vezes seguidas, em qualquer sentido.
      for (let attempt = 0; attempt < 10; attempt++) {
        const s = seed + attempt;
        const q: SessionQuestion = dir === 'staff>fretboard' ? generateNoteQuestion(cfg, inst, s, prev?.kcId) : generateFretQuestion(cfg, inst, s, prev?.kcId);
        if (!prev || poolSize < 2 || spelledToMidi(q.written) !== spelledToMidi(prev.written)) return q;
      }
      return dir === 'staff>fretboard' ? generateNoteQuestion(cfg, inst, seed) : generateFretQuestion(cfg, inst, seed);
    },
    [cfg, inst, ui.direction, ui.length, poolSize],
  );

  const toggleString = (s: number) =>
    setUi((u) => {
      const has = u.strings.includes(s);
      const strings = has ? u.strings.filter((x) => x !== s) : [...u.strings, s].sort();
      return { ...u, strings: strings.length ? strings : u.strings };
    });

  if (runKey !== null) {
    return (
      <TrainingSession
        key={runKey}
        inst={inst}
        settings={settings}
        fifths={cfg.fifths}
        window={win}
        module="A"
        title={
          <>
            <strong>{DIRECTION_LABEL[ui.direction].split(' (')[0]}</strong> · {positionLabel(cfg.position)} · {keyLabel(cfg.fifths).split(' (')[0]}
          </>
        }
        total={ui.length}
        nextQuestion={nextQuestion}
        sessionConfig={{ ...cfg, direction: ui.direction }}
        onExit={() => setRunKey(null)}
      />
    );
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Reconhecimento de notas</h1>
        <p className="muted">Módulos A e B — da pauta para o braço e do braço para a pauta.</p>
      </header>

      <div className="config-grid">
        <fieldset>
          <legend>Sentido</legend>
          <select value={ui.direction} onChange={(e) => setUi({ ...ui, direction: e.target.value as DirectionChoice })} aria-label="Sentido">
            {(Object.keys(DIRECTION_LABEL) as DirectionChoice[]).map((d) => (
              <option key={d} value={d}>
                {DIRECTION_LABEL[d]}
              </option>
            ))}
          </select>
          <select
            value={ui.answerMode}
            disabled={ui.direction !== 'staff>fretboard'}
            onChange={(e) => setUi({ ...ui, answerMode: e.target.value as UiConfig['answerMode'] })}
            aria-label="Modo de resposta"
          >
            <option value="any">Qualquer local válido na região</option>
            <option value="string">Na corda indicada</option>
            <option value="all">Todos os locais da região</option>
          </select>
        </fieldset>

        <fieldset>
          <legend>Região do braço</legend>
          <select value={ui.position} onChange={(e) => setUi({ ...ui, position: e.target.value as PositionChoice })} aria-label="Posição">
            <option value="open">Posição aberta (casas 0–4)</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
              <option key={p} value={`p${p}`}>
                {roman(p)} posição (casas {p}–{p + 3})
              </option>
            ))}
            <option value="whole">Braço inteiro</option>
          </select>
          {ui.position.startsWith('p') && (
            <div className="checks">
              <label><input type="checkbox" checked={ui.stretch1} onChange={(e) => setUi({ ...ui, stretch1: e.target.checked })} /> Abertura do dedo 1</label>
              <label><input type="checkbox" checked={ui.stretch4} onChange={(e) => setUi({ ...ui, stretch4: e.target.checked })} /> Abertura do dedo 4</label>
              <label><input type="checkbox" checked={ui.allowOpen} onChange={(e) => setUi({ ...ui, allowOpen: e.target.checked })} /> Cordas soltas</label>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>Cordas</legend>
          <div className="chips">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <button key={s} type="button" className={`chip${ui.strings.includes(s) ? ' is-on' : ''}`} aria-pressed={ui.strings.includes(s)} onClick={() => toggleString(s)}>
                {s}
              </button>
            ))}
          </div>
          <select value={ui.length} onChange={(e) => setUi({ ...ui, length: Number(e.target.value) })} aria-label="Número de questões">
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>{n} questões</option>
            ))}
            <option value={0}>Sem fim</option>
          </select>
        </fieldset>

        <fieldset>
          <legend>Notas e armadura</legend>
          <select value={ui.accidentals} onChange={(e) => setUi({ ...ui, accidentals: e.target.value as UiConfig['accidentals'] })} aria-label="Acidentes">
            <option value="diatonic">Só notas da tonalidade</option>
            <option value="chromatic">Com acidentes ocorrentes</option>
          </select>
          <select value={ui.fifths} onChange={(e) => setUi({ ...ui, fifths: Number(e.target.value) })} aria-label="Armadura">
            {Array.from({ length: 15 }, (_, i) => i - 7).map((f) => (
              <option key={f} value={f}>
                {keyLabel(f)}
              </option>
            ))}
          </select>
        </fieldset>
      </div>

      <div className="preview">
        <p className="muted">
          {positionLabel(cfg.position)} · cordas {ui.strings.join(', ')} · <strong>{poolSize}</strong> nota{poolSize === 1 ? '' : 's'} possíve{poolSize === 1 ? 'l' : 'is'}
        </p>
        <Fretboard inst={inst} settings={{ ...settings, showNoteNames: true }} window={win} />
      </div>

      <div className="actions">
        <button type="button" className="btn-primary" disabled={poolSize === 0} onClick={() => setRunKey(Date.now())}>
          Começar
        </button>
        {poolSize === 0 && <span className="warn">Nenhuma nota disponível com essas opções.</span>}
      </div>
    </section>
  );
}
