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
import { spelledToMidi } from '../src/core/theory/pitch';
import { COMFORT, HARD_HIGH } from '../src/core/repertoire/importTools';
import { parseMidi, topLine, type MidiNote } from './midi-melodia';
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

/** Obra já escrita para violão: fica na tonalidade e na oitava originais. */
function asWritten(fifths: number, measures: ScoreNote[][]) {
  const midis = measures.flat().flatMap((n) => (n.spelled ? [spelledToMidi(n.spelled)] : []));
  if (midis.length === 0 || Math.min(...midis) < COMFORT.low || Math.max(...midis) > HARD_HIGH) return null;
  return { fifths, measures, semitones: 0 };
}

/** Corta pelo número de notas (estudos de violão são densos): até ~`max` notas, no mínimo 8 compassos. */
function byNotes(measures: ScoreNote[][], max: number): ScoreNote[][] {
  let n = 0;
  let k = 0;
  while (k < measures.length && (k < 8 || n + measures[k]!.filter((x) => !x.rest).length <= max)) {
    n += measures[k]!.filter((x) => !x.rest).length;
    k++;
  }
  return measures.slice(0, k);
}

/** `original`: obra já escrita para violão — fica na tonalidade e na oitava originais. */
function add(base: Omit<AcervoPiece, 'level' | 'fifths' | 'music' | 'semitones'>, fifths: number, meter: Meter, measures: ScoreNote[][], original = false) {
  if (OFFENSIVE.test(base.title)) return fail('título ofensivo');
  const cut = excerpt(original ? byNotes(measures, 128) : measures, meter, 32);
  const g = original ? asWritten(fifths, cut) : forGuitar(fifths, cut);
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
  const c = /^C:(.*)$/m.exec(tune)?.[1]?.trim().replace(/^["']+|["']+$/g, '').trim();
  const name = (x: string) =>
    x
      .replace(/\.$/, '')
      .replace(/\.(?=\S)/g, '. ')
      .replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a + b.toLowerCase());
  // "collected by F. O'Neill": quem recolheu a melodia, não quem compôs
  const by = c && /^collected by\s+(.+)$/i.exec(c)?.[1];
  if (by) return `Tradicional (${fallback}; recolhida por ${name(by)})`;
  return c && !/trad/i.test(c) ? `${name(c)} (${fallback})` : `Tradicional (${fallback})`;
};
abcDir('ryansMammoth', "Ryan's Mammoth Collection (Boston, 1883) — corpus music21", (t) => composerField(t, 'coleção de 1883'), 'ryan');
abcDir('oneills1850', "O'Neill's Music of Ireland (1903; 1850 melodias) — corpus music21", (t) => composerField(t, 'Irlanda'), 'oneill');

// ---------- violão: Mutopia Project (Sor, Giuliani, Carcassi, Aguado, Tárrega…) ----------
interface MutopiaEntry {
  id: string;
  title: string;
  composer: string;
  opus: string;
  instrument: string;
  license: string;
}
/** Nomes completos dos compositores mais presentes. */
const FULL_NAME: Record<string, string> = {
  'M. Giuliani': 'Mauro Giuliani',
  'F. Sor': 'Fernando Sor',
  'F. Horetzky': 'Felix Horetzky',
  'M. Carcassi': 'Matteo Carcassi',
  'D. Aguado': 'Dionisio Aguado',
  'F. Knjze': 'František Max Kníže',
  'F. Carulli': 'Ferdinando Carulli',
  'J. K. Mertz': 'Johann Kaspar Mertz',
  'F. Tarrega': 'Francisco Tárrega',
  'W. T. Matiegka': 'Wenzel Thomas Matiegka',
  'N. Coste': 'Napoléon Coste',
  'L. V. Beethoven': 'Beethoven',
  'W. A. Mozart': 'Mozart',
  'J. Brahms': 'Brahms',
  'G. Fauré': 'Gabriel Fauré',
  'F. X. Gruber': 'Franz Xaver Gruber',
  'G. Sanz': 'Gaspar Sanz',
  'L. Milan': 'Luis de Milán',
  'V. Galilei': 'Vincenzo Galilei',
  Traditional: 'Tradicional',
  Anonymous: 'Anônimo',
};
const LICENSE: Record<string, string> = {
  'Public Domain': 'domínio público',
  'Creative Commons Attribution 3.0': 'CC BY 3.0',
  'Creative Commons Attribution 4.0': 'CC BY 4.0',
  'Creative Commons Attribution-ShareAlike 2.0': 'CC BY-SA 2.0',
  'Creative Commons Attribution-ShareAlike 2.5': 'CC BY-SA 2.5',
  'Creative Commons Attribution-ShareAlike 3.0': 'CC BY-SA 3.0',
  'Creative Commons Attribution-ShareAlike 4.0': 'CC BY-SA 4.0',
};
/** Duração do \partial do LilyPond em semicolcheias ("8*3" = 3 colcheias). */
function lilyPartial(ly: string): number {
  const m = /\\partial\s+(\d+)(\.*)\s*(?:\*\s*(\d+)(?:\/(\d+))?)?/.exec(ly);
  if (!m) return 0;
  let u = 16 / Number(m[1]);
  for (let k = 0; k < m[2]!.length; k++) u *= 1.5;
  return Math.round((u * Number(m[3] ?? 1)) / Number(m[4] ?? 1));
}
const files = (p: string, ext: string): string[] => {
  try {
    return (readdirSync(p, { recursive: true }) as string[]).filter((x) => x.endsWith(ext)).sort().map((x) => join(p, x));
  } catch {
    return [];
  }
};
const mut = join(dir, 'mutopia');
const manifest = JSON.parse(readFileSync(join(mut, 'manifest.json'), 'utf8')) as MutopiaEntry[];
for (const e of manifest) {
  const duo = /^for (2 Guitars|Guitar Duet)$/.test(e.instrument);
  if (!duo && !/^for (Classical )?Guitar$/.test(e.instrument)) continue;
  const died = Number(/–(\d{4})\)/.exec(e.composer)?.[1] ?? 0);
  // só compositores mortos há mais de 70 anos (domínio público no Brasil)
  if (!died || died > 1955) {
    if (!/^(Traditional|Anonymous)/.test(e.composer)) {
      fail('compositor recente');
      continue;
    }
  }
  try {
    const midPath = files(join(mut, 'midz', e.id), '.mid').filter((x) => !/score|guitar\d/i.test(x))[0] ?? join(mut, 'mid', `${e.id}.mid`);
    const lyText = [join(mut, 'ly', `${e.id}.ly`), ...files(join(mut, 'lyz', e.id), '.ly')].map((p) => {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        return '';
      }
    }).join('\n');
    if (!lyText) throw new Error('sem .ly');
    const midi = parseMidi(readFileSync(midPath));
    if (duo) {
      // duo de violões: fica a parte do 1º violão (a mais aguda, que leva a melodia)
      if (midi.tracks.length !== 2) throw new Error('duo com mais de 2 trilhas');
      const mean = (t: MidiNote[]) => t.reduce((s, n) => s + n.pitch, 0) / t.length;
      midi.notes = [...midi.tracks].sort((a, b) => mean(b) - mean(a))[0]!;
    }
    // clave de Sol "8": o .ly (e o MIDI) estão na altura que SOA; o violão se escreve uma oitava acima
    const clef8 = /\\clef\s*"?(treble_8|G_8|G2_8)/.test(lyText);
    let line = topLine(midi, lilyPartial(lyText), clef8 ? 12 : 0);
    if (line.measures.length < 8) throw new Error(line.offGrid ? 'quiálteras logo no começo' : 'curta demais');
    // sem clave "8" achada (às vezes vem de um arquivo incluído): se a melodia desce
    // abaixo do Mi3 escrito, o MIDI está na altura que soa → sobe uma oitava
    const lowest = (l: typeof line) => Math.min(...l.measures.flat().flatMap((n) => (n.written !== null ? [n.written] : [])));
    if (!clef8 && lowest(line) < COMFORT.low) line = topLine(midi, lilyPartial(lyText), 12);
    if (lowest(line) < COMFORT.low) throw new Error('oitava duvidosa');
    const short = e.composer.replace(/\s*\(.*$/, '');
    const composer = FULL_NAME[short] ?? short;
    const maintainer = /maintainer\s*=\s*"([^"]+)"/.exec(lyText)?.[1];
    const base = e.title
      .replace(/\s+for (classical )?guitar\b/i, '')
      .replace(/\s*:\s*/g, ': ')
      .replace(/[“”]/g, '"')
      .replace(/[.\s]+$/, '')
      .replace(/^Nº\.\s*(\d+)\.\s*(.+)$/, '$2 (nº $1)') // "Nº. 28. Pleyel's Hymn" → "Pleyel's Hymn (nº 28)"
      .trim();
    // "12 Etudes, No. 1" + "Op. 6 No. 1" → "12 Etudes, No. 1, Op. 6" (sem repetir o número)
    let opus = e.opus.replace(/^O\s+(?=\d)/, 'Op. ');
    if (/\bno\.?\s*\d/i.test(base)) opus = opus.replace(/\s*No\.?\s*[\d.]+\s*$/i, '');
    const title = opus && !base.includes(opus) && !/\bop(us|\.)?\s*\d/i.test(base) ? `${base}, ${opus}` : base;
    const license = LICENSE[e.license] ?? e.license;
    const source = `Mutopia Project — edição ${maintainer ? `de ${maintainer}, ` : ''}${license}; ${duo ? 'parte do 1º violão do duo' : 'melodia (voz de cima)'}`;
    add({ id: `violao-${slug(composer).slice(0, 12)}-${e.id}`, title, composer, source }, line.fifths, line.meter, line.measures, true);
  } catch (err) {
    fail(`violão: ${(err as Error).message.slice(0, 40)}`);
  }
}

// dentro do nível: das mais curtas (mais fáceis) para as mais longas
const size = (p: AcervoPiece) => p.music.split(' ').length;
out.sort((a, b) => a.level - b.level || size(a) - size(b) || a.title.localeCompare(b.title));
writeFileSync(join(process.cwd(), 'src/core/repertoire/acervo.json'), JSON.stringify(out));
const byLevel = [1, 2, 3, 4, 5].map((l) => `${l}: ${out.filter((p) => p.level === l).length}`).join(' · ');
console.log(`importadas: ${out.length} (${byLevel})`);
console.log('recusadas:', JSON.stringify(Object.entries(fails).sort((a, b) => b[1] - a[1]).slice(0, 60)));
