import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// simula o app Android (Capacitor) para exercitar a consulta ao GitHub
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
const { CHECK_EVERY_MS, checkApkUpdate } = await import('./appUpdate');

describe('aviso de versão nova — dentro do app Android', () => {
  let latest = '1.7.1';
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: `v${latest}` }) }));
  beforeEach(() => {
    latest = '1.7.1';
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('avisa quando a versão publicada é maior que a instalada', async () => {
    expect(await checkApkUpdate('1.7.0', { now: 0 })).toBe('1.7.1');
    expect(await checkApkUpdate('1.7.1', { now: 1 })).toBeNull();
  });

  it('dentro de 3 h usa a resposta guardada; depois disso pergunta de novo', async () => {
    await checkApkUpdate('1.7.0', { now: 0 });
    latest = '1.8.0';
    expect(await checkApkUpdate('1.7.0', { now: CHECK_EVERY_MS - 1 })).toBe('1.7.1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await checkApkUpdate('1.7.0', { now: CHECK_EVERY_MS })).toBe('1.8.0');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('o botão "Procurar atualização" ignora a resposta guardada', async () => {
    await checkApkUpdate('1.7.0', { now: 0 });
    latest = '1.8.0';
    expect(await checkApkUpdate('1.7.0', { now: 5, force: true })).toBe('1.8.0');
  });

  it('sem internet não aparece aviso (e não quebra)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await checkApkUpdate('1.7.0', { now: 0 })).toBeNull();
  });
});
