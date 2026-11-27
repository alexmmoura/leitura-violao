import { Capacitor } from '@capacitor/core';

/**
 * App Android (.apk): ele NÃO se atualiza sozinho como o site. Ao abrir (e ao voltar
 * para ele, no máximo a cada 3 h) o app pergunta ao GitHub qual é a versão mais nova
 * publicada e, se for maior que a instalada, mostra um aviso com o link para baixar. A consulta é anônima (não
 * envia nada do usuário) e, sem internet, simplesmente não aparece aviso.
 */
export const REPO = 'alexmmoura/leitura-violao';
/** Link fixo para o .apk da versão mais nova. */
export const APK_URL = `https://github.com/${REPO}/releases/latest/download/Claves.apk`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const CHECK_KEY = 'lv-apk-check';
/** Intervalo mínimo entre duas consultas automáticas. */
export const CHECK_EVERY_MS = 3 * 60 * 60 * 1000;

/** Rodando dentro do app Android (Capacitor), e não no navegador. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * App Android: grava o backup na pasta do app e abre o "Compartilhar" do Android
 * (Drive, WhatsApp, e-mail…). Os plugins só são carregados aqui (não pesam no site).
 */
export async function shareBackupFile(name: string, text: string): Promise<void> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: 'Backup do Claves', files: [uri], dialogTitle: 'Guardar o backup do Claves' });
}

/** Compara "1.10.0" com "1.9.2" (número a número). */
export function isNewer(latest: string, current: string): boolean {
  const a = latest.replace(/^v/, '').split('.').map(Number);
  const b = current.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Versão mais nova publicada, se for maior que a instalada (null se não há ou sem internet).
 * Consultou há menos de 3 h? Usa a resposta guardada — a menos que `force` (botão "Procurar atualização").
 */
export async function checkApkUpdate(current: string, { now = Date.now(), force = false }: { now?: number; force?: boolean } = {}): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const last = JSON.parse(localStorage.getItem(CHECK_KEY) ?? 'null') as { at: number; latest: string } | null;
    if (!force && last && now - last.at < CHECK_EVERY_MS) return isNewer(last.latest, current) ? last.latest : null;
  } catch {
    /* sem armazenamento: checa de novo */
  }
  try {
    const res = await fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const latest = String(((await res.json()) as { tag_name?: string }).tag_name ?? '').replace(/^v/, '');
    if (!latest) return null;
    try {
      localStorage.setItem(CHECK_KEY, JSON.stringify({ at: now, latest }));
    } catch {
      /* ok */
    }
    return isNewer(latest, current) ? latest : null;
  } catch {
    return null;
  }
}
