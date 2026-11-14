import type { ReadingMode } from './ReadingSession';

/** Opções de "como ler" — compartilhadas pela Leitura de partituras e por Minhas partituras. */
export interface ReadingOptions {
  mode: ReadingMode;
  bpm: number;
  lookAhead: boolean;
  clickDuring: boolean;
  preRead: number;
  /** Solfejo: microfone ouve a voz, qualquer oitava vale. */
  sing: boolean;
}

export const DEFAULT_READING_OPTIONS: ReadingOptions = { mode: 'static', bpm: 60, lookAhead: false, clickDuring: true, preRead: 10, sing: false };

export default function ReadingModeFieldset({ o, set, compound }: { o: ReadingOptions; set: (p: Partial<ReadingOptions>) => void; compound: boolean }) {
  return (
    <fieldset>
      <legend>Modo</legend>
      <select value={o.mode} onChange={(e) => set({ mode: e.target.value as ReadingMode })} aria-label="Modo">
        <option value="static">Estático (nota a nota, sem pressa)</option>
        <option value="continuous">Contínuo com metrônomo (clique no braço, no tempo)</option>
        <option value="guitar">No violão ou cantando, com metrônomo (microfone)</option>
      </select>
      <label className="small">
        <input type="checkbox" checked={o.sing} onChange={(e) => set({ sing: e.target.checked })} /> Cantar (solfejo): o microfone ouve a voz e aceita qualquer oitava
      </label>
      {o.mode !== 'static' && (
        <>
          <label className="small" htmlFor="rbpm">
            Andamento: {o.bpm} bpm ({compound ? 'semínima pontuada' : 'semínima'})
          </label>
          <input id="rbpm" type="range" min={30} max={140} step={2} value={o.bpm} onChange={(e) => set({ bpm: Number(e.target.value) })} />
          <div className="checks">
            <label>
              <input type="checkbox" checked={o.lookAhead} onChange={(e) => set({ lookAhead: e.target.checked })} /> Apagar notas já tocadas (olhar à frente; esconde as cores)
            </label>
            <label>
              <input type="checkbox" checked={o.clickDuring} onChange={(e) => set({ clickDuring: e.target.checked })} /> Metrônomo durante a frase
            </label>
          </div>
          <select value={o.preRead} onChange={(e) => set({ preRead: Number(e.target.value) })} aria-label="Pré-leitura">
            {[0, 10, 20, 30].map((s) => (
              <option key={s} value={s}>
                {s ? `Pré-leitura de ${s} s` : 'Sem pré-leitura'}
              </option>
            ))}
          </select>
        </>
      )}
    </fieldset>
  );
}
