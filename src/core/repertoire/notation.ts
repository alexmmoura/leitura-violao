import { ScoreError, type ScoreDef, type ScoreNote } from '../score/score';
import { measureSize, type Meter } from '../rhythm/rhythm';
import type { Fifths } from '../theory/keySignature';
import { spelledToMidi, type Alter, type Letter, type SpelledPitch } from '../theory/pitch';

/**
 * Notação compacta para escrever melodias à mão no código (repertório).
 *
 *  - tokens separados por espaço; compassos separados por "|";
 *  - nota: letra + acidente opcional (#, b, ##, bb) + oitava ESCRITA (violão:
 *    clave de sol com 8, ou seja, soa uma oitava abaixo) + duração;
 *  - duração: w = semibreve (16 semicolcheias), h = mínima (8), q = semínima (4),
 *    e = colcheia (2), s = semicolcheia (1); "." depois da duração = pontuada (×1,5);
 *  - "~" no fim = ligada à próxima nota (que continua soando);
 *  - pausa: "r" + duração (ex.: "rq", "re", "rh.").
 *
 * Exemplo: "E5q E5q F5q G5q | D5q. C5e C5h".
 * O primeiro e o último compasso podem ser incompletos (anacruse); os do meio
 * precisam fechar exatamente o tempo do compasso.
 */
const DUR: Readonly<Record<string, number>> = { w: 16, h: 8, q: 4, e: 2, s: 1 };
const ACC: Readonly<Record<string, Alter>> = { '': 0, '#': 1, '##': 2, b: -1, bb: -2 };
const NOTE_RE = /^([A-G])(##|#|bb|b)?(\d)([whqes])(\.)?(~)?$/;
const REST_RE = /^r([whqes])(\.)?$/;

function units(letter: string, dotted: boolean, token: string): number {
  const base = DUR[letter]!;
  const u = dotted ? base * 1.5 : base;
  if (!Number.isInteger(u)) throw new ScoreError(`Duração impossível em "${token}" (semicolcheia pontuada não existe aqui).`);
  return u;
}

/** Converte o texto em compassos de notas (alturas escritas). */
export function parseNotation(text: string, meter: Meter): ScoreNote[][] {
  const size = measureSize(meter);
  const bars = text
    .split('|')
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  if (bars.length === 0) throw new ScoreError('Melodia vazia.');
  return bars.map((bar, bi) => {
    const notes = bar.split(/\s+/).map((token): ScoreNote => {
      const r = REST_RE.exec(token);
      if (r) return { units: units(r[1]!, !!r[2], token), rest: true, written: null };
      const m = NOTE_RE.exec(token);
      if (!m) throw new ScoreError(`Não entendi "${token}" (compasso ${bi + 1}).`);
      const spelled: SpelledPitch = { letter: m[1] as Letter, alter: ACC[m[2] ?? '']!, octave: Number(m[3]) };
      return { units: units(m[4]!, !!m[5], token), rest: false, tie: !!m[6], written: spelledToMidi(spelled), spelled };
    });
    const total = notes.reduce((s, n) => s + n.units, 0);
    const edge = bi === 0 || bi === bars.length - 1;
    if (total > size || (!edge && total !== size)) {
      throw new ScoreError(`O compasso ${bi + 1} tem ${total} semicolcheias; o compasso pede ${size}.`);
    }
    return notes;
  });
}

/** Partitura completa a partir da notação compacta. */
export function notationScore(id: string, title: string, fifths: Fifths, meter: Meter, music: string): ScoreDef {
  return { id, title, fifths, meter, measures: parseNotation(music, meter), source: 'editor', createdAt: 0 };
}
