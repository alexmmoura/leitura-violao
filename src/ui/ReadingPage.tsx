import { useEffect, useMemo, useState } from 'react';
import { audioContext } from '../audio/metronome';
import { randomSeed } from '../core/exercise/rng';
import { makeGuitar } from '../core/instrument/instrument';
import { fixedPosition, OPEN_POSITION, roman, WHOLE_NECK, type PositionSpec } from '../core/instrument/position';
import { generateMelody, materialKey, SHIFT_PAIRS, shiftIsMeaningful, type Melody, type MelodyConfig } from '../core/melody/melody';
import { sustainableBpm, type ReadingRecord } from '../core/melody/sightReading';
import { beatsPer, COMPOUND_LEVEL_LABEL, isCompound, LEVEL_LABEL, meterLabel, METERS, parseMeter } from '../core/rhythm/rhythm';
import { keyLabel } from '../core/theory/keySignature';
import { db } from '../data/db';
import type { Settings } from '../data/settings';
import ReadingSession from './ReadingSession';
import ReadingModeFieldset, { DEFAULT_READING_OPTIONS, type ReadingOptions } from './ReadingControls';
import { ReviewBanner, useReviewQueue, type ReviewProps } from './review';
import { parseMaterialKey } from '../core/melody/melody';

/**
 * Módulo D — leitura de melodias e leitura à primeira vista (§6.4).
 * Cada tentativa é uma frase NOVA (leitura à primeira vista não se decora).
 */
type RegionChoice = 'open' | `p${number}` | `s${number}-${number}` | 'whole';

const LEAPS: [number, string][] = [
  [1, 'Só graus conjuntos'],
  [2, 'Até terças'],
  [4, 'Até quintas'],
  [7, 'Até oitavas'],
];

function regionSpecs(r: RegionChoice): { region: PositionSpec; shiftTo?: PositionSpec } {
  if (r === 'open') return { region: OPEN_POSITION };
  if (r === 'whole') return { region: WHOLE_NECK };
  if (r.startsWith('s')) {
    const [a, b] = r.slice(1).split('-').map(Number) as [number, number];
    return { region: fixedPosition(a), shiftTo: fixedPosition(b) };
  }
  return { region: fixedPosition(Number(r.slice(1))) };
}

export default function ReadingPage({ settings, review, onReviewDone, presetSing = false }: { settings: Settings; presetSing?: boolean } & ReviewProps) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const [region, setRegion] = useState<RegionChoice>('p5');
  const [fifths, setFifths] = useState(0);
  const [meterStr, setMeterStr] = useState('4/4');
  const meter = parseMeter(meterStr) ?? { num: 4, den: 4 as const };
  const compound = isCompound(meter);
  const [measures, setMeasures] = useState(4);
  const [rhythmLevel, setRhythmLevel] = useState(0);
  const [maxLeap, setMaxLeap] = useState(2);
  const [chromatic, setChromatic] = useState(false);
  const [opts, setOpts] = useState<ReadingOptions>({ ...DEFAULT_READING_OPTIONS, sing: presetSing });
  const [run, setRun] = useState<{ melody: Melody; key: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReadingRecord[]>([]);
  /** Durante a prática as opções ficam recolhidas (a pauta e o braço ganham a tela). */
  const [showConfig, setShowConfig] = useState(false);

  // revisão: cada item é um MATERIAL ("leitura:<chave>"); a frase lida é sempre nova
  const rq = useReviewQueue(review);
  useEffect(() => {
    if (!rq.current) return;
    const c = parseMaterialKey(rq.current.slice('leitura:'.length));
    if (!c) return rq.advance();
    const toChoice = (s: PositionSpec): RegionChoice => (s.kind === 'open' ? 'open' : s.kind === 'whole' ? 'whole' : `p${s.position}`);
    setRegion(c.shiftTo && c.region.kind === 'fixed' && c.shiftTo.kind === 'fixed' ? `s${c.region.position}-${c.shiftTo.position}` : toChoice(c.region));
    setFifths(c.fifths);
    setMeterStr(c.meter ? meterLabel(c.meter) : `${c.beats}/4`);
    setMeasures(c.measures);
    setRhythmLevel(c.rhythmLevel);
    setMaxLeap(c.maxLeap);
    setChromatic(c.chromatic);
    setRun(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rq.current]);

  const config: MelodyConfig = useMemo(
    () => {
      const m = parseMeter(meterStr) ?? { num: 4, den: 4 as const };
      // compassos simples continuam só com `beats` (mesma chave de material de antes)
      return {
        fifths,
        ...regionSpecs(region),
        strings: [1, 2, 3, 4, 5, 6],
        measures,
        beats: beatsPer(m),
        ...(m.den === 8 ? { meter: m } : {}),
        rhythmLevel,
        maxLeap,
        chromatic,
      };
    },
    [fifths, region, measures, meterStr, rhythmLevel, maxLeap, chromatic],
  );
  const key = materialKey(config);
  const shiftOptions = useMemo(() => SHIFT_PAIRS.filter(([a, b]) => shiftIsMeaningful({ ...config, region: fixedPosition(a), shiftTo: fixedPosition(b) }, inst)), [config, inst]);

  // se a mudança escolhida deixar de fazer sentido na nova tonalidade, volta à posição fixa
  useEffect(() => {
    if (region.startsWith('s') && !shiftOptions.some(([a, b]) => `s${a}-${b}` === region)) setRegion('p5');
  }, [shiftOptions, region]);

  const loadHistory = () => {
    db.attempts
      .where('kcId')
      .equals(`leitura:${key}`)
      .toArray()
      .then((rows) =>
        setHistory(
          rows
            .map((r) => ('reading' in (r.answer as object) ? { ts: r.ts, s: (r.answer as { reading: import('../data/db').ReadingSummary }).reading } : null))
            .filter((x): x is { ts: number; s: import('../data/db').ReadingSummary } => !!x && x.s.mode === 'continuous' && x.s.bpm !== null && x.s.continuity !== null)
            .map((x) => ({ ts: x.ts, bpm: x.s.bpm!, notesInTime: x.s.notesInTime, continuity: x.s.continuity! })),
        ),
      )
      .catch(() => setHistory([]));
  };
  useEffect(loadHistory, [key]);

  const sustainable = sustainableBpm(history);

  const start = () => {
    // Desbloqueia o áudio DENTRO do gesto do clique: com pré-leitura, o metrônomo só
    // começa segundos depois, quando o navegador já não consideraria um gesto do usuário.
    if (opts.mode !== 'static') void audioContext().resume();
    try {
      setError(null);
      setShowConfig(false);
      setRun({ melody: generateMelody(config, inst, randomSeed()), key: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const specs = regionSpecs(region);
  const span = (s: PositionSpec) => (s.kind === 'fixed' ? `casas ${s.position}–${s.position + 3}` : '');
  const regionHint =
    specs.region.kind === 'open'
      ? 'Cordas soltas e casas 1 a 4 (dedo 1 na casa 1).'
      : specs.region.kind === 'whole'
        ? 'Vale qualquer casa do braço — você escolhe onde tocar cada nota.'
        : specs.shiftTo && specs.shiftTo.kind === 'fixed'
          ? `Começa com a mão na ${roman(specs.region.position)} posição (${span(specs.region)}) e muda para a ${roman(specs.shiftTo.position)} (${span(specs.shiftTo)}) durante a frase.`
          : `Dedo 1 (indicador) na casa ${specs.region.position}: a mão fica parada e você usa só as ${span(specs.region)}, um dedo por casa.`;
  const focus = !!run && !showConfig;
  const MODE_SHORT = { static: 'nota a nota', continuous: `contínuo, ${opts.bpm} bpm`, guitar: `no violão, ${opts.bpm} bpm` } as const;

  return (
    <section className="page">
      {!focus && (
        <header className="page-head">
          <h1>{presetSing ? 'Solfejo' : 'Leitura de partituras'}</h1>
          <p className="muted">Módulo D — frases originais geradas a cada tentativa. Na leitura à primeira vista, parar é o erro mais grave.</p>
        </header>
      )}
      <ReviewBanner q={rq} naming={settings.naming} onExit={onReviewDone} />
      {rq.active && !run && <p className="small">Material da revisão já configurado abaixo — escolha o modo e clique em <strong>Começar</strong>.</p>}

      {focus && (
        <div className="focus-bar">
          <span className="focus-summary">
            {keyLabel(fifths)} · {meterStr} · {measures} compassos · {MODE_SHORT[opts.mode]}
            {opts.sing ? ' · solfejo' : ''}
          </span>
          <button type="button" className="btn-ghost" onClick={() => setShowConfig(true)}>⚙ Opções</button>
          <button type="button" className="btn-primary" onClick={start}>Nova frase</button>
        </div>
      )}

      {!focus && (
      <>
      <div className="config-grid">
        <fieldset>
          <legend>Região</legend>
          <select value={region} onChange={(e) => setRegion(e.target.value as RegionChoice)} aria-label="Região">
            <option value="open">Posição aberta</option>
            {[1, 2, 3, 4, 5, 7, 9, 12].map((p) => (
              <option key={p} value={`p${p}`}>{roman(p)} posição</option>
            ))}
            {shiftOptions.map(([a, b]) => (
              <option key={`${a}-${b}`} value={`s${a}-${b}`}>Mudança {roman(a)} → {roman(b)}</option>
            ))}
            <option value="whole">Braço inteiro</option>
          </select>
          <p className="muted small field-hint">{regionHint}</p>
          <select value={fifths} onChange={(e) => setFifths(Number(e.target.value))} aria-label="Tonalidade">
            {Array.from({ length: 9 }, (_, i) => i - 4).map((f) => (
              <option key={f} value={f}>{keyLabel(f)}</option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>Frase</legend>
          <select value={meterStr} onChange={(e) => setMeterStr(e.target.value)} aria-label="Compasso">
            {METERS.map((m) => (
              <option key={meterLabel(m)} value={meterLabel(m)}>
                {meterLabel(m)}
                {isCompound(m) ? ' (composto)' : ''}
              </option>
            ))}
          </select>
          <select value={measures} onChange={(e) => setMeasures(Number(e.target.value))} aria-label="Compassos">
            {[2, 4, 8].map((m) => (
              <option key={m} value={m}>{m} compassos</option>
            ))}
          </select>
          <select value={rhythmLevel} onChange={(e) => setRhythmLevel(Number(e.target.value))} aria-label="Ritmo">
            <option value={0}>{compound ? 'Só pulsação (semínima + colcheia)' : 'Só semínimas (altura sem ritmo)'}</option>
            {(compound ? COMPOUND_LEVEL_LABEL : LEVEL_LABEL).map((l, i) => (
              <option key={i} value={i + 1}>Ritmo nível {i + 1}: {l}</option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>Melodia</legend>
          <select value={maxLeap} onChange={(e) => setMaxLeap(Number(e.target.value))} aria-label="Saltos">
            {LEAPS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <div className="checks">
            <label><input type="checkbox" checked={chromatic} onChange={(e) => setChromatic(e.target.checked)} /> Acidentes ocorrentes</label>
          </div>
        </fieldset>

        <ReadingModeFieldset o={opts} set={(p) => setOpts((o) => ({ ...o, ...p }))} compound={compound} />
      </div>

      <div className="actions">
        <button type="button" className="btn-primary" onClick={start}>
          {run ? 'Nova frase' : 'Começar'}
        </button>
        {run && <button type="button" className="btn-ghost" onClick={() => setShowConfig(false)}>Fechar opções</button>}
        <span className="muted small">
          Andamento sustentável neste material: <strong>{sustainable ? `${sustainable} bpm` : 'ainda não medido'}</strong> (3 frases novas seguidas com ≥ 85% no tempo e ≥ 90% de continuidade, modo contínuo).
        </span>
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
            setTimeout(loadHistory, 300); // a gravação da tentativa é assíncrona
            if (rq.active) {
              setRun(null);
              rq.advance();
            } else start();
          }}
          continueLabel={rq.active ? 'Próxima revisão' : 'Próxima frase'}
        />
      )}
    </section>
  );
}
