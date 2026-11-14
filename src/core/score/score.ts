import { locationsFor, soundingAt, type FretLocation, type Instrument } from '../instrument/instrument';
import { WHOLE_NECK } from '../instrument/position';
import type { Melody, MelodyConfig, MelodyEvent } from '../melody/melody';
import { resolveFingering } from '../melody/fingering';
import { beatsPer, measureSize, type Meter } from '../rhythm/rhythm';
import { accidentalsToDraw } from '../theory/accidentals';
import type { Fifths } from '../theory/keySignature';
import { asWritten, spelledToMidi, writtenToSounding, type SpelledPitch, type SoundingMidi } from '../theory/pitch';
import { preferredSpelling } from '../theory/spelling';

/**
 * Partituras do próprio aluno (importadas de MusicXML, de tablatura em texto ou
 * criadas marcando notas no braço virtual). Viram uma `Melody` comum, então
 * todos os modos de leitura (estático, contínuo, no violão, solfejo) funcionam.
 */
export interface ScoreNote {
  /** Duração em semicolcheias (semínima = 4). */
  readonly units: number;
  readonly rest: boolean;
  /** Ligada à próxima nota (que continua soando). */
  readonly tie?: boolean;
  /** Altura ESCRITA (MIDI), null nas pausas. */
  readonly written: number | null;
  /** Grafia vinda do arquivo (ex.: MusicXML); se ausente, é deduzida da tonalidade. */
  readonly spelled?: SpelledPitch;
  /** Corda e casa indicadas (tablatura ou braço virtual). */
  readonly loc?: FretLocation;
}

export type ScoreSource = 'musicxml' | 'tab' | 'editor';

export interface ScoreDef {
  readonly id: string;
  readonly title: string;
  readonly fifths: Fifths;
  readonly meter: Meter;
  /** Compassos já divididos (o primeiro pode ser anacruse). */
  readonly measures: readonly (readonly ScoreNote[])[];
  readonly source: ScoreSource;
  readonly createdAt: number;
  /** Avisos da importação (ex.: acordes reduzidos à nota mais aguda). */
  readonly warnings?: readonly string[];
}

/** Figuras com desenho simples, da maior para a menor. */
const FIG_UNITS = [16, 12, 8, 6, 4, 3, 2, 1];

/** Quebra uma duração em figuras desenháveis (ex.: 5 = 4 + 1 ligadas). */
export function splitUnits(units: number): number[] {
  const out: number[] = [];
  let rest = units;
  while (rest > 0) {
    const f = FIG_UNITS.find((u) => u <= rest)!;
    out.push(f);
    rest -= f;
  }
  return out;
}

/** Garante que cada nota tenha figura simples, ligando os pedaços. */
function normalizeFigures(notes: readonly ScoreNote[]): ScoreNote[] {
  const out: ScoreNote[] = [];
  for (const n of notes) {
    const parts = splitUnits(n.units);
    parts.forEach((u, i) => {
      const last = i === parts.length - 1;
      out.push({ ...n, units: u, tie: n.rest ? false : last ? !!n.tie : true });
    });
  }
  return out;
}

/**
 * Divide uma sequência contínua de notas em compassos da fórmula dada.
 * Notas que atravessam a barra são partidas e ligadas.
 */
export function splitIntoMeasures(notes: readonly ScoreNote[], meter: Meter): ScoreNote[][] {
  const size = measureSize(meter);
  const measures: ScoreNote[][] = [[]];
  let used = 0;
  for (const n of notes) {
    let left = n.units;
    while (left > 0) {
      const room = size - used;
      const take = Math.min(room, left);
      left -= take;
      measures[measures.length - 1]!.push({ ...n, units: take, tie: n.rest ? false : left > 0 ? true : !!n.tie });
      used += take;
      if (used === size) {
        measures.push([]);
        used = 0;
      }
    }
  }
  if (measures[measures.length - 1]!.length === 0) measures.pop();
  return measures.map(normalizeFigures);
}

export class ScoreError extends Error {}

/** Converte a partitura numa `Melody` (pauta, digitação de referência, acidentes). */
export function buildScoreMelody(score: ScoreDef, inst: Instrument): Melody {
  const measures = score.measures.map(normalizeFigures).filter((m) => m.length > 0);
  if (!measures.some((m) => m.some((n) => !n.rest))) throw new ScoreError('A partitura não tem nenhuma nota.');

  // ataques (sem continuações de ligadura)
  const flat = measures.flat();
  const isAttack = flat.map((e, i) => !e.rest && !(i > 0 && !flat[i - 1]!.rest && flat[i - 1]!.tie && flat[i - 1]!.written === e.written));
  const attackNotes = flat.filter((_, i) => isAttack[i]);
  const spelled = attackNotes.map((n) => n.spelled ?? preferredSpelling(n.written!, score.fifths));
  const sounding = spelled.map((p) => writtenToSounding(asWritten(spelledToMidi(p)), inst.transposition));

  const unplayable = sounding.map((s, i) => ({ s, i })).filter((x) => locationsFor(x.s, inst).length === 0);
  if (unplayable.length) {
    throw new ScoreError(`${unplayable.length} nota(s) fora da extensão do violão (ex.: nota ${unplayable[0]!.i + 1}).`);
  }

  // digitação: a da tablatura/braço quando houver; senão, a melhor sugerida no braço inteiro
  const given = attackNotes.map((n) => n.loc);
  const fingering = given.every((l) => !!l)
    ? (resolveFingering(sounding, inst, { allow: (l) => given.some((g) => g!.string === l.string && g!.fret === l.fret) }) ?? resolveFingering(sounding, inst))
    : resolveFingering(sounding, inst);
  if (!fingering) throw new ScoreError('Não foi possível sugerir uma digitação para estas notas.');

  const events: MelodyEvent[] = [];
  let k = -1;
  let flatIdx = 0;
  let onset = 0;
  measures.forEach((measure, mi) => {
    const start = flatIdx;
    let kk = k;
    const notesHere = measure
      .map((e, j) => ({ e, attack: isAttack[start + j]! }))
      .filter((x) => !x.e.rest)
      .map((x) => {
        if (x.attack) kk++;
        return { ...spelled[kk]!, tiedFrom: !x.attack };
      });
    const acc = accidentalsToDraw(notesHere, score.fifths);
    let j = 0;
    for (const e of measure) {
      const attack = isAttack[flatIdx]!;
      if (e.rest) {
        events.push({ units: e.units, rest: true, pitch: null, sounding: null, measure: mi, onsetUnits: onset, accidental: null, noteIndex: -1, tie: false, tiedFromPrev: false });
      } else {
        if (attack) k++;
        const next = flat[flatIdx + 1];
        const tie = !!e.tie && !!next && !next.rest && next.written === e.written;
        events.push({ units: e.units, rest: false, pitch: spelled[k]!, sounding: sounding[k]! as SoundingMidi, measure: mi, onsetUnits: onset, accidental: acc[j]!, noteIndex: k, tie, tiedFromPrev: !attack });
        j++;
      }
      onset += e.units;
      flatIdx++;
    }
  });

  const config: MelodyConfig = {
    fifths: score.fifths,
    region: WHOLE_NECK,
    strings: [1, 2, 3, 4, 5, 6],
    measures: measures.length,
    beats: beatsPer(score.meter),
    meter: score.meter,
    rhythmLevel: 0,
    maxLeap: 7,
    chromatic: true,
  };
  return { seed: 0, config, events, fingering, materialKey: `obra:${score.id}` };
}

/** Nota escrita correspondente a um local do braço (para tablatura e editor). */
export function noteAt(loc: FretLocation, inst: Instrument, units: number): ScoreNote {
  return { units, rest: false, written: soundingAt(loc, inst) - inst.transposition, loc };
}

/** Total de notas atacadas (para a lista). */
export function scoreNoteCount(score: ScoreDef): number {
  const flat = score.measures.flat();
  return flat.filter((e, i) => !e.rest && !(i > 0 && flat[i - 1]!.tie && !flat[i - 1]!.rest && flat[i - 1]!.written === e.written)).length;
}

export function newScoreId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
