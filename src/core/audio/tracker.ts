import { frequencyToMidi } from '../theory/pitch';

/**
 * Rastreador de notas — especificação §15.4–15.5.
 * Transforma quadros do detector (≈ 10 ms) em EVENTOS de nota:
 *  - porta de ruído (gate) calibrável;
 *  - nota = midi arredondado, aceito só se |desvio| ≤ tolerância em cents;
 *  - estabilidade: N quadros seguidos com a mesma nota antes de emitir;
 *  - ataque por energia: permite reconhecer a MESMA nota tocada de novo;
 *  - o instante emitido é o do ataque (primeiro quadro da nota), não o da confirmação.
 * Nunca "corrige" a resposta para a nota esperada.
 */
export interface Frame {
  /** Segundos, no relógio do AudioContext. */
  readonly t: number;
  readonly freq: number | null;
  readonly clarity: number;
  readonly rms: number;
}

export interface NoteEvent {
  readonly midi: number;
  readonly cents: number;
  readonly freq: number;
  /** Instante do ataque (s, relógio do AudioContext). */
  readonly onsetT: number;
  /** Instante em que a nota foi confirmada (s). onsetT ≤ confirmT. */
  readonly confirmT: number;
}

export interface TrackerOptions {
  readonly aRef: number;
  readonly toleranceCents: number;
  readonly stableFrames: number;
  /** RMS abaixo disto = silêncio. */
  readonly gate: number;
  /** Subida de energia que caracteriza um novo ataque (razão). */
  readonly attackRatio: number;
  /** Quadros de silêncio que encerram a nota. */
  readonly releaseFrames: number;
  readonly minClarity: number;
  /**
   * Voz (solfejo): a voz desliza até a nota, tem consoante no começo da sílaba e o
   * detector às vezes salta uma oitava. Nesse modo uma nota cantada vira UM evento:
   * a altura precisa ficar estável por mais tempo, só o silêncio separa duas notas
   * iguais (a consoante não conta como ataque) e salto de oitava não é nota nova.
   */
  readonly voice?: boolean;
}

/** Quadros estáveis (≈ 10 ms cada) exigidos da voz: ≈ 0,1 s na mesma nota. */
export const VOICE_STABLE_FRAMES = 10;

export const DEFAULT_TRACKER: TrackerOptions = {
  aRef: 440,
  toleranceCents: 35,
  stableFrames: 3,
  gate: 0.01,
  attackRatio: 1.8,
  releaseFrames: 4,
  minClarity: 0.6,
};

export class NoteTracker {
  private candidate: { midi: number; count: number; startT: number; cents: number[]; freq: number } | null = null;
  private current: number | null = null;
  private silent = 0;
  private recentRms: number[] = [];
  private attackT: number | null = null;
  private emittedSinceAttack = false;

  constructor(private readonly opts: TrackerOptions = DEFAULT_TRACKER) {}

  reset(): void {
    this.candidate = null;
    this.current = null;
    this.silent = 0;
    this.recentRms = [];
    this.attackT = null;
    this.emittedSinceAttack = false;
  }

  /** Nota soando agora (já confirmada), ou null. */
  get sounding(): number | null {
    return this.current;
  }

  push(f: Frame): NoteEvent | null {
    const o = this.opts;
    // ataque: energia sobe bruscamente em relação ao mínimo recente
    // (e ainda subindo em relação ao quadro anterior — no decaimento não há ataque)
    const floor = this.recentRms.length ? Math.min(...this.recentRms) : 0;
    const prev = this.recentRms[this.recentRms.length - 1] ?? 0;
    if (!o.voice && f.rms > o.gate * 2 && f.rms > floor * o.attackRatio && f.rms > prev * 1.15) {
      // novo ataque: a nota anterior acabou; só um candidato formado DEPOIS dele vale
      this.attackT = f.t;
      this.emittedSinceAttack = false;
      this.candidate = null;
    }
    this.recentRms = [...this.recentRms, f.rms].slice(-3);

    const voiced = f.rms >= o.gate && f.freq !== null && f.clarity >= o.minClarity;
    if (!voiced) {
      this.silent++;
      if (this.silent >= o.releaseFrames) {
        this.current = null;
        this.candidate = null;
      }
      return null;
    }
    this.silent = 0;

    const m = frequencyToMidi(f.freq!, o.aRef);
    const midi = Math.round(m);
    const cents = (m - midi) * 100;
    if (Math.abs(cents) > o.toleranceCents) {
      this.candidate = null;
      return null;
    }
    if (this.candidate && this.candidate.midi === midi) {
      this.candidate.count++;
      this.candidate.cents.push(cents);
    } else {
      // nova altura: o ataque é o deste quadro, ou o ataque de energia recente se houver
      const start = this.attackT !== null && f.t - this.attackT < 0.08 ? this.attackT : f.t;
      this.candidate = { midi, count: 1, startT: start, cents: [cents], freq: f.freq! };
    }

    const c = this.candidate;
    // repetição da mesma nota: só se houve ataque e o candidato nasceu depois dele
    const repeated = !this.emittedSinceAttack && this.attackT !== null && c.startT >= this.attackT - 1e-9;
    const octaveJump = !!o.voice && this.current !== null && c.midi !== this.current && (c.midi - this.current) % 12 === 0;
    const isNew = (c.midi !== this.current && !octaveJump) || repeated;
    const stable = o.voice ? Math.max(o.stableFrames, VOICE_STABLE_FRAMES) : o.stableFrames;
    if (c.count >= stable && isNew) {
      const sorted = [...c.cents].sort((a, b) => a - b);
      this.current = c.midi;
      this.emittedSinceAttack = true;
      const onsetT = this.attackT !== null && this.attackT <= c.startT + 1e-9 && c.startT - this.attackT < 0.08 ? this.attackT : c.startT;
      return { midi: c.midi, cents: sorted[Math.floor(sorted.length / 2)]!, freq: c.freq, onsetT, confirmT: f.t };
    }
    return null;
  }
}

/** Mede o ruído de fundo (RMS) e sugere a porta: 3× o ruído, com mínimo de 0,003. */
export function suggestGate(silenceRms: readonly number[]): number {
  if (silenceRms.length === 0) return DEFAULT_TRACKER.gate;
  const sorted = [...silenceRms].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)]!;
  return Math.max(0.003, p90 * 3);
}
