import type { FretLocation } from './instrument';

/**
 * Modelo de posição (Leavitt) — especificação §8.5.
 *
 *  - Posição p = casa do dedo 1 na disposição natural.
 *  - Janela base: casas [p, p+3], dedo = casa − p + 1.
 *  - Abertura do dedo 1: casa p−1 (dedo 1). Abertura do dedo 4: casa p+4 (dedo 4).
 *  - Com aberturas, a posição é identificada pelo dedo 2: p = casa do dedo 2 − 1.
 *  - Posição aberta: casas 0–4 (cordas soltas + dedos 1–4 nas casas 1–4).
 */
export type PositionSpec =
  | { readonly kind: 'whole' }
  | { readonly kind: 'open' }
  | {
      readonly kind: 'fixed';
      readonly position: number;
      readonly stretch1: boolean;
      readonly stretch4: boolean;
      readonly allowOpen: boolean;
    };

export const WHOLE_NECK: PositionSpec = { kind: 'whole' };
export const OPEN_POSITION: PositionSpec = { kind: 'open' };

export function fixedPosition(position: number, opts: Partial<{ stretch1: boolean; stretch4: boolean; allowOpen: boolean }> = {}): PositionSpec {
  if (!Number.isInteger(position) || position < 1) throw new RangeError(`Posição inválida: ${position}`);
  return { kind: 'fixed', position, stretch1: opts.stretch1 ?? false, stretch4: opts.stretch4 ?? false, allowOpen: opts.allowOpen ?? false };
}

export interface FretWindow {
  /** Menor casa presa permitida. */
  readonly min: number;
  /** Maior casa presa permitida. */
  readonly max: number;
  /** Janela base (sem aberturas), para destaque visual. */
  readonly baseMin: number;
  readonly baseMax: number;
  readonly openStrings: boolean;
}

export function fretWindow(spec: PositionSpec, maxFret: number): FretWindow {
  switch (spec.kind) {
    case 'whole':
      return { min: 1, max: maxFret, baseMin: 1, baseMax: maxFret, openStrings: true };
    case 'open':
      return { min: 1, max: 4, baseMin: 1, baseMax: 4, openStrings: true };
    case 'fixed': {
      const p = spec.position;
      return {
        min: Math.max(1, spec.stretch1 ? p - 1 : p),
        max: Math.min(maxFret, spec.stretch4 ? p + 4 : p + 3),
        baseMin: p,
        baseMax: Math.min(maxFret, p + 3),
        openStrings: spec.allowOpen,
      };
    }
  }
}

export function inPosition(loc: FretLocation, spec: PositionSpec, maxFret: number): boolean {
  const w = fretWindow(spec, maxFret);
  if (loc.fret === 0) return w.openStrings;
  return loc.fret >= w.min && loc.fret <= w.max;
}

/** Dedo da mão esquerda sugerido (0 = corda solta, null = fora da posição). */
export function fingerFor(loc: FretLocation, spec: PositionSpec, maxFret: number): 0 | 1 | 2 | 3 | 4 | null {
  if (!inPosition(loc, spec, maxFret)) return null;
  if (loc.fret === 0) return 0;
  if (spec.kind === 'whole') return null;
  const p = spec.kind === 'open' ? 1 : spec.position;
  const f = loc.fret - p + 1;
  if (f < 1) return 1; // abertura do dedo 1
  if (f > 4) return 4; // abertura do dedo 4
  return f as 1 | 2 | 3 | 4;
}

/** Regra de Leavitt: com aberturas, a posição = casa do dedo 2 − 1. */
export function positionFromFinger2(finger2Fret: number): number {
  return finger2Fret - 1;
}

const ROMAN: readonly [number, string][] = [
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function roman(n: number): string {
  let out = '';
  let rest = n;
  for (const [v, s] of ROMAN) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

export function positionLabel(spec: PositionSpec): string {
  switch (spec.kind) {
    case 'whole':
      return 'Braço inteiro';
    case 'open':
      return 'Posição aberta';
    case 'fixed': {
      const ext = [spec.stretch1 && 'abertura dedo 1', spec.stretch4 && 'abertura dedo 4', spec.allowOpen && 'cordas soltas']
        .filter(Boolean)
        .join(', ');
      return `${roman(spec.position)} posição${ext ? ` (${ext})` : ''}`;
    }
  }
}

export function positionKey(spec: PositionSpec): string {
  switch (spec.kind) {
    case 'whole':
      return 'all';
    case 'open':
      return 'open';
    case 'fixed':
      return `p${spec.position}${spec.stretch1 ? 'a1' : ''}${spec.stretch4 ? 'a4' : ''}${spec.allowOpen ? 'o' : ''}`;
  }
}
