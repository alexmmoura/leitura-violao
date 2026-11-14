import { useMemo, useState, type ReactNode } from 'react';
import { harmonic, melodic, playEvents } from '../audio/player';
import { makeGuitar, soundingAt, type FretLocation, type Instrument } from '../core/instrument/instrument';
import {
  chordLabel,
  chordMidis,
  chordPcs,
  chordsContaining,
  chordType,
  CHORD_TYPES,
  CIRCLE,
  DEGREE_LABEL,
  FUNCTION_NAME,
  harmonicField,
  identifyChords,
  INTERVALS,
  inversions,
  mod12,
  noteName,
  prefersFlats,
  PROGRESSIONS,
  progressionChords,
  SCALES,
  scalePcs,
  substitutions,
  type HarmonicFunction,
  type NamedChord,
} from '../core/theory/tools';
import type { Settings } from '../data/settings';
import Fretboard, { type Mark } from './Fretboard';

/**
 * Ferramentas — calculadoras e visualizadores de harmonia e do braço.
 * Tudo calculado localmente pelo núcleo (core/theory/tools).
 */
type ToolId = 'fretboard' | 'scales' | 'intervals' | 'chordcalc' | 'field' | 'functions' | 'subst' | 'similar' | 'inversion' | 'prog' | 'circle' | 'piano';

const TOOLS: { id: ToolId; icon: string; title: string; about: string }[] = [
  { id: 'fretboard', icon: '🎸', title: 'Braço (fretboard)', about: 'Veja onde fica cada nota ou intervalo no braço inteiro.' },
  { id: 'scales', icon: '📏', title: 'Escalas', about: 'Ouça e visualize as principais escalas no braço.' },
  { id: 'intervals', icon: '↔️', title: 'Calculadora de intervalos', about: 'Nota + intervalo = qual nota? Ouça cada intervalo.' },
  { id: 'chordcalc', icon: '🧮', title: 'Calculadora de acordes', about: 'Marque as notas no braço e descubra o nome do acorde.' },
  { id: 'field', icon: '🎼', title: 'Campo harmônico', about: 'Os acordes de cada tonalidade, em tríades e tétrades.' },
  { id: 'functions', icon: '🔤', title: 'Funções harmônicas', about: 'Tônica, subdominante e dominante de cada grau — com som.' },
  { id: 'subst', icon: '🔁', title: 'Substituição de acordes', about: 'Acordes que podem trocar de lugar em cada função.' },
  { id: 'similar', icon: '⚭', title: 'Similaridade de acordes', about: 'Acordes que contêm as notas que você escolher.' },
  { id: 'inversion', icon: '🔃', title: 'Inversão de acorde', about: 'As inversões possíveis de qualquer acorde.' },
  { id: 'prog', icon: '📈', title: 'Progressões e cadências', about: 'As progressões mais usadas, em qualquer tom, com som.' },
  { id: 'circle', icon: '🎡', title: 'Ciclo das quintas', about: 'Tonalidades vizinhas, relativas e os graus de cada tom.' },
  { id: 'piano', icon: '🎹', title: 'Piano virtual', about: 'Um teclado para conferir notas e cantar afinado.' },
];

const PCS = Array.from({ length: 12 }, (_, i) => i);

function NoteSelect({ value, onChange, flats, label }: { value: number; onChange: (pc: number) => void; flats?: boolean; label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {PCS.map((pc) => (
          <option key={pc} value={pc}>
            {noteName(pc, flats)} ({noteName(pc, flats, true)})
          </option>
        ))}
      </select>
    </label>
  );
}

/** Marcas no braço para um conjunto de classes de altura. */
function marksFor(inst: Instrument, pcs: readonly number[], root: number | null, label: (pc: number) => string, maxFret = inst.frets): Mark[] {
  const out: Mark[] = [];
  inst.strings.forEach((_, i) => {
    for (let f = 0; f <= maxFret; f++) {
      const loc = { string: i + 1, fret: f };
      const pc = mod12(soundingAt(loc, inst));
      if (pcs.includes(pc)) out.push({ loc, kind: pc === root ? 'selected' : 'valid', label: label(pc) });
    }
  });
  return out;
}

export default function ToolsPage({ settings }: { settings: Settings }) {
  const [tool, setTool] = useState<ToolId | null>(null);
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const fbSettings = useMemo(() => ({ ...settings, showNoteNames: false }), [settings]);
  const play = (c: NamedChord) => void playEvents(harmonic(chordMidis(c)), settings.aRef);
  const current = TOOLS.find((t) => t.id === tool);

  if (!current) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Ferramentas</h1>
          <p className="muted">Calculadoras e mapas para consultar enquanto estuda.</p>
        </header>
        <div className="tool-list">
          {TOOLS.map((t) => (
            <button key={t.id} type="button" className="tool-card" onClick={() => setTool(t.id)}>
              <span className="tool-icon" aria-hidden>{t.icon}</span>
              <span>
                <strong>{t.title}</strong>
                <span className="muted">{t.about}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const ctx: Ctx = { inst, settings, fbSettings, play };
  return (
    <section className="page">
      <header className="sub-head">
        <button type="button" className="back" onClick={() => setTool(null)} aria-label="Voltar às ferramentas">‹</button>
        <h1>{current.title}</h1>
      </header>
      {tool === 'fretboard' && <FretboardTool {...ctx} />}
      {tool === 'scales' && <ScalesTool {...ctx} />}
      {tool === 'intervals' && <IntervalsTool {...ctx} />}
      {tool === 'chordcalc' && <ChordCalcTool {...ctx} />}
      {tool === 'field' && <FieldTool {...ctx} />}
      {tool === 'functions' && <FunctionsTool {...ctx} />}
      {tool === 'subst' && <SubstTool {...ctx} />}
      {tool === 'similar' && <SimilarTool {...ctx} />}
      {tool === 'inversion' && <InversionTool {...ctx} />}
      {tool === 'prog' && <ProgTool {...ctx} />}
      {tool === 'circle' && <CircleTool {...ctx} />}
      {tool === 'piano' && <PianoTool {...ctx} />}
    </section>
  );
}

interface Ctx {
  inst: Instrument;
  settings: Settings;
  fbSettings: Settings;
  play: (c: NamedChord) => void;
}

function ChordGrid({ items, play, flats }: { items: { chord: NamedChord; sub?: string }[]; play: (c: NamedChord) => void; flats?: boolean }) {
  return (
    <div className="chord-grid">
      {items.map((it, i) => (
        <button key={i} type="button" className="chord-tile" onClick={() => play(it.chord)} title="Tocar o acorde">
          <strong>{chordLabel(it.chord, flats)}</strong>
          {it.sub && <span className="muted small">{it.sub}</span>}
          <span className="muted small">{chordPcs(it.chord).map((p) => noteName(p, flats)).join(' ')}</span>
        </button>
      ))}
    </div>
  );
}
const Hint = ({ children }: { children: ReactNode }) => <p className="hint-box">{children}</p>;

// ---------- Braço ----------
function FretboardTool({ inst, fbSettings }: Ctx) {
  const [sel, setSel] = useState<number[]>(PCS);
  const [flats, setFlats] = useState(false);
  const [asIntervals, setAsIntervals] = useState(false);
  const [root, setRoot] = useState(0);
  const toggle = (pc: number) => setSel((s) => (s.includes(pc) ? s.filter((x) => x !== pc) : [...s, pc]));
  const marks = useMemo(() => marksFor(inst, sel, asIntervals ? root : null, (pc) => (asIntervals ? DEGREE_LABEL[mod12(pc - root)]! : noteName(pc, flats))), [inst, sel, asIntervals, root, flats]);
  return (
    <>
      <div className="pill-row">
        <button type="button" className="pill" onClick={() => setSel(PCS)}>Todas</button>
        <button type="button" className="pill" onClick={() => setSel([])}>Nenhuma</button>
        <button type="button" className={`pill${flats ? ' is-on' : ''}`} onClick={() => setFlats((f) => !f)}>{flats ? 'Bemóis ♭' : 'Sustenidos ♯'}</button>
        <button type="button" className={`pill${asIntervals ? ' is-on' : ''}`} onClick={() => setAsIntervals((v) => !v)}>Intervalos</button>
      </div>
      <div className="note-row">
        {PCS.map((pc) => (
          <button key={pc} type="button" className={`note-dot${sel.includes(pc) ? ' is-on' : ''}${asIntervals && pc === root ? ' is-root' : ''}`} onClick={() => (asIntervals && sel.includes(pc) && pc !== root ? setRoot(pc) : toggle(pc))}>
            {noteName(pc, flats)}
          </button>
        ))}
      </div>
      {asIntervals && <Hint>Modo intervalos: toque numa nota acesa para torná-la a tônica (1). As outras mostram o grau em relação a ela.</Hint>}
      <Fretboard inst={inst} settings={fbSettings} window={null} marks={marks} />
    </>
  );
}

// ---------- Escalas ----------
function ScalesTool({ inst, fbSettings, settings }: Ctx) {
  const [tonic, setTonic] = useState(0);
  const [id, setId] = useState('major');
  const [showDeg, setShowDeg] = useState(false);
  const scale = SCALES.find((s) => s.id === id)!;
  const flats = prefersFlats(tonic, scale.steps.includes(3) && !scale.steps.includes(4));
  const pcs = scalePcs(tonic, scale);
  const marks = useMemo(() => marksFor(inst, pcs, tonic, (pc) => (showDeg ? DEGREE_LABEL[mod12(pc - tonic)]! : noteName(pc, flats))), [inst, pcs.join(), tonic, showDeg, flats]);
  const listen = () => {
    const up = [...scale.steps, 12].map((s) => 48 + tonic + s);
    void playEvents(melodic([...up, ...[...up].reverse().slice(1)], 0.32), settings.aRef);
  };
  return (
    <>
      <div className="config-grid">
        <NoteSelect label="Tônica" value={tonic} onChange={setTonic} flats={flats} />
        <label className="field">
          <span>Escala</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {SCALES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="pill-row">
        <button type="button" className="pill is-on" onClick={listen}>🔊 Ouvir</button>
        <button type="button" className={`pill${showDeg ? ' is-on' : ''}`} onClick={() => setShowDeg((v) => !v)}>Mostrar graus</button>
      </div>
      <p className="big-line">{pcs.map((p) => noteName(p, flats)).join('  ')}</p>
      <p className="muted small center">Fórmula: {scale.steps.map((s) => DEGREE_LABEL[s]).join(' – ')}</p>
      <Fretboard inst={inst} settings={fbSettings} window={null} marks={marks} />
    </>
  );
}

// ---------- Intervalos ----------
function IntervalsTool({ settings }: Ctx) {
  const [root, setRoot] = useState(0);
  const [semi, setSemi] = useState(7);
  const [desc, setDesc] = useState(false);
  const flats = prefersFlats(root);
  const target = mod12(root + (desc ? -semi : semi));
  const base = 55 + root;
  const hear = (s: number, mode: 'h' | 'm') => {
    const b = 55 + root;
    const other = b + (desc ? -s : s);
    void playEvents(mode === 'h' ? harmonic([b, other], 0, 1.6, 0) : melodic([b, other], 0.7), settings.aRef);
  };
  return (
    <>
      <div className="config-grid">
        <NoteSelect label="Nota fundamental" value={root} onChange={setRoot} flats={flats} />
        <label className="field">
          <span>Intervalo</span>
          <select value={semi} onChange={(e) => setSemi(Number(e.target.value))}>
            {INTERVALS.map((i) => (
              <option key={i.semitones} value={i.semitones}>{i.short} — {i.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Direção</span>
          <select value={desc ? 'd' : 'a'} onChange={(e) => setDesc(e.target.value === 'd')}>
            <option value="a">Ascendente (para cima)</option>
            <option value="d">Descendente (para baixo)</option>
          </select>
        </label>
      </div>
      <p className="result-box">{noteName(target, flats)} <span className="muted">({noteName(target, flats, true)})</span></p>
      <p className="muted small center">{semi} semitom(ns) {desc ? 'abaixo' : 'acima'} de {noteName(root, flats)}.</p>
      <div className="pill-row">
        <button type="button" className="pill is-on" onClick={() => hear(semi, 'm')}>🔊 Melódico</button>
        <button type="button" className="pill is-on" onClick={() => hear(semi, 'h')}>🔊 Harmônico</button>
      </div>
      <h2>Ouvir todos os intervalos a partir de {noteName(root, flats)}</h2>
      <div className="chord-grid">
        {INTERVALS.map((i) => (
          <button key={i.semitones} type="button" className="chord-tile" onClick={() => void playEvents(melodic([base, base + i.semitones, base], 0.6), settings.aRef)}>
            <strong>{i.short}</strong>
            <span className="muted small">{i.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------- Calculadora de acordes ----------
function ChordCalcTool({ inst, fbSettings, settings }: Ctx) {
  const [locs, setLocs] = useState<FretLocation[]>([]);
  const click = (loc: FretLocation) =>
    setLocs((cur) => {
      const same = cur.find((l) => l.string === loc.string);
      const rest = cur.filter((l) => l.string !== loc.string);
      return same && same.fret === loc.fret ? rest : [...rest, loc];
    });
  const sorted = [...locs].sort((a, b) => soundingAt(a, inst) - soundingAt(b, inst));
  const midis = sorted.map((l) => soundingAt(l, inst) as number);
  const found = identifyChords(midis, midis[0]);
  const flats = found[0] ? prefersFlats(found[0].root) : false;
  return (
    <>
      <Hint>Toque no braço para marcar uma nota por corda (toque de novo para tirar). O app diz qual acorde é.</Hint>
      <Fretboard inst={inst} settings={fbSettings} window={null} marks={locs.map((loc) => ({ loc, kind: 'selected' as const, label: noteName(soundingAt(loc, inst), flats) }))} onCellClick={click} />
      <p className="result-box">{found.length ? found.map((c) => chordLabel(c, flats)).join('  ou  ') : locs.length < 3 ? 'Marque pelo menos 3 notas diferentes' : 'Não reconheci um acorde comum com essas notas'}</p>
      <div className="pill-row">
        <button type="button" className="pill is-on" disabled={!midis.length} onClick={() => void playEvents(harmonic(midis), settings.aRef)}>🔊 Ouvir</button>
        <button type="button" className="pill" onClick={() => setLocs([])}>Limpar</button>
      </div>
    </>
  );
}

// ---------- Campo harmônico ----------
function FieldTool({ play }: Ctx) {
  const [tonic, setTonic] = useState(0);
  const [minor, setMinor] = useState(false);
  const flats = prefersFlats(tonic, minor);
  return (
    <>
      <div className="config-grid">
        <NoteSelect label="Tônica" value={tonic} onChange={setTonic} flats={flats} />
        <label className="field">
          <span>Modo</span>
          <select value={minor ? 'm' : 'M'} onChange={(e) => setMinor(e.target.value === 'm')}>
            <option value="M">Maior</option>
            <option value="m">Menor natural</option>
          </select>
        </label>
      </div>
      <Hint>Toque no acorde para ouvir.</Hint>
      {[false, true].map((tet) => (
        <div key={String(tet)} className="panel">
          <div className="panel-title">{tet ? 'Tétrades' : 'Tríades'}</div>
          <ChordGrid flats={flats} play={play} items={harmonicField(tonic, minor, tet).map((f) => ({ chord: f.chord, sub: `${f.degree} · ${FUNCTION_NAME[f.fn]}` }))} />
        </div>
      ))}
    </>
  );
}

// ---------- Funções harmônicas ----------
function FunctionsTool({ play }: Ctx) {
  const [tonic, setTonic] = useState(0);
  const flats = prefersFlats(tonic);
  const field = harmonicField(tonic);
  const order = ['I', 'VI', 'III', 'IV', 'II', 'V', 'VII'];
  return (
    <>
      <div className="config-grid">
        <NoteSelect label="Tom (maior)" value={tonic} onChange={setTonic} flats={flats} />
      </div>
      <Hint>
        <strong>Tônica</strong> = repouso; <strong>subdominante</strong> = afastamento; <strong>dominante</strong> = tensão que pede a tônica. Toque para ouvir cada grau.
      </Hint>
      <div className="chord-grid">
        {order.map((d) => {
          const f = field.find((x) => x.degree === d)!;
          return (
            <button key={d} type="button" className={`chord-tile fn-${f.fn}`} onClick={() => play(f.chord)}>
              <strong>{FUNCTION_NAME[f.fn]} {f.strength}</strong>
              <span>{d} — {chordLabel(f.chord, flats)}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn-primary wide-btn" onClick={() => void playEvents(['IV', 'V', 'I'].flatMap((d, i) => harmonic(chordMidis(field.find((x) => x.degree === d)!.chord), i * 1.3, 1.3)), 440)}>
        🔊 Ouvir S → D → T (IV – V – I)
      </button>
    </>
  );
}

// ---------- Substituição ----------
function SubstTool({ play }: Ctx) {
  const [root, setRoot] = useState(0);
  const [fn, setFn] = useState<HarmonicFunction>('T');
  const flats = prefersFlats(root);
  return (
    <>
      <div className="config-grid">
        <NoteSelect label="Acorde (maior) a ser substituído" value={root} onChange={setRoot} flats={flats} />
        <label className="field">
          <span>Função desse acorde</span>
          <select value={fn} onChange={(e) => setFn(e.target.value as HarmonicFunction)}>
            <option value="T">Tônica (é o I grau)</option>
            <option value="S">Subdominante (é o IV grau)</option>
            <option value="D">Dominante (é o V grau)</option>
          </select>
        </label>
      </div>
      <Hint>Toque no acorde para ouvir.</Hint>
      <ChordGrid flats={flats} play={play} items={substitutions(root, fn).map((s) => ({ chord: s.chord, sub: s.why }))} />
    </>
  );
}

// ---------- Similaridade ----------
function SimilarTool({ play }: Ctx) {
  const [sel, setSel] = useState<number[]>([]);
  const [flats, setFlats] = useState(false);
  const list = chordsContaining(sel).slice(0, 60);
  return (
    <>
      <div className="pill-row">
        <button type="button" className={`pill${flats ? ' is-on' : ''}`} onClick={() => setFlats((f) => !f)}>{flats ? 'Bemóis ♭' : 'Sustenidos ♯'}</button>
        <button type="button" className="pill" onClick={() => setSel([])}>Limpar</button>
      </div>
      <p className="center">Selecione as notas:</p>
      <div className="note-row">
        {PCS.map((pc) => (
          <button key={pc} type="button" className={`note-dot${sel.includes(pc) ? ' is-on' : ''}`} onClick={() => setSel((s) => (s.includes(pc) ? s.filter((x) => x !== pc) : [...s, pc]))}>
            {noteName(pc, flats)}
          </button>
        ))}
      </div>
      {sel.length === 0 ? <Hint>Escolha uma ou mais notas para ver todos os acordes que as contêm.</Hint> : <ChordGrid flats={flats} play={play} items={list.map((chord) => ({ chord }))} />}
    </>
  );
}

// ---------- Inversão ----------
function InversionTool({ play }: Ctx) {
  const [root, setRoot] = useState(0);
  const [suffix, setSuffix] = useState('');
  const flats = prefersFlats(root);
  const chord: NamedChord = { root, type: chordType(suffix) };
  const names = ['1ª inversão', '2ª inversão', '3ª inversão', '4ª inversão'];
  return (
    <>
      <div className="config-grid">
        <NoteSelect label="Fundamental" value={root} onChange={setRoot} flats={flats} />
        <label className="field">
          <span>Tipo</span>
          <select value={suffix} onChange={(e) => setSuffix(e.target.value)}>
            {CHORD_TYPES.map((t) => (
              <option key={t.suffix} value={t.suffix}>{noteName(root, flats)}{t.suffix} — {t.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="panel">
        <div className="panel-title">Estado fundamental e inversões</div>
        <ChordGrid flats={flats} play={play} items={[{ chord, sub: 'estado fundamental' }, ...inversions(chord).map((c, i) => ({ chord: c, sub: `${names[i]} (baixo em ${noteName(c.bass!, flats)})` }))]} />
      </div>
    </>
  );
}

// ---------- Progressões ----------
function ProgTool({ play, settings }: Ctx) {
  const [idx, setIdx] = useState(0);
  const [tonic, setTonic] = useState(0);
  const p = PROGRESSIONS[idx]!;
  const flats = prefersFlats(tonic, p.chords[p.chords.length - 1]![1].startsWith('m') && p.chords[p.chords.length - 1]![0] === 0);
  const chords = progressionChords(p, tonic);
  return (
    <>
      <div className="config-grid">
        <label className="field">
          <span>Progressão ou cadência</span>
          <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
            {PROGRESSIONS.map((x, i) => (
              <option key={x.name} value={i}>{x.name}</option>
            ))}
          </select>
        </label>
        <NoteSelect label="Grau I (tom)" value={tonic} onChange={setTonic} flats={flats} />
      </div>
      <Hint>{p.about}</Hint>
      <div className="panel">
        <div className="panel-title">Progressão</div>
        <ChordGrid flats={flats} play={play} items={chords.map((c) => ({ chord: c.chord, sub: c.degree }))} />
      </div>
      <button type="button" className="btn-primary wide-btn" onClick={() => void playEvents(chords.flatMap((c, i) => harmonic(chordMidis(c.chord), i * 1.2, 1.2)), settings.aRef)}>
        🔊 Tocar
      </button>
    </>
  );
}

// ---------- Ciclo das quintas ----------
const DEG_COLORS = ['#bff5d3', '#bfdcfb', '#d9bff5', '#f7bff0', '#f5c0a0', '#f29a94', '#fbf7b0'];
const DEG_NAMES = ['I — Tônica', 'V — Dominante', 'II — Supertônica', 'VI — Superdominante', 'III — Mediante', 'VII — Sensível', 'IV — Subdominante'];
function CircleTool({ play }: Ctx) {
  const [k, setK] = useState(0); // índice no ciclo
  const key = CIRCLE[k]!;
  const flats = key.fifths < 0;
  // no ciclo, os 7 graus do tom ficam juntos: IV à esquerda, depois I, V, II, VI, III, VII
  const degOf = (i: number) => {
    const d = (i - k + 12) % 12;
    return d <= 5 ? d : d === 11 ? 6 : -1;
  };
  const R = 150;
  const pos = (i: number, r: number) => {
    const a = ((i - k) * 30 - 90) * (Math.PI / 180);
    return { x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) };
  };
  return (
    <>
      <p className="muted center">Toque numa tonalidade para girar o ciclo até ela.</p>
      <svg className="circle5" viewBox="0 0 400 400" role="group" aria-label="Ciclo das quintas">
        <circle cx={200} cy={200} r={R} className="c5-ring" />
        {CIRCLE.map((c, i) => {
          const o = pos(i, R);
          const m = pos(i, 92);
          const d = degOf(i);
          const fl = c.fifths < 0;
          return (
            <g key={c.pc}>
              <g className="c5-node" onClick={() => { setK(i); play({ root: c.pc, type: chordType('') }); }}>
                <circle cx={o.x} cy={o.y} r={27} fill={d >= 0 ? DEG_COLORS[d] : undefined} className={d < 0 ? 'c5-off' : ''} />
                <text x={o.x} y={o.y + 6} textAnchor="middle" className={d >= 0 ? 'c5-on-text' : 'c5-text'}>{noteName(c.pc, fl)}</text>
              </g>
              <g className="c5-node" onClick={() => play({ root: c.minorPc, type: chordType('m') })}>
                <circle cx={m.x} cy={m.y} r={17} className="c5-off" />
                <text x={m.x} y={m.y + 4} textAnchor="middle" className="c5-text c5-small">{noteName(c.minorPc, fl)}m</text>
              </g>
            </g>
          );
        })}
        <circle cx={200} cy={200} r={46} className="c5-center" />
        <text x={200} y={212} textAnchor="middle" className="c5-center-text">{noteName(key.pc, flats)}</text>
      </svg>
      <p className="center">
        Tonalidade atual: <strong>{noteName(key.pc, flats)} maior</strong> / {noteName(key.minorPc, flats)} menor (relativa) —{' '}
        {key.fifths === 0 ? 'sem acidentes' : `${Math.abs(key.fifths)} ${key.fifths > 0 ? 'sustenido(s)' : 'bemol(óis)'}`}
      </p>
      <div className="pill-row">
        {DEG_NAMES.map((n, d) => (
          <span key={n} className="deg-pill" style={{ background: DEG_COLORS[d] }}>{n}</span>
        ))}
      </div>
      <Hint>Vizinhos no ciclo diferem por um só acidente. À direita sobe uma quinta (mais um sustenido); à esquerda sobe uma quarta (mais um bemol).</Hint>
    </>
  );
}

// ---------- Piano ----------
function PianoTool({ settings }: Ctx) {
  const [last, setLast] = useState<number | null>(null);
  const START = 48; // Dó3
  const keys = Array.from({ length: 25 }, (_, i) => START + i);
  const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(mod12(m));
  const whites = keys.filter((m) => !isBlack(m));
  const ww = 100 / whites.length;
  const hit = (m: number) => {
    setLast(m);
    void playEvents([{ midi: m, at: 0, dur: 1.2 }], settings.aRef);
  };
  return (
    <>
      <p className="result-box">{last === null ? 'Toque numa tecla' : `${noteName(last)} (${noteName(last, false, true)})`}</p>
      <div className="piano" role="group" aria-label="Piano virtual">
        {whites.map((m, i) => (
          <button key={m} type="button" className="pk-white" style={{ left: `${i * ww}%`, width: `${ww}%` }} onPointerDown={() => hit(m)} aria-label={noteName(m)}>
            {mod12(m) === 0 ? 'C' : ''}
          </button>
        ))}
        {keys.filter(isBlack).map((m) => {
          const idx = whites.findIndex((w) => w > m);
          return <button key={m} type="button" className="pk-black" style={{ left: `${idx * ww - ww * 0.3}%`, width: `${ww * 0.6}%` }} onPointerDown={() => hit(m)} aria-label={noteName(m)} />;
        })}
      </div>
      <p className="muted small center">Duas oitavas a partir do Dó3 (soando como a 5ª corda, casa 3, do violão).</p>
    </>
  );
}
