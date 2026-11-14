import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR, soundingAt, type FretLocation } from '../instrument/instrument';
import { chordPitchClasses, chordSymbol, chordTones, closeVoicingPitches, diatonicSevenths, TETRADS, TRIADS, type Chord } from '../theory/chords';
import { pitchClass, pitchName, spelledToMidi, type SpelledPitch } from '../theory/pitch';
import { cagedShapes } from './caged';
import { makeChordEarQuestion, makeDegreeQuestion, makeDictation, makeIntervalEarQuestion } from './ear';
import { intervalCode, intervalSemitones, parseIntervalCode } from '../theory/intervals';
import { analyzeVoicing, bestVoiceLeading, classifyVoicing, enumerateVoicings, evaluateVoicing, voiceLeadingCost } from './voicing';

const g = STANDARD_GUITAR;
const sp = (letter: SpelledPitch['letter'], alter: SpelledPitch['alter'], octave: number): SpelledPitch => ({ letter, alter, octave });
const C = sp('C', 0, 4);
const L = (string: number, fret: number): FretLocation => ({ string, fret });
const names = (ps: SpelledPitch[]) => ps.map((p) => pitchName(p, { naming: 'english' }));

describe('acordes (§6.7)', () => {
  it('notas com grafia correta', () => {
    expect(names(chordTones({ root: C, quality: 'maj7' }).map((t) => t.pitch))).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(names(chordTones({ root: sp('B', 0, 3), quality: 'm7b5' }).map((t) => t.pitch))).toEqual(['B3', 'D4', 'F4', 'A4']);
    expect(names(chordTones({ root: sp('C', 1, 4), quality: 'dim7' }).map((t) => t.pitch))).toEqual(['C♯4', 'E4', 'G4', 'B♭4']);
    expect(names(chordTones({ root: sp('E', -1, 4), quality: 'aug' }).map((t) => t.pitch))).toEqual(['E♭4', 'G4', 'B4']);
  });
  it('cifras', () => {
    expect(chordSymbol({ root: C, quality: 'maj7' })).toBe('C7M');
    expect(chordSymbol({ root: sp('F', 1, 3), quality: 'm7b5' })).toBe('F♯m7♭5');
    expect(chordSymbol({ root: sp('B', -1, 3), quality: 'dim7' })).toBe('B♭°7');
    expect(chordSymbol({ root: sp('A', 0, 3), quality: 'min' }, 'latin')).toBe('Lám');
  });
  it('empilhamento fechado por inversão', () => {
    expect(names(closeVoicingPitches({ root: C, quality: 'maj7' }, 0, 4))).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(names(closeVoicingPitches({ root: C, quality: 'maj7' }, 1, 4))).toEqual(['E4', 'G4', 'B4', 'C5']);
    expect(names(closeVoicingPitches({ root: C, quality: 'maj7' }, 3, 4))).toEqual(['B4', 'C5', 'E5', 'G5']);
  });
  it('campo harmônico de Dó maior (tétrades)', () => {
    expect(diatonicSevenths(C).map((c) => chordSymbol(c))).toEqual(['C7M', 'Dm7', 'Em7', 'F7M', 'G7', 'Am7', 'Bm7♭5']);
  });
});

describe('distribuição de vozes', () => {
  // Cmaj7: C4 E4 G4 B4 = 60 64 67 71
  it('fechada, Drop 2, Drop 3, Drop 2+4', () => {
    expect(classifyVoicing([60, 64, 67, 71])).toBe('close');
    expect(classifyVoicing([55, 60, 64, 71])).toBe('drop2'); // G3 C4 E4 B4
    expect(classifyVoicing([52, 60, 67, 71])).toBe('drop3'); // E3 C4 G4 B4
    expect(classifyVoicing([48, 55, 64, 71])).toBe('drop24'); // C3 G3 E4 B4
    expect(classifyVoicing([48, 64, 67, 83])).toBe('open');
  });
  it('Drop 2 nas cordas 1–4 e Drop 3 nas cordas 2-3-4-6: análise completa', () => {
    const cmaj7: Chord = { root: C, quality: 'maj7' };
    // Drop 2, fundamental, cordas 4-3-2-1: C4 G4 B4 E5 (soantes) → casas 10, 12, 12, 12
    const d2 = [L(4, 10), L(3, 12), L(2, 12), L(1, 12)];
    const a = analyzeVoicing(d2, cmaj7, g);
    expect(a.type).toBe('drop2');
    expect(a.inversion).toBe(0);
    expect(a.missing).toEqual([]);
    expect(a.skipsStrings).toBe(false);
    // Drop 3, fundamental, cordas 6-4-3-2: C3 B3 E4 G4 → 8, 9, 9, 8
    const d3 = [L(6, 8), L(4, 9), L(3, 9), L(2, 8)];
    const b = analyzeVoicing(d3, cmaj7, g);
    expect(b.type).toBe('drop3');
    expect(b.inversion).toBe(0);
    expect(b.skipsStrings).toBe(true);
  });
  it('avaliação atributo por atributo', () => {
    const req = { chord: { root: C, quality: 'maj7' as const }, inversion: 0, type: 'drop3' as const, strings: [2, 3, 4, 6] };
    const ev = evaluateVoicing([L(4, 10), L(3, 12), L(2, 12), L(1, 12)], req, g);
    expect(ev.correct).toBe(false);
    expect(ev.checks.find((c) => c.label === 'Drop 3')!.detail).toBe('você fez Drop 2');
    expect(ev.checks.find((c) => c.label.startsWith('Cordas'))!.ok).toBe(false);
    expect(ev.checks.find((c) => c.label === 'Só notas do acorde')!.ok).toBe(true);
    const ok = evaluateVoicing([L(6, 8), L(4, 9), L(3, 9), L(2, 8)], req, g);
    expect(ok.correct).toBe(true);
    // nota estranha, corda repetida, falta a 3ª
    const bad = evaluateVoicing([L(5, 3), L(5, 7), L(4, 5)], { chord: { root: C, quality: 'maj' } }, g);
    expect(bad.correct).toBe(false);
    expect(bad.analysis.duplicateStrings).toBe(true);
  });
  it('qualquer voicing válido é aceito (enumerados para várias tétrades e conjuntos de cordas)', () => {
    let count = 0;
    for (const q of [...TRIADS, ...TETRADS]) {
      for (const root of [C, sp('F', 1, 3), sp('B', -1, 3)]) {
        const chord = { root, quality: q };
        const sets = q.startsWith('m') || TETRADS.includes(q) ? [[1, 2, 3, 4], [2, 3, 4, 5], [2, 3, 4, 6]] : [[1, 2, 3], [2, 3, 4], [3, 4, 5]];
        for (const s of sets) {
          for (const v of enumerateVoicings(chord, s, g)) {
            const ev = evaluateVoicing(v, { chord, strings: s }, g);
            expect(ev.correct, `${chordSymbol(chord)} ${JSON.stringify(v)}`).toBe(true);
            count++;
          }
        }
      }
    }
    expect(count).toBeGreaterThan(300);
  });
  it('condução de vozes: II–V–I em Drop 2 nas cordas 1–4 encontra o menor movimento', () => {
    const [dm7, g7] = [diatonicSevenths(C)[1]!, diatonicSevenths(C)[4]!];
    const start = enumerateVoicings(dm7, [1, 2, 3, 4], g).find((v) => classifyVoicing(v.map((l) => soundingAt(l, g))) === 'drop2' && v.every((l) => l.fret >= 3 && l.fret <= 7))!;
    const best = bestVoiceLeading(start, g7, [1, 2, 3, 4], g)!;
    const all = enumerateVoicings(g7, [1, 2, 3, 4], g).map((v) => voiceLeadingCost(start, v, g));
    expect(best.cost).toBe(Math.min(...all));
    expect(best.cost).toBeLessThanOrEqual(4); // Dm7 → G7 resolve com 1–2 semitons por voz
  });
});

describe('percepção (§6.8)', () => {
  it('graus, intervalos, acordes e ditado coerentes (500 sorteios cada)', () => {
    for (let s = 0; s < 500; s++) {
      const d = makeDegreeQuestion(s);
      expect(pitchClass(d.midi - d.tonic)).toBe([0, 2, 4, 5, 7, 9, 11][d.degree]);
      const iv = makeIntervalEarQuestion(s, 4, ['asc', 'desc', 'harmonic']);
      expect(iv.high - iv.low).toBe(intervalSemitones(iv.interval));
      expect(iv.options).toContain(intervalCode(iv.interval));
      expect(new Set(iv.options.map((c) => intervalSemitones(parseIntervalCode(c)!))).size).toBe(iv.options.length); // sem enarmônicos auditivamente iguais
      const ch = makeChordEarQuestion(s, s % 2 ? 'triads' : 'tetrads');
      expect(ch.options).toContain(ch.quality);
      const dict = makeDictation(s, 4);
      expect(dict.midis[0]).toBe(dict.tonic);
      expect(dict.midis).toHaveLength(4);
      for (let i = 1; i < dict.midis.length; i++) expect(Math.abs(dict.midis[i]! - dict.midis[i - 1]!)).toBeLessThanOrEqual(4);
    }
  });
});

describe('CAGED ligado às posições (§3.4)', () => {
  it('Lá maior: forma de Mi na V posição; todas as formas soam só notas do acorde', () => {
    const a = { root: sp('A', 0, 3), quality: 'maj' as const };
    const shapes = cagedShapes(a, g);
    expect(shapes.map((s) => s.shape)).toEqual(expect.arrayContaining(['C', 'A', 'G', 'E', 'D']));
    const eShape = shapes.find((s) => s.shape === 'E')!;
    expect(eShape.position).toBe(5);
    expect(eShape.locs).toEqual(expect.arrayContaining([L(6, 5), L(5, 7), L(4, 7), L(3, 6), L(2, 5), L(1, 5)]));
    const pcs = chordPitchClasses(a);
    for (const s of shapes) {
      for (const l of s.locs) expect(pcs.has(pitchClass(soundingAt(l, g)))).toBe(true);
      expect(new Set(s.locs.map((l) => pitchClass(soundingAt(l, g)))).size).toBe(3);
    }
    // ordem C-A-G-E-D ao subir o braço (ciclo)
    expect(shapes.map((s) => s.position)).toEqual([...shapes.map((s) => s.position)].sort((x, y) => x - y));
  });
  it('acordes abertos: deslocamento 0 é o próprio acorde aberto', () => {
    const c = cagedShapes({ root: C, quality: 'maj' }, g).find((s) => s.shape === 'C')!;
    expect(c.shift).toBe(0);
    expect(c.locs).toEqual([L(5, 3), L(4, 2), L(3, 0), L(2, 1), L(1, 0)]);
    expect(cagedShapes({ root: sp('E', 0, 3), quality: 'min' }, g).find((s) => s.shape === 'E')!.shift).toBe(0);
    expect(cagedShapes({ root: C, quality: 'dom7' }, g)).toEqual([]);
    expect(spelledToMidi(C)).toBe(60);
  });
});
