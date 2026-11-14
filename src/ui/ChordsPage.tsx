import { useEffect, useMemo, useState } from 'react';
import { mic, useMicNotes, useMicStatus } from '../audio/microphone';
import { harmonic, melodic, playEvents } from '../audio/player';
import { createRng, randomSeed, type Rng } from '../core/exercise/rng';
import { CAGED_ORDER, cagedShapes, SHAPE_LABEL } from '../core/harmony/caged';
import { bestVoiceLeading, classifyVoicing, enumerateVoicings, evaluateVoicing, voiceLeadingCost, VOICING_LABEL, type VoicingEvaluation, type VoicingRequest, type VoicingType } from '../core/harmony/voicing';
import { makeGuitar, soundingAt, type FretLocation } from '../core/instrument/instrument';
import { fixedPosition, fretWindow, roman } from '../core/instrument/position';
import {
  chordName,
  chordPitchClasses,
  chordSymbol,
  closeVoicingPitches,
  diatonicSevenths,
  INVERSION_LABEL,
  isTetrad,
  roleToInversion,
  TETRADS,
  TRIADS,
  type Chord,
  type ChordQuality,
} from '../core/theory/chords';
import { pitchClass, type SpelledPitch } from '../core/theory/pitch';
import { db, localDay } from '../data/db';
import type { Settings } from '../data/settings';
import Fretboard, { type Mark } from './Fretboard';
import Staff from './Staff';
import { ReviewBanner, useReviewQueue, type ReviewProps } from './review';

/**
 * Módulo G — acordes, inversões e voicings (§6.7). Não confunde o NOME do acorde
 * com uma digitação: qualquer voicing válido é aceito e o feedback explica qual foi feito.
 */
type Mode = 'build' | 'identify' | 'caged' | 'leading';
type Family = 'triads' | 'tetrads';
type TypeAsk = 'any' | 'close' | 'drop2' | 'drop3';

const ROOTS: SpelledPitch[] = [
  { letter: 'C', alter: 0, octave: 4 },
  { letter: 'D', alter: -1, octave: 4 },
  { letter: 'D', alter: 0, octave: 4 },
  { letter: 'E', alter: -1, octave: 4 },
  { letter: 'E', alter: 0, octave: 4 },
  { letter: 'F', alter: 0, octave: 4 },
  { letter: 'F', alter: 1, octave: 4 },
  { letter: 'G', alter: 0, octave: 4 },
  { letter: 'A', alter: -1, octave: 4 },
  { letter: 'A', alter: 0, octave: 4 },
  { letter: 'B', alter: -1, octave: 4 },
  { letter: 'B', alter: 0, octave: 4 },
];

const STRING_SETS: Record<Exclude<TypeAsk, 'any'>, number[][]> = {
  close: [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6]],
  drop2: [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]],
  drop3: [[1, 2, 3, 5], [2, 3, 4, 6]],
};

function logChord(kcId: string, correct: boolean, choice: string, module: 'G' | 'H' = 'G') {
  const now = Date.now();
  db.attempts
    .add({ ts: now, day: localDay(now), module, kcId, direction: module === 'G' ? 'chord' : 'ear', seed: 0, correct, score: correct ? 1 : 0, errorCode: null, rtMs: 0, inputMethod: 'mouse', answer: { choice }, written: '', sessionId: 'chords' })
    .catch(() => undefined);
}

const writtenChord = (c: Chord, inversion: number) =>
  closeVoicingPitches(c, inversion, 4).map((p) => ({ pitch: p, accidental: p.alter !== 0 ? p.alter : null }));

const soundingMidis = (locs: readonly FretLocation[], inst: ReturnType<typeof makeGuitar>) => locs.map((l) => soundingAt(l, inst)).sort((a, b) => a - b);

// ---------------------------------------------------------------- perguntas "construir"

interface BuildQ {
  readonly chord: Chord;
  readonly req: VoicingRequest;
  readonly example: FretLocation[];
}

/** Item de revisão "acorde:{qualidade}:{tipo|livre|arpejo}:{inversão|x}". */
interface BuildForce {
  readonly quality: ChordQuality;
  readonly type?: VoicingType;
  readonly inversion?: number;
}

function parseBuildForce(id: string): BuildForce | null {
  const [, q, type, inv] = id.split(':');
  if (!q || ![...TRIADS, ...TETRADS].includes(q as ChordQuality)) return null;
  const t = type && type in VOICING_LABEL ? (type as VoicingType) : undefined;
  const i = inv !== undefined && inv !== 'x' && !Number.isNaN(Number(inv)) ? Number(inv) : undefined;
  return { quality: q as ChordQuality, ...(t ? { type: t } : {}), ...(i !== undefined ? { inversion: i } : {}) };
}

function makeBuildQ(family: Family, askInv: boolean, typeAsk: TypeAsk, inst: ReturnType<typeof makeGuitar>, rng: Rng, force?: BuildForce): BuildQ {
  for (let tries = 0; tries < 300; tries++) {
    const quality = force?.quality ?? rng.pick(family === 'triads' ? TRIADS : TETRADS);
    const chord: Chord = { root: rng.pick(ROOTS), quality };
    const tetrad = isTetrad(quality);
    const type: VoicingType | undefined = force ? force.type : typeAsk === 'any' ? undefined : typeAsk;
    if (type === 'close' && tetrad) continue;
    if ((type === 'drop2' || type === 'drop3') && !tetrad) continue;
    const strings = type && type !== 'open' && type !== 'drop24' ? rng.pick(STRING_SETS[type]) : undefined;
    const inversion = force ? force.inversion : askInv ? rng.int(0, tetrad ? 3 : 2) : undefined;
    const req: VoicingRequest = { chord, ...(type ? { type } : {}), ...(strings ? { strings } : {}), ...(inversion !== undefined ? { inversion } : {}) };
    const sets = strings ? [strings] : tetrad ? [...STRING_SETS.drop2, ...STRING_SETS.drop3] : STRING_SETS.close;
    const valid = sets.flatMap((s) => enumerateVoicings(chord, s, inst, { maxFret: 12 })).filter((v) => evaluateVoicing(v, req, inst).correct);
    if (!valid.length) continue;
    const example = valid.sort((a, b) => Math.max(...a.map((l) => l.fret)) - Math.max(...b.map((l) => l.fret)))[0]!;
    return { chord, req, example };
  }
  throw new Error('Sem acorde possível com essas opções');
}

function describeReq(q: BuildQ): string {
  const parts = [chordSymbol(q.chord)];
  if (q.req.inversion !== undefined) parts.push(INVERSION_LABEL[q.req.inversion]!);
  if (q.req.type) parts.push(VOICING_LABEL[q.req.type]);
  if (q.req.strings) parts.push(`cordas ${[...q.req.strings].sort((a, b) => a - b).join('-')}`);
  return parts.join(' · ');
}

// ---------------------------------------------------------------- página

export default function ChordsPage({ settings, review, onReviewDone }: { settings: Settings } & ReviewProps) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const [mode, setMode] = useState<Mode>('build');
  const rq = useReviewQueue(review);
  const cur = rq.current;
  const buildForce = cur?.startsWith('acorde:') ? parseBuildForce(cur) : null;
  const idForce = cur?.startsWith('ident:') ? (cur.split(':')[1] as ChordQuality) : null;

  // revisão: o modo segue o item atual
  useEffect(() => {
    if (!cur) return;
    if (cur.startsWith('acorde:')) setMode(buildForce ? 'build' : 'build');
    else if (cur.startsWith('ident:')) setMode('identify');
    else if (cur.startsWith('conducao:')) setMode('leading');
    else rq.advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);
  const onNext = rq.active ? rq.advance : undefined;

  return (
    <section className="page">
      <header className="page-head">
        <h1>Acordes e harmonia</h1>
        <p className="muted">Módulo G — o nome do acorde não é uma digitação: qualquer voicing válido é aceito, e o app explica qual você fez.</p>
      </header>
      <ReviewBanner q={rq} naming={settings.naming} onExit={onReviewDone} />
      <div className="tabs" role="tablist">
        {(
          [
            ['build', 'Construir no braço'],
            ['identify', 'Identificar'],
            ['caged', 'Mapa CAGED'],
            ['leading', 'Condução de vozes'],
          ] as [Mode, string][]
        ).map(([m, l]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={`tab${mode === m ? ' is-on' : ''}`} onClick={() => setMode(m)}>
            {l}
          </button>
        ))}
      </div>
      {mode === 'build' && <Build key={cur ?? 'livre'} inst={inst} settings={settings} force={buildForce ?? undefined} onNext={onNext} />}
      {mode === 'identify' && <Identify key={cur ?? 'livre'} inst={inst} settings={settings} force={idForce ?? undefined} onNext={onNext} />}
      {mode === 'caged' && <Caged inst={inst} settings={settings} />}
      {mode === 'leading' && <Leading key={cur ?? 'livre'} inst={inst} settings={settings} onNext={onNext} />}
    </section>
  );
}

type Inst = ReturnType<typeof makeGuitar>;

/** Seleção no braço: no máximo uma nota por corda (clicar de novo apaga). */
function useVoicingSelection() {
  const [sel, setSel] = useState<Map<number, number>>(new Map());
  const toggle = (loc: FretLocation) =>
    setSel((m) => {
      const next = new Map(m);
      if (next.get(loc.string) === loc.fret) next.delete(loc.string);
      else next.set(loc.string, loc.fret);
      return next;
    });
  const locs: FretLocation[] = [...sel.entries()].map(([string, fret]) => ({ string, fret }));
  return { locs, toggle, clear: () => setSel(new Map()), set: (l: FretLocation[]) => setSel(new Map(l.map((x) => [x.string, x.fret]))) };
}

function Checks({ ev }: { ev: VoicingEvaluation }) {
  return (
    <ul className="checks-list">
      {ev.checks.map((c) => (
        <li key={c.label} className={c.ok ? 'ok' : 'bad'}>
          {c.ok ? '✓' : '✗'} {c.label}
          {!c.ok && c.detail ? ` — ${c.detail}` : ''}
        </li>
      ))}
    </ul>
  );
}

function analysisLine(ev: VoicingEvaluation): string {
  const a = ev.analysis;
  return `Você fez: ${a.type ? VOICING_LABEL[a.type] : '—'}${a.inversion !== null ? `, ${INVERSION_LABEL[a.inversion]}` : ''}, cordas ${a.strings.join('-') || '—'}, abertura de ${a.span} casa(s)${a.skipsStrings ? ', com corda pulada' : ''}.`;
}

// ---------------------------------------------------------------- construir

function Build({ inst, settings, force, onNext }: { inst: Inst; settings: Settings; force?: BuildForce; onNext?: () => void }) {
  const [family, setFamily] = useState<Family>(force && isTetrad(force.quality) ? 'tetrads' : 'triads');
  const [askInv, setAskInv] = useState(false);
  const [typeAsk, setTypeAsk] = useState<TypeAsk>('any');
  const [q, setQ] = useState<BuildQ | null>(null);
  const [ev, setEv] = useState<VoicingEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState<number[]>([]);
  const sel = useVoicingSelection();
  const micState = useMicStatus();
  const micOn = micState.status === 'on' || micState.status === 'test';

  const generate = () => {
    try {
      setError(null);
      setQ(makeBuildQ(family, askInv, typeAsk, inst, createRng(randomSeed()), force));
      setEv(null);
      setHeard([]);
      sel.clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const next = () => (onNext ? onNext() : generate());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(generate, [family, askInv, typeAsk, inst]);
  useEffect(() => {
    if (family === 'triads' && (typeAsk === 'drop2' || typeAsk === 'drop3')) setTypeAsk('any');
    if (family === 'tetrads' && typeAsk === 'close') setTypeAsk('any');
  }, [family, typeAsk]);

  // acorde arpejado no violão: junta as alturas ouvidas (o baixo = a mais grave)
  useMicNotes((n) => setHeard((h) => (h.includes(n.midi) ? h : [...h, n.midi])), micOn && !ev);

  if (!q) return error ? <p className="warn">{error}</p> : null;

  const confirm = () => {
    const e = evaluateVoicing(sel.locs, q.req, inst);
    setEv(e);
    logChord(`acorde:${q.chord.quality}:${q.req.type ?? 'livre'}:${q.req.inversion ?? 'x'}`, e.correct, sel.locs.map((l) => `${l.string}:${l.fret}`).join(' '));
  };

  const confirmHeard = () => {
    const roles = chordPitchClasses(q.chord);
    const pcs = new Set(heard.map(pitchClass));
    const foreign = heard.filter((m) => !roles.has(pitchClass(m)));
    const missing = [...roles.entries()].filter(([pc]) => !pcs.has(pc)).map(([, r]) => r);
    const bass = Math.min(...heard);
    const inv = roles.has(pitchClass(bass)) ? roleToInversion(roles.get(pitchClass(bass))!) : null;
    const checks = [
      { label: 'Só notas do acorde', ok: foreign.length === 0 },
      { label: 'Todas as funções presentes', ok: missing.length === 0, detail: missing.length ? `falta: ${missing.join(', ')}` : undefined },
      ...(q.req.inversion !== undefined ? [{ label: INVERSION_LABEL[q.req.inversion]!, ok: inv === q.req.inversion, detail: inv === null ? undefined : `baixo: ${INVERSION_LABEL[inv]}` }] : []),
      { label: 'Tipo de voicing e cordas', ok: true, detail: 'não verificáveis pelo microfone' },
    ];
    const e: VoicingEvaluation = { correct: checks.every((c) => c.ok), checks, analysis: evaluateVoicing([], q.req, inst).analysis };
    setEv(e);
    logChord(`acorde:${q.chord.quality}:arpejo:${q.req.inversion ?? 'x'}`, e.correct, heard.join(' '));
  };

  const marks: Mark[] = [
    ...sel.locs.map((loc) => ({ loc, kind: (ev ? (ev.correct ? 'correct' : 'wrong') : 'selected') as Mark['kind'] })),
    ...(ev && !ev.correct ? q.example.map((loc) => ({ loc, kind: 'valid' as const })) : []),
  ];

  return (
    <div className="train-stage">
      <div className="config-grid compact">
        <select value={family} onChange={(e) => setFamily(e.target.value as Family)} aria-label="Família">
          <option value="triads">Tríades</option>
          <option value="tetrads">Tétrades</option>
        </select>
        <select value={typeAsk} onChange={(e) => setTypeAsk(e.target.value as TypeAsk)} aria-label="Tipo de voicing">
          <option value="any">Qualquer voicing</option>
          {family === 'triads' && <option value="close">Posição fechada em 3 cordas</option>}
          {family === 'tetrads' && <option value="drop2">Drop 2</option>}
          {family === 'tetrads' && <option value="drop3">Drop 3</option>}
        </select>
        <label className="checks"><span><input type="checkbox" checked={askInv} onChange={(e) => setAskInv(e.target.checked)} /> Pedir inversão</span></label>
      </div>

      <p className="prompt">
        <span className="tag">Construa: {describeReq(q)}</span>
      </p>
      <Staff fifths={0} notes={writtenChord(q.chord, q.req.inversion ?? 0)} chord label={`Acorde ${chordSymbol(q.chord)}`} />
      <p className="muted small center">{chordName(q.chord, settings.naming)} — na pauta, em posição fechada; no braço, distribua como pedido.</p>

      <Fretboard inst={inst} settings={settings} window={null} marks={marks} onCellClick={ev ? undefined : (l) => sel.toggle(l)} disabled={!!ev} />

      {!ev && (
        <div className="actions center">
          <button type="button" className="btn-primary" disabled={sel.locs.length < 3} onClick={confirm}>Confirmar</button>
          <button type="button" onClick={sel.clear}>Limpar</button>
          <button type="button" disabled={sel.locs.length === 0} onClick={() => void playEvents(harmonic(soundingMidis(sel.locs, inst)), settings.aRef)}>Ouvir o meu</button>
          <button type="button" onClick={() => void playEvents(harmonic(soundingMidis(q.example, inst)), settings.aRef)}>Ouvir o acorde</button>
        </div>
      )}

      {!ev && (
        <div className="mic-toggle">
          {micOn ? (
            <>
              <span className="mic-heard">🎤 Arpeje o acorde no violão (nota por nota). Ouvi: {heard.length ? heard.map((m) => roleOf(q.chord, m)).join(' ') : '—'}</span>
              <button type="button" disabled={heard.length < 3} onClick={confirmHeard}>Avaliar o arpejo</button>
              <button type="button" className="btn-ghost" onClick={() => setHeard([])}>Recomeçar</button>
              <button type="button" className="btn-ghost" onClick={() => mic.stop()}>Desligar</button>
            </>
          ) : (
            <button type="button" onClick={() => void mic.start(settings.micDeviceId || undefined)}>🎤 Tocar arpejado no violão</button>
          )}
        </div>
      )}

      {ev && (
        <div className={`feedback ${ev.correct ? 'is-ok' : 'is-bad'}`}>
          <p className="feedback-title">{ev.correct ? 'Correto' : 'Ainda não'}</p>
          <Checks ev={ev} />
          {sel.locs.length > 0 && <p className="small">{analysisLine(ev)}</p>}
          {!ev.correct && <p className="small">Um exemplo válido aparece em verde no braço (há outros).</p>}
          <button type="button" className="btn-primary" onClick={next}>Próximo</button>
        </div>
      )}
    </div>
  );
}

function roleOf(c: Chord, midi: number): string {
  const r = chordPitchClasses(c).get(pitchClass(midi));
  return r ? (r === '1' ? 'F' : r) : '×';
}

// ---------------------------------------------------------------- identificar

interface IdQ {
  readonly chord: Chord;
  readonly voicing: FretLocation[];
  readonly inversion: number;
  readonly options: Chord[];
}

function makeIdQ(family: Family, inst: Inst, rng: Rng, forceQuality?: ChordQuality): IdQ {
  for (;;) {
    const qualities = family === 'triads' ? TRIADS : TETRADS;
    const chord: Chord = { root: rng.pick(ROOTS), quality: forceQuality ?? rng.pick(qualities) };
    const set = rng.pick(family === 'triads' ? STRING_SETS.close : [...STRING_SETS.drop2, ...STRING_SETS.drop3]);
    const vs = enumerateVoicings(chord, set, inst, { maxFret: 12 }).filter((v) => {
      const t = classifyVoicing(soundingMidis(v, inst));
      return family === 'triads' ? t === 'close' : t === 'drop2' || t === 'drop3';
    });
    if (!vs.length) continue;
    const voicing = rng.pick(vs);
    const ev = evaluateVoicing(voicing, { chord }, inst);
    const opts = new Map<string, Chord>([[chordSymbol(chord), chord]]);
    while (opts.size < 4) {
      const alt: Chord = rng.next() < 0.5 ? { root: chord.root, quality: rng.pick(qualities) } : { root: rng.pick(ROOTS), quality: chord.quality };
      opts.set(chordSymbol(alt), alt);
    }
    const options = [...opts.values()].sort(() => rng.next() - 0.5);
    return { chord, voicing, inversion: ev.analysis.inversion ?? 0, options };
  }
}

function Identify({ inst, settings, force, onNext }: { inst: Inst; settings: Settings; force?: ChordQuality; onNext?: () => void }) {
  const [family, setFamily] = useState<Family>(force && isTetrad(force) ? 'tetrads' : 'triads');
  const [q, setQ] = useState<IdQ>(() => makeIdQ(force && isTetrad(force) ? 'tetrads' : 'triads', inst, createRng(randomSeed()), force));
  const [pick, setPick] = useState<{ chord: string | null; inv: number | null }>({ chord: null, inv: null });
  const [done, setDone] = useState<boolean | null>(null);
  const next = () => {
    if (onNext && done !== null) return onNext();
    setQ(makeIdQ(family, inst, createRng(randomSeed()), force));
    setPick({ chord: null, inv: null });
    setDone(null);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(next, [family, inst]);

  useEffect(() => {
    if (done !== null || pick.chord === null || pick.inv === null) return;
    const ok = pick.chord === chordSymbol(q.chord) && pick.inv === q.inversion;
    setDone(ok);
    logChord(`ident:${q.chord.quality}`, ok, `${pick.chord}/${pick.inv}`);
  }, [pick, q, done]);

  const ev = evaluateVoicing(q.voicing, { chord: q.chord }, inst);
  const marks: Mark[] = q.voicing.map((loc) => ({ loc, kind: 'selected' as const, label: done !== null ? roleOf(q.chord, soundingAt(loc, inst)) : undefined }));
  return (
    <div className="train-stage">
      <div className="config-grid compact">
        <select value={family} onChange={(e) => setFamily(e.target.value as Family)} aria-label="Família">
          <option value="triads">Tríades (posição fechada)</option>
          <option value="tetrads">Tétrades (Drop 2 / Drop 3)</option>
        </select>
        <button type="button" onClick={() => void playEvents(harmonic(soundingMidis(q.voicing, inst)), settings.aRef)}>Ouvir</button>
      </div>
      <p className="prompt"><span className="tag">Que acorde é este, e em que inversão?</span></p>
      <Fretboard inst={inst} settings={settings} window={null} marks={marks} />
      <div className="actions answer-row">
        {q.options.map((c) => {
          const s = chordSymbol(c);
          const cls = done !== null ? (s === chordSymbol(q.chord) ? 'is-right' : pick.chord === s ? 'is-wrong' : '') : pick.chord === s ? 'chip is-on' : '';
          return (
            <button key={s} type="button" className={cls} disabled={done !== null} onClick={() => setPick((p) => ({ ...p, chord: s }))}>
              {chordSymbol(c, settings.naming)}
            </button>
          );
        })}
      </div>
      <div className="actions answer-row">
        {INVERSION_LABEL.slice(0, isTetrad(q.chord.quality) ? 4 : 3).map((l, i) => {
          const cls = done !== null ? (i === q.inversion ? 'is-right' : pick.inv === i ? 'is-wrong' : '') : pick.inv === i ? 'chip is-on' : '';
          return (
            <button key={i} type="button" className={cls} disabled={done !== null} onClick={() => setPick((p) => ({ ...p, inv: i }))}>
              {l.split(' (')[0]}
            </button>
          );
        })}
      </div>
      {done !== null && (
        <div className={`feedback ${done ? 'is-ok' : 'is-bad'}`}>
          <p className="feedback-title">{done ? 'Correto' : 'Incorreto'}</p>
          <p>
            {chordName(q.chord, settings.naming)} ({chordSymbol(q.chord, settings.naming)}), {INVERSION_LABEL[q.inversion]}. {analysisLine(ev).replace('Você fez', 'Distribuição')}
          </p>
          <p className="small muted">No braço: F = fundamental, 3/5/7 = funções.</p>
          <button type="button" className="btn-primary" onClick={next}>Próximo</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- CAGED

function Caged({ inst, settings }: { inst: Inst; settings: Settings }) {
  const [rootIdx, setRootIdx] = useState(9); // Lá
  const [minor, setMinor] = useState(false);
  const chord: Chord = { root: ROOTS[rootIdx]!, quality: minor ? 'min' : 'maj' };
  const shapes = cagedShapes(chord, inst);
  const [shapeIdx, setShapeIdx] = useState(0);
  const shape = shapes[Math.min(shapeIdx, shapes.length - 1)];
  const marks: Mark[] = shape ? shape.locs.map((loc) => ({ loc, kind: 'valid' as const, label: roleOf(chord, soundingAt(loc, inst)) })) : [];
  const win = shape && shape.shift > 0 ? fretWindow(fixedPosition(shape.position), inst.frets) : null;
  return (
    <div className="train-stage">
      <div className="config-grid compact">
        <select value={rootIdx} onChange={(e) => setRootIdx(Number(e.target.value))} aria-label="Fundamental">
          {ROOTS.map((r, i) => (
            <option key={i} value={i}>{chordSymbol({ root: r, quality: 'maj' }, settings.naming)}</option>
          ))}
        </select>
        <select value={minor ? 'min' : 'maj'} onChange={(e) => setMinor(e.target.value === 'min')} aria-label="Qualidade">
          <option value="maj">Maior (C, A, G, E, D)</option>
          <option value="min">Menor (A, E, D)</option>
        </select>
      </div>
      <div className="actions answer-row">
        {shapes.map((s, i) => (
          <button key={s.shape} type="button" className={i === shapeIdx ? 'chip is-on wide' : 'wide'} onClick={() => setShapeIdx(i)}>
            {SHAPE_LABEL[s.shape]} · {s.shift === 0 ? 'aberto' : `${roman(s.position)} pos.`}
          </button>
        ))}
      </div>
      {shape && (
        <p className="center">
          <strong>{chordSymbol(chord, settings.naming)}</strong> na {SHAPE_LABEL[shape.shape]}
          {shape.shift === 0 ? ' — é o próprio acorde aberto.' : ` — vive na ${roman(shape.position)} posição de Leavitt (a "pestana" faz o papel da pestana do acorde aberto).`}{' '}
          <button type="button" className="btn-ghost" onClick={() => void playEvents(harmonic(soundingMidis(shape.locs, inst)), settings.aRef)}>Ouvir</button>
        </p>
      )}
      <Fretboard inst={inst} settings={settings} window={win} marks={marks} />
      <p className="muted small">
        As cinco formas, na ordem {CAGED_ORDER.join('-')}, cobrem o braço todo. Use o CAGED como mapa de onde estão as notas do acorde em cada posição — não como
        substituto da leitura. F = fundamental.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- condução de vozes

const KEYS: SpelledPitch[] = [ROOTS[0]!, ROOTS[5]!, ROOTS[7]!, ROOTS[10]!, ROOTS[2]!];

function Leading({ inst, settings, onNext }: { inst: Inst; settings: Settings; onNext?: () => void }) {
  const [keyIdx, setKeyIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const strings = STRING_SETS.drop2[setIdx]!;
  const prog = useMemo(() => {
    const d = diatonicSevenths(KEYS[keyIdx]!);
    return [d[1]!, d[4]!, d[0]!];
  }, [keyIdx]);
  const start = useMemo(() => {
    const vs = enumerateVoicings(prog[0]!, strings, inst, { maxFret: 12 }).filter((v) => classifyVoicing(soundingMidis(v, inst)) === 'drop2');
    return vs.sort((a, b) => Math.abs(avg(a) - 6) - Math.abs(avg(b) - 6))[0] ?? [];
  }, [prog, strings, inst]);
  const [step, setStep] = useState(1);
  const [history, setHistory] = useState<FretLocation[][]>([start]);
  const [result, setResult] = useState<{ ev: VoicingEvaluation; cost: number; best: { voicing: FretLocation[]; cost: number } | null } | null>(null);
  const sel = useVoicingSelection();
  useEffect(() => {
    setStep(1);
    setHistory([start]);
    setResult(null);
    sel.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const prev = history[history.length - 1]!;
  const target = prog[step];
  const confirm = () => {
    if (!target) return;
    const ev = evaluateVoicing(sel.locs, { chord: target, strings }, inst);
    const best = bestVoiceLeading(prev, target, strings, inst, { maxFret: 15 });
    const cost = ev.correct ? voiceLeadingCost(prev, sel.locs, inst) : Infinity;
    setResult({ ev, cost, best });
    logChord(`conducao:${target.quality}`, ev.correct && best !== null && cost <= best.cost, String(cost));
  };
  const advance = () => {
    const used = result?.ev.correct ? sel.locs : (result?.best?.voicing ?? sel.locs);
    setHistory((h) => [...h, used]);
    setStep((s) => s + 1);
    setResult(null);
    sel.clear();
  };

  const marks: Mark[] = [
    ...prev.map((loc) => ({ loc, kind: 'muted' as const })),
    ...sel.locs.map((loc) => ({ loc, kind: (result ? (result.ev.correct ? 'correct' : 'wrong') : 'selected') as Mark['kind'] })),
    ...(result?.best && (!result.ev.correct || result.cost > result.best.cost) ? result.best.voicing.map((loc) => ({ loc, kind: 'valid' as const })) : []),
  ];

  return (
    <div className="train-stage">
      <div className="config-grid compact">
        <select value={keyIdx} onChange={(e) => setKeyIdx(Number(e.target.value))} aria-label="Tonalidade">
          {KEYS.map((k, i) => (
            <option key={i} value={i}>Tom de {chordSymbol({ root: k, quality: 'maj' }, settings.naming)}</option>
          ))}
        </select>
        <select value={setIdx} onChange={(e) => setSetIdx(Number(e.target.value))} aria-label="Cordas">
          {STRING_SETS.drop2.map((s, i) => (
            <option key={i} value={i}>Drop 2 nas cordas {s.join('-')}</option>
          ))}
        </select>
      </div>
      <p className="prompt">
        <span className="tag">
          II–V–I: {prog.map((c, i) => (i === step ? `[${chordSymbol(c, settings.naming)}]` : chordSymbol(c, settings.naming))).join(' → ')}
        </span>
      </p>
      {target ? (
        <p className="center">
          Do acorde anterior (cinza), monte <strong>{chordSymbol(target, settings.naming)}</strong> nas cordas {strings.join('-')} movendo as vozes o mínimo possível.
        </p>
      ) : (
        <p className="center">Progressão completa. Movimento total: {history.slice(1).reduce((s, v, i) => s + voiceLeadingCost(history[i]!, v, inst), 0)} semitons.</p>
      )}
      <Fretboard inst={inst} settings={settings} window={null} marks={marks} onCellClick={target && !result ? (l) => sel.toggle(l) : undefined} disabled={!target || !!result} />
      <div className="actions center">
        {target && !result && (
          <>
            <button type="button" className="btn-primary" disabled={sel.locs.length < 3} onClick={confirm}>Confirmar</button>
            <button type="button" onClick={sel.clear}>Limpar</button>
          </>
        )}
        <button type="button" onClick={() => void playEvents(history.flatMap((v, i) => harmonic(soundingMidis(v, inst), i * 1.4, 1.4)), settings.aRef)}>Ouvir a progressão até aqui</button>
        {!target && (
          <button type="button" onClick={() => { setStep(1); setHistory([start]); }}>Recomeçar</button>
        )}
        {!target && onNext && (
          <button type="button" className="btn-primary" onClick={onNext}>Próxima revisão</button>
        )}
      </div>
      {result && (
        <div className={`feedback ${result.ev.correct && result.best && result.cost <= result.best.cost ? 'is-ok' : 'is-bad'}`}>
          <p className="feedback-title">
            {!result.ev.correct ? 'Acorde incorreto' : result.best && result.cost <= result.best.cost ? 'Condução ótima' : 'Acorde certo, mas dá para mover menos'}
          </p>
          {!result.ev.correct && <Checks ev={result.ev} />}
          {result.ev.correct && result.best && (
            <p>
              Suas vozes se moveram {result.cost} semitons no total; o mínimo possível é {result.best.cost}.
              {result.cost > result.best.cost && ' A solução de menor movimento está em verde.'} Notas comuns ficam paradas; as outras andam por grau.
            </p>
          )}
          <button type="button" className="btn-primary" onClick={advance}>
            {step + 1 < prog.length ? 'Próximo acorde' : 'Concluir'}
          </button>
        </div>
      )}
      <button type="button" className="btn-ghost" onClick={() => void playEvents(melodic(soundingMidis(prev, inst), 0.3), settings.aRef)}>Arpejar o acorde anterior</button>
    </div>
  );
}

function avg(v: FretLocation[]): number {
  return v.reduce((s, l) => s + l.fret, 0) / Math.max(1, v.length);
}

export type { ChordQuality };
