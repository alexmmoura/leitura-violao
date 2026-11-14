import { locationsFor, type FretLocation, type Instrument } from '../instrument/instrument';
import { inPosition, positionKey, type PositionSpec } from '../instrument/position';
import type { SoundingMidi } from '../theory/pitch';

/** Restrições de um exercício — especificação §9.1, passo 6. */
export interface Constraints {
  /** Cordas habilitadas (1 = mais aguda). */
  readonly strings: readonly number[];
  readonly minFret: number;
  readonly maxFret: number;
  readonly position: PositionSpec;
  /** Quando definido, a resposta tem de estar nesta corda. */
  readonly requiredString?: number;
}

export function satisfies(loc: FretLocation, c: Constraints, inst: Instrument): boolean {
  if (!c.strings.includes(loc.string)) return false;
  if (c.requiredString !== undefined && loc.string !== c.requiredString) return false;
  if (loc.fret !== 0 && (loc.fret < c.minFret || loc.fret > c.maxFret)) return false;
  if (loc.fret === 0 && c.minFret > 0 && c.position.kind === 'whole') return false;
  return inPosition(loc, c.position, inst.frets);
}

/** V = L(s) ∩ Restrições. */
export function validLocations(s: SoundingMidi, inst: Instrument, c: Constraints): FretLocation[] {
  return locationsFor(s, inst).filter((l) => satisfies(l, c, inst));
}

export function constraintsKey(c: Constraints): string {
  const strings = [...c.strings].sort().join('');
  return `s${strings}|f${c.minFret}-${c.maxFret}|${positionKey(c.position)}${c.requiredString ? `|c${c.requiredString}` : ''}`;
}
