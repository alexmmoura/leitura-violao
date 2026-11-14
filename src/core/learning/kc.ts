import type { FretLocation } from '../instrument/instrument';
import { fixedPosition, OPEN_POSITION, positionKey, WHOLE_NECK, type PositionSpec } from '../instrument/position';
import { parseEnglishPitchName, pitchName, type SpelledPitch } from '../theory/pitch';
import { canonicalChordKc } from './kinds';

/**
 * Itens de conhecimento (Knowledge Components) — especificação §10.3.
 * Identificadores estáveis e legíveis; cada sentido é um cartão independente.
 *
 *   pb:<nota escrita>@<posição>   pauta → braço   (ex.: "pb:F♯4@p5")
 *   pball:<nota>@<posição>        pauta → braço, todos os locais
 *   bp:<corda>:<casa>@k<armadura> braço → pauta   (ex.: "bp:4:4@k0")
 */
export type KcRef =
  | { readonly kind: 'staff>fretboard'; readonly written: SpelledPitch; readonly posKey: string; readonly all: boolean }
  | { readonly kind: 'fretboard>staff'; readonly loc: FretLocation; readonly fifths: number };

export function pbId(written: SpelledPitch, position: PositionSpec, all = false): string {
  return `${all ? 'pball' : 'pb'}:${pitchName(written, { naming: 'english' })}@${positionKey(position)}`;
}

export function bpId(loc: FretLocation, fifths: number): string {
  return `bp:${loc.string}:${loc.fret}@k${fifths}`;
}

/**
 * Lê um id de item. Aceita também os formatos da versão 0.1 (registros antigos),
 * para que o histórico já gravado continue valendo.
 */
export function parseKcId(id: string): KcRef | null {
  let m = /^(pb|pball):(.+)@([a-z0-9]+)$/u.exec(id);
  if (m) {
    const written = parseEnglishPitchName(m[2]!);
    return written ? { kind: 'staff>fretboard', written, posKey: m[3]!, all: m[1] === 'pball' } : null;
  }
  m = /^bp:(\d+):(\d+)@k(-?\d+)$/.exec(id);
  if (m) return { kind: 'fretboard>staff', loc: { string: Number(m[1]), fret: Number(m[2]) }, fifths: Number(m[3]) };
  // formatos legados (v0.1)
  m = /^pauta>braco:([^|]+)\|s\d+\|f\d+-\d+\|([a-z0-9]+)(?:\|c\d+)?$/u.exec(id);
  if (m) {
    const written = parseEnglishPitchName(m[1]!);
    return written ? { kind: 'staff>fretboard', written, posKey: m[2]!, all: false } : null;
  }
  m = /^braco>pauta:(\d+):(\d+)\|k(-?\d+)$/.exec(id);
  if (m) return { kind: 'fretboard>staff', loc: { string: Number(m[1]), fret: Number(m[2]) }, fifths: Number(m[3]) };
  return null;
}

/** Converte qualquer id (inclusive legado) para o formato canônico. */
export function canonicalKcId(id: string): string {
  const r = parseKcId(id);
  if (!r) return canonicalChordKc(id);
  if (r.kind === 'fretboard>staff') return bpId(r.loc, r.fifths);
  return `${r.all ? 'pball' : 'pb'}:${pitchName(r.written, { naming: 'english' })}@${r.posKey}`;
}

/** Inverso de positionKey. */
export function parsePositionKey(key: string): PositionSpec | null {
  if (key === 'all') return WHOLE_NECK;
  if (key === 'open') return OPEN_POSITION;
  const m = /^p(\d+)(a1)?(a4)?(o)?$/.exec(key);
  if (!m) return null;
  return fixedPosition(Number(m[1]), { stretch1: !!m[2], stretch4: !!m[3], allowOpen: !!m[4] });
}
