import { soundingAt, type FretLocation, type Instrument } from '../instrument/instrument';
import { positionLabel } from '../instrument/position';
import { diatonicIndex, pitchName, type Naming, type OctaveConvention, type SpelledPitch } from '../theory/pitch';
import { preferredSpelling } from '../theory/spelling';
import type { NoteQuestion } from './noteQuestion';
import type { ErrorCode } from './validate';

/**
 * Explicação pedagógica gerada a partir dos dados — especificação §9.5.
 * Nunca texto fixo: sempre derivada da questão, das localizações e da resposta.
 */
export interface ExplainOptions {
  readonly naming: Naming;
  readonly octaves: OctaveConvention;
}

export function locationLabel(l: FretLocation): string {
  return l.fret === 0 ? `corda ${l.string} solta` : `corda ${l.string}, casa ${l.fret}`;
}

/** Onde a nota ESCRITA fica na pauta (clave de Sol): "4ª linha", "2º espaço", "1ª linha suplementar abaixo"… */
export function staffPlace(p: SpelledPitch): string {
  const steps = diatonicIndex(p) - diatonicIndex({ letter: 'E', alter: 0, octave: 4 }); // Mi4 = 1ª linha
  if (steps >= 0 && steps <= 8) return steps % 2 === 0 ? `${steps / 2 + 1}ª linha` : `${(steps + 1) / 2}º espaço`;
  const below = steps < 0;
  const k = below ? -steps : steps - 8;
  if (k === 1) return below ? 'logo abaixo da pauta' : 'logo acima da pauta';
  if (k % 2 === 0) return `${k / 2}ª linha suplementar ${below ? 'abaixo' : 'acima'}`;
  return `${below ? 'abaixo' : 'acima'} da ${(k - 1) / 2}ª linha suplementar ${below ? 'inferior' : 'superior'}`;
}

/**
 * Cada linha começa com um rótulo ("Pedida:", "Você marcou:", "Como achar:", "Dica:")
 * para ficar claro a que se refere cada informação.
 */
export function explainQuestion(q: NoteQuestion, inst: Instrument, opts: ExplainOptions, answer?: FretLocation, error?: ErrorCode): string[] {
  // a oitava só aparece quando o erro É de oitava; no resto, só atrapalha
  const withOctave = error === 'OCTAVE';
  const name = (p: SpelledPitch) => pitchName(p, { naming: opts.naming, octaves: opts.octaves, withOctave });
  const short = (p: SpelledPitch) => pitchName(p, { naming: opts.naming, withOctave: false });
  const lines: string[] = [];

  lines.push(`Pedida: ${name(q.written)} (${staffPlace(q.written)}) → ${q.valid.map(locationLabel).join(' ou ')}.`);

  if (answer && error) {
    const marked = preferredSpelling(soundingAt(answer, inst) - inst.transposition);
    lines.push(
      error === 'OUT_OF_CONSTRAINTS'
        ? `Você marcou: ${locationLabel(answer)} → é a nota certa, mas fora da região pedida (${positionLabel(q.constraints.position)}).`
        : `Você marcou: ${locationLabel(answer)} → é um ${name(marked)}.`,
    );
  }

  const first = q.valid[0];
  const str = first ? inst.strings[first.string - 1] : undefined;
  if (first && str) {
    if (first.fret === 0) lines.push(`Como achar: é a própria corda ${first.string} solta.`);
    else {
      const open = short(preferredSpelling(str.openMidi));
      const n = first.fret;
      // casas poucas: mostra o caminho nota a nota; muitas: só a contagem
      const path = Array.from({ length: n }, (_, i) => (i === n - 1 ? short(q.written) : short(preferredSpelling(str.openMidi + i + 1))));
      lines.push(
        n <= 5
          ? `Como achar: a corda ${first.string} solta é ${open}; suba ${n} ${n > 1 ? 'casas' : 'casa'}: ${path.join(', ')}.`
          : `Como achar: a corda ${first.string} solta é ${open}; suba ${n} casas (cada casa = meio tom) até ${short(q.written)}.`,
      );
    }
  }

  if (q.alterSource === 'key') lines.push('Dica: o sustenido/bemol desta nota vem da armadura (não aparece ao lado da nota).');
  if (answer && error) {
    if (error === 'OCTAVE') lines.push('Dica: o nome está certo, mas a oitava não — conte as linhas suplementares.');
    if (error === 'KEY_ACCIDENTAL') lines.push('Dica: a armadura vale para todas as oitavas da nota.');
    if (error === 'OUT_OF_CONSTRAINTS') lines.push('Dica: procure o mesmo som dentro da posição.');
    if (error === 'LINE_SPACE') lines.push('Dica: confira se é linha ou espaço — errar por uma terça costuma vir de contar mal as linhas.');
  }
  return lines;
}
