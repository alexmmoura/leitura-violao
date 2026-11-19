import type { Meter } from '../rhythm/rhythm';
import type { ScoreDef } from '../score/score';
import type { Fifths } from '../theory/keySignature';
import { notationScore } from './notation';

/**
 * Repertório: trechos de obras clássicas e canções tradicionais em DOMÍNIO
 * PÚBLICO (compositores mortos há mais de 70 anos), escritos à mão na notação
 * compacta de ./notation.ts. Só a linha melódica, com alturas ESCRITAS para
 * violão (soam uma oitava abaixo). Trechos curtos e conhecidos, para não errar notas.
 *
 * Níveis (1 → 5):
 *  1. posição aberta, notas longas, graus conjuntos;
 *  2. colcheias, saltos, sustenidos da armadura;
 *  3. anacruse, pontuadas, pausas, bemóis;
 *  4. semicolcheias, cromatismo, regiões agudas e linhas suplementares;
 *  5. trechos longos e rápidos.
 */
export type Level = 1 | 2 | 3 | 4 | 5;

export interface Piece {
  readonly id: string;
  readonly title: string;
  readonly composer: string;
  readonly level: Level;
  readonly fifths: Fifths;
  readonly meter: Meter;
  readonly music: string;
  /** O que este trecho treina. */
  readonly about?: string;
  /** De onde veio (obras baixadas do acervo). */
  readonly source?: string;
  /** Transposição para o violão em semitons (0/ausente = tonalidade original). */
  readonly semitones?: number;
}

export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

export const LEVEL_INFO: Readonly<Record<Level, { title: string; about: string }>> = {
  1: { title: 'Nível 1', about: 'Posição aberta, notas longas e graus conjuntos.' },
  2: { title: 'Nível 2', about: 'Colcheias, saltos e sustenidos da armadura.' },
  3: { title: 'Nível 3', about: 'Anacruse, notas pontuadas, pausas e bemóis.' },
  4: { title: 'Nível 4', about: 'Semicolcheias, cromatismo, regiões agudas e linhas suplementares.' },
  5: { title: 'Nível 5', about: 'Trechos longos e rápidos.' },
};

const m = (num: number, den: 4 | 8 = 4): Meter => ({ num, den });

/** Arpejo do Prelúdio em Dó (BWV 846): n1 n2 n3 n4 n5 n3 n4 n5, duas vezes, em semicolcheias. */
const prelude = (chords: readonly string[][]): string =>
  chords
    .map((c) => {
      const half = [c[0], c[1], c[2], c[3], c[4], c[2], c[3], c[4]].map((n) => `${n}s`).join(' ');
      return `${half} ${half}`;
    })
    .join(' | ');

const MINUET_A =
  'D5q G4e A4e B4e C5e | D5q G4q G4q | E5q C5e D5e E5e F#5e | G5q G4q G4q | C5q D5e C5e B4e A4e | B4q C5e B4e A4e G4e | F#4q G4e A4e B4e G4e | A4h. | ' +
  'D5q G4e A4e B4e C5e | D5q G4q G4q | E5q C5e D5e E5e F#5e | G5q G4q G4q | C5q D5e C5e B4e A4e | B4q C5e B4e A4e G4e | A4q B4e A4e G4e F#4e | G4h.';
const MINUET_B =
  'B5q G5e A5e B5e G5e | A5q D5e E5e F#5e D5e | G5q E5e F#5e G5e D5e | C#5q B4e C#5e A4q | A4e B4e C#5e D5e E5e F#5e | G5q F#5q E5q | F#5q A4q C#5q | D5h. | ' +
  'D5q G4e F#4e G4q | E5q G4e F#4e G4q | D5q C5q B4q | A4e G4e F#4e G4e A4q | D4e E4e F#4e G4e A4e B4e | C5q B4q A4q | B4e D5e G4q F#4q | G4h.';

export const PIECES: readonly Piece[] = [
  // ---------- Nível 1 ----------
  {
    id: 'ode-alegria-do',
    title: 'Ode à alegria (9ª Sinfonia)',
    composer: 'Beethoven',
    level: 1,
    fifths: 0,
    meter: m(4),
    about: 'Cordas 1 e 2, graus conjuntos.',
    music:
      'E5q E5q F5q G5q | G5q F5q E5q D5q | C5q C5q D5q E5q | E5q. D5e D5h | E5q E5q F5q G5q | G5q F5q E5q D5q | C5q C5q D5q E5q | D5q. C5e C5h',
  },
  {
    id: 'ah-vous-dirai-je',
    title: 'Ah! vous dirai-je, maman (tema das Variações K. 265)',
    composer: 'Mozart',
    level: 1,
    fifths: 0,
    meter: m(4),
    about: 'Cordas 3 a 5, notas repetidas e graus conjuntos.',
    music:
      'C4q C4q G4q G4q | A4q A4q G4h | F4q F4q E4q E4q | D4q D4q C4h | G4q G4q F4q F4q | E4q E4q D4h | G4q G4q F4q F4q | E4q E4q D4h | C4q C4q G4q G4q | A4q A4q G4h | F4q F4q E4q E4q | D4q D4q C4h',
  },
  {
    id: 'au-clair-de-la-lune',
    title: 'Au clair de la lune',
    composer: 'Tradicional (França)',
    level: 1,
    fifths: 0,
    meter: m(4),
    about: 'Desce até as cordas graves (Lá e Sol abaixo da pauta).',
    music:
      'C4q C4q C4q D4q | E4h D4h | C4q E4q D4q D4q | C4w | C4q C4q C4q D4q | E4h D4h | C4q E4q D4q D4q | C4w | D4q D4q D4q D4q | A3h A3h | D4q C4q B3q A3q | G3w | C4q C4q C4q D4q | E4h D4h | C4q E4q D4q D4q | C4w',
  },
  {
    id: 'hanschen-klein',
    title: 'Hänschen klein (Lightly Row)',
    composer: 'Tradicional (Alemanha)',
    level: 1,
    fifths: 0,
    meter: m(4),
    about: 'Terças e graus conjuntos na região média.',
    music: 'G4q E4q E4h | F4q D4q D4h | C4q D4q E4q F4q | G4q G4q G4h | G4q E4q E4h | F4q D4q D4h | C4q E4q G4q G4q | C4w',
  },
  {
    id: 'mary-little-lamb',
    title: 'Mary had a little lamb',
    composer: 'Tradicional (EUA)',
    level: 1,
    fifths: 0,
    meter: m(4),
    about: 'Três notas vizinhas e um salto de terça.',
    music: 'E4q D4q C4q D4q | E4q E4q E4h | D4q D4q D4h | E4q G4q G4h | E4q D4q C4q D4q | E4q E4q E4q E4q | D4q D4q E4q D4q | C4w',
  },
  {
    id: 'frere-jacques',
    title: 'Frère Jacques',
    composer: 'Tradicional (França)',
    level: 1,
    fifths: 0,
    meter: m(4),
    about: 'Primeiras colcheias e o Sol grave (corda 6).',
    music: 'C4q D4q E4q C4q | C4q D4q E4q C4q | E4q F4q G4h | E4q F4q G4h | G4e A4e G4e F4e E4q C4q | G4e A4e G4e F4e E4q C4q | C4q G3q C4h | C4q G3q C4h',
  },

  // ---------- Nível 2 ----------
  {
    id: 'minueto-sol-a',
    title: 'Minueto em Sol (BWV Anh. 114) — parte A',
    composer: 'Petzold (atribuído a Bach)',
    level: 2,
    fifths: 1,
    meter: m(3),
    about: 'Colcheias em 3/4 e o Fá♯ da armadura.',
    music: MINUET_A,
  },
  {
    id: 'largo-novo-mundo',
    title: 'Largo (Sinfonia do Novo Mundo)',
    composer: 'Dvořák',
    level: 2,
    fifths: 0,
    meter: m(4),
    about: 'Semínima pontuada + colcheia.',
    music: 'E4q. G4e G4h | E4q. D4e C4h | D4q. E4e G4q. E4e | D4w | E4q. G4e G4h | E4q. D4e C4h | D4q. E4e D4q. C4e | C4w',
  },
  {
    id: 'canone-re',
    title: 'Cânone em Ré',
    composer: 'Pachelbel',
    level: 2,
    fifths: 2,
    meter: m(4),
    about: 'Ré maior: Fá♯ e Dó♯ da armadura, escala descendente.',
    music: 'F#5h E5h | D5h C#5h | B4h A4h | B4h C#5h | D5h C#5h | B4h A4h | G4h F#4h | G4h E4h',
  },
  {
    id: 'ode-alegria-sol',
    title: 'Ode à alegria — completa, em Sol',
    composer: 'Beethoven',
    level: 2,
    fifths: 1,
    meter: m(4),
    about: 'A melodia inteira, com a parte do meio em colcheias.',
    music:
      'B4q B4q C5q D5q | D5q C5q B4q A4q | G4q G4q A4q B4q | B4q. A4e A4h | B4q B4q C5q D5q | D5q C5q B4q A4q | G4q G4q A4q B4q | A4q. G4e G4h | ' +
      'A4q A4q B4q G4q | A4q B4e C5e B4q G4q | A4q B4e C5e B4q A4q | G4q A4q D4h | B4q B4q C5q D5q | D5q C5q B4q A4q | G4q G4q A4q B4q | A4q. G4e G4h',
  },
  {
    id: 'sinfonia-surpresa',
    title: 'Sinfonia nº 94 "Surpresa" — tema do 2º movimento',
    composer: 'Haydn',
    level: 2,
    fifths: 0,
    meter: m(2),
    about: 'Arpejo de Dó e notas com linhas suplementares abaixo.',
    music: 'C4e C4e E4e E4e | G4e G4e E4q | F4e F4e D4e D4e | B3e B3e G3q',
  },

  // ---------- Nível 3 ----------
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Tradicional (Inglaterra)',
    level: 3,
    fifths: 0,
    meter: m(3),
    about: 'Anacruse, pontuadas e o Sol♯ de Lá menor.',
    music:
      'A4q | C5h D5q | E5q. F5e E5q | D5h B4q | G4q. A4e B4q | C5h A4q | A4q. G#4e A4q | B4h G#4q | E4h A4q | C5h D5q | E5q. F5e E5q | D5h B4q | G4q. A4e B4q | C5q. B4e A4q | G#4q. F#4e G#4q | A4h',
  },
  {
    id: 'pequena-serenata',
    title: 'Eine kleine Nachtmusik — início',
    composer: 'Mozart',
    level: 3,
    fifths: 1,
    meter: m(4),
    about: 'Pausas no meio do compasso e arpejos.',
    music: 'G4q re D4e G4q re D4e | G4e D4e G4e B4e D5q rq | C5q re A4e C5q re A4e | C5e A4e F#4e A4e D4q rq',
  },
  {
    id: 'quinta-sinfonia',
    title: 'Sinfonia nº 5 — início',
    composer: 'Beethoven',
    level: 3,
    fifths: -3,
    meter: m(2),
    about: 'Começa com pausa; Mi♭ da armadura (Dó menor).',
    music: 're G4e G4e G4e | Eb4h | re F4e F4e F4e | D4h',
  },
  {
    id: 'gymnopedie-1',
    title: 'Gymnopédie nº 1 — melodia',
    composer: 'Satie',
    level: 3,
    fifths: 2,
    meter: m(3),
    about: 'Região aguda da corda 1 e mínimas pontuadas.',
    music: 'rq F#5q A5q | G5q F#5q C#5q | B4q C#5q D5q | A4h. | F#4h.',
  },

  // ---------- Nível 4 ----------
  {
    id: 'fur-elise',
    title: 'Für Elise — tema',
    composer: 'Beethoven',
    level: 4,
    fifths: 0,
    meter: m(3, 8),
    about: 'Semicolcheias em 3/8 e Ré♯ cromático.',
    music:
      'E5s D#5s | E5s D#5s E5s B4s D5s C5s | A4e rs C4s E4s A4s | B4e rs E4s G#4s B4s | C5e rs E4s E5s D#5s | E5s D#5s E5s B4s D5s C5s | A4e rs C4s E4s A4s | B4e rs E4s C5s B4s | A4q.',
  },
  {
    id: 'preludio-do-1',
    title: 'Prelúdio em Dó (BWV 846) — compassos 1 a 4',
    composer: 'J. S. Bach',
    level: 4,
    fifths: 0,
    meter: m(4),
    about: 'Arpejos em semicolcheias, do grave ao agudo.',
    music: prelude([
      ['C4', 'E4', 'G4', 'C5', 'E5'],
      ['C4', 'D4', 'A4', 'D5', 'F5'],
      ['B3', 'D4', 'G4', 'D5', 'F5'],
      ['C4', 'E4', 'G4', 'C5', 'E5'],
    ]),
  },
  {
    id: 'romance-anonimo',
    title: 'Romance anônimo — melodia, compassos 1 a 8',
    composer: 'Anônimo (Espanha)',
    level: 4,
    fifths: 1,
    meter: m(3),
    about: 'Melodia na corda 1 até a casa 12: linhas suplementares acima.',
    music: 'B5q B5q B5q | B5q A5q G5q | G5q F#5q E5q | E5q G5q B5q | E6q E6q E6q | E6q D6q C6q | C6q B5q A5q | A5q B5q C6q',
  },
  {
    id: 'minueto-sol-b',
    title: 'Minueto em Sol (BWV Anh. 114) — parte B',
    composer: 'Petzold (atribuído a Bach)',
    level: 4,
    fifths: 1,
    meter: m(3),
    about: 'Região aguda, Dó♯ cromático e saltos.',
    music: MINUET_B,
  },

  // ---------- Nível 5 ----------
  {
    id: 'rondo-alla-turca',
    title: 'Rondo alla turca — início',
    composer: 'Mozart',
    level: 5,
    fifths: 0,
    meter: m(2),
    about: 'Semicolcheias rápidas, Sol♯ e Ré♯, subida até o Dó agudo.',
    music: 'B4s A4s G#4s A4s | C5e re D5s C5s B4s C5s | E5e re F5s E5s D#5s E5s | B5s A5s G#5s A5s B5s A5s G#5s A5s | C6q',
  },
  {
    id: 'preludio-do-2',
    title: 'Prelúdio em Dó (BWV 846) — compassos 5 a 8',
    composer: 'J. S. Bach',
    level: 5,
    fifths: 0,
    meter: m(4),
    about: 'Arpejos com Fá♯ cromático e notas agudas.',
    music: prelude([
      ['C4', 'E4', 'A4', 'E5', 'A5'],
      ['C4', 'D4', 'F#4', 'A4', 'D5'],
      ['B3', 'D4', 'G4', 'D5', 'G5'],
      ['B3', 'C4', 'E4', 'G4', 'C5'],
    ]),
  },
  {
    id: 'minueto-sol-completo',
    title: 'Minueto em Sol (BWV Anh. 114) — completo',
    composer: 'Petzold (atribuído a Bach)',
    level: 5,
    fifths: 1,
    meter: m(3),
    about: 'As duas partes seguidas: 32 compassos sem parar.',
    music: `${MINUET_A} | ${MINUET_B}`,
  },
];

export const pieceById = (id: string, extra: readonly Piece[] = []): Piece | undefined => PIECES.find((p) => p.id === id) ?? extra.find((p) => p.id === id);

/**
 * Acervo baixado (corais de Bach e coleções de melodias tradicionais em domínio
 * público, convertidos por tools/importar-repertorio.ts). Carregado à parte, só
 * quando a tela de obras abre, para não pesar no início do app.
 */
let acervo: Promise<Piece[]> | null = null;
export function loadAcervo(): Promise<Piece[]> {
  acervo ??= import('./acervo.json').then((m) => (m.default as unknown as Piece[]).map((p) => ({ ...p, level: p.level as Level })));
  return acervo;
}

/** Id do item de aprendizagem (FSRS) de uma obra. */
export const pieceKcId = (id: string): string => `repertorio:${id}`;

/** Partitura da obra (vira uma Melody comum com buildScoreMelody). */
export function pieceScore(p: Piece): ScoreDef {
  return notationScore(`rep-${p.id}`, p.title, p.fifths, p.meter, p.music);
}
