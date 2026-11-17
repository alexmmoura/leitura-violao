import { useEffect, useRef, useSyncExternalStore } from 'react';
import workletUrl from './pitch.worklet.ts?worker&url';
import { karplusStrong } from '../core/audio/synth';
import { DEFAULT_TRACKER, NoteTracker, type Frame, type NoteEvent, type TrackerOptions } from '../core/audio/tracker';
import { midiToFrequency } from '../core/theory/pitch';
import { audioContext } from './metronome';

/**
 * Serviço de microfone — especificação §15 e §17.1.
 *  - só liga por ação explícita do usuário;
 *  - desliga cancelamento de eco, supressão de ruído e ganho automático (feitos para voz);
 *  - processamento 100 % local (AudioWorklet); nada é gravado nem enviado;
 *  - desliga sozinho após 5 min sem notas, e quando a tela de exercício é fechada.
 */
export type MicStatus = 'off' | 'starting' | 'on' | 'test' | 'error';

const IDLE_MS = 5 * 60_000;

class MicService {
  status: MicStatus = 'off';
  error: string | null = null;
  level = 0;
  private stream: MediaStream | null = null;
  private source: AudioNode | null = null;
  private node: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private moduleLoaded: Promise<void> | null = null;
  private tracker = new NoteTracker();
  private trackerOpts: TrackerOptions = DEFAULT_TRACKER;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly statusListeners = new Set<() => void>();
  private readonly frameListeners = new Set<(f: Frame) => void>();
  private readonly noteListeners = new Set<(n: NoteEvent) => void>();
  private snapshot = { status: this.status as MicStatus, error: null as string | null };

  // ---------- assinatura (React) ----------
  subscribe = (cb: () => void) => {
    this.statusListeners.add(cb);
    return () => void this.statusListeners.delete(cb);
  };
  getSnapshot = () => this.snapshot;
  private setStatus(s: MicStatus, error: string | null = null) {
    this.status = s;
    this.error = error;
    this.snapshot = { status: s, error };
    for (const l of this.statusListeners) l();
  }
  onFrame(cb: (f: Frame) => void): () => void {
    this.frameListeners.add(cb);
    return () => void this.frameListeners.delete(cb);
  }
  onNote(cb: (n: NoteEvent) => void): () => void {
    this.noteListeners.add(cb);
    return () => void this.noteListeners.delete(cb);
  }

  configure(opts: Partial<TrackerOptions>) {
    this.trackerOpts = { ...this.trackerOpts, ...opts };
    this.tracker = new NoteTracker(this.trackerOpts);
    this.node?.port.postMessage({ gate: this.trackerOpts.gate });
  }

  get isActive() {
    return this.status === 'on' || this.status === 'test';
  }

  private async chain(): Promise<AudioWorkletNode> {
    const ctx = audioContext();
    if (ctx.state !== 'running') await ctx.resume();
    if (!this.moduleLoaded) this.moduleLoaded = ctx.audioWorklet.addModule(workletUrl);
    await this.moduleLoaded;
    const node = new AudioWorkletNode(ctx, 'pitch-processor', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
    node.port.postMessage({ gate: this.trackerOpts.gate });
    node.port.onmessage = (e: MessageEvent<Frame>) => this.handleFrame(e.data);
    // o worklet precisa estar ligado ao destino para ser processado; ganho 0 = sem retorno de som
    const sink = ctx.createGain();
    sink.gain.value = 0;
    node.connect(sink).connect(ctx.destination);
    this.node = node;
    this.sink = sink;
    this.tracker = new NoteTracker(this.trackerOpts);
    return node;
  }

  private handleFrame(f: Frame) {
    this.level = f.rms;
    for (const l of this.frameListeners) l(f);
    const ev = this.tracker.push(f);
    if (ev) {
      this.bumpIdle();
      for (const l of this.noteListeners) l(ev);
    }
  }

  private bumpIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stop(), IDLE_MS);
  }

  /** Liga o microfone. Deve ser chamado a partir de um clique do usuário. */
  async start(deviceId?: string): Promise<void> {
    if (this.isActive) this.stop();
    this.setStatus('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não oferece acesso ao microfone (é preciso HTTPS ou localhost).');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      const node = await this.chain();
      const src = audioContext().createMediaStreamSource(stream);
      src.connect(node);
      this.stream = stream;
      this.source = src;
      this.bumpIdle();
      this.setStatus('on');
    } catch (e) {
      this.teardown();
      const name = e instanceof DOMException ? e.name : '';
      const msg =
        name === 'NotAllowedError'
          ? 'Permissão do microfone negada.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'Nenhum microfone encontrado neste computador — responda pelo braço (clique) ou pelo teclado.'
            : name === 'NotReadableError'
              ? 'O microfone está ocupado por outro programa (ex.: Teams/Zoom).'
              : e instanceof Error
                ? e.message
                : String(e);
      this.setStatus('error', msg);
    }
  }

  /**
   * Sinal de teste: toca notas sintetizadas (corda dedilhada) DIRETAMENTE na mesma
   * cadeia de análise, sem microfone — verifica o detector de ponta a ponta.
   */
  async startTestSignal(midis: readonly number[], noteSec = 0.6, audible = true): Promise<void> {
    if (this.isActive) this.stop();
    this.setStatus('starting');
    try {
      const node = await this.chain();
      const ctx = audioContext();
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, Math.floor(sr * noteSec * midis.length + sr * 0.3), sr);
      const data = buf.getChannelData(0);
      midis.forEach((m, k) => data.set(karplusStrong(midiToFrequency(m), sr, noteSec, k + 1), Math.floor(k * noteSec * sr)));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(node);
      if (audible) {
        const g = ctx.createGain();
        g.gain.value = 0.4;
        src.connect(g).connect(ctx.destination);
      }
      src.onended = () => {
        if (this.status === 'test') this.stop();
      };
      src.start();
      this.source = src;
      this.setStatus('test');
    } catch (e) {
      this.teardown();
      this.setStatus('error', e instanceof Error ? e.message : String(e));
    }
  }

  private teardown() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    try {
      if (this.source instanceof AudioBufferSourceNode) this.source.stop();
    } catch {
      /* já parado */
    }
    this.source?.disconnect();
    this.node?.disconnect();
    this.sink?.disconnect();
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    this.stream = null;
    this.source = null;
    this.node = null;
    this.sink = null;
    this.level = 0;
    this.tracker.reset();
  }

  stop() {
    this.teardown();
    this.setStatus('off');
  }
}

export const mic = new MicService();

export function useMicStatus() {
  return useSyncExternalStore(mic.subscribe, mic.getSnapshot, mic.getSnapshot);
}

/** Recebe notas detectadas enquanto `active`; o callback mais recente é sempre usado. */
export function useMicNotes(cb: (n: NoteEvent) => void, active: boolean) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    return mic.onNote((n) => ref.current(n));
  }, [active]);
}

/** Converte um instante do relógio do áudio (s) para o relógio do performance.now (ms). */
export function audioTimeToPerf(t: number): number {
  const ctx = audioContext();
  const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
  if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
    return ts.performanceTime + (t - ts.contextTime) * 1000;
  }
  return performance.now() - (ctx.currentTime - t) * 1000;
}
