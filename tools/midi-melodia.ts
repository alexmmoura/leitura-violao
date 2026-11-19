/**
 * Tira a MELODIA (voz de cima) de um arquivo MIDI de violão solo — usado só pelo
 * importador do acervo (tools/importar-repertorio.ts), não pelo app.
 *
 * Peças de violão misturam baixo, acompanhamento e melodia na mesma pauta. Aqui
 * fica, a cada ataque, a nota mais aguda; uma nota que soa ABAIXO de uma nota
 * mais aguda ainda presa (voz interna) é descartada. Arpejos sem nota presa
 * continuam como estão (é o que o violonista lê e toca).
 */
import { measureSize, type Meter } from '../src/core/rhythm/rhythm';
import { spellingsForMidi, isSimpleSpelling } from '../src/core/theory/spelling';
import { LETTERS, type SpelledPitch } from '../src/core/theory/pitch';
import { splitIntoMeasures, type ScoreNote } from '../src/core/score/score';

export interface MidiNote {
  tick: number;
  dur: number;
  pitch: number;
}

export interface MidiFile {
  div: number;
  notes: MidiNote[];
  /** As mesmas notas, separadas por trilha (só as trilhas com notas). */
  tracks: MidiNote[][];
  /** Fórmulas de compasso [num, den] com o tick em que começam. */
  times: { tick: number; num: number; den: number }[];
  keys: { tick: number; fifths: number; minor: boolean }[];
}

export function parseMidi(buf: Uint8Array): MidiFile {
  let p = 0;
  const u32 = () => ((buf[p++]! << 24) | (buf[p++]! << 16) | (buf[p++]! << 8) | buf[p++]!) >>> 0;
  const u16 = () => (buf[p++]! << 8) | buf[p++]!;
  const vlq = () => {
    let v = 0;
    let b: number;
    do {
      b = buf[p++]!;
      v = (v << 7) | (b & 127);
    } while (b & 128);
    return v;
  };
  const tag = (at: number) => String.fromCharCode(buf[at]!, buf[at + 1]!, buf[at + 2]!, buf[at + 3]!);
  if (tag(0) !== 'MThd') throw new Error('não é MIDI');
  p = 4;
  const hl = u32();
  u16();
  const ntr = u16();
  const div = u16();
  if (div & 0x8000) throw new Error('MIDI com tempo SMPTE');
  p = 8 + hl;
  const out: MidiFile = { div, notes: [], tracks: [], times: [], keys: [] };
  for (let t = 0; t < ntr && p < buf.length; t++) {
    while (p < buf.length && tag(p) !== 'MTrk') {
      p += 4;
      p += u32();
    }
    if (p >= buf.length) break;
    p += 4;
    const len = u32();
    const end = p + len;
    let tick = 0;
    let run = 0;
    const on = new Map<number, { tick: number; pitch: number }>();
    const mine: MidiNote[] = [];
    while (p < end) {
      tick += vlq();
      let st = buf[p]!;
      if (st & 128) p++;
      else st = run;
      if (st === 0xff) {
        const type = buf[p++]!;
        const l = vlq();
        if (type === 0x58) out.times.push({ tick, num: buf[p]!, den: 2 ** buf[p + 1]! });
        if (type === 0x59) out.keys.push({ tick, fifths: (buf[p]! << 24) >> 24, minor: buf[p + 1] === 1 });
        p += l;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) {
        p += vlq();
        continue;
      }
      run = st;
      const hi = st & 0xf0;
      const ch = st & 15;
      const a = buf[p++]!;
      const b = hi === 0xc0 || hi === 0xd0 ? 0 : buf[p++]!;
      if (ch === 9) continue; // percussão
      const k = ch * 128 + a;
      if (hi === 0x90 && b > 0) on.set(k, { tick, pitch: a });
      else if (hi === 0x80 || (hi === 0x90 && b === 0)) {
        const n = on.get(k);
        if (n) {
          on.delete(k);
          if (tick > n.tick) mine.push({ ...n, dur: tick - n.tick });
        }
      }
    }
    p = end;
    if (mine.length) {
      out.tracks.push(mine);
      out.notes.push(...mine);
    }
  }
  out.notes.sort((a, b) => a.tick - b.tick || b.pitch - a.pitch);
  return out;
}

/** Posição na linha das quintas (Fá −1, Dó 0, Sol 1 … Si 5; ♯ +7, ♭ −7). */
const LOF: Record<string, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };

/**
 * Grafia de uma nota MIDI numa tonalidade: a mais próxima da tonalidade na linha
 * das quintas (em menor, a sensível sobe: Sol♯ em Lá menor, Dó♯ em Ré menor).
 */
export function spellInKey(midi: number, fifths: number, minor: boolean): SpelledPitch {
  const lo = fifths - 1;
  const hi = fifths + (minor ? 8 : 5);
  const dist = (s: SpelledPitch) => {
    const x = LOF[s.letter]! + 7 * s.alter;
    return x < lo ? lo - x : x > hi ? x - hi : 0;
  };
  const options = spellingsForMidi(midi, 1).filter((s) => isSimpleSpelling(s) || dist(s) === 0);
  options.sort((a, b) => dist(a) - dist(b) || LETTERS.indexOf(a.letter) - LETTERS.indexOf(b.letter));
  return options[0]!;
}

export interface MelodyLine {
  meter: Meter;
  fifths: number;
  measures: ScoreNote[][];
  /** Notas de quiáltera (fora da grade de semicolcheias) — a melodia para antes delas. */
  offGrid: number;
  total: number;
}

function meterOf(num: number, den: number): Meter | null {
  if (den === 4 || den === 8) return { num, den };
  if (den === 2) return { num: num * 2, den: 4 };
  return null;
}

/**
 * Melodia da voz de cima. `partial` = duração da anacruse em semicolcheias (0 se
 * não há); `octave` = semitons somados para virar altura ESCRITA (violão: +12).
 * Para na primeira mudança de compasso ou de tonalidade.
 */
export function topLine(m: MidiFile, partial: number, octave: number): MelodyLine {
  const t0 = m.times[0] ?? { tick: 0, num: 4, den: 4 };
  const meter = meterOf(t0.num, t0.den);
  if (!meter) throw new Error(`compasso ${t0.num}/${t0.den}`);
  const k0 = m.keys[0] ?? { tick: 0, fifths: 0, minor: false };
  const g = m.div / 4; // semicolcheia
  const stopTick = Math.min(
    ...m.times.filter((t) => t.tick > 0 && (t.num !== t0.num || t.den !== t0.den)).map((t) => t.tick),
    ...m.keys.filter((k) => k.tick > 0 && k.fifths !== k0.fifths).map((k) => k.tick),
    Infinity,
  );
  const size = measureSize(meter);
  // quiáltera (nota fora da grade que não é apojatura curtinha): a melodia para no
  // começo do compasso dela — o app ainda não desenha quiálteras
  const offGridAt = (n: MidiNote) => Math.abs(n.tick - Math.round(n.tick / g) * g) > g / 8;
  let offGrid = 0;
  let stop = stopTick;
  for (const n of m.notes) {
    if (n.tick >= stop || !offGridAt(n) || n.dur < g / 2) continue;
    offGrid++;
    const u = Math.floor(n.tick / g);
    const bar = partial > 0 ? (u < partial ? 0 : partial + Math.floor((u - partial) / size) * size) : Math.floor(u / size) * size;
    stop = Math.min(stop, bar * g);
  }
  const q: { on: number; off: number; pitch: number }[] = [];
  for (const n of m.notes) {
    if (n.tick >= stop || offGridAt(n)) continue; // apojaturas somem
    const on = Math.round(n.tick / g);
    const off = Math.min(Math.max(on + 1, Math.round((n.tick + n.dur) / g)), Math.round(stop / g));
    q.push({ on, off, pitch: n.pitch });
  }
  const byOnset = new Map<number, number>();
  for (const n of q) byOnset.set(n.on, Math.max(byOnset.get(n.on) ?? -1, n.pitch));
  const onsets = [...byOnset.keys()].sort((a, b) => a - b);
  // voz de cima: a nota mais aguda do ataque, se nenhuma nota mais aguda ainda soa
  const line: { on: number; off: number; pitch: number }[] = [];
  for (const t of onsets) {
    const top = byOnset.get(t)!;
    const held = line[line.length - 1];
    if (held && held.off > t && held.pitch > top) continue;
    const own = q.filter((n) => n.on === t && n.pitch === top).reduce((a, n) => Math.max(a, n.off), t + 1);
    line.push({ on: t, off: own, pitch: top });
  }
  const notes: ScoreNote[] = [];
  const lead = partial > 0 ? size - (partial % size) : 0;
  if (lead) notes.push({ units: lead, rest: true, written: null });
  let at = 0;
  for (let i = 0; i < line.length; i++) {
    const n = line[i]!;
    if (n.on > at) notes.push({ units: n.on - at, rest: true, written: null });
    const next = line[i + 1]?.on ?? n.off;
    const end = Math.min(n.off, next);
    const spelled = spellInKey(n.pitch + octave, k0.fifths, k0.minor);
    notes.push({ units: end - n.on, rest: false, written: n.pitch + octave, spelled });
    at = end;
  }
  const measures = splitIntoMeasures(notes, meter);
  if (lead) {
    // tira o enchimento da anacruse
    let cut = lead;
    const first = measures[0]!;
    while (cut > 0 && first[0]?.rest) {
      const r = first.shift()!;
      if (r.units > cut) first.unshift({ ...r, units: r.units - cut });
      cut -= r.units;
    }
    if (first.length === 0) measures.shift();
  }
  // tira pausas do começo do 1º compasso (anacruse sem nota) e do fim
  while (measures.length > 1 && measures[0]!.every((n) => n.rest)) measures.shift();
  while (measures.length > 1 && measures[measures.length - 1]!.every((n) => n.rest)) measures.pop();
  return { meter, fifths: k0.fifths, measures, offGrid, total: m.notes.length };
}
