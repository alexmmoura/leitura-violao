import { soundingAt, type FretLocation, type Instrument } from '../instrument/instrument';
import { chordPitchClasses, chordTones, INVERSION_LABEL, isTetrad, roleToInversion, type Chord, type ChordRole } from '../theory/chords';
import { pitchClass } from '../theory/pitch';

/**
 * Voicings — especificação §6.7 e §9.6.
 * Um nome de acorde tem MUITAS digitações válidas: a validação é por regras
 * (classes de altura, baixo, tipo de distribuição, tocabilidade), nunca por
 * comparação com uma digitação fixa.
 */
export type VoicingType = 'close' | 'drop2' | 'drop3' | 'drop24' | 'open';

export const VOICING_LABEL: Readonly<Record<VoicingType, string>> = {
  close: 'posição fechada',
  drop2: 'Drop 2',
  drop3: 'Drop 3',
  drop24: 'Drop 2+4',
  open: 'posição aberta',
};

export interface VoicedNote {
  readonly loc: FretLocation;
  readonly midi: number;
  /** null = nota estranha ao acorde. */
  readonly role: ChordRole | null;
}

export interface VoicingAnalysis {
  /** Notas da mais grave para a mais aguda. */
  readonly notes: VoicedNote[];
  readonly duplicateStrings: boolean;
  readonly foreign: VoicedNote[];
  readonly missing: ChordRole[];
  readonly inversion: number | null;
  readonly type: VoicingType | null;
  /** Abertura de mão: maior − menor casa PRESA. */
  readonly span: number;
  readonly strings: number[];
  /** Há corda sem nota entre a mais grave e a mais aguda usadas. */
  readonly skipsStrings: boolean;
}

const isClose = (midis: readonly number[]) => {
  const s = [...midis].sort((a, b) => a - b);
  return s[s.length - 1]! - s[0]! < 12 && new Set(s.map(pitchClass)).size === s.length;
};

/** Classifica a distribuição de vozes (alturas, da grave para a aguda). */
export function classifyVoicing(midisIn: readonly number[]): VoicingType {
  const midis = [...midisIn].sort((a, b) => a - b);
  if (isClose(midis)) return 'close';
  if (midis.length === 4 && new Set(midis.map(pitchClass)).size === 4) {
    // desfaz o "drop": sobe a voz mais grave uma oitava e vê onde ela cai
    const raised = midis[0]! + 12;
    const one = [...midis.slice(1), raised].sort((a, b) => a - b);
    if (isClose(one)) {
      const fromTop = one.length - one.indexOf(raised); // 1 = mais aguda
      if (fromTop === 2) return 'drop2';
      if (fromTop === 3) return 'drop3';
    }
    const two = [...midis.slice(2), midis[0]! + 12, midis[1]! + 12].sort((a, b) => a - b);
    if (isClose(two)) return 'drop24';
  }
  return 'open';
}

export function analyzeVoicing(locs: readonly FretLocation[], chord: Chord, inst: Instrument, omit5 = false): VoicingAnalysis {
  const roles = chordPitchClasses(chord);
  const notes = locs
    .map((loc) => {
      const midi = soundingAt(loc, inst);
      return { loc, midi, role: roles.get(pitchClass(midi)) ?? null };
    })
    .sort((a, b) => a.midi - b.midi);
  const strings = [...new Set(locs.map((l) => l.string))].sort((a, b) => a - b);
  const duplicateStrings = strings.length !== locs.length;
  const present = new Set(notes.map((n) => n.role).filter(Boolean));
  const missing = chordTones(chord)
    .map((t) => t.role)
    .filter((r) => !present.has(r) && !(omit5 && r === '5'));
  const fretted = locs.filter((l) => l.fret > 0).map((l) => l.fret);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const bass = notes[0];
  return {
    notes,
    duplicateStrings,
    foreign: notes.filter((n) => n.role === null),
    missing,
    inversion: bass?.role ? roleToInversion(bass.role) : null,
    type: notes.length >= 3 ? classifyVoicing(notes.map((n) => n.midi)) : null,
    span,
    strings,
    skipsStrings: strings.length > 1 && strings[strings.length - 1]! - strings[0]! + 1 > strings.length,
  };
}

export interface VoicingRequest {
  readonly chord: Chord;
  readonly inversion?: number;
  readonly type?: VoicingType;
  /** Conjunto exato de cordas pedido. */
  readonly strings?: readonly number[];
  readonly omit5?: boolean;
  /** Abertura máxima da mão (casas presas). Padrão 4. */
  readonly maxSpan?: number;
}

export interface VoicingCheck {
  readonly label: string;
  readonly ok: boolean;
  readonly detail?: string;
}

export interface VoicingEvaluation {
  readonly correct: boolean;
  readonly analysis: VoicingAnalysis;
  readonly checks: VoicingCheck[];
}

/** Validação atributo por atributo (§9.6), para feedback do tipo "certo, mas era Drop 3". */
export function evaluateVoicing(locs: readonly FretLocation[], req: VoicingRequest, inst: Instrument): VoicingEvaluation {
  const a = analyzeVoicing(locs, req.chord, inst, req.omit5);
  const checks: VoicingCheck[] = [];
  const minNotes = isTetrad(req.chord.quality) ? 4 - (req.omit5 ? 1 : 0) : 3;
  checks.push({ label: 'Uma nota por corda', ok: !a.duplicateStrings });
  checks.push({ label: `Pelo menos ${minNotes} notas`, ok: locs.length >= minNotes, detail: `${locs.length} marcada(s)` });
  checks.push({ label: 'Só notas do acorde', ok: a.foreign.length === 0, detail: a.foreign.length ? `${a.foreign.length} nota(s) estranha(s)` : undefined });
  checks.push({ label: 'Todas as funções presentes', ok: a.missing.length === 0, detail: a.missing.length ? `falta: ${a.missing.map((r) => (r === '1' ? 'fundamental' : `${r}ª`)).join(', ')}` : undefined });
  const maxSpan = req.maxSpan ?? 4;
  checks.push({ label: `Tocável (abertura ≤ ${maxSpan} casas)`, ok: a.span <= maxSpan, detail: `abertura ${a.span}` });
  if (req.inversion !== undefined) {
    checks.push({
      label: INVERSION_LABEL[req.inversion]!,
      ok: a.inversion === req.inversion,
      detail: a.inversion === null ? 'baixo não é nota do acorde' : `você fez ${INVERSION_LABEL[a.inversion]}`,
    });
  }
  if (req.type) {
    checks.push({ label: VOICING_LABEL[req.type], ok: a.type === req.type, detail: a.type ? `você fez ${VOICING_LABEL[a.type]}` : undefined });
  }
  if (req.strings) {
    const want = [...req.strings].sort((x, y) => x - y);
    checks.push({ label: `Cordas ${want.join('-')}`, ok: want.length === a.strings.length && want.every((s, i) => a.strings[i] === s), detail: `você usou ${a.strings.join('-') || 'nenhuma'}` });
  }
  return { correct: checks.every((c) => c.ok), analysis: a, checks };
}

/**
 * Todos os voicings de um acorde num conjunto de cordas (uma nota por corda),
 * com todas as funções presentes e abertura ≤ maxSpan.
 */
export function enumerateVoicings(chord: Chord, strings: readonly number[], inst: Instrument, opts: { maxFret?: number; maxSpan?: number; allowOpen?: boolean } = {}): FretLocation[][] {
  const maxFret = Math.min(opts.maxFret ?? 15, inst.frets);
  const maxSpan = opts.maxSpan ?? 4;
  const roles = chordPitchClasses(chord);
  const perString = strings.map((s) => {
    const out: FretLocation[] = [];
    for (let f = opts.allowOpen === false ? 1 : 0; f <= maxFret; f++) {
      const loc = { string: s, fret: f };
      if (roles.has(pitchClass(soundingAt(loc, inst)))) out.push(loc);
    }
    return out;
  });
  const result: FretLocation[][] = [];
  const need = roles.size;
  const rec = (i: number, acc: FretLocation[]) => {
    if (i === perString.length) {
      const pcs = new Set(acc.map((l) => pitchClass(soundingAt(l, inst))));
      if (pcs.size < Math.min(need, acc.length)) return;
      if (strings.length >= need && pcs.size < need) return;
      result.push([...acc]);
      return;
    }
    for (const loc of perString[i]!) {
      const fretted = [...acc, loc].filter((l) => l.fret > 0).map((l) => l.fret);
      if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > maxSpan) continue;
      acc.push(loc);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return result;
}

/**
 * Custo de condução de vozes (§9.6 item 7): soma dos deslocamentos em semitons,
 * emparelhando as vozes por ordem de registro (grave com grave…).
 */
export function voiceLeadingCost(a: readonly FretLocation[], b: readonly FretLocation[], inst: Instrument): number {
  const ma = a.map((l) => soundingAt(l, inst)).sort((x, y) => x - y);
  const mb = b.map((l) => soundingAt(l, inst)).sort((x, y) => x - y);
  if (ma.length !== mb.length) return Infinity;
  return ma.reduce((s, m, i) => s + Math.abs(m - mb[i]!), 0);
}

/** Melhor próximo voicing (menor movimento) do acorde seguinte no mesmo conjunto de cordas. */
export function bestVoiceLeading(prev: readonly FretLocation[], next: Chord, strings: readonly number[], inst: Instrument, opts?: { maxFret?: number; maxSpan?: number }) {
  const options = enumerateVoicings(next, strings, inst, opts);
  let best: { voicing: FretLocation[]; cost: number } | null = null;
  for (const v of options) {
    const cost = voiceLeadingCost(prev, v, inst);
    if (!best || cost < best.cost) best = { voicing: v, cost };
  }
  return best;
}
