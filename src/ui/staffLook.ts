/**
 * Acabamento visual comum das pautas (VexFlow).
 *
 * Linhas retas (linhas da pauta, suplementares, hastes e barras) ficam alinhadas
 * aos pixels da tela: sem isso o navegador "espalha" cada linha por 2 pixels
 * e a pauta parece cinza e borrada. Curvas, cabeças de nota e barras de
 * colcheia continuam suavizadas.
 */
const STRAIGHT = /^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*L\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*$/;

export function crispLines(svg: SVGSVGElement | null): void {
  if (!svg) return;
  svg.querySelectorAll('path').forEach((p) => {
    const m = STRAIGHT.exec(p.getAttribute('d') ?? '');
    if (m && (m[2] === m[4] || m[1] === m[3])) p.setAttribute('shape-rendering', 'crispEdges');
  });
  svg.querySelectorAll('.vf-stavebarline rect, rect.vf-stavebarline').forEach((r) => r.setAttribute('shape-rendering', 'crispEdges'));
}

/** Cor de uma variável CSS no lugar onde a pauta está (a "folha" redefine as cores). */
export function cssColor(el: Element | null, name: string, fallback: string): string {
  const v = el ? getComputedStyle(el).getPropertyValue(name).trim() : '';
  return v || fallback;
}
