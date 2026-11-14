const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Milissegundos → "1,4 s" (ou "–" quando não há valor). */
export function secs(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? '–' : `${fmt.format(ms / 1000)} s`;
}
