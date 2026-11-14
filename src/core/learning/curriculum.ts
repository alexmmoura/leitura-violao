import { buildFretQuestion, type FretQuestion } from '../exercise/fretQuestion';
import { buildQuestion, candidatePool, type NoteQuestion, type NoteQuestionConfig } from '../exercise/noteQuestion';
import { validLocations } from '../exercise/constraints';
import { locationKey, type FretLocation, type Instrument } from '../instrument/instrument';
import { fixedPosition, OPEN_POSITION, positionLabel, type PositionSpec } from '../instrument/position';
import { asSounding, spelledToMidi, writtenToSounding, writtenMidiOf, type SpelledPitch } from '../theory/pitch';
import { preferredSpelling } from '../theory/spelling';
import { bpId, parseKcId, parsePositionKey, pbId } from './kc';

/**
 * Currículo de itens de leitura — especificação §5 (níveis 1–4) e §3.4.
 * Define a ORDEM em que itens novos são apresentados; o agendamento das
 * revisões é do FSRS. Princípio Sagreras: uma variável nova por etapa.
 */
export type Question = NoteQuestion | FretQuestion;

export interface CurriculumItem {
  readonly kcId: string;
  readonly stage: number;
}

export interface Stage {
  readonly index: number;
  readonly label: string;
}

function cfgFor(position: PositionSpec, inst: Instrument, strings: number[], accidentals: 'diatonic' | 'chromatic'): NoteQuestionConfig {
  return { fifths: 0, accidentals, strings, position, minFret: 0, maxFret: inst.frets, minWritten: 0, maxWritten: 200, answerMode: 'any' };
}

const ALL = [1, 2, 3, 4, 5, 6];
/** Ordem de posições: aberta → II → V → VII → IX → XII → demais (§3.1). */
const POSITION_ORDER = [2, 5, 7, 9, 12, 1, 3, 4, 6, 8, 10, 11];

export function buildCurriculum(inst: Instrument): { items: CurriculumItem[]; stages: Stage[] } {
  const stages: Stage[] = [];
  const items: CurriculumItem[] = [];
  const seen = new Set<string>();

  const addStage = (label: string, position: PositionSpec, notes: SpelledPitch[], strings: number[]) => {
    const index = stages.length;
    stages.push({ index, label });
    const constraints = { strings, minFret: 0, maxFret: inst.frets, position };
    const pb = notes.map((p) => pbId(p, position));
    const bp: string[] = [];
    for (const p of notes) {
      for (const loc of validLocations(writtenToSounding(writtenMidiOf(p), inst.transposition), inst, constraints)) bp.push(bpId(loc, 0));
    }
    // Intercala: o sentido braço → pauta de uma nota entra 2 itens depois do sentido pauta → braço.
    const merged: string[] = [];
    pb.forEach((id, i) => {
      merged.push(id);
      if (i >= 2 && bp[i - 2]) merged.push(bp[i - 2]!);
    });
    merged.push(...bp.slice(Math.max(0, pb.length - 2)));
    for (const id of merged) {
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({ kcId: id, stage: index });
    }
  };

  const sortAsc = (ps: SpelledPitch[]) => [...ps].sort((a, b) => spelledToMidi(a) - spelledToMidi(b));
  const naturals = (pos: PositionSpec, strings: number[]) => sortAsc(candidatePool(cfgFor(pos, inst, strings, 'diatonic'), inst));
  const accidentals = (pos: PositionSpec) => sortAsc(candidatePool(cfgFor(pos, inst, ALL, 'chromatic'), inst).filter((p) => p.alter !== 0));

  addStage('Posição aberta · naturais · cordas 1–3', OPEN_POSITION, naturals(OPEN_POSITION, [1, 2, 3]), [1, 2, 3]);
  addStage('Posição aberta · naturais · cordas 4–6', OPEN_POSITION, naturals(OPEN_POSITION, [4, 5, 6]), [4, 5, 6]);
  addStage('Posição aberta · acidentes', OPEN_POSITION, accidentals(OPEN_POSITION), ALL);
  for (const p of POSITION_ORDER) {
    const pos = fixedPosition(p);
    if (p + 3 > inst.frets) continue;
    addStage(`${positionLabel(pos)} · naturais`, pos, naturals(pos, ALL), ALL);
    addStage(`${positionLabel(pos)} · acidentes`, pos, accidentals(pos), ALL);
  }
  return { items, stages };
}

/** Grafia usada para perguntar um local (braço → pauta) sem armadura. */
function spellingAt(loc: FretLocation, inst: Instrument): SpelledPitch {
  const s = inst.strings[loc.string - 1]!.openMidi + loc.fret;
  return preferredSpelling(s - inst.transposition, 0);
}

/**
 * Constrói a questão de qualquer item a partir do id — inclusive itens praticados
 * no modo livre que não estão no currículo. Retorna null se o item não couber no
 * instrumento atual (ex.: número de casas reduzido).
 */
export function questionForKc(kcId: string, inst: Instrument, seed: number): Question | null {
  const ref = parseKcId(kcId);
  if (!ref) return null;
  if (ref.kind === 'fretboard>staff') {
    const { loc } = ref;
    if (loc.string > inst.strings.length || loc.fret > inst.frets) return null;
    return buildFretQuestion(spellingAt(loc, inst), loc, ref.fifths, inst, seed);
  }
  const position = parsePositionKey(ref.posKey);
  if (!position) return null;
  const cfg = { ...cfgFor(position, inst, ALL, 'chromatic' as const), answerMode: ref.all ? ('all' as const) : ('any' as const) };
  const s = writtenToSounding(writtenMidiOf(ref.written), inst.transposition);
  if (validLocations(s, inst, cfg).length === 0) return null;
  return buildQuestion(ref.written, cfg, inst, seed);
}

/** Altura soante de um item (para evitar a mesma nota duas vezes seguidas). */
export function soundingOfKc(kcId: string, inst: Instrument): number | null {
  const ref = parseKcId(kcId);
  if (!ref) return null;
  if (ref.kind === 'fretboard>staff') {
    const str = inst.strings[ref.loc.string - 1];
    return str ? str.openMidi + ref.loc.fret : null;
  }
  return writtenToSounding(writtenMidiOf(ref.written), inst.transposition);
}

/** Locais do braço associados a um item (para o mapa de calor). */
export function locationsOfKc(kcId: string, inst: Instrument): FretLocation[] {
  const ref = parseKcId(kcId);
  if (!ref) return [];
  if (ref.kind === 'fretboard>staff') return ref.loc.fret <= inst.frets ? [ref.loc] : [];
  const position = parsePositionKey(ref.posKey);
  if (!position) return [];
  return validLocations(asSounding(spelledToMidi(ref.written) + inst.transposition), inst, { strings: ALL, minFret: 0, maxFret: inst.frets, position });
}

export { locationKey };
