import type { Instrument } from '../instrument/instrument';
import { soundingAt } from '../instrument/instrument';
import type { Meter } from '../rhythm/rhythm';
import { noteAt, ScoreError, splitIntoMeasures, type ScoreNote } from './score';

/**
 * Leitor de tablatura em texto (ASCII), o formato comum em sites de cifras:
 *
 *   e|-------0-----|
 *   B|-----1---1---|
 *   G|---2---------|
 *   D|-0-----------|
 *   A|-------------|
 *   E|-------------|
 *
 * Cada bloco tem 6 linhas (corda 1 em cima). Números são casas; letras de técnica
 * (h, p, b, r, /, \, ~, x) são ignoradas. Tablatura não diz o ritmo: todas as
 * notas recebem a mesma figura escolhida. Notas na mesma coluna (acordes) viram
 * só a mais aguda, porque o exercício é de leitura melódica.
 */
export interface TabResult {
  readonly measures: ScoreNote[][];
  readonly notes: number;
  readonly warnings: string[];
}

const LINE = /^\s*([A-Ga-g][#b]?)?\s*[|:]?(.*[-–].*)$/;

function isTabLine(s: string): boolean {
  const m = LINE.exec(s);
  if (!m) return false;
  const body = m[2]!;
  const dashes = (body.match(/[-–]/g) ?? []).length;
  return dashes >= 3 && dashes >= body.replace(/\s/g, '').length * 0.4;
}

/** Corpo da linha (depois do nome da corda e da primeira barra). */
function bodyOf(s: string): string {
  const m = LINE.exec(s)!;
  return m[2]!.replace(/–/g, '-');
}

export function parseTab(text: string, inst: Instrument, units: number, meter: Meter): TabResult {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (isTabLine(l)) cur.push(bodyOf(l));
    else {
      if (cur.length) blocks.push(cur);
      cur = [];
    }
  }
  if (cur.length) blocks.push(cur);

  const warnings: string[] = [];
  const good = blocks.filter((b) => b.length === inst.strings.length);
  if (good.length === 0) {
    throw new ScoreError(
      blocks.length
        ? `Encontrei linhas de tablatura, mas não em grupos de ${inst.strings.length} cordas. Cole o bloco inteiro (de e a E).`
        : 'Não encontrei tablatura no texto. Cada linha deve ser como: e|---0---3---|',
    );
  }
  if (good.length < blocks.length) warnings.push(`${blocks.length - good.length} bloco(s) ignorado(s) por não terem ${inst.strings.length} linhas.`);

  const notes: ScoreNote[] = [];
  let chords = 0;
  for (const block of good) {
    const width = Math.max(...block.map((l) => l.length));
    for (let col = 0; col < width; col++) {
      // números que COMEÇAM nesta coluna (casas 10+ ocupam 2 colunas)
      const hits: { string: number; fret: number }[] = [];
      block.forEach((line, si) => {
        const ch = line[col];
        if (!ch || !/\d/.test(ch) || (col > 0 && /\d/.test(line[col - 1] ?? ''))) return;
        const num = /^\d{1,2}/.exec(line.slice(col))![0];
        const fret = Number(num);
        if (fret <= inst.frets) hits.push({ string: si + 1, fret });
      });
      if (hits.length === 0) continue;
      if (hits.length > 1) chords++;
      const top = hits.reduce((a, b) => (soundingAt(b, inst) > soundingAt(a, inst) ? b : a));
      notes.push(noteAt(top, inst, units));
    }
  }
  if (notes.length === 0) throw new ScoreError('A tablatura não tem nenhuma casa numerada.');
  if (chords) warnings.push(`${chords} acorde(s) reduzido(s) à nota mais aguda (o exercício é de leitura melódica).`);
  warnings.push('Tablatura não traz ritmo: todas as notas ficaram com a mesma figura.');
  return { measures: splitIntoMeasures(notes, meter), notes: notes.length, warnings };
}
