import { useCallback, useEffect, useState } from 'react';
import type { Naming, OctaveConvention } from '../core/theory/pitch';
import { db } from './db';

/** Preferências do usuário (§14.4), guardadas no IndexedDB. */
export interface Settings {
  naming: Naming;
  octaves: OctaveConvention;
  leftHanded: boolean;
  /** true: corda 1 (Mi aguda) em cima, como nos diagramas de leitura. */
  string1OnTop: boolean;
  frets: 12 | 15 | 19 | 20 | 22 | 24;
  spacing: 'realistic' | 'uniform';
  showNoteNames: boolean;
  theme: 'system' | 'light' | 'dark';
  /** Itens novos por dia em "Meu treinamento" (§6.9). */
  newPerDay: number;
  /** Retenção-alvo do FSRS (§10.7). */
  retention: number;
  /** Compensação de latência dos toques (ms), medida na calibração do Módulo E (§15.6). */
  latencyMs: number;
  /** Lá de referência em Hz (§8.1). */
  aRef: number;
  /** Tolerância de afinação para aceitar uma nota pelo microfone (cents, §15.5). */
  toleranceCents: number;
  /** Porta de ruído (RMS) do microfone, calibrável. */
  micGate: number;
  micDeviceId: string;
  /** Guitarra MIDI hexafônica: canal da corda 1 (as demais seguem). 0 = desligado. */
  midiString1Channel: number;
}

export const DEFAULT_SETTINGS: Settings = {
  naming: 'latin',
  octaves: 'scientific',
  leftHanded: false,
  string1OnTop: true,
  frets: 19,
  spacing: 'realistic',
  showNoteNames: false,
  theme: 'dark',
  newPerDay: 15,
  retention: 0.9,
  latencyMs: 0,
  aRef: 440,
  toleranceCents: 35,
  micGate: 0.01,
  micDeviceId: '',
  midiString1Channel: 0,
};

const KEY = 'settings';

export function useSettings(): [Settings, (patch: Partial<Settings>) => void, boolean] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    db.settings
      .get(KEY)
      .then((rec) => {
        if (!alive || !rec) return;
        // Campos ausentes (configurações salvas por versões antigas) ficam com o padrão.
        const saved = Object.fromEntries(Object.entries(rec.value as Partial<Settings>).filter(([, v]) => v !== undefined && v !== null));
        setSettings({ ...DEFAULT_SETTINGS, ...saved });
      })
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      db.settings.put({ key: KEY, value: next }).catch(() => undefined);
      return next;
    });
  }, []);

  return [settings, update, loaded];
}
