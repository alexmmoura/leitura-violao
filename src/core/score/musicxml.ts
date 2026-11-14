import { locationsFor, type FretLocation, type Instrument } from '../instrument/instrument';
import { measureSize, type Meter } from '../rhythm/rhythm';
import { asSounding, LETTERS, spelledToMidi, type Alter, type Letter, type SpelledPitch } from '../theory/pitch';
import { ScoreError, type ScoreNote } from './score';
import { child, childrenOf, find, parseXml, textOf, type XmlNode } from './xml';

/**
 * Importação de MusicXML (.musicxml/.xml), o formato de troca exportado pelo
 * MuseScore (gratuito), Guitar Pro, Sibelius, Finale, Dorico etc.
 *
 * Usa a 1ª parte e a voz principal. Acordes viram a nota mais aguda. Casas e
 * cordas da tablatura (<technical><string>/<fret>) são aproveitadas como digitação.
 * Quiálteras (tercinas) ainda não são suportadas.
 */
export interface ImportedScore {
  readonly title: string;
  readonly fifths: number;
  readonly meter: Meter;
  readonly measures: ScoreNote[][];
  readonly warnings: string[];
}

interface RawNote {
  units: number;
  rest: boolean;
  tie: boolean;
  spelled: SpelledPitch | null;
  loc: FretLocation | null;
}

function meterOf(beats: number, type: number): Meter | null {
  if (!Number.isInteger(beats) || beats < 1) return null;
  if (type === 4 || type === 8) return { num: beats, den: type };
  if (type === 2) return { num: beats * 2, den: 4 };
  if (type === 16 && beats % 2 === 0) return { num: beats / 2, den: 8 };
  return null;
}

export function parseMusicXml(text: string, inst: Instrument): ImportedScore {
  let doc: XmlNode;
  try {
    doc = parseXml(text);
  } catch {
    throw new ScoreError('O arquivo não é um XML válido.');
  }
  const score = find(doc, 'score-partwise');
  if (!score) {
    if (find(doc, 'score-timewise')) throw new ScoreError('MusicXML "timewise" não é suportado; exporte como MusicXML comum (partwise).');
    throw new ScoreError('O arquivo não é uma partitura MusicXML.');
  }
  const title =
    textOf(child(score, 'work'), 'work-title') || textOf(score, 'movement-title') || childrenOf(score, 'credit').map((c) => textOf(c, 'credit-words')).find(Boolean) || 'Partitura importada';
  const part = child(score, 'part');
  if (!part) throw new ScoreError('A partitura não tem nenhuma parte.');
  const partCount = childrenOf(score, 'part').length;

  const warnings: string[] = [];
  if (partCount > 1) warnings.push(`A partitura tem ${partCount} partes; usei só a primeira.`);

  let divisions = 1;
  let fifths: number | null = null;
  let meter: Meter | null = null;
  let clefOctave = 0;
  let transposeOctave = 0;
  let voice: string | null = null;
  let chords = 0;
  let tuplets = 0;
  let keyChanged = false;
  let meterChanged = false;
  const measures: RawNote[][] = [];

  for (const m of childrenOf(part, 'measure')) {
    const notes: RawNote[] = [];
    for (const el of m.children) {
      if (el.name === 'attributes') {
        const d = Number(textOf(el, 'divisions'));
        if (d > 0) divisions = d;
        const key = child(el, 'key');
        if (key && textOf(key, 'fifths') !== undefined) {
          const f = Number(textOf(key, 'fifths'));
          if (fifths === null) fifths = f;
          else if (f !== fifths) keyChanged = true;
        }
        const time = child(el, 'time');
        if (time) {
          const mt = meterOf(Number(textOf(time, 'beats')), Number(textOf(time, 'beat-type')));
          if (!mt) throw new ScoreError(`Fórmula de compasso não suportada: ${textOf(time, 'beats')}/${textOf(time, 'beat-type')}.`);
          if (meter === null) meter = mt;
          else if (mt.num !== meter.num || mt.den !== meter.den) meterChanged = true;
        }
        const clef = childrenOf(el, 'clef').find((c) => !c.attrs.number || c.attrs.number === '1');
        if (clef) {
          if (textOf(clef, 'sign') === 'TAB') throw new ScoreError('A 1ª pauta é só tablatura; exporte com a pauta comum (partitura) também.');
          clefOctave = Number(textOf(clef, 'clef-octave-change') ?? 0);
        }
        const tr = child(el, 'transpose');
        if (tr) transposeOctave = Number(textOf(tr, 'octave-change') ?? 0);
        continue;
      }
      if (el.name === 'forward') {
        const v = textOf(el, 'voice');
        if (voice !== null && v !== undefined && v !== voice) continue;
        const staff = textOf(el, 'staff');
        if (staff && staff !== '1') continue;
        notes.push({ units: (Number(textOf(el, 'duration')) * 4) / divisions, rest: true, tie: false, spelled: null, loc: null });
        continue;
      }
      if (el.name !== 'note') continue;
      if (child(el, 'grace') || child(el, 'cue')) continue;
      const staff = textOf(el, 'staff');
      if (staff && staff !== '1') continue;
      const v = textOf(el, 'voice') ?? '1';
      if (voice === null) voice = v;
      if (v !== voice) continue;
      if (child(el, 'time-modification')) tuplets++;

      const pitchEl = child(el, 'pitch');
      let spelled: SpelledPitch | null = null;
      if (pitchEl) {
        const step = (textOf(pitchEl, 'step') ?? '').toUpperCase() as Letter;
        if (!LETTERS.includes(step)) continue;
        const alter = Math.max(-2, Math.min(2, Math.round(Number(textOf(pitchEl, 'alter') ?? 0)))) as Alter;
        spelled = { letter: step, alter, octave: Number(textOf(pitchEl, 'octave')) };
      }
      const tech = child(child(el, 'notations'), 'technical');
      const str = Number(textOf(tech, 'string'));
      const fret = Number(textOf(tech, 'fret'));
      const loc = tech && str >= 1 && fret >= 0 && textOf(tech, 'fret') !== undefined ? { string: str, fret } : null;
      const tie = childrenOf(el, 'tie').some((t) => t.attrs.type === 'start');

      if (child(el, 'chord')) {
        // acorde: fica a nota mais aguda
        chords++;
        const prev = notes[notes.length - 1];
        if (prev && spelled && (!prev.spelled || spelledToMidi(spelled) > spelledToMidi(prev.spelled))) {
          prev.spelled = spelled;
          prev.loc = loc;
          prev.tie = tie;
        }
        continue;
      }
      const isRest = !!child(el, 'rest') || !pitchEl;
      notes.push({ units: (Number(textOf(el, 'duration')) * 4) / divisions, rest: isRest, tie: !isRest && tie, spelled: isRest ? null : spelled, loc: isRest ? null : loc });
    }
    measures.push(notes);
  }

  if (tuplets) throw new ScoreError('A partitura tem quiálteras (tercinas etc.), que ainda não são suportadas.');
  const bad = measures.flat().find((n) => !(n.units >= 1) || Math.abs(n.units - Math.round(n.units)) > 1e-6);
  if (bad) throw new ScoreError('A partitura tem figuras menores que a semicolcheia (fusas etc.), que ainda não são suportadas.');
  meter ??= { num: 4, den: 4 };
  fifths ??= 0;
  if (fifths < -7 || fifths > 7) fifths = 0;
  if (chords) warnings.push(`${chords} nota(s) de acorde removida(s): ficou a nota mais aguda de cada acorde.`);
  if (keyChanged) warnings.push('A tonalidade muda no meio da música; usei só a armadura inicial.');
  if (meterChanged) warnings.push('A fórmula de compasso muda no meio da música; usei só a inicial.');

  // Escrita × soante: em clave de Sol "8" o MusicXML guarda a altura SOANTE; com
  // <transpose> de −1 oitava, a ESCRITA. Escolhe a oitava que cabe no violão.
  const pitched = measures.flat().filter((n) => n.spelled);
  const fits = (shift: number) => pitched.filter((n) => locationsFor(asSounding(spelledToMidi(n.spelled!) + 12 * shift + inst.transposition), inst).length > 0).length;
  const base = clefOctave === -1 && transposeOctave === 0 ? 1 : 0;
  const order = [base, base === 1 ? 0 : 1, base + 1, base - 1];
  let shift = base;
  let best = fits(base);
  for (const s of order) {
    const f = fits(s);
    if (f > best) {
      best = f;
      shift = s;
    }
  }
  if (shift !== base) warnings.push(`Oitava ajustada (${shift > base ? '+' : '−'}${Math.abs(shift - base)}) para a música caber no violão.`);

  const size = measureSize(meter);
  const out: ScoreNote[][] = measures.map((ms, i) => {
    let notes: ScoreNote[] = ms.map((n) => ({
      units: Math.round(n.units),
      rest: n.rest,
      tie: n.tie,
      written: n.spelled ? spelledToMidi(n.spelled) + 12 * shift : null,
      ...(n.spelled ? { spelled: { ...n.spelled, octave: n.spelled.octave + shift } } : {}),
      ...(n.loc ? { loc: n.loc } : {}),
    }));
    const total = notes.reduce((s, n) => s + n.units, 0);
    // compasso vazio (voz ausente) vira pausa; compasso incompleto no meio é completado
    if (total === 0) notes = [{ units: size, rest: true, written: null }];
    else if (total < size && i > 0 && i < measures.length - 1) notes.push({ units: size - total, rest: true, written: null });
    return notes;
  });
  // tira compassos de pausa do fim
  while (out.length > 1 && out[out.length - 1]!.every((n) => n.rest)) out.pop();
  return { title, fifths, meter, measures: out, warnings };
}
