/**
 * Leitor XML mínimo (sem DOM), suficiente para MusicXML. Funciona no navegador e
 * nos testes (Node) igualmente.
 */
export interface XmlNode {
  readonly name: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: XmlNode[];
  text: string;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e] ?? m),
  );

export function parseXml(src: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) stack[stack.length - 1]!.text += decode(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      i = src.indexOf('-->', lt) + 3;
      if (i < 3) break;
      continue;
    }
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt);
      stack[stack.length - 1]!.text += src.slice(lt + 9, end);
      i = end + 3;
      continue;
    }
    if (src[lt + 1] === '?' || src[lt + 1] === '!') {
      // <?xml …?>, <!DOCTYPE …> (pode ter [ … ] interno)
      let j = lt + 2;
      let depth = 0;
      while (j < src.length) {
        if (src[j] === '[') depth++;
        else if (src[j] === ']') depth--;
        else if (src[j] === '>' && depth <= 0) break;
        j++;
      }
      i = j + 1;
      continue;
    }
    const gt = src.indexOf('>', lt);
    if (gt < 0) throw new Error('XML malformado.');
    const raw = src.slice(lt + 1, gt);
    i = gt + 1;
    if (raw[0] === '/') {
      const name = raw.slice(1).trim();
      // fecha até o elemento correspondente (tolera pequenas falhas)
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k]!.name === name) {
          stack.length = k;
          break;
        }
      }
      continue;
    }
    const selfClose = raw.endsWith('/');
    const body = selfClose ? raw.slice(0, -1) : raw;
    const nameEnd = body.search(/[\s]/);
    const name = nameEnd < 0 ? body : body.slice(0, nameEnd);
    const attrs: Record<string, string> = {};
    const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) attrs[m[1]!] = decode(m[3] ?? m[4] ?? '');
    const node: XmlNode = { name, attrs, children: [], text: '' };
    stack[stack.length - 1]!.children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

export const child = (n: XmlNode | undefined, name: string): XmlNode | undefined => n?.children.find((c) => c.name === name);
export const childrenOf = (n: XmlNode | undefined, name: string): XmlNode[] => n?.children.filter((c) => c.name === name) ?? [];
export const textOf = (n: XmlNode | undefined, name: string): string | undefined => {
  const c = child(n, name);
  return c ? c.text.trim() : undefined;
};
/** Primeiro descendente com o nome dado (busca em profundidade). */
export function find(n: XmlNode, name: string): XmlNode | undefined {
  for (const c of n.children) {
    if (c.name === name) return c;
    const d = find(c, name);
    if (d) return d;
  }
  return undefined;
}
