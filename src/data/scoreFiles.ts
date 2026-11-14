import type { Instrument } from '../core/instrument/instrument';
import { parseMusicXml, type ImportedScore } from '../core/score/musicxml';
import { ScoreError } from '../core/score/score';

/**
 * Leitura de arquivos de partitura no navegador: MusicXML em texto (.musicxml,
 * .xml) ou compactado (.mxl = zip). O zip é aberto aqui mesmo, sem bibliotecas.
 */
export async function readScoreFile(file: File, inst: Instrument): Promise<ImportedScore> {
  const name = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (name.endsWith('.gp') || name.endsWith('.gp5') || name.endsWith('.gpx') || name.endsWith('.gp4')) {
    throw new ScoreError('Arquivos do Guitar Pro não são lidos diretamente: no Guitar Pro, use Arquivo → Exportar → MusicXML.');
  }
  if (name.endsWith('.mscz')) throw new ScoreError('No MuseScore, use Arquivo → Exportar → MusicXML (.musicxml ou .mxl).');
  if (name.endsWith('.pdf') || name.endsWith('.png') || name.endsWith('.jpg')) {
    throw new ScoreError('Imagens e PDF não podem ser lidos como notas. Use um arquivo MusicXML ou cole a tablatura em texto.');
  }
  const text = isZip ? await xmlFromMxl(buf) : new TextDecoder('utf-8').decode(buf);
  return parseMusicXml(text, inst);
}

interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  localOffset: number;
}

function entries(b: Uint8Array): ZipEntry[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // fim do diretório central (procura de trás para frente)
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ScoreError('Arquivo .mxl corrompido.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    out.push({ name, method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function extract(b: Uint8Array, e: ZipEntry): Promise<string> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const nameLen = dv.getUint16(e.localOffset + 26, true);
  const extraLen = dv.getUint16(e.localOffset + 28, true);
  const start = e.localOffset + 30 + nameLen + extraLen;
  const data = b.subarray(start, start + e.compSize);
  if (e.method === 0) return new TextDecoder('utf-8').decode(data);
  if (e.method !== 8) throw new ScoreError('Compressão do .mxl não suportada.');
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

async function xmlFromMxl(b: Uint8Array): Promise<string> {
  const list = entries(b);
  const container = list.find((e) => e.name === 'META-INF/container.xml');
  let target: ZipEntry | undefined;
  if (container) {
    const xml = await extract(b, container);
    const path = /full-path\s*=\s*"([^"]+)"/.exec(xml)?.[1];
    target = list.find((e) => e.name === path);
  }
  target ??= list.find((e) => !e.name.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(e.name));
  if (!target) throw new ScoreError('Não encontrei a partitura dentro do .mxl.');
  return extract(b, target);
}
