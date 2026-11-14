/**
 * Ferramentas de harmonia (calculadoras) — trabalham com classes de altura (0–11),
 * sem oitava: escalas, acordes, campo harmônico, funções, progressões, ciclo das quintas.
 */
const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const LATIN: Record<string, string> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Tônicas que se escrevem melhor com bemóis. */
export const prefersFlats = (pc: number, minor = false) => (minor ? [0, 2, 5, 7, 10, 3] : [5, 10, 3, 8, 1]).includes(mod12(pc));

export function noteName(pc: number, flats = false, latin = false): string {
  const n = (flats ? FLAT : SHARP)[mod12(pc)]!;
  return latin ? LATIN[n[0]!]! + n.slice(1) : n;
}

// ---------- Intervalos ----------
export interface IntervalInfo {
  readonly semitones: number;
  readonly short: string;
  readonly name: string;
}
export const INTERVALS: readonly IntervalInfo[] = [
  { semitones: 0, short: '1J', name: 'uníssono' },
  { semitones: 1, short: '2m', name: '2ª menor' },
  { semitones: 2, short: '2M', name: '2ª maior' },
  { semitones: 3, short: '3m', name: '3ª menor' },
  { semitones: 4, short: '3M', name: '3ª maior' },
  { semitones: 5, short: '4J', name: '4ª justa' },
  { semitones: 6, short: '4aum/5dim', name: 'trítono (4ª aumentada / 5ª diminuta)' },
  { semitones: 7, short: '5J', name: '5ª justa' },
  { semitones: 8, short: '6m', name: '6ª menor' },
  { semitones: 9, short: '6M', name: '6ª maior' },
  { semitones: 10, short: '7m', name: '7ª menor' },
  { semitones: 11, short: '7M', name: '7ª maior' },
  { semitones: 12, short: '8J', name: 'oitava' },
];
/** Rótulo curto do intervalo (grau) de uma nota em relação à tônica. */
export const DEGREE_LABEL = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

// ---------- Escalas ----------
export interface ScaleDef {
  readonly id: string;
  readonly name: string;
  readonly steps: readonly number[];
}
export const SCALES: readonly ScaleDef[] = [
  { id: 'major', name: 'Maior', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', name: 'Menor natural', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'harm', name: 'Menor harmônica', steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'mel', name: 'Menor melódica', steps: [0, 2, 3, 5, 7, 9, 11] },
  { id: 'pentaM', name: 'Pentatônica maior', steps: [0, 2, 4, 7, 9] },
  { id: 'pentam', name: 'Pentatônica menor', steps: [0, 3, 5, 7, 10] },
  { id: 'blues', name: 'Penta blues', steps: [0, 3, 5, 6, 7, 10] },
  { id: 'dorian', name: 'Dórico', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', name: 'Frígio', steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', name: 'Lídio', steps: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixo', name: 'Mixolídio', steps: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'locrian', name: 'Lócrio', steps: [0, 1, 3, 5, 6, 8, 10] },
  { id: 'whole', name: 'Hexafônica (tons inteiros)', steps: [0, 2, 4, 6, 8, 10] },
  { id: 'dimWH', name: 'Diminuta (tom–semitom)', steps: [0, 2, 3, 5, 6, 8, 9, 11] },
  { id: 'dimHW', name: 'Dominante diminuta (semitom–tom)', steps: [0, 1, 3, 4, 6, 7, 9, 10] },
  { id: 'bebop', name: 'Bebop dominante', steps: [0, 2, 4, 5, 7, 9, 10, 11] },
];
export const scalePcs = (tonic: number, s: ScaleDef) => s.steps.map((x) => mod12(tonic + x));

// ---------- Acordes ----------
export interface ChordType {
  readonly suffix: string;
  readonly name: string;
  readonly steps: readonly number[];
}
export const CHORD_TYPES: readonly ChordType[] = [
  { suffix: '', name: 'maior', steps: [0, 4, 7] },
  { suffix: 'm', name: 'menor', steps: [0, 3, 7] },
  { suffix: '°', name: 'diminuto', steps: [0, 3, 6] },
  { suffix: '+', name: 'aumentado', steps: [0, 4, 8] },
  { suffix: 'sus2', name: 'suspenso com 2ª', steps: [0, 2, 7] },
  { suffix: 'sus4', name: 'suspenso com 4ª', steps: [0, 5, 7] },
  { suffix: '6', name: 'maior com 6ª', steps: [0, 4, 7, 9] },
  { suffix: 'm6', name: 'menor com 6ª', steps: [0, 3, 7, 9] },
  { suffix: '7M', name: 'maior com 7ª maior', steps: [0, 4, 7, 11] },
  { suffix: '7', name: 'dominante', steps: [0, 4, 7, 10] },
  { suffix: 'm7', name: 'menor com 7ª', steps: [0, 3, 7, 10] },
  { suffix: 'm7M', name: 'menor com 7ª maior', steps: [0, 3, 7, 11] },
  { suffix: 'm7(♭5)', name: 'meio-diminuto', steps: [0, 3, 6, 10] },
  { suffix: '°7', name: 'diminuto com 7ª', steps: [0, 3, 6, 9] },
  { suffix: 'add9', name: 'maior com 9ª adicionada', steps: [0, 2, 4, 7] },
  { suffix: '7M(9)', name: 'maior com 7ª maior e 9ª', steps: [0, 2, 4, 7, 11] },
  { suffix: '7(9)', name: 'dominante com 9ª', steps: [0, 2, 4, 7, 10] },
  { suffix: 'm7(9)', name: 'menor com 7ª e 9ª', steps: [0, 2, 3, 7, 10] },
];
export const chordType = (suffix: string) => CHORD_TYPES.find((t) => t.suffix === suffix)!;

export interface NamedChord {
  readonly root: number;
  readonly type: ChordType;
  /** Baixo diferente da fundamental (inversão), se houver. */
  readonly bass?: number;
}
export const chordPcs = (c: NamedChord) => c.type.steps.map((x) => mod12(c.root + x));
export function chordLabel(c: NamedChord, flats = false): string {
  return `${noteName(c.root, flats)}${c.type.suffix}${c.bass !== undefined && c.bass !== c.root ? `/${noteName(c.bass, flats)}` : ''}`;
}

/** Acordes cujas notas são EXATAMENTE as dadas; o baixo (se dado) define a inversão. */
export function identifyChords(pcs: readonly number[], bass?: number): NamedChord[] {
  const set = [...new Set(pcs.map(mod12))];
  if (set.length < 3) return [];
  const out: NamedChord[] = [];
  for (const root of set) {
    for (const type of CHORD_TYPES) {
      const cp = type.steps.map((x) => mod12(root + x));
      if (cp.length === set.length && cp.every((p) => set.includes(p))) out.push({ root, type, ...(bass !== undefined && mod12(bass) !== root ? { bass: mod12(bass) } : {}) });
    }
  }
  // prefere o acorde em estado fundamental
  return out.sort((a, b) => Number(a.bass !== undefined) - Number(b.bass !== undefined));
}

/** Acordes que CONTÊM todas as notas dadas (similaridade), dos mais simples aos mais complexos. */
export function chordsContaining(pcs: readonly number[]): NamedChord[] {
  const set = [...new Set(pcs.map(mod12))];
  if (set.length === 0) return [];
  const out: NamedChord[] = [];
  for (let root = 0; root < 12; root++) {
    for (const type of CHORD_TYPES) {
      const cp = type.steps.map((x) => mod12(root + x));
      if (set.every((p) => cp.includes(p))) out.push({ root, type });
    }
  }
  return out.sort((a, b) => a.type.steps.length - b.type.steps.length);
}

/** Inversões: o mesmo acorde com cada uma das outras notas no baixo. */
export function inversions(c: NamedChord): NamedChord[] {
  return [...c.type.steps]
    .sort((a, b) => a - b)
    .filter((s) => s !== 0)
    .map((s) => ({ root: c.root, type: c.type, bass: mod12(c.root + s) }));
}

// ---------- Campo harmônico e funções ----------
export type HarmonicFunction = 'T' | 'S' | 'D';
export const FUNCTION_NAME: Record<HarmonicFunction, string> = { T: 'Tônica', S: 'Subdominante', D: 'Dominante' };
export interface FieldChord {
  readonly degree: string;
  readonly chord: NamedChord;
  readonly fn: HarmonicFunction;
  readonly strength: 'forte' | 'meio-forte' | 'fraca';
}
const MAJOR_FIELD: readonly [number, string, string, string, HarmonicFunction, FieldChord['strength']][] = [
  [0, 'I', '', '7M', 'T', 'forte'],
  [2, 'II', 'm', 'm7', 'S', 'meio-forte'],
  [4, 'III', 'm', 'm7', 'T', 'fraca'],
  [5, 'IV', '', '7M', 'S', 'forte'],
  [7, 'V', '', '7', 'D', 'forte'],
  [9, 'VI', 'm', 'm7', 'T', 'fraca'],
  [11, 'VII', '°', 'm7(♭5)', 'D', 'meio-forte'],
];
const MINOR_FIELD: readonly [number, string, string, string, HarmonicFunction, FieldChord['strength']][] = [
  [0, 'I', 'm', 'm7', 'T', 'forte'],
  [2, 'II', '°', 'm7(♭5)', 'S', 'meio-forte'],
  [3, '♭III', '', '7M', 'T', 'fraca'],
  [5, 'IV', 'm', 'm7', 'S', 'forte'],
  [7, 'V', 'm', 'm7', 'D', 'fraca'],
  [8, '♭VI', '', '7M', 'S', 'fraca'],
  [10, '♭VII', '', '7', 'D', 'meio-forte'],
];
export function harmonicField(tonic: number, minor = false, tetrads = false): FieldChord[] {
  return (minor ? MINOR_FIELD : MAJOR_FIELD).map(([step, degree, tri, tet, fn, strength]) => ({
    degree,
    chord: { root: mod12(tonic + step), type: chordType(tetrads ? tet : tri) },
    fn,
    strength,
  }));
}

/**
 * Substitutos de um acorde MAIOR conforme a função que ele exerce:
 * tônica (I), subdominante (IV) ou dominante (V).
 */
export function substitutions(root: number, fn: HarmonicFunction): { chord: NamedChord; why: string }[] {
  const c = (step: number, suffix: string, bassStep?: number): NamedChord => ({ root: mod12(root + step), type: chordType(suffix), ...(bassStep !== undefined ? { bass: mod12(root + bassStep) } : {}) });
  if (fn === 'T')
    return [
      { chord: c(0, '7M'), why: 'mesma tônica com 7ª maior' },
      { chord: c(0, '6'), why: 'mesma tônica com 6ª' },
      { chord: c(0, 'add9'), why: 'mesma tônica com 9ª' },
      { chord: c(0, '', 4), why: '1ª inversão (3ª no baixo)' },
      { chord: c(0, '', 7), why: '2ª inversão (5ª no baixo)' },
      { chord: c(9, 'm7'), why: 'VIm7 — relativo menor (tônica fraca)' },
      { chord: c(4, 'm7'), why: 'IIIm7 — anti-relativo (tônica fraca)' },
      { chord: c(0, 'sus2'), why: 'suspensão que resolve na própria tônica' },
    ];
  if (fn === 'S')
    return [
      { chord: c(0, '7M'), why: 'mesma subdominante com 7ª maior' },
      { chord: c(0, '6'), why: 'mesma subdominante com 6ª' },
      { chord: c(9, 'm7'), why: 'IIm7 — relativo menor da subdominante' },
      { chord: c(0, 'm6'), why: 'IVm6 — subdominante menor (empréstimo modal)' },
      { chord: c(0, 'm'), why: 'IVm — subdominante menor' },
      { chord: c(3, '7M'), why: '♭VI7M — empréstimo do tom menor' },
      { chord: c(0, '', 4), why: '1ª inversão' },
    ];
  return [
    { chord: c(0, '7'), why: 'dominante com 7ª (trítono que pede resolução)' },
    { chord: c(0, '7(9)'), why: 'dominante com 9ª' },
    { chord: c(0, 'sus4'), why: 'dominante suspensa (V7sus4)' },
    { chord: c(4, 'm7(♭5)'), why: 'VIIm7(♭5) — mesmo trítono, sem a fundamental' },
    { chord: c(4, '°'), why: 'VII° — tríade diminuta da sensível' },
    { chord: c(6, '7'), why: 'SubV7 — dominante substituta (trítono em comum)' },
    { chord: c(7, 'm7'), why: 'IIm7 antes do V7 (II–V)' },
  ];
}

// ---------- Progressões e cadências ----------
export interface Progression {
  readonly name: string;
  readonly about: string;
  /** [semitons acima do grau I, sufixo, grau]. */
  readonly chords: readonly [number, string, string][];
}
export const PROGRESSIONS: readonly Progression[] = [
  { name: 'IIm – V7 – I', about: 'A cadência mais usada no jazz, na bossa e no choro.', chords: [[2, 'm', 'IIm'], [7, '7', 'V7'], [0, '', 'I']] },
  { name: 'IIm7 – V7 – I7M', about: 'O mesmo II–V–I com tétrades.', chords: [[2, 'm7', 'IIm7'], [7, '7', 'V7'], [0, '7M', 'I7M']] },
  { name: 'V7 – I (cadência autêntica)', about: 'Tensão da dominante resolvendo na tônica.', chords: [[7, '7', 'V7'], [0, '', 'I']] },
  { name: 'IV – I (cadência plagal)', about: 'O "amém" dos hinos: subdominante → tônica.', chords: [[5, '', 'IV'], [0, '', 'I']] },
  { name: 'IV – V7 – I (cadência perfeita)', about: 'Subdominante, dominante e tônica: as três funções em ordem.', chords: [[5, '', 'IV'], [7, '7', 'V7'], [0, '', 'I']] },
  { name: 'V7 – VIm (cadência deceptiva)', about: 'A dominante "engana" e resolve no VI grau.', chords: [[7, '7', 'V7'], [9, 'm', 'VIm']] },
  { name: 'I – V (meia cadência)', about: 'Termina suspensa na dominante.', chords: [[0, '', 'I'], [7, '', 'V']] },
  { name: 'I – V – VIm – IV', about: 'A progressão pop mais comum.', chords: [[0, '', 'I'], [7, '', 'V'], [9, 'm', 'VIm'], [5, '', 'IV']] },
  { name: 'I – VIm – IV – V', about: 'Progressão dos anos 50.', chords: [[0, '', 'I'], [9, 'm', 'VIm'], [5, '', 'IV'], [7, '', 'V']] },
  { name: 'I – VIm – IIm – V7', about: 'Turnaround clássico.', chords: [[0, '', 'I'], [9, 'm', 'VIm'], [2, 'm', 'IIm'], [7, '7', 'V7']] },
  { name: 'Blues de 12 compassos', about: 'I7 (4) · IV7 (2) · I7 (2) · V7 · IV7 · I7 · V7.', chords: [[0, '7', 'I7'], [0, '7', 'I7'], [0, '7', 'I7'], [0, '7', 'I7'], [5, '7', 'IV7'], [5, '7', 'IV7'], [0, '7', 'I7'], [0, '7', 'I7'], [7, '7', 'V7'], [5, '7', 'IV7'], [0, '7', 'I7'], [7, '7', 'V7']] },
  { name: 'IIm7(♭5) – V7 – Im (II–V–I menor)', about: 'Cadência para o tom menor.', chords: [[2, 'm7(♭5)', 'IIm7(♭5)'], [7, '7', 'V7'], [0, 'm', 'Im']] },
  { name: 'Im – ♭VII – ♭VI – V7 (cadência andaluza)', about: 'Descida típica do flamenco.', chords: [[0, 'm', 'Im'], [10, '', '♭VII'], [8, '', '♭VI'], [7, '7', 'V7']] },
];
export function progressionChords(p: Progression, tonic: number): { degree: string; chord: NamedChord }[] {
  return p.chords.map(([step, suffix, degree]) => ({ degree, chord: { root: mod12(tonic + step), type: chordType(suffix) } }));
}

// ---------- Ciclo das quintas ----------
/** 12 tonalidades em ordem de quintas a partir de Dó, com a relativa menor e a armadura. */
export const CIRCLE = Array.from({ length: 12 }, (_, i) => {
  const pc = mod12(i * 7);
  const fifths = i <= 6 ? i : i - 12;
  return { pc, fifths, minorPc: mod12(pc + 9) };
});

/** Alturas MIDI (soantes) de um acorde em posição fechada, perto do Dó central. */
export function chordMidis(c: NamedChord, base = 48): number[] {
  const root = base + mod12(c.root);
  const notes = [...c.type.steps].sort((a, b) => a - b).map((s) => root + s);
  if (c.bass !== undefined && c.bass !== c.root) return [base - 12 + mod12(c.bass), ...notes];
  return [root - 12, ...notes];
}
