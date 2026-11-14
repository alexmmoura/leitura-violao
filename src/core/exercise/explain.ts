import { soundingAt, type FretLocation, type Instrument } from '../instrument/instrument';
import { positionLabel } from '../instrument/position';
import { pitchName, type Naming, type OctaveConvention } from '../theory/pitch';
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

export function explainQuestion(q: NoteQuestion, inst: Instrument, opts: ExplainOptions, answer?: FretLocation, error?: ErrorCode): string[] {
  const name = (p: Parameters<typeof pitchName>[0]) => pitchName(p, { naming: opts.naming, octaves: opts.octaves });
  const lines: string[] = [];
  if (inst.transposition === -12) {
    const soundingSpelled = { ...q.written, octave: q.written.octave - 1 };
    lines.push(`Nota escrita: ${name(q.written)} — soa uma oitava abaixo (${name(soundingSpelled)}).`);
  } else {
    lines.push(`Nota escrita: ${name(q.written)}.`);
  }

  if (q.alterSource === 'key') lines.push(`A alteração vem da armadura.`);

  const first = q.valid[0];
  if (first) {
    const str = inst.strings[first.string - 1];
    if (str) {
      const open = preferredSpelling(str.openMidi);
      lines.push(
        first.fret === 0
          ? `Corda ${first.string} solta = ${name(open)} soante.`
          : `Corda ${first.string} solta = ${name(open)} soante; ${first.fret} ${first.fret > 1 ? 'semitons' : 'semitom'} acima → casa ${first.fret}.`,
      );
    }
  }
  lines.push(`Válidas neste exercício (${positionLabel(q.constraints.position)}): ${q.valid.map(locationLabel).join('; ')}.`);

  if (answer && error) {
    const heard = preferredSpelling(soundingAt(answer, inst) - inst.transposition);
    lines.push(`Você marcou ${locationLabel(answer)}, que corresponde a ${name(heard)} escrito.`);
    if (error === 'OCTAVE') lines.push('A letra está certa, mas a oitava não: conte as linhas suplementares.');
    if (error === 'KEY_ACCIDENTAL') lines.push('Lembre-se: a armadura vale para todas as oitavas da letra.');
    if (error === 'OUT_OF_CONSTRAINTS') lines.push('A altura está certa, mas fora da região pedida — procure o mesmo som dentro da posição.');
    if (error === 'LINE_SPACE') lines.push('Confira: linha ou espaço? Erros de terça costumam vir de contar linhas suplementares.');
  }
  return lines;
}
