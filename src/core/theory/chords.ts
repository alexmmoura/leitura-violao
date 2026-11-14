import { parseIntervalCode, transpose } from './intervals';
import { alterSymbol, letterName, pitchClass, spelledToMidi, type Naming, type SpelledPitch } from './pitch';

/**
 * Acordes — especificação §6.7.
 * Acorde (abstrato) = fundamental + qualidade → notas grafadas com FUNÇÃO (1, 3, 5, 7).
 * Não confundir com voicing (a distribuição concreta no braço — ver voicing.ts).
 */
export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug' | 'maj7' | 'dom7' | 'min7' | 'm7b5' | 'dim7';
export type ChordRole = '1' | '3' | '5' | '7';

export const TRIADS: readonly ChordQuality[] = ['maj', 'min', 'dim', 'aug'];
export const TETRADS: readonly ChordQuality[] = ['maj7', 'dom7', 'min7', 'm7b5', 'dim7'];

/** Intervalos a partir da fundamental, por função. */
const STRUCTURE: Readonly<Record<ChordQuality, readonly [ChordRole, string][]>> = {
  maj: [['1', 'P1'], ['3', 'M3'], ['5', 'P5']],
  min: [['1', 'P1'], ['3', 'm3'], ['5', 'P5']],
  dim: [['1', 'P1'], ['3', 'm3'], ['5', 'd5']],
  aug: [['1', 'P1'], ['3', 'M3'], ['5', 'A5']],
  maj7: [['1', 'P1'], ['3', 'M3'], ['5', 'P5'], ['7', 'M7']],
  dom7: [['1', 'P1'], ['3', 'M3'], ['5', 'P5'], ['7', 'm7']],
  min7: [['1', 'P1'], ['3', 'm3'], ['5', 'P5'], ['7', 'm7']],
  m7b5: [['1', 'P1'], ['3', 'm3'], ['5', 'd5'], ['7', 'm7']],
  dim7: [['1', 'P1'], ['3', 'm3'], ['5', 'd5'], ['7', 'd7']],
};

export const QUALITY_LABEL: Readonly<Record<ChordQuality, string>> = {
  maj: 'maior',
  min: 'menor',
  dim: 'diminuto',
  aug: 'aumentado',
  maj7: 'maior com 7ª maior',
  dom7: 'dominante (com 7ª menor)',
  min7: 'menor com 7ª',
  m7b5: 'meio-diminuto (m7♭5)',
  dim7: 'diminuto (com 7ª diminuta)',
};

const SUFFIX: Readonly<Record<ChordQuality, string>> = {
  maj: '',
  min: 'm',
  dim: '°',
  aug: '+',
  maj7: '7M',
  dom7: '7',
  min7: 'm7',
  m7b5: 'm7♭5',
  dim7: '°7',
};

export interface Chord {
  readonly root: SpelledPitch;
  readonly quality: ChordQuality;
}

export interface ChordTone {
  readonly role: ChordRole;
  readonly pitch: SpelledPitch;
  readonly pc: number;
}

export function isTetrad(q: ChordQuality): boolean {
  return STRUCTURE[q].length === 4;
}

/** Notas do acorde em posição fundamental fechada, a partir de `root` (com a oitava dela). */
export function chordTones(c: Chord): ChordTone[] {
  return STRUCTURE[c.quality].map(([role, code]) => {
    const pitch = code === 'P1' ? c.root : transpose(c.root, parseIntervalCode(code)!, 'asc');
    return { role, pitch, pc: pitchClass(spelledToMidi(pitch)) };
  });
}

export function chordPitchClasses(c: Chord): Map<number, ChordRole> {
  return new Map(chordTones(c).map((t) => [t.pc, t.role]));
}

/** Cifra, ex.: "C7M", "F♯m7♭5", "B♭°7" (ou com nomes latinos: "Dó7M"). */
export function chordSymbol(c: Chord, naming: Naming = 'english'): string {
  return `${letterName(c.root.letter, naming)}${alterSymbol(c.root.alter)}${SUFFIX[c.quality]}`;
}

export function chordName(c: Chord, naming: Naming = 'latin'): string {
  return `${letterName(c.root.letter, naming)}${alterSymbol(c.root.alter)} ${QUALITY_LABEL[c.quality]}`;
}

export const INVERSION_LABEL = ['estado fundamental', '1ª inversão (3ª no baixo)', '2ª inversão (5ª no baixo)', '3ª inversão (7ª no baixo)'];

export function roleToInversion(role: ChordRole): number {
  return { '1': 0, '3': 1, '5': 2, '7': 3 }[role];
}

/**
 * Notas do acorde empilhadas em posição FECHADA a partir da inversão pedida,
 * começando na oitava `octave` — usado para escrever o acorde na pauta.
 */
export function closeVoicingPitches(c: Chord, inversion: number, octave: number): SpelledPitch[] {
  const tones = chordTones(c).map((t) => t.pitch);
  const rotated = [...tones.slice(inversion), ...tones.slice(0, inversion)];
  const out: SpelledPitch[] = [];
  let prevMidi = -Infinity;
  for (const p of rotated) {
    // a primeira nota fica na oitava pedida; as seguintes sobem até ficar acima da anterior
    let q = { ...p, octave };
    while (spelledToMidi(q) <= prevMidi) q = { ...q, octave: q.octave + 1 };
    out.push(q);
    prevMidi = spelledToMidi(q);
  }
  return out;
}

/** Acordes diatônicos (tétrades) de uma tonalidade maior: graus I–VII. */
export function diatonicSevenths(tonic: SpelledPitch): Chord[] {
  const steps: [string, ChordQuality][] = [
    ['P1', 'maj7'],
    ['M2', 'min7'],
    ['M3', 'min7'],
    ['P4', 'maj7'],
    ['P5', 'dom7'],
    ['M6', 'min7'],
    ['M7', 'm7b5'],
  ];
  return steps.map(([code, quality]) => ({ root: code === 'P1' ? tonic : transpose(tonic, parseIntervalCode(code)!, 'asc'), quality }));
}
