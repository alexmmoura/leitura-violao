import { describe, expect, it } from 'vitest';
import { APK_URL, checkApkUpdate, isNativeApp, isNewer } from './appUpdate';

describe('aviso de versão nova do app Android', () => {
  it('compara versões número a número', () => {
    expect(isNewer('1.10.0', '1.9.2')).toBe(true);
    expect(isNewer('v1.6.0', '1.5.0')).toBe(true);
    expect(isNewer('1.5.0', '1.5.0')).toBe(false);
    expect(isNewer('1.4.9', '1.5.0')).toBe(false);
  });

  it('no navegador não é app nativo e não consulta nada', async () => {
    expect(isNativeApp()).toBe(false);
    expect(await checkApkUpdate('1.0.0')).toBeNull();
  });

  it('o link do .apk aponta sempre para a versão mais nova', () => {
    expect(APK_URL).toBe('https://github.com/alexmmoura/leitura-violao/releases/latest/download/Claves.apk');
  });
});
