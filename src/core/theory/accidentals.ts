import { keyAlterFor, type Fifths } from './keySignature';
import type { Alter, Letter } from './pitch';

/**
 * Resolução da alteração efetiva dentro de um compasso — especificação §9.2.
 *
 * Ordem de precedência:
 *  1. acidente explícito na própria nota (bequadro = 0);
 *  2. acidente anterior no MESMO compasso, mesma letra e MESMA oitava (vale até a barra);
 *  3. nota ligada a partir do compasso anterior herda a alteração de origem;
 *  4. armadura (vale para a letra em todas as oitavas).
 * Acidentes de cortesia não alteram o resultado (só exibição) — não são modelados aqui.
 */
export interface NotatedNote {
  readonly letter: Letter;
  readonly octave: number;
  /** Acidente escrito na nota, ou null se não houver. */
  readonly explicit: Alter | null;
  /** Se a nota é continuação de uma ligadura vinda do compasso anterior, a alteração da nota de origem. */
  readonly tiedFrom?: Alter | null;
}

export type AlterSource = 'explicit' | 'measure' | 'tie' | 'key' | 'none';

export interface ResolvedAlter {
  readonly alter: Alter;
  readonly source: AlterSource;
}

export function resolveMeasure(notes: readonly NotatedNote[], fifths: Fifths): ResolvedAlter[] {
  const active = new Map<string, Alter>();
  return notes.map((n) => {
    const slot = `${n.letter}${n.octave}`;
    if (n.explicit !== null) {
      active.set(slot, n.explicit);
      return { alter: n.explicit, source: 'explicit' };
    }
    const inMeasure = active.get(slot);
    if (inMeasure !== undefined) return { alter: inMeasure, source: 'measure' };
    if (n.tiedFrom !== undefined && n.tiedFrom !== null) return { alter: n.tiedFrom, source: 'tie' };
    const k = keyAlterFor(n.letter, fifths);
    return { alter: k, source: k === 0 ? 'none' : 'key' };
  });
}

/**
 * Inverso de resolveMeasure: dado o que deve SOAR (alteração efetiva de cada nota
 * do compasso), quais acidentes desenhar. Desenha só o necessário — mas repõe o
 * acidente quando uma alteração anterior no compasso mudou a letra/oitava.
 * Garantia: resolveMeasure(com estes acidentes) devolve as mesmas alterações.
 */
export function accidentalsToDraw(notes: readonly { letter: Letter; octave: number; alter: Alter; tiedFrom?: boolean }[], fifths: Fifths): (Alter | null)[] {
  const active = new Map<string, Alter>();
  return notes.map((n) => {
    // continuação de ligadura herda a alteração da nota de origem: nada a desenhar,
    // e ela NÃO estabelece vigência no compasso novo
    if (n.tiedFrom) return null;
    const slot = `${n.letter}${n.octave}`;
    const current = active.get(slot) ?? keyAlterFor(n.letter, fifths);
    if (current === n.alter) return null;
    active.set(slot, n.alter);
    return n.alter;
  });
}

/**
 * Qual acidente precisa ser DESENHADO para uma nota isolada no início do compasso,
 * dada a armadura. Retorna null quando a armadura já basta.
 */
export function displayedAccidental(letter: Letter, alter: Alter, fifths: Fifths): Alter | null {
  return keyAlterFor(letter, fifths) === alter ? null : alter;
}
