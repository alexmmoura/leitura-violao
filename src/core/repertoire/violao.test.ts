import { describe, expect, it } from 'vitest';
import { parseMidi, spellInKey, topLine, type MidiFile } from '../../../tools/midi-melodia';
import { loadAcervo } from './pieces';

describe('melodia tirada do MIDI de violão (importador)', () => {
  it('grafa as notas pela tonalidade (sensível do menor com sustenido)', () => {
    expect(spellInKey(68, 0, true)).toMatchObject({ letter: 'G', alter: 1 }); // Sol♯ em Lá menor
    expect(spellInKey(61, -1, true)).toMatchObject({ letter: 'C', alter: 1 }); // Dó♯ em Ré menor
    expect(spellInKey(70, 0, false)).toMatchObject({ letter: 'B', alter: -1 }); // Si♭ em Dó maior
    expect(spellInKey(66, 0, false)).toMatchObject({ letter: 'F', alter: 1 }); // Fá♯ em Dó maior
  });

  it('fica com a voz de cima, tira a voz interna presa, respeita a anacruse e sobe a oitava do violão', () => {
    // div 4 → 1 tick = 1 semicolcheia; 4/4 com anacruse de 1 tempo
    const m: MidiFile = {
      div: 4,
      times: [{ tick: 0, num: 4, den: 4 }],
      keys: [{ tick: 0, fifths: 0, minor: false }],
      tracks: [],
      notes: [
        { tick: 0, dur: 4, pitch: 67 }, // anacruse: Sol
        { tick: 4, dur: 8, pitch: 72 }, // melodia: Dó (mínima)
        { tick: 4, dur: 16, pitch: 48 }, // baixo
        { tick: 8, dur: 4, pitch: 64 }, // voz interna sob o Dó preso: some
        { tick: 12, dur: 4, pitch: 71 }, // Si
        { tick: 20, dur: 16, pitch: 72 }, // Dó (semibreve)
      ],
    };
    const line = topLine(m, 4, 12);
    const bars = line.measures.map((b) => b.map((n) => (n.rest ? `r${n.units}` : `${n.written}:${n.units}`)));
    expect(bars).toEqual([['79:4'], ['84:8', '83:4', 'r4'], ['84:16']]);
  });

  it('para antes de uma quiáltera (o app ainda não desenha tercinas)', () => {
    const m: MidiFile = {
      div: 12,
      times: [{ tick: 0, num: 2, den: 4 }],
      keys: [{ tick: 0, fifths: 0, minor: false }],
      tracks: [],
      notes: [
        { tick: 0, dur: 24, pitch: 60 },
        { tick: 24, dur: 24, pitch: 62 },
        { tick: 48, dur: 8, pitch: 64 }, // tercina de colcheias
        { tick: 56, dur: 8, pitch: 65 },
        { tick: 64, dur: 8, pitch: 67 },
      ],
    };
    const line = topLine(m, 0, 12);
    expect(line.offGrid).toBeGreaterThan(0);
    // os 2 primeiros compassos ficam; o 3º (o da tercina) e o resto saem
    expect(line.measures.length).toBe(2);
  });

  it('lê um MIDI mínimo (formato 1)', () => {
    const bytes = [
      ...[0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 1, 0, 4],
      ...[0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 20],
      ...[0, 0xff, 0x58, 4, 3, 2, 24, 8], // 3/4
      ...[0, 0x90, 64, 80, 4, 0x80, 64, 0], // Mi4 por 1 semicolcheia
      ...[0, 0xff, 0x2f, 0],
    ];
    const m = parseMidi(new Uint8Array(bytes));
    expect(m.times[0]).toMatchObject({ num: 3, den: 4 });
    expect(m.notes).toEqual([{ tick: 0, dur: 4, pitch: 64 }]);
  });
});

describe('obras de violão no acervo', () => {
  it('tem centenas de obras originais de violão (Sor, Giuliani, Carcassi, Tárrega…) na tonalidade original', async () => {
    const violao = (await loadAcervo()).filter((p) => p.id.startsWith('violao-'));
    expect(violao.length).toBeGreaterThan(200);
    for (const c of ['Fernando Sor', 'Mauro Giuliani', 'Matteo Carcassi', 'Dionisio Aguado', 'Francisco Tárrega']) {
      expect(violao.some((p) => p.composer === c)).toBe(true);
    }
    expect(violao.every((p) => p.semitones === 0)).toBe(true);
    expect(violao.every((p) => /Mutopia Project/.test(p.source ?? ''))).toBe(true);
  });
});
