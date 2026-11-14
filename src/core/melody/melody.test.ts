import { describe, expect, it } from 'vitest';
import { createRng } from '../exercise/rng';
import { STANDARD_GUITAR, soundingAt } from '../instrument/instrument';
import { fixedPosition, inPosition, OPEN_POSITION, WHOLE_NECK } from '../instrument/position';
import { accidentalsToDraw, resolveMeasure } from '../theory/accidentals';
import { intervalBetween } from '../theory/intervals';
import { keyAlterFor } from '../theory/keySignature';
import { asSounding, LETTERS, spelledToMidi, type Alter } from '../theory/pitch';
import { measureSize } from '../rhythm/rhythm';
import { resolveFingering } from './fingering';
import { generateMelody, lastRejection, materialKey, melodyMeter, melodyNotes, parseMaterialKey, SHIFT_PAIRS, shiftIsMeaningful, type MelodyConfig } from './melody';
import { evaluateReading, sustainableBpm } from './sightReading';

const g = STANDARD_GUITAR;
const ALL = [1, 2, 3, 4, 5, 6];
const base: MelodyConfig = { fifths: 0, region: fixedPosition(5), strings: ALL, measures: 4, beats: 4, rhythmLevel: 0, maxLeap: 2, chromatic: false };

describe('acidentes a desenhar (inverso da vigência)', () => {
  it('ida e volta com resolveMeasure (1.000 compassos aleatórios)', () => {
    const rng = createRng(11);
    for (let t = 0; t < 1000; t++) {
      const fifths = rng.int(-4, 4);
      const notes = Array.from({ length: rng.int(1, 8) }, () => ({ letter: rng.pick(LETTERS), octave: rng.int(3, 5), alter: rng.int(-1, 1) as Alter }));
      const drawn = accidentalsToDraw(notes, fifths);
      const back = resolveMeasure(notes.map((n, i) => ({ letter: n.letter, octave: n.octave, explicit: drawn[i]! })), fifths);
      expect(back.map((b) => b.alter)).toEqual(notes.map((n) => n.alter));
    }
  });
  it('repõe o bequadro depois de um sustenido no mesmo compasso', () => {
    expect(accidentalsToDraw([{ letter: 'F', octave: 4, alter: 1 }, { letter: 'F', octave: 4, alter: 0 }], 0)).toEqual([1, 0]);
    expect(accidentalsToDraw([{ letter: 'F', octave: 4, alter: 1 }], 1)).toEqual([null]);
  });
});

describe('digitação (Viterbi, §8.7)', () => {
  it('escala de Dó na V posição fica na V posição, sem mudanças', () => {
    const scale = [48, 50, 52, 53, 55, 57, 59, 60].map(asSounding); // Dó3..Dó4 soantes
    const r = resolveFingering(scale, g, { allow: (l) => inPosition(l, fixedPosition(5, { stretch1: true }), g.frets), allowPosition: (p) => p === 5 })!;
    expect(r.shifts).toBe(0);
    expect(r.notes.every((n) => n.position === 5)).toBe(true);
    for (const n of r.notes) expect(soundingAt(n.loc, g)).toBe(scale[r.notes.indexOf(n)]);
  });
  it('sem restrições, uma escala longa usa poucas mudanças', () => {
    const scale = [40, 42, 44, 45, 47, 49, 51, 52, 54, 56, 57, 59, 61, 63, 64, 66, 68, 69, 71, 73, 75, 76].map(asSounding);
    const r = resolveFingering(scale, g)!;
    expect(r.notes).toHaveLength(scale.length);
    expect(r.shifts).toBeLessThanOrEqual(3);
  });
  it('impossível → null', () => {
    expect(resolveFingering([asSounding(30)], g)).toBeNull();
  });
});

describe('gerador de melodias (§7.4)', () => {
  const configs: MelodyConfig[] = [
    base,
    { ...base, region: OPEN_POSITION, maxLeap: 1 },
    { ...base, fifths: 2, rhythmLevel: 2, maxLeap: 4 },
    { ...base, fifths: -1, region: fixedPosition(2), rhythmLevel: 3, chromatic: true, beats: 3 },
    { ...base, region: fixedPosition(5), shiftTo: fixedPosition(7), measures: 4 },
    { ...base, region: WHOLE_NECK, rhythmLevel: 4, maxLeap: 7, measures: 8 },
    { ...base, meter: { num: 6, den: 8 }, beats: 2, rhythmLevel: 2 },
    { ...base, meter: { num: 9, den: 8 }, beats: 3, rhythmLevel: 4, chromatic: true, fifths: 2 },
    { ...base, meter: { num: 12, den: 8 }, beats: 4, rhythmLevel: 3, region: fixedPosition(2) },
    { ...base, meter: { num: 6, den: 8 }, beats: 2, rhythmLevel: 0, region: OPEN_POSITION },
  ];

  it('respeita todas as restrições declaradas (CA-C3-3) em 300 melodias', () => {
    const rng = createRng(21);
    for (let t = 0; t < 300; t++) {
      const c = configs[t % configs.length]!;
      const m = generateMelody(c, g, rng.int(0, 2 ** 31));
      // soma de durações por compasso
      for (let mi = 0; mi < c.measures; mi++) {
        expect(m.events.filter((e) => e.measure === mi).reduce((s, e) => s + e.units, 0)).toBe(measureSize(melodyMeter(c)));
      }
      const notes = melodyNotes(m);
      const tonic = LETTERS[(((c.fifths * 4) % 7) + 7) % 7];
      expect(notes[notes.length - 1]!.pitch!.letter).toBe(tonic);
      expect(m.events[0]!.rest).toBe(false);
      // digitação: um local por nota, na região e com a altura certa
      expect(m.fingering.notes).toHaveLength(notes.length);
      m.fingering.notes.forEach((fn, i) => {
        expect(soundingAt(fn.loc, g)).toBe(notes[i]!.sounding);
        expect(c.strings).toContain(fn.loc.string);
        const inA = inPosition(fn.loc, c.region, g.frets);
        const inB = c.shiftTo ? inPosition(fn.loc, c.shiftTo, g.frets) : false;
        expect(inA || inB).toBe(true);
      });
      if (c.shiftTo) expect(m.fingering.shifts).toBeGreaterThanOrEqual(1);
      // saltos e trítonos
      for (let i = 1; i < notes.length; i++) {
        const iv = intervalBetween(notes[i - 1]!.pitch!, notes[i]!.pitch!);
        if (!c.chromatic) {
          expect(['A', 'd']).not.toContain(iv.quality);
          expect(iv.number - 1).toBeLessThanOrEqual(Math.max(c.maxLeap, 7));
          for (const n of [notes[i]!]) expect(n.pitch!.alter).toBe(keyAlterFor(n.pitch!.letter, c.fifths));
        }
      }
    }
  });

  it('acidentes desenhados reproduzem as alturas (vigência no compasso)', () => {
    const rng = createRng(5);
    for (let t = 0; t < 100; t++) {
      const c = configs[3]!;
      const m = generateMelody(c, g, rng.int(0, 2 ** 31));
      for (let mi = 0; mi < c.measures; mi++) {
        const ns = m.events.filter((e) => e.measure === mi && !e.rest);
        const back = resolveMeasure(ns.map((e) => ({ letter: e.pitch!.letter, octave: e.pitch!.octave, explicit: e.accidental, tiedFrom: e.tiedFromPrev ? e.pitch!.alter : null })), c.fifths);
        expect(back.map((b) => b.alter)).toEqual(ns.map((e) => e.pitch!.alter));
      }
    }
  });

  it('toda configuração oferecida na interface gera melodia (tonalidades × ritmos × saltos × regiões)', () => {
    const fails: string[] = [];
    let n = 0;
    for (const fifths of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) {
      for (const rhythmLevel of [0, 1, 2, 3, 4]) {
        for (const maxLeap of [1, 2, 4, 7]) {
          const cfgs: MelodyConfig[] = [0, 2, 5, 7, 9, 12].map((p) => ({ ...base, fifths, rhythmLevel, maxLeap, chromatic: rhythmLevel % 2 === 1, region: p === 0 ? OPEN_POSITION : fixedPosition(p) }));
          for (const [a, b] of SHIFT_PAIRS) cfgs.push({ ...cfgs[0]!, region: fixedPosition(a), shiftTo: fixedPosition(b) });
          // as mesmas configurações em 6/8 (composto) — e uma amostra em 9/8 e 12/8
          cfgs.push(...cfgs.map((c) => ({ ...c, meter: { num: 6, den: 8 as const }, beats: 2 })));
          cfgs.push({ ...cfgs[0]!, meter: { num: 9, den: 8 }, beats: 3 }, { ...cfgs[2]!, meter: { num: 12, den: 8 }, beats: 4 });
          for (const c of cfgs) {
            if (!shiftIsMeaningful(c, g)) continue;
            n++;
            try {
              generateMelody(c, g, n * 31);
            } catch {
              fails.push(`${materialKey(c)} (${lastRejection})`);
            }
          }
        }
      }
    }
    expect(n).toBeGreaterThan(3500);
    expect(fails).toEqual([]);
  });

  it('ligaduras: a continuação repete a nota, não é ataque e não redesenha acidente (400 melodias)', () => {
    const rng = createRng(77);
    let ties = 0;
    let crossBar = 0;
    for (let t = 0; t < 400; t++) {
      const c: MelodyConfig = t % 2 ? { ...base, rhythmLevel: 4, chromatic: true, fifths: 3 } : { ...base, meter: { num: 6, den: 8 }, beats: 2, rhythmLevel: 4, chromatic: true, fifths: -2 };
      const m = generateMelody(c, g, rng.int(0, 2 ** 31));
      const ev = m.events;
      for (let i = 1; i < ev.length; i++) {
        const cur = ev[i]!;
        if (!cur.tiedFromPrev) continue;
        ties++;
        const prev = ev[i - 1]!;
        expect(prev.tie).toBe(true);
        expect(cur.pitch).toEqual(prev.pitch);
        expect(cur.noteIndex).toBe(prev.noteIndex);
        expect(cur.accidental).toBeNull();
        if (cur.measure !== prev.measure) crossBar++;
      }
      // a digitação cobre só os ataques
      expect(m.fingering.notes).toHaveLength(melodyNotes(m).length);
    }
    expect(ties).toBeGreaterThan(50);
    expect(crossBar).toBeGreaterThan(5);
  });

  it('ataques da frase pulam as continuações de ligadura (tempo real)', () => {
    const m = generateMelody({ ...base, rhythmLevel: 4 }, g, 123);
    const attacks = melodyNotes(m).map((e) => e.onsetUnits);
    const unique = new Set(attacks);
    expect(unique.size).toBe(attacks.length);
    for (const e of m.events.filter((x) => x.tiedFromPrev)) expect(attacks).not.toContain(e.onsetUnits);
  });

  it('chave de material é reversível (ida e volta) e aceita o formato antigo', () => {
    const cs: MelodyConfig[] = [
      base,
      { ...base, fifths: -3, rhythmLevel: 4, maxLeap: 7, chromatic: true, measures: 8, beats: 3 },
      { ...base, region: fixedPosition(2), shiftTo: fixedPosition(5) },
      { ...base, region: OPEN_POSITION, measures: 2, beats: 2 },
      { ...base, region: WHOLE_NECK },
      { ...base, meter: { num: 6, den: 8 }, beats: 2 },
      { ...base, meter: { num: 12, den: 8 }, beats: 4, measures: 2 },
    ];
    for (const c of cs) expect(parseMaterialKey(materialKey(c))).toEqual(c);
    expect(materialKey({ ...base, meter: { num: 9, den: 8 }, beats: 3 })).toContain('|m4x9d8');
    expect(parseMaterialKey('p5|k0|r0|s2')).toMatchObject({ measures: 4, beats: 4, maxLeap: 2 });
    expect(parseMaterialKey('lixo')).toBeNull();
  });

  it('mudança V → VII não é oferecida em tonalidades onde não obriga a mão a se mover', () => {
    expect(shiftIsMeaningful({ ...base, fifths: -2, region: fixedPosition(5), shiftTo: fixedPosition(7) }, g)).toBe(false);
    expect(shiftIsMeaningful({ ...base, fifths: 0, region: fixedPosition(2), shiftTo: fixedPosition(5) }, g)).toBe(true);
  });

  it('reprodutível e graus conjuntos quando maxLeap = 1', () => {
    const c = { ...base, maxLeap: 1 };
    expect(generateMelody(c, g, 42)).toEqual(generateMelody(c, g, 42));
    const notes = melodyNotes(generateMelody(c, g, 43));
    for (let i = 1; i < notes.length - 1; i++) {
      expect(Math.abs(spelledToMidi(notes[i]!.pitch!) - spelledToMidi(notes[i - 1]!.pitch!))).toBeLessThanOrEqual(2);
    }
  });
});

describe('métricas de leitura (§11.4)', () => {
  const beat = 1000;
  const exp = [0, 1000, 2000, 3000, 4000, 5000].map((onsetMs, i) => ({ onsetMs, sounding: 50 + i }));
  it('tudo certo', () => {
    const ev = evaluateReading(exp, exp.map((e) => ({ tMs: e.onsetMs + 20, sounding: e.sounding })), beat, 100, 6000);
    expect(ev.notesInTime).toBe(1);
    expect(ev.continuity).toBe(1);
    expect(ev.medianAbsDevMs).toBe(20);
  });
  it('classifica altura errada, atraso e omissão; parada de 2 notas reduz a continuidade', () => {
    const resp = [
      { tMs: 0, sounding: 50 },
      { tMs: 1010, sounding: 99 }, // altura errada
      { tMs: 2300, sounding: 52 }, // fora do tempo (tol 100)
      // 3000 e 4000 omitidas → parada de 2 s
      { tMs: 5000, sounding: 55 },
      { tMs: 5600, sounding: 70 }, // extra
    ];
    const ev = evaluateReading(exp, resp, beat, 100, 6000);
    expect(ev.perNote.map((p) => p.status)).toEqual(['ok', 'wrong-pitch', 'timing', 'missed', 'missed', 'ok']);
    expect(ev.notesInTime).toBeCloseTo(2 / 6, 9);
    expect(ev.pitchAccuracy).toBeCloseTo(3 / 6, 9);
    expect(ev.continuity).toBeCloseTo(1 - 2000 / 6000, 9);
    expect(ev.recovery).toBe(4);
    expect(ev.extras).toBe(1);
  });
  it('andamento sustentável = menor de 3 frases seguidas boas', () => {
    const r = (ts: number, bpm: number, ok = true) => ({ ts, bpm, notesInTime: ok ? 0.9 : 0.5, continuity: 0.95 });
    expect(sustainableBpm([r(1, 60), r(2, 66), r(3, 72)])).toBe(60);
    expect(sustainableBpm([r(1, 60), r(2, 66), r(3, 72), r(4, 72), r(5, 76)])).toBe(72);
    expect(sustainableBpm([r(1, 60), r(2, 66, false), r(3, 72)])).toBeNull();
  });
});
