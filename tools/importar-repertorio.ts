/**
 * Converte obras em DOMÍNIO PÚBLICO baixadas do corpus do music21
 * (https://github.com/cuthbertLab/music21/tree/master/music21/corpus) para o
 * repertório do Claves: transpõe para o violão, mede o nível 1–5 e grava
 * src/core/repertoire/acervo.json.
 *
 * Uso (na pasta do projeto):
 *   node tools/run-ts.mjs tools/importar-repertorio.ts <pasta-do-acervo>
 * onde a pasta tem: bach-xml/*.xml (corais, MusicXML descompactado),
 * ryansMammoth/*.abc e oneills1850/*.abc.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeGuitar } from '../src/core/instrument/instrument';
import { parseNotation } from '../src/core/repertoire/notation';
import { excerpt, forGuitar, levelOf, measureDifficulty, toNotation } from '../src/core/repertoire/importTools';
import type { Level } from '../src/core/repertoire/pieces';
import { parseAbcTune, splitAbcTunes } from '../src/core/score/abc';
import { parseMusicXml } from '../src/core/score/musicxml';
import { buildScoreMelody, type ScoreNote } from '../src/core/score/score';
import type { Meter } from '../src/core/rhythm/rhythm';

export interface AcervoPiece {
  id: string;
  title: string;
  composer: string;
  source: string;
  level: Level;
  fifths: number;
  meter: Meter;
  music: string;
  /** Semitons de transposição em relação ao original (0 = original). */
  semitones: number;
}

const dir = process.argv[2];
if (!dir) throw new Error('informe a pasta do acervo');
const inst = makeGuitar({ frets: 19 });
const out: AcervoPiece[] = [];
const seen = new Set<string>();
const fails: Record<string, number> = {};
const fail = (why: string) => (fails[why] = (fails[why] ?? 0) + 1);

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

const ids = new Set<string>();
/** Coleções do séc. XIX têm títulos de "minstrel shows" com termos racistas: ficam de fora. */
const OFFENSIVE = /\b(coons?|darke?y|darkies|nigg\w*|pickaninn\w*|jim crow|mammy|sambo)\b/i;

function add(base: Omit<AcervoPiece, 'level' | 'fifths' | 'music' | 'semitones'>, fifths: number, meter: Meter, measures: ScoreNote[][]) {
  if (OFFENSIVE.test(base.title)) return fail('título ofensivo');
  const cut = excerpt(measures, meter, 32);
  const g = forGuitar(fifths, cut);
  if (!g) return fail('não cabe no violão');
  const music = toNotation(g.measures);
  if (seen.has(music)) return fail('repetida');
  try {
    // confere tudo: a notação relida fecha os compassos e a melodia é tocável
    const re = parseNotation(music, meter);
    buildScoreMelody({ id: base.id, title: base.title, fifths: g.fifths, meter, measures: re, source: 'editor', createdAt: 0 }, inst);
  } catch (e) {
    return fail(`conferência: ${(e as Error).message.slice(0, 40)}`);
  }
  const d = measureDifficulty(g.fifths, g.measures);
  if (d.notes < 8) return fail('curta demais');
  seen.add(music);
  let id = base.id;
  for (let n = 2; ids.has(id); n++) id = `${base.id}-${n}`;
  ids.add(id);
  out.push({ ...base, id, level: levelOf(g.fifths, meter, d), fifths: g.fifths, meter, music, semitones: g.semitones });
}

// ---------- Bach: corais (voz do soprano) ----------
/** Deixa só a parte do soprano (alguns corais têm instrumentos antes dela). */
function sopranoOnly(xml: string): string {
  const id = /<score-part id="([^"]+)">\s*<part-name>\s*Soprano/i.exec(xml)?.[1];
  if (!id) throw new Error('sem parte de soprano');
  return xml.replace(/<part id="([^"]+)">[\s\S]*?<\/part>/g, (m, pid: string) => (pid === id ? m : ''));
}
const bachDir = join(dir, 'bach-xml');
for (const f of readdirSync(bachDir).filter((x) => x.endsWith('.xml')).sort()) {
  const bwv = f.replace(/^bwv/, '').replace(/\.xml$/, '');
  try {
    const s = parseMusicXml(sopranoOnly(readFileSync(join(bachDir, f), 'utf8')), inst);
    add({ id: `bach-bwv${slug(bwv)}`, title: `Coral BWV ${bwv} (soprano)`, composer: 'J. S. Bach', source: 'Corais de Bach — corpus music21' }, s.fifths, s.meter, s.measures);
  } catch (e) {
    fail(`bach: ${(e as Error).message.slice(0, 50)}`);
  }
}

// ---------- melodias em ABC ----------
function abcDir(sub: string, source: string, composerOf: (text: string) => string, prefix: string) {
  const d = join(dir, sub);
  for (const f of readdirSync(d).filter((x) => x.endsWith('.abc')).sort()) {
    const text = readFileSync(join(d, f), 'latin1');
    splitAbcTunes(text).forEach((tune, k) => {
      try {
        const t = parseAbcTune(tune);
        const raw = t.title.replace(/\s*--\s*/g, ' — ').replace(/[.:]+$/, '').replace(/(\w):(\w)/g, '$1$2');
        // títulos em CAIXA ALTA viram "Caixa De Título"
        const title = raw === raw.toUpperCase() ? raw.toLowerCase().replace(/(^|[\s(—-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : raw;
        add({ id: `${prefix}-${slug(title)}-${slug(f).slice(0, 12)}-${k}`, title, composer: composerOf(tune), source }, t.fifths, t.meter, t.measures);
      } catch (e) {
        fail(`abc: ${(e as Error).message.slice(0, 50)}`);
      }
    });
  }
}
const composerField = (tune: string, fallback: string) => {
  const c = /^C:(.*)$/m.exec(tune)?.[1]?.trim();
  return c && !/trad/i.test(c) ? `${c.replace(/\.$/, '').replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a + b.toLowerCase())} (${fallback})` : `Tradicional (${fallback})`;
};
abcDir('ryansMammoth', "Ryan's Mammoth Collection (Boston, 1883) — corpus music21", (t) => composerField(t, 'coleção de 1883'), 'ryan');
abcDir('oneills1850', "O'Neill's Music of Ireland (1903; 1850 melodias) — corpus music21", (t) => composerField(t, 'Irlanda'), 'oneill');

// dentro do nível: das mais curtas (mais fáceis) para as mais longas
const size = (p: AcervoPiece) => p.music.split(' ').length;
out.sort((a, b) => a.level - b.level || size(a) - size(b) || a.title.localeCompare(b.title));
writeFileSync(join(process.cwd(), 'src/core/repertoire/acervo.json'), JSON.stringify(out));
const byLevel = [1, 2, 3, 4, 5].map((l) => `${l}: ${out.filter((p) => p.level === l).length}`).join(' · ');
console.log(`importadas: ${out.length} (${byLevel})`);
console.log('recusadas:', JSON.stringify(Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 15)));
