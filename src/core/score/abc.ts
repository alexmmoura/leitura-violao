import { measureSize, type Meter } from '../rhythm/rhythm';
import { keyAlterFor } from '../theory/keySignature';
import { spelledToMidi, type Alter, type Letter, type SpelledPitch } from '../theory/pitch';
import { ScoreError, type ScoreNote } from './score';

/**
 * Leitor de ABC (notação de texto usada nas coleções de melodias folclóricas).
 *
 * Suporta o essencial de melodias de uma voz: cabeçalho X/T/M/L/K, notas com
 * acidentes (^ _ =), oitavas (' ,), durações (2, /2, 3/2, /), ritmo pontuado
 * (> <), pausas (z x), ligaduras (-), acordes (fica a nota mais aguda), barras e
 * repetições (as casas 1 e 2 são lidas em sequência). Ignora cifras, ornamentos,
 * apojaturas e letras. Recusa (ScoreError) o que não dá para representar bem:
 * quiálteras, várias vozes, troca de tonalidade ou compasso no meio.
 */
export interface AbcTune {
  readonly title: string;
  readonly fifths: number;
  readonly meter: Meter;
  readonly measures: ScoreNote[][];
}

const MAJOR_FIFTHS: Readonly<Record<string, number>> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};
const MODE_SHIFT: readonly [RegExp, number][] = [
  [/^(maj|ion)/, 0], [/^mix/, -1], [/^dor/, -2], [/^(m$|min|aeo|m\b)/, -3], [/^phr/, -4], [/^loc/, -5], [/^lyd/, 1],
];

export function abcKeyFifths(k: string): number {
  const m = /^\s*([A-G])([#b]?)\s*([A-Za-z]*)/.exec(k);
  if (!m) throw new ScoreError(`Tonalidade ABC desconhecida: "${k}".`);
  const base = MAJOR_FIFTHS[m[1]! + m[2]!];
  if (base === undefined) throw new ScoreError(`Tonalidade ABC desconhecida: "${k}".`);
  const mode = m[3]!.toLowerCase();
  if (!mode) return base;
  const shift = MODE_SHIFT.find(([re]) => re.test(mode));
  if (!shift) throw new ScoreError(`Modo ABC desconhecido: "${k}".`);
  return base + shift[1];
}

function abcMeter(m: string): Meter {
  const s = m.trim();
  if (s === 'C') return { num: 4, den: 4 };
  if (s === 'C|') return { num: 4, den: 4 };
  const r = /^(\d+)\/(\d+)$/.exec(s);
  if (!r) throw new ScoreError(`Compasso ABC desconhecido: "${m}".`);
  const num = Number(r[1]);
  const den = Number(r[2]);
  if (den === 4 || den === 8) return { num, den };
  if (den === 2) return { num: num * 2, den: 4 };
  throw new ScoreError(`Compasso ABC não suportado: "${m}".`);
}

/** Separa um arquivo com várias melodias (cada uma começa com "X:"). */
export function splitAbcTunes(text: string): string[] {
  const parts = text.split(/^(?=X:)/m);
  return parts.filter((p) => /^X:/m.test(p));
}

interface Tok {
  kind: 'note' | 'rest' | 'bar' | 'broken';
  units?: number;
  spelled?: SpelledPitch;
  tie?: boolean;
  /** '>' ou '<' (com repetições, ex. '>>'). */
  broken?: string;
}

/** Lê UMA melodia ABC. */
export function parseAbcTune(text: string): AbcTune {
  let title = '';
  let meter: Meter | null = null;
  let unit: number | null = null; // semicolcheias por L:
  let fifths: number | null = null;
  const body: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/%.*$/, '');
    const f = /^([A-Za-z]):(.*)$/.exec(line);
    if (f && fifths === null) {
      const [, k, v] = f;
      if (k === 'T' && !title) title = v!.trim();
      else if (k === 'M') meter = abcMeter(v!);
      else if (k === 'L') {
        const r = /^\s*(\d+)\/(\d+)/.exec(v!);
        if (!r) throw new ScoreError(`L: inválido: "${v}".`);
        unit = (16 * Number(r[1])) / Number(r[2]);
      } else if (k === 'K') {
        if (/^\s*(none|HP|Hp)/.test(v!)) throw new ScoreError('Tonalidade ABC especial não suportada.');
        fifths = abcKeyFifths(v!);
      } else if (k === 'V') throw new ScoreError('Melodia com várias vozes.');
      continue;
    }
    if (fifths === null) continue;
    if (f) {
      if (/^[KMLV]$/.test(f[1]!)) throw new ScoreError('Troca de tonalidade, compasso ou voz no meio da melodia.');
      continue; // w:, W:, P:, etc.
    }
    body.push(line.replace(/\\\s*$/, ''));
  }
  if (fifths === null) throw new ScoreError('Melodia ABC sem K:.');
  const m: Meter = meter ?? { num: 4, den: 4 };
  const L = unit ?? (m.num / m.den < 0.75 ? 1 : 2);

  const src = body.join(' ');
  const toks: Tok[] = [];
  let i = 0;
  const lenAt = (): number => {
    // número, "/", "//", "3/2", "/4"
    const r = /^(\d*)(\/*)(\d*)/.exec(src.slice(i))!;
    i += r[0].length;
    const num = r[1] ? Number(r[1]) : 1;
    let den = 1;
    if (r[2]) den = r[3] ? Number(r[3]) * 2 ** (r[2].length - 1) : 2 ** r[2].length;
    return num / den;
  };
  const noteAt = (): SpelledPitch & { explicit: Alter | null } => {
    let acc: Alter | null = null;
    const a = /^(\^\^|\^|__|_|=)/.exec(src.slice(i));
    if (a) {
      acc = ({ '^^': 2, '^': 1, __: -2, _: -1, '=': 0 } as const)[a[1] as '^^'];
      i += a[1]!.length;
    }
    const ch = src[i]!;
    i++;
    let octave = ch === ch.toLowerCase() ? 5 : 4;
    while (src[i] === "'" || src[i] === ',') {
      octave += src[i] === "'" ? 1 : -1;
      i++;
    }
    return { letter: ch.toUpperCase() as Letter, alter: 0, octave, explicit: acc };
  };

  // acidentes valem até o fim do compasso (mesma letra e oitava)
  let measureAcc = new Map<string, Alter>();
  const spell = (n: SpelledPitch & { explicit: Alter | null }): SpelledPitch => {
    const key = `${n.letter}${n.octave}`;
    if (n.explicit !== null) measureAcc.set(key, n.explicit);
    const alter = measureAcc.get(key) ?? keyAlterFor(n.letter, fifths!);
    return { letter: n.letter, alter, octave: n.octave };
  };

  while (i < src.length) {
    const c = src[i]!;
    const rest = src.slice(i);
    if (/\s|`|y/.test(c)) { i++; continue; }
    if (c === '"') { const j = src.indexOf('"', i + 1); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '!' || c === '+') { const j = src.indexOf(c, i + 1); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '{') { const j = src.indexOf('}', i + 1); i = j < 0 ? src.length : j + 1; continue; }
    if (c === '(') {
      if (/^\(\d/.test(rest)) throw new ScoreError('Melodia com quiálteras (tercinas).');
      i++;
      continue;
    }
    if (c === ')' || /[~.HLMOPSTuvJR]/.test(c)) { i++; continue; }
    if (c === '[' && /^\[[A-Za-z]:/.test(rest)) throw new ScoreError('Campo no meio da melodia.');
    // barras e repetições: |, ||, |], [|, |:, :|, ::, [1, |1, :|2 …
    const bar = /^(:*\|+\]?:*|\[\|:*|::+|\[\d|\|\d)(\d*)/.exec(rest);
    if (bar && (c === '|' || c === ':' || (c === '[' && /^\[[\d|]/.test(rest)))) {
      i += bar[0].length;
      toks.push({ kind: 'bar' });
      measureAcc = new Map();
      continue;
    }
    if (c === '>' || c === '<') {
      const r = /^(>+|<+)/.exec(rest)!;
      i += r[0].length;
      toks.push({ kind: 'broken', broken: r[0] });
      continue;
    }
    if (c === '-') {
      const last = [...toks].reverse().find((t) => t.kind === 'note');
      if (last) last.tie = true;
      i++;
      continue;
    }
    if (c === 'z' || c === 'x') {
      i++;
      toks.push({ kind: 'rest', units: L * lenAt() });
      continue;
    }
    if (c === 'Z') throw new ScoreError('Pausa de vários compassos.');
    if (c === '[') {
      // acorde: fica a nota mais aguda
      i++;
      let best: SpelledPitch | null = null;
      while (i < src.length && src[i] !== ']') {
        if (/[\^_=A-Ga-g]/.test(src[i]!)) {
          const n = spell(noteAt());
          lenAt();
          if (!best || spelledToMidi(n) > spelledToMidi(best)) best = n;
        } else i++;
      }
      i++;
      const len = lenAt();
      if (!best) continue;
      toks.push({ kind: 'note', units: L * len, spelled: best });
      continue;
    }
    if (/[\^_=A-Ga-g]/.test(c)) {
      const n = spell(noteAt());
      toks.push({ kind: 'note', units: L * lenAt(), spelled: n });
      continue;
    }
    throw new ScoreError(`Símbolo ABC não suportado: "${c}".`);
  }

  // ritmo pontuado: a>b = a pontuada + b pela metade
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]!;
    if (t.kind !== 'broken') continue;
    const prev = toks.slice(0, k).reverse().find((x) => x.kind === 'note' || x.kind === 'rest');
    const next = toks.slice(k + 1).find((x) => x.kind === 'note' || x.kind === 'rest');
    if (!prev || !next) continue;
    const n = t.broken!.length;
    const short = 1 / 2 ** n;
    const long = 2 - short;
    if (t.broken![0] === '>') {
      prev.units! *= long;
      next.units! *= short;
    } else {
      prev.units! *= short;
      next.units! *= long;
    }
  }

  // compassos
  const size = measureSize(m);
  let measures: ScoreNote[][] = [[]];
  for (const t of toks) {
    if (t.kind === 'bar') {
      if (measures[measures.length - 1]!.length) measures.push([]);
      continue;
    }
    if (t.kind === 'broken') continue;
    const u = t.units!;
    if (!(u >= 1) || Math.abs(u - Math.round(u)) > 1e-9) throw new ScoreError('Duração menor que semicolcheia ou fracionária.');
    const units = Math.round(u);
    measures[measures.length - 1]!.push(
      t.kind === 'rest' ? { units, rest: true, written: null } : { units, rest: false, tie: !!t.tie, written: spelledToMidi(t.spelled!), spelled: t.spelled! },
    );
  }
  measures = measures.filter((x) => x.length > 0);

  // fim de uma parte + anacruse da seguinte = um compasso completo
  const total = (xs: ScoreNote[]) => xs.reduce((s, n) => s + n.units, 0);
  const merged: ScoreNote[][] = [];
  for (let k = 0; k < measures.length; k++) {
    const cur = measures[k]!;
    const nxt = measures[k + 1];
    if (k > 0 && nxt && total(cur) < size && total(cur) + total(nxt) === size) {
      merged.push([...cur, ...nxt]);
      k++;
    } else merged.push(cur);
  }
  merged.forEach((bar, k) => {
    const t = total(bar);
    const edge = k === 0 || k === merged.length - 1;
    if (t > size || (!edge && t !== size)) throw new ScoreError(`Compasso ${k + 1} com ${t} semicolcheias (esperado ${size}).`);
  });
  if (merged.length === 0) throw new ScoreError('Melodia vazia.');
  return { title: title || 'Sem título', fifths, meter: m, measures: merged };
}
