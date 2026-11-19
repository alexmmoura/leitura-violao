import { useEffect, useMemo, useState } from 'react';
import { audioContext } from '../audio/metronome';
import { makeGuitar } from '../core/instrument/instrument';
import type { Melody } from '../core/melody/melody';
import { LEVEL_INFO, LEVELS, loadAcervo, pieceById, pieceKcId, pieceScore, PIECES, type Level, type Piece } from '../core/repertoire/pieces';
import { autoLevel, levelUpNeed, nextPiece, PICK_REASON_LABEL, PIECE_STATUS_LABEL, pieceStates, type PickReason, type PieceState } from '../core/repertoire/progression';
import { isCompound, meterLabel } from '../core/rhythm/rhythm';
import { buildScoreMelody } from '../core/score/score';
import { keyLabel } from '../core/theory/keySignature';
import { useLearningData } from '../data/learning';
import type { Settings } from '../data/settings';
import ReadingModeFieldset, { DEFAULT_READING_OPTIONS, type ReadingOptions } from './ReadingControls';
import ReadingSession from './ReadingSession';
import { ReviewBanner, useReviewQueue, type ReviewProps } from './review';

/**
 * Obras clássicas (repertório em domínio público), níveis 1 a 5.
 * Nível escolhido à mão, ou automático no estilo Anki: as obras que você lê bem
 * voltam cada vez mais tarde; as que erra voltam logo; o nível sobe sozinho.
 */
type LevelChoice = Level | 'auto';
type Reason = PickReason | 'chosen' | 'review';
const REASON_LABEL: Readonly<Record<Reason, string>> = { ...PICK_REASON_LABEL, chosen: 'escolhida por você', review: 'revisão' };
const DAY = 86_400_000;

function whenLabel(s: PieceState, now: number): string {
  if (s.status === 'new') return PIECE_STATUS_LABEL.new;
  if (s.status === 'due') return PIECE_STATUS_LABEL.due;
  const days = s.dueAt ? Math.max(1, Math.ceil((s.dueAt - now) / DAY)) : null;
  const next = days ? ` · volta em ${days} ${days === 1 ? 'dia' : 'dias'}` : '';
  return `${PIECE_STATUS_LABEL[s.status]}${next}`;
}

export default function RepertoirePage({ settings, review, onReviewDone }: { settings: Settings } & ReviewProps) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const { data, reload } = useLearningData(settings.retention);
  const [choice, setChoice] = useState<LevelChoice>(() => {
    try {
      const v = localStorage.getItem('lv-rep-level');
      return v === null || v === 'auto' ? 'auto' : (Math.min(5, Math.max(1, Number(v))) as Level);
    } catch {
      return 'auto';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('lv-rep-level', String(choice));
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  }, [choice]);
  const [opts, setOpts] = useState<ReadingOptions>(DEFAULT_READING_OPTIONS);
  const [run, setRun] = useState<{ piece: Piece; melody: Melody; reason: Reason; key: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const rq = useReviewQueue(review);
  // obras escritas à mão já de saída; o acervo baixado (quase 2 mil) chega logo depois
  const [extra, setExtra] = useState<Piece[]>([]);
  useEffect(() => {
    let alive = true;
    loadAcervo()
      .then((xs) => alive && setExtra(xs))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const all = useMemo(() => [...PIECES, ...extra], [extra]);
  const [listLevel, setListLevel] = useState<Level | null>(null);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(30);

  const now = Date.now();
  const states = useMemo(() => pieceStates(data?.model ?? null, now, all), [data, all]); // eslint-disable-line react-hooks/exhaustive-deps
  const level = choice === 'auto' ? autoLevel(states) : choice;
  const here = states.filter((s) => s.piece.level === level);
  const passedHere = here.filter((s) => s.passed).length;
  const preview = nextPiece(states, choice, run?.piece.id);

  const play = (piece: Piece, reason: Reason) => {
    if (opts.mode !== 'static') void audioContext().resume();
    try {
      setError(null);
      setShowConfig(false);
      const melody = { ...buildScoreMelody(pieceScore(piece), inst), materialKey: pieceKcId(piece.id) };
      setRun({ piece, melody, reason, key: Date.now() });
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const playNext = (avoid?: string) => {
    // revisões vindas de "Meu treinamento" têm prioridade
    if (rq.active && rq.current) {
      const p = pieceById(rq.current.slice('repertorio:'.length), extra);
      if (p) return play(p, 'review');
    }
    const pick = nextPiece(states, choice, avoid);
    if (pick) play(pick.piece, pick.reason);
  };

  const focus = !!run && !showConfig;
  const MODE_SHORT = { static: 'nota a nota', continuous: `contínuo, ${opts.bpm} bpm`, guitar: `no violão, ${opts.bpm} bpm` } as const;

  return (
    <section className="page repertoire">
      {!focus && (
        <header className="page-head">
          <h1>Obras clássicas</h1>
          <p className="muted">
            Trechos de obras e canções em domínio público, do nível 1 ao 5. No modo automático, como no Anki, as obras que você lê bem voltam cada vez mais
            tarde e as que você erra voltam logo; quando você aprova a maior parte de um nível, o seguinte abre sozinho.
          </p>
        </header>
      )}
      <ReviewBanner q={rq} naming={settings.naming} onExit={onReviewDone} />

      {focus && run && (
        <div className="focus-bar">
          <span className="focus-summary">
            <strong>{run.piece.title}</strong> · {run.piece.composer} · nível {run.piece.level} · {REASON_LABEL[run.reason]} · {keyLabel(run.piece.fifths)} · {meterLabel(run.piece.meter)} ·{' '}
            {MODE_SHORT[opts.mode]}
          </span>
          <button type="button" className="btn-ghost" onClick={() => setShowConfig(true)}>⚙ Opções</button>
          <button type="button" className="btn-primary" onClick={() => playNext(run.piece.id)}>Próxima obra</button>
        </div>
      )}

      {!focus && (
        <>
          <div className="config-grid">
            <fieldset>
              <legend>Nível</legend>
              <div className="level-pick" role="radiogroup" aria-label="Nível">
                <button type="button" role="radio" aria-checked={choice === 'auto'} className={`level-btn${choice === 'auto' ? ' is-on' : ''}`} onClick={() => setChoice('auto')}>
                  Automático <span className="muted small">(tipo Anki)</span>
                </button>
                {LEVELS.map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={choice === l} className={`level-btn${choice === l ? ' is-on' : ''}`} onClick={() => setChoice(l)}>
                    {l}
                  </button>
                ))}
              </div>
              <p className="muted small field-hint">
                {choice === 'auto' ? <>Seu nível agora: <strong>{level}</strong>. </> : null}
                {LEVEL_INFO[level].about} {passedHere} de {here.length} obras aprovadas
                {choice === 'auto' && level < 5 ? ` (o nível ${level + 1} abre com ${levelUpNeed(here.length)})` : ''}.
              </p>
            </fieldset>
            <ReadingModeFieldset o={opts} set={(p) => setOpts((o) => ({ ...o, ...p }))} compound={run ? isCompound(run.piece.meter) : false} />
          </div>

          <div className="actions">
            <button type="button" className="btn-primary" disabled={!preview && !rq.active} onClick={() => playNext(run?.piece.id)}>
              {run ? 'Próxima obra' : 'Começar'}
            </button>
            {run && <button type="button" className="btn-ghost" onClick={() => setShowConfig(false)}>Fechar opções</button>}
            {preview && !rq.active && (
              <span className="muted small">
                A seguir: <strong>{preview.piece.title}</strong> ({REASON_LABEL[preview.reason]})
              </span>
            )}
          </div>
        </>
      )}
      {error && <p className="warn">{error}</p>}

      {run && (
        <ReadingSession
          key={run.key}
          melody={run.melody}
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
            setTimeout(reload, 300); // a gravação da tentativa é assíncrona
            if (rq.active) {
              rq.advance();
              setRun(null);
            } else playNext(run.piece.id);
          }}
          continueLabel={rq.active ? 'Próxima revisão' : 'Próxima obra'}
        />
      )}

      {!focus && (
        <div className="rep-list">
          <div className="rep-tabs" role="tablist" aria-label="Obras por nível">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={(listLevel ?? level) === l}
                className={`rep-tab${(listLevel ?? level) === l ? ' is-on' : ''}${l === level ? ' is-current' : ''}`}
                onClick={() => {
                  setListLevel(l);
                  setShown(30);
                }}
              >
                Nível {l} <span className="muted small">({states.filter((x) => x.piece.level === l).length})</span>
              </button>
            ))}
            <input
              type="search"
              className="rep-search"
              placeholder="Buscar obra ou compositor"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(30);
              }}
              aria-label="Buscar obra ou compositor"
            />
          </div>
          {(() => {
            const l = listLevel ?? level;
            const q = query.trim().toLowerCase();
            const list = states.filter((x) => (q ? `${x.piece.title} ${x.piece.composer}`.toLowerCase().includes(q) : x.piece.level === l));
            return (
              <div className="rep-level">
                <h2>
                  {q ? `Busca: ${list.length} obras` : LEVEL_INFO[l].title} {!q && <span className="muted small">— {LEVEL_INFO[l].about}</span>}
                </h2>
                <ul>
                  {list.slice(0, shown).map((x) => (
                    <li key={x.piece.id} className={`rep-item is-${x.status}`}>
                      <div className="rep-text">
                        <strong>{x.piece.title}</strong>
                        <span className="muted small">
                          {q ? `Nível ${x.piece.level} · ` : ''}
                          {x.piece.composer} · {keyLabel(x.piece.fifths).split(' (')[0]} · {meterLabel(x.piece.meter)}
                          {x.piece.semitones && x.piece.semitones % 12 !== 0 ? ' · transposta para o violão' : ''}
                          {x.piece.about ? ` · ${x.piece.about}` : ''}
                        </span>
                      </div>
                      <span className={`rep-status is-${x.status}`}>{whenLabel(x, now)}</span>
                      <button type="button" className="btn-ghost" onClick={() => play(x.piece, 'chosen')}>Tocar</button>
                    </li>
                  ))}
                </ul>
                {list.length > shown && (
                  <button type="button" className="btn-ghost rep-more" onClick={() => setShown((n) => n + 30)}>
                    Mostrar mais ({list.length - shown} restantes)
                  </button>
                )}
              </div>
            );
          })()}
          <p className="muted small">
            {all.length} obras: {PIECES.length} trechos famosos escritos à mão e {extra.length} melodias baixadas do corpus aberto do music21 (corais de Bach; O'Neill's Music of Ireland; Ryan's Mammoth Collection, 1883), todas em domínio público. Só a melodia, em altura escrita para violão; tonalidades difíceis foram transpostas.
          </p>
        </div>
      )}
    </section>
  );
}
