import { validLocations } from '../exercise/constraints';
import { createRng, type Rng } from '../exercise/rng';
import type { FretLocation, Instrument } from '../instrument/instrument';
import { fretWindow, inPosition, positionKey, type PositionSpec } from '../instrument/position';
import { accidentalsToDraw } from '../theory/accidentals';
import { intervalBetween } from '../theory/intervals';
import { keyAlterFor, type Fifths } from '../theory/keySignature';
import { diatonicIndex, LETTERS, spelledToMidi, writtenMidiOf, writtenToSounding, type Alter, type SpelledPitch, type SoundingMidi } from '../theory/pitch';
import { isSimpleSpelling } from '../theory/spelling';
import { beatSize, beatsPer, generateMeasures, isCompound, type Meter, type RhythmEvent } from '../rhythm/rhythm';
import { resolveFingering, type FingeringResult } from './fingering';
import { parsePositionKey } from '../learning/kc';

/**
 * Gerador de melodias originais — especificação §6.4 e §7.4.
 * Regras: frases que terminam na tônica, graus conjuntos predominantes, salto
 * seguido de movimento contrário, sem trítono melódico (salvo com cromatismo),
 * tessitura limitada à região pedida e digitação de referência viável.
 */
export interface MelodyConfig {
  readonly fifths: Fifths;
  readonly region: PositionSpec;
  /** Segunda região: a frase começa em `region` e termina em `shiftTo` (mudança de posição). */
  readonly shiftTo?: PositionSpec;
  readonly strings: readonly number[];
  readonly measures: number;
  /** Tempos de semínima por compasso (n/4). Ignorado quando `meter` é dado. */
  readonly beats: number;
  /** Fórmula de compasso, inclusive composta (6/8, 9/8, 12/8). Ausente = beats/4. */
  readonly meter?: Meter;
  /** 0 = só o tempo (altura sem ritmo); 1–4 = níveis do Módulo E. */
  readonly rhythmLevel: number;
  /** Maior salto em graus (1 = só graus conjuntos, 2 = terças, 4 = quintas, 7 = oitava). */
  readonly maxLeap: number;
  /** Acidentes ocorrentes ocasionais (bordaduras/passagens cromáticas). */
  readonly chromatic: boolean;
}

export interface MelodyEvent {
  readonly units: number;
  readonly rest: boolean;
  /** null nas pausas. */
  readonly pitch: SpelledPitch | null;
  readonly sounding: SoundingMidi | null;
  readonly measure: number;
  readonly onsetUnits: number;
  /** Acidente a desenhar (null = nenhum). */
  readonly accidental: Alter | null;
  /** Índice da nota (ataques), ou −1 nas pausas. A continuação de uma ligadura repete o índice da nota de origem. */
  readonly noteIndex: number;
  /** Ligada à próxima figura (mesma nota continua soando). */
  readonly tie: boolean;
  /** Continuação de ligadura: não é ataque, não redesenha acidente. */
  readonly tiedFromPrev: boolean;
}

/** Fórmula de compasso efetiva de uma configuração. */
export function melodyMeter(c: MelodyConfig): Meter {
  return c.meter ?? { num: c.beats, den: 4 };
}

export interface Melody {
  readonly seed: number;
  readonly config: MelodyConfig;
  readonly events: MelodyEvent[];
  readonly fingering: FingeringResult;
  readonly materialKey: string;
}

const tonicLetter = (fifths: Fifths) => LETTERS[(((fifths * 4) % 7) + 7) % 7]!;

/**
 * Chave do MATERIAL de leitura (região, tonalidade, ritmo, saltos, tamanho).
 * É o item revisado pelo FSRS: cada revisão gera uma frase NOVA desse material.
 */
export function materialKey(c: MelodyConfig): string {
  const meter = melodyMeter(c);
  const size = meter.den === 8 ? `${meter.num}d8` : `${meter.num}`;
  return `${positionKey(c.region)}${c.shiftTo ? `>${positionKey(c.shiftTo)}` : ''}|k${c.fifths}|r${c.rhythmLevel}|s${c.maxLeap}${c.chromatic ? 'c' : ''}|m${c.measures}x${size}`;
}

/** Inverso de materialKey (chaves antigas, sem "|m…", assumem 4 compassos de 4/4). */
export function parseMaterialKey(key: string, strings: readonly number[] = [1, 2, 3, 4, 5, 6]): MelodyConfig | null {
  const m = /^([a-z0-9]+)(?:>([a-z0-9]+))?\|k(-?\d+)\|r(\d)\|s(\d+)(c?)(?:\|m(\d+)x(\d+)(d8)?)?$/.exec(key);
  if (!m) return null;
  const region = parsePositionKey(m[1]!);
  const shiftTo = m[2] ? parsePositionKey(m[2]) : undefined;
  if (!region || shiftTo === null) return null;
  const num = m[8] ? Number(m[8]) : 4;
  const compound = m[9] === 'd8';
  return {
    fifths: Number(m[3]),
    region,
    ...(shiftTo ? { shiftTo } : {}),
    strings,
    measures: m[7] ? Number(m[7]) : 4,
    beats: compound ? beatsPer({ num, den: 8 }) : num,
    ...(compound ? { meter: { num, den: 8 as const } } : {}),
    rhythmLevel: Number(m[4]),
    maxLeap: Number(m[5]),
    chromatic: m[6] === 'c',
  };
}

function regionConstraints(region: PositionSpec, c: MelodyConfig, inst: Instrument) {
  return { strings: c.strings, minFret: 0, maxFret: inst.frets, position: region };
}

/** Notas diatônicas (grafia da tonalidade) com pelo menos um local na região, em ordem de altura. */
export function diatonicPool(region: PositionSpec, c: MelodyConfig, inst: Instrument): SpelledPitch[] {
  const out: SpelledPitch[] = [];
  for (let octave = 2; octave <= 7; octave++) {
    for (const letter of LETTERS) {
      const p: SpelledPitch = { letter, alter: keyAlterFor(letter, c.fifths), octave };
      if (validLocations(writtenToSounding(writtenMidiOf(p), inst.transposition), inst, regionConstraints(region, c, inst)).length) out.push(p);
    }
  }
  return out.sort((a, b) => spelledToMidi(a) - spelledToMidi(b));
}

function rhythmSkeleton(c: MelodyConfig, rng: Rng): RhythmEvent[][] {
  const meter = melodyMeter(c);
  const beat = beatSize(meter);
  const nBeats = beatsPer(meter);
  // "só o pulso": semínimas nos simples; nos compostos, o balanço semínima + colcheia
  // (uma nota por tempo de semínima pontuada daria frases curtas demais)
  const onBeats = (k: number): RhythmEvent[] =>
    isCompound(meter)
      ? Array.from({ length: k }, () => [{ units: 4, rest: false }, { units: 2, rest: false }]).flat()
      : Array.from({ length: k }, () => ({ units: beat, rest: false }));
  // cadência: simples → … + mínima; composta → (semínima + colcheia)… + semínima pontuada
  const cadence = (): RhythmEvent[] => {
    if (isCompound(meter)) return [...Array.from({ length: nBeats - 1 }, () => [{ units: 4, rest: false }, { units: 2, rest: false }]).flat(), { units: 6, rest: false }];
    return nBeats >= 3 ? [...onBeats(nBeats - 2), { units: 8, rest: false }] : [{ units: 8, rest: false }];
  };
  const body = c.rhythmLevel === 0 ? Array.from({ length: c.measures - 1 }, () => onBeats(nBeats)) : generateMeasures(c.rhythmLevel, meter, c.measures - 1, rng.int(0, 2 ** 31));
  const out: RhythmEvent[][] = [...body.map((m) => [...m]), cadence()];
  // a primeira nota da frase nunca é pausa
  if (out[0]![0]!.rest) out[0]![0] = { ...out[0]![0]!, rest: false };
  return out;
}

function pickMove(rng: Rng, maxLeap: number, mustStep: number): number {
  if (mustStep !== 0) return mustStep;
  const r = rng.next();
  let size: number;
  if (maxLeap <= 1 || r < 0.6) size = 1;
  else if (maxLeap <= 2 || r < 0.85) size = 2;
  else size = rng.int(3, maxLeap);
  if (rng.next() < 0.04) size = 0; // repetição ocasional
  return size * (rng.next() < 0.5 ? 1 : -1);
}

/** Motivo da última rejeição (diagnóstico). */
export let lastRejection = '';
const fail = (why: string): null => {
  lastRejection = why;
  return null;
};

function attempt(c: MelodyConfig, inst: Instrument, seed: number): Melody | null {
  const rng = createRng(seed);
  const skeleton = rhythmSkeleton(c, rng);
  // só ATAQUES recebem nota nova (a continuação de uma ligadura repete a anterior)
  const flat = skeleton.flat();
  const isAttack = flat.map((e, i) => !e.rest && !(i > 0 && !flat[i - 1]!.rest && flat[i - 1]!.tie));
  const noteCount = isAttack.filter(Boolean).length;
  const poolA = diatonicPool(c.region, c, inst);
  const poolB = c.shiftTo ? diatonicPool(c.shiftTo, c, inst) : poolA;
  if (poolA.length < 3 || poolB.length < 3) return null;
  const tonic = tonicLetter(c.fifths);
  // A mudança começa a ~40 % da frase: sobra caminho para alcançar a nova região e cadenciar.
  const switchAt = c.shiftTo ? Math.max(2, Math.floor(noteCount * 0.4)) : noteCount;

  const pitches: SpelledPitch[] = [];
  const midTonics = poolA.map((p, i) => ({ p, i })).filter((x) => x.p.letter === tonic);
  let pool = poolA;
  let idx = midTonics.length ? rng.pick(midTonics).i : rng.int(0, poolA.length - 1);
  if (c.shiftTo) {
    // Com mudança de posição, a frase começa numa nota que SÓ existe na primeira região;
    // senão tudo poderia ser tocado na segunda e a mão nunca se moveria.
    const bMidis = new Set(poolB.map(spelledToMidi));
    const aMidis0 = new Set(poolA.map(spelledToMidi));
    const onlyBMidis = poolB.map(spelledToMidi).filter((m) => !aMidis0.has(m));
    const onlyA = poolA.map((p, i) => ({ p, i })).filter((x) => !bMidis.has(spelledToMidi(x.p)));
    if (onlyA.length === 0 || onlyBMidis.length === 0) return fail('sem notas exclusivas');
    // começa no registro onde a mudança acontece: perto das notas exclusivas da segunda região
    const ranked = onlyA
      .map((x) => ({ i: x.i, d: Math.min(...onlyBMidis.map((m) => Math.abs(m - spelledToMidi(x.p)))) - (x.p.letter === tonic ? 1.5 : 0) + rng.next() }))
      .sort((a, b) => a.d - b.d);
    idx = ranked[0]!.i;
  }
  let mustStep = 0;
  /** Índice (na segunda região) da nota exclusiva a alcançar; −1 = sem alvo; −2 = alcançado. */
  let approachTarget = -1;
  const nearestTonic = () => {
    const tonics = pool.map((p, i) => ({ p, i })).filter((x) => x.p.letter === tonic);
    return tonics.length ? tonics.sort((a, b) => Math.abs(a.i - idx) - Math.abs(b.i - idx))[0]!.i : idx;
  };
  /** A cadência começa nas 3 últimas notas, ou antes se a tônica estiver longe demais. */
  const cadenceDue = (k: number) => {
    if (k < switchAt && c.shiftTo) return false;
    if (c.shiftTo && approachTarget !== -2 && noteCount - 1 - k > 1) return false; // primeiro alcança a nota exclusiva
    const left = noteCount - 1 - k;
    const needed = Math.ceil(Math.abs(nearestTonic() - idx) / Math.max(1, c.maxLeap));
    return left <= 2 || left <= needed;
  };
  for (let k = 0; k < noteCount; k++) {
    if (k === switchAt && pool !== poolB) {
      // passa a caminhar na segunda região, a partir da nota dela mais próxima da atual,
      // em direção a uma nota EXCLUSIVA dela (que obriga a mão a mudar de posição)
      const cur = pitches[pitches.length - 1]!;
      pool = poolB;
      const aMidis = new Set(poolA.map(spelledToMidi));
      const byDist = (target: SpelledPitch) => (p: SpelledPitch, i: number) => ({ i, d: Math.abs(spelledToMidi(p) - spelledToMidi(target)) + rng.next() * 0.5 });
      idx = pool.map(byDist(cur)).sort((a, b) => a.d - b.d)[0]!.i;
      // alvo: nota exclusiva perto da posição atual E da tônica (para sobrar caminho até a cadência)
      const tonicIdx = pool.map((p, i) => (p.letter === tonic ? i : -1)).filter((i) => i >= 0);
      const onlyB = pool
        .map((p, i) => ({ p, i }))
        .filter((x) => !aMidis.has(spelledToMidi(x.p)))
        .map((x) => ({ i: x.i, cost: 2 * Math.abs(x.i - idx) + (tonicIdx.length ? Math.min(...tonicIdx.map((t) => Math.abs(t - x.i))) : 0) + rng.next() * 0.5 }))
        .sort((a, b) => a.cost - b.cost);
      if (!onlyB.length) return fail('sem notas exclusivas na segunda região');
      approachTarget = onlyB[0]!.i;
      if (spelledToMidi(pool[idx]!) === spelledToMidi(cur) && idx !== approachTarget) idx += Math.sign(approachTarget - idx);
    } else if (k > 0 && approachTarget >= 0 && idx !== approachTarget && !cadenceDue(k)) {
      // aproximação da nota exclusiva da segunda região
      idx += Math.sign(approachTarget - idx) * Math.min(Math.abs(approachTarget - idx), Math.max(1, c.maxLeap));
      if (idx === approachTarget) approachTarget = -2;
    } else if (k > 0 && cadenceDue(k)) {
      // cadência: caminha até a tônica mais próxima e termina nela
      const target = nearestTonic();
      const left = noteCount - 1 - k; // notas restantes depois desta
      const dist = target - idx;
      const step = Math.max(1, c.maxLeap);
      if (left === 0) idx = target;
      else if (dist !== 0) idx += Math.sign(dist) * Math.min(Math.abs(dist), Math.abs(dist) > (left - 1) * step ? step : 1);
      else idx = Math.max(0, Math.min(pool.length - 1, idx + (rng.next() < 0.5 ? 1 : -1)));
    } else if (k > 0) {
      let move = pickMove(rng, c.maxLeap, mustStep);
      // tende ao centro da tessitura
      if (idx + move < 0 || idx + move >= pool.length) move = -move;
      if (idx + move < 0 || idx + move >= pool.length) move = idx > pool.length / 2 ? -1 : 1;
      const prev2 = pitches.length >= 2 ? pitches[pitches.length - 2] : null;
      if (move === 0 && prev2 && spelledToMidi(prev2) === spelledToMidi(pool[idx]!)) move = 1;
      mustStep = Math.abs(move) >= 3 ? -Math.sign(move) : 0;
      idx = Math.max(0, Math.min(pool.length - 1, idx + move));
    }
    // Limite real do salto em graus da pauta (a lista de alturas pode ter "buracos"
    // numa posição; um passo de índice pode valer mais de um grau).
    const prev = pitches[pitches.length - 1];
    if (prev) {
      const limit = Math.max(1, c.maxLeap);
      const leap = () => Math.abs(diatonicIndex(pool[idx]!) - diatonicIndex(prev));
      if (k === noteCount - 1) {
        // a nota final é a tônica; admite o salto cadencial clássico (até 5ª, como 5 → 1)
        if (leap() > Math.max(limit, 4)) return fail('cadência');
      } else {
        const from = pool.findIndex((p) => spelledToMidi(p) === spelledToMidi(prev));
        // Com "buracos" na posição, a nota vizinha disponível pode estar a uma terça:
        // nesse caso ela conta como o menor passo possível naquela direção.
        const dir = Math.sign(idx - from);
        const neighbor = from >= 0 && dir !== 0 ? pool[from + dir] : undefined;
        const allowed = Math.max(limit, neighbor ? Math.abs(diatonicIndex(neighbor) - diatonicIndex(prev)) : limit);
        while (leap() > allowed && from >= 0 && idx !== from) idx -= dir;
        if (leap() > Math.max(allowed, 2)) return fail('salto grande demais');
      }
    }
    pitches.push(pool[idx]!);
  }

  // cromatismo: aproximação por semitom da nota seguinte (nunca na última nota)
  if (c.chromatic) {
    for (let k = 1; k < pitches.length - 1; k++) {
      if (rng.next() > 0.18) continue;
      const cur = pitches[k]!;
      const nxt = pitches[k + 1]!;
      const gap = spelledToMidi(nxt) - spelledToMidi(cur);
      if (Math.abs(gap) !== 2) continue;
      const alter = (cur.alter + Math.sign(gap)) as Alter;
      const altered = { ...cur, alter };
      if (!isSimpleSpelling(altered)) continue;
      const s = writtenToSounding(writtenMidiOf(altered), inst.transposition);
      const region = k < switchAt ? c.region : (c.shiftTo ?? c.region);
      if (!validLocations(s, inst, regionConstraints(region, c, inst)).length) continue;
      pitches[k] = altered;
    }
  }

  // filtros de musicalidade
  for (let k = 1; k < pitches.length; k++) {
    const iv = intervalBetween(pitches[k - 1]!, pitches[k]!);
    if (!c.chromatic && (iv.quality === 'A' || iv.quality === 'd')) return fail('trítono'); // trítono/aumentados
    if (k >= 2 && spelledToMidi(pitches[k]!) === spelledToMidi(pitches[k - 1]!) && spelledToMidi(pitches[k - 1]!) === spelledToMidi(pitches[k - 2]!)) return fail('repetição');
  }

  // digitação de referência dentro das regiões
  const winA = fretWindow(c.region, inst.frets);
  const winB = c.shiftTo ? fretWindow(c.shiftTo, inst.frets) : winA;
  const allow = (l: FretLocation) => c.strings.includes(l.string) && (inPosition(l, c.region, inst.frets) || (!!c.shiftTo && inPosition(l, c.shiftTo, inst.frets)));
  const posOk = (p: number) => {
    const fits = (w: typeof winA, spec: PositionSpec) => spec.kind === 'whole' || (p >= w.min && p <= Math.max(w.min, w.max - 3));
    return fits(winA, c.region) || (!!c.shiftTo && fits(winB, c.shiftTo));
  };
  const sounding = pitches.map((p) => writtenToSounding(writtenMidiOf(p), inst.transposition));
  const hasStretch = (s: PositionSpec) => s.kind === 'whole' || (s.kind === 'fixed' && (s.stretch1 || s.stretch4));
  const allowStretch = hasStretch(c.region) || (!!c.shiftTo && hasStretch(c.shiftTo));
  const fingering = resolveFingering(sounding, inst, { allow, allowPosition: posOk, allowStretch });
  if (!fingering) return fail('digitação');
  if (c.shiftTo && fingering.shifts < 1) return fail('sem mudança');

  // eventos com acidentes por compasso
  // (continuações de ligadura repetem a nota de origem e não desenham acidente)
  const events: MelodyEvent[] = [];
  let k = -1; // índice da última nota atacada
  let flatIdx = 0;
  let onset = 0;
  skeleton.forEach((measure, mi) => {
    const startIdx = flatIdx;
    // notas do compasso com a informação de ligadura, para a vigência dos acidentes
    let kk = k;
    const notesHere = measure
      .map((e, j) => ({ e, attack: isAttack[startIdx + j]! }))
      .filter((x) => !x.e.rest)
      .map((x) => {
        if (x.attack) kk++;
        return { ...pitches[kk]!, tiedFrom: !x.attack };
      });
    const acc = accidentalsToDraw(notesHere, c.fifths);
    let j = 0;
    for (const e of measure) {
      const attack = isAttack[flatIdx]!;
      if (e.rest) {
        events.push({ units: e.units, rest: true, pitch: null, sounding: null, measure: mi, onsetUnits: onset, accidental: null, noteIndex: -1, tie: false, tiedFromPrev: false });
      } else {
        if (attack) k++;
        events.push({ units: e.units, rest: false, pitch: pitches[k]!, sounding: sounding[k]!, measure: mi, onsetUnits: onset, accidental: acc[j]!, noteIndex: k, tie: !!e.tie, tiedFromPrev: !attack });
        j++;
      }
      onset += e.units;
      flatIdx++;
    }
  });
  return { seed, config: c, events, fingering, materialKey: materialKey(c) };
}

/** Gera uma melodia; tenta várias sementes derivadas até satisfazer todas as regras. */
export function generateMelody(c: MelodyConfig, inst: Instrument, seed: number): Melody {
  const rng = createRng(seed);
  for (let i = 0; i < 150; i++) {
    const m = attempt(c, inst, i === 0 ? seed : rng.int(0, 2 ** 31));
    if (m) return m;
  }
  throw new Error('Não foi possível gerar uma melodia com essas restrições.');
}

/**
 * Uma mudança de posição só faz sentido se a segunda região tiver notas da
 * tonalidade que NÃO cabem na primeira (senão a mão nunca precisa se mover).
 */
export function shiftIsMeaningful(c: MelodyConfig, inst: Instrument): boolean {
  if (!c.shiftTo) return true;
  const a = diatonicPool(c.region, c, inst).map(spelledToMidi);
  const b = diatonicPool(c.shiftTo, c, inst).map(spelledToMidi);
  const onlyB = b.filter((m) => !a.includes(m)).length;
  const onlyA = a.filter((m) => !b.includes(m)).length;
  return onlyA >= 1 && onlyB >= 2;
}

/** Combinações de mudança de posição oferecidas na interface (progressão do §5, nível 4). */
export const SHIFT_PAIRS: readonly [number, number][] = [
  [2, 5],
  [5, 7],
  [7, 9],
  [9, 12],
  [5, 9],
];

/** Notas ATACADAS (sem pausas e sem continuações de ligadura). */
export function melodyNotes(m: Melody): MelodyEvent[] {
  return m.events.filter((e) => !e.rest && !e.tiedFromPrev);
}
