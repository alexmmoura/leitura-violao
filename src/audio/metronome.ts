/**
 * Metrônomo sonoro e relógio de toques — especificação §6.5 e §12.5.
 *
 * Todos os cliques de um exercício curto são agendados de uma vez no relógio do
 * AudioContext (preciso ao nível da amostra; setTimeout não é). Os toques do
 * teclado (relógio do performance.now) são convertidos para o mesmo relógio com
 * getOutputTimestamp(), que já desconta a latência de saída do áudio.
 */
let shared: AudioContext | null = null;

export function audioContext(): AudioContext {
  if (!shared) shared = new AudioContext({ latencyHint: 'interactive' });
  return shared;
}

export interface ClickPlan {
  /** Instante (s, relógio do AudioContext) do primeiro tempo após a contagem. */
  readonly startAt: number;
  readonly beatSec: number;
  readonly countInBeats: number;
  readonly totalBeats: number;
  readonly beatsPerMeasure: number;
  stop(): void;
}

function click(ctx: AudioContext, at: number, accent: boolean, out: AudioNode, level?: number): OscillatorNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accent ? 1760 : level !== undefined ? 880 : 1175;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level ?? (accent ? 0.6 : 0.35), at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.08);
  return osc;
}

/**
 * Agenda contagem (1 compasso) + `beats` tempos. `playBeats` = false deixa só a
 * contagem audível (para o aluno tocar sem muleta). `subdivision` > 1 acrescenta
 * cliques fracos entre os tempos (3 nos compassos compostos: "1-2-3, 2-2-3").
 */
export async function scheduleClicks(bpm: number, beatsPerMeasure: number, beats: number, playBeats = true, subdivision = 1): Promise<ClickPlan> {
  const ctx = audioContext();
  if (ctx.state !== 'running') await ctx.resume();
  const beatSec = 60 / bpm;
  const countIn = beatsPerMeasure;
  const t0 = ctx.currentTime + 0.25;
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const nodes: OscillatorNode[] = [];
  for (let i = 0; i < countIn + beats; i++) {
    if (i >= countIn && !playBeats) continue;
    nodes.push(click(ctx, t0 + i * beatSec, i % beatsPerMeasure === 0, out));
    for (let s = 1; s < subdivision; s++) nodes.push(click(ctx, t0 + (i + s / subdivision) * beatSec, false, out, 0.12));
  }
  return {
    startAt: t0 + countIn * beatSec,
    beatSec,
    countInBeats: countIn,
    totalBeats: beats,
    beatsPerMeasure,
    stop: () => {
      out.disconnect();
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* já parado */
        }
      }
    },
  };
}

/** Converte o timeStamp de um evento (ms, performance.now) para segundos no relógio do áudio. */
export function eventToAudioTime(eventTimeStamp: number): number {
  const ctx = audioContext();
  const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
  if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
    return ts.contextTime + (eventTimeStamp - ts.performanceTime) / 1000;
  }
  return ctx.currentTime - (performance.now() - eventTimeStamp) / 1000;
}
