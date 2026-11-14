/**
 * AudioWorklet de detecção de altura — especificação §15.2.
 * Roda fora da thread da interface. Acumula blocos de 128 amostras numa janela
 * deslizante, reduz a taxa pela metade e aplica o YIN a cada ~10 ms.
 * Envia à thread principal apenas números (frequência, clareza, nível): o áudio
 * nunca sai deste processo nem é gravado.
 */
import { decimate2, rms, yin } from '../core/audio/yin';

// Tipos mínimos do escopo global do AudioWorklet (não fazem parte do lib "DOM").
declare const sampleRate: number;
declare const currentTime: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const WINDOW_SEC = 0.0427; // ≈ 2048 amostras a 48 kHz
const HOP_SEC = 0.01;

class PitchProcessor extends AudioWorkletProcessor {
  private readonly win: number;
  private readonly hop: number;
  private readonly ring: Float32Array;
  private readonly frame: Float32Array;
  private readonly half: Float32Array;
  private readonly scratch: Float32Array;
  private write = 0;
  private filled = 0;
  private sinceHop = 0;
  private gate = 0.004;

  constructor() {
    super();
    this.win = Math.pow(2, Math.round(Math.log2(sampleRate * WINDOW_SEC)));
    this.hop = Math.round(sampleRate * HOP_SEC);
    this.ring = new Float32Array(this.win);
    this.frame = new Float32Array(this.win);
    this.half = new Float32Array(this.win / 2);
    this.scratch = new Float32Array(this.win);
    this.port.onmessage = (e: MessageEvent) => {
      if (e.data && typeof e.data.gate === 'number') this.gate = e.data.gate;
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.ring[this.write] = ch[i]!;
      this.write = (this.write + 1) % this.win;
    }
    this.filled = Math.min(this.win, this.filled + ch.length);
    this.sinceHop += ch.length;
    if (this.filled < this.win || this.sinceHop < this.hop) return true;
    this.sinceHop = 0;

    // janela em ordem cronológica
    for (let i = 0; i < this.win; i++) this.frame[i] = this.ring[(this.write + i) % this.win]!;
    const level = rms(this.frame);
    // abaixo da porta (silêncio) não gasta CPU com o YIN
    if (level < this.gate * 0.5) {
      this.port.postMessage({ t: currentTime, freq: null, clarity: 0, rms: level });
      return true;
    }
    const est = yin(decimate2(this.frame, this.half), { sampleRate: sampleRate / 2 }, this.scratch);
    this.port.postMessage({ t: currentTime, freq: est.freq, clarity: est.clarity, rms: level });
    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
