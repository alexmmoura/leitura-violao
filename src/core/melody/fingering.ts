import { locationsFor, type FretLocation, type Instrument } from '../instrument/instrument';
import type { SoundingMidi } from '../theory/pitch';

/**
 * Resolvedor de digitação — especificação §8.7.
 * Programação dinâmica (Viterbi) sobre estados (local, posição da mão).
 * A digitação resultante é SUGESTÃO de referência, nunca a única resposta.
 *
 * Posição p = casa do dedo 1 (Leavitt). Para uma casa presa f, a mão pode estar
 * em p ∈ [f−3, f] (dedos 4…1) ou, com abertura, p = f−4 (dedo 4) / p = f+1 (dedo 1).
 * Cordas soltas servem a qualquer posição (e permitem mudar de posição "de graça").
 */
export interface FingeredNote {
  readonly loc: FretLocation;
  readonly position: number;
  /** 0 = corda solta. */
  readonly finger: 0 | 1 | 2 | 3 | 4;
  readonly stretch: boolean;
}

export interface FingeringResult {
  readonly notes: FingeredNote[];
  readonly cost: number;
  readonly shifts: number;
  readonly positions: number[];
}

export interface FingeringOptions {
  /** Restringe os locais candidatos (ex.: cordas, casas, posição fixa). */
  readonly allow?: (loc: FretLocation) => boolean;
  /** Posições de mão permitidas (ex.: só a V). */
  readonly allowPosition?: (p: number) => boolean;
  readonly preferOpen?: boolean;
  /** Aberturas de dedo permitidas (padrão: sim). Desligue quando o exercício não as prevê. */
  readonly allowStretch?: boolean;
}

interface State {
  readonly loc: FretLocation;
  readonly position: number;
  readonly finger: 0 | 1 | 2 | 3 | 4;
  readonly stretch: boolean;
}

function statesFor(loc: FretLocation, inst: Instrument, opts: FingeringOptions): State[] {
  const okP = (p: number) => p >= 1 && p <= inst.frets && (opts.allowPosition?.(p) ?? true);
  if (loc.fret === 0) {
    const out: State[] = [];
    for (let p = 1; p <= Math.min(inst.frets, 12); p++) if (okP(p)) out.push({ loc, position: p, finger: 0, stretch: false });
    return out;
  }
  const out: State[] = [];
  for (let finger = 1 as 1 | 2 | 3 | 4; finger <= 4; finger = (finger + 1) as 1 | 2 | 3 | 4) {
    const p = loc.fret - finger + 1;
    if (okP(p)) out.push({ loc, position: p, finger, stretch: false });
    if (finger === 4) break;
  }
  if (opts.allowStretch === false) return out;
  if (okP(loc.fret - 4)) out.push({ loc, position: loc.fret - 4, finger: 4, stretch: true });
  if (okP(loc.fret + 1)) out.push({ loc, position: loc.fret + 1, finger: 1, stretch: true });
  return out;
}

function stateCost(s: State, opts: FingeringOptions): number {
  let c = 0.02 * s.position; // leve preferência por regiões graves
  if (s.stretch) c += s.finger === 4 ? 1.2 : 0.8; // abertura do 4 é a mais difícil (Leavitt)
  if (s.finger === 0) c += opts.preferOpen === false ? 0.6 : -0.1;
  return c;
}

function transitionCost(a: State, b: State): number {
  let c = 0;
  if (a.position !== b.position) {
    const free = a.finger === 0 || b.finger === 0; // mudança apoiada em corda solta
    c += (free ? 1 : 2.5) + 0.4 * Math.abs(a.position - b.position);
  }
  const ds = Math.abs(a.loc.string - b.loc.string);
  if (ds > 1) c += 0.3 * (ds - 1);
  if (a.finger !== 0 && a.finger === b.finger && a.loc.fret !== b.loc.fret) c += 2; // mesmo dedo em casas diferentes
  if (a.finger !== 0 && a.finger === b.finger && a.loc.fret === b.loc.fret && a.loc.string !== b.loc.string) c += 0.5; // pestana/rolagem
  return c;
}

export function resolveFingering(notes: readonly SoundingMidi[], inst: Instrument, opts: FingeringOptions = {}): FingeringResult | null {
  if (notes.length === 0) return { notes: [], cost: 0, shifts: 0, positions: [] };
  const layers = notes.map((s) => locationsFor(s, inst).filter((l) => opts.allow?.(l) ?? true).flatMap((l) => statesFor(l, inst, opts)));
  if (layers.some((l) => l.length === 0)) return null;

  let cost = layers[0]!.map((s) => stateCost(s, opts));
  const back: number[][] = [layers[0]!.map(() => -1)];
  for (let i = 1; i < layers.length; i++) {
    const prev = layers[i - 1]!;
    const cur = layers[i]!;
    const next: number[] = [];
    const bp: number[] = [];
    for (const s of cur) {
      let best = Infinity;
      let arg = -1;
      prev.forEach((p, j) => {
        const v = cost[j]! + transitionCost(p, s);
        if (v < best) {
          best = v;
          arg = j;
        }
      });
      next.push(best + stateCost(s, opts));
      bp.push(arg);
    }
    cost = next;
    back.push(bp);
  }
  let idx = cost.indexOf(Math.min(...cost));
  const total = cost[idx]!;
  const path: State[] = [];
  for (let i = layers.length - 1; i >= 0; i--) {
    path.unshift(layers[i]![idx]!);
    idx = back[i]![idx]!;
  }
  // posição "visível": ignora cordas soltas ao contar mudanças
  const fretted = path.filter((s) => s.finger !== 0);
  let shifts = 0;
  for (let i = 1; i < fretted.length; i++) if (fretted[i]!.position !== fretted[i - 1]!.position) shifts++;
  const positions = [...new Set(fretted.map((s) => s.position))];
  return { notes: path.map((s) => ({ loc: s.loc, position: s.position, finger: s.finger, stretch: s.stretch })), cost: total, shifts, positions };
}
