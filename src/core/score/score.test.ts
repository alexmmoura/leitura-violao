import { describe, expect, it } from 'vitest';
import { makeGuitar } from '../instrument/instrument';
import { melodyNotes } from '../melody/melody';
import { evaluateReading } from '../melody/sightReading';
import { parseMusicXml } from './musicxml';
import { buildScoreMelody, noteAt, splitIntoMeasures, splitUnits, type ScoreDef } from './score';
import { parseTab } from './tab';
import { parseXml } from './xml';

const inst = makeGuitar();
const def = (over: Partial<ScoreDef>): ScoreDef => ({ id: 't', title: 't', fifths: 0, meter: { num: 4, den: 4 }, measures: [], source: 'editor', createdAt: 0, ...over });

describe('partituras próprias — núcleo', () => {
  it('quebra durações em figuras desenháveis', () => {
    expect(splitUnits(4)).toEqual([4]);
    expect(splitUnits(5)).toEqual([4, 1]);
    expect(splitUnits(14)).toEqual([12, 2]);
  });

  it('divide em compassos e liga a nota que atravessa a barra', () => {
    const n = (units: number) => ({ units, rest: false, written: 64 });
    const ms = splitIntoMeasures([n(12), n(8)], { num: 4, den: 4 });
    expect(ms.map((m) => m.map((x) => x.units))).toEqual([[12, 4], [4]]);
    expect(ms[0]![1]!.tie).toBe(true);
    expect(ms[1]![0]!.tie).toBe(false);
  });

  it('monta a melodia: ligadura não vira novo ataque e o acidente não se repete', () => {
    // Fá♯ (escrito 66) mínima pontuada + semínima ligada à próxima barra
    const ms = splitIntoMeasures(
      [
        { units: 12, rest: false, written: 66 },
        { units: 8, rest: false, written: 66 },
        { units: 4, rest: true, written: null },
      ],
      { num: 4, den: 4 },
    );
    const mel = buildScoreMelody(def({ measures: ms }), inst);
    expect(melodyNotes(mel)).toHaveLength(2);
    const fsharps = mel.events.filter((e) => !e.rest);
    // mínima pontuada | semínima ligada → semínima no compasso seguinte (continuação)
    expect(fsharps.map((e) => e.accidental)).toEqual([1, null, null]);
    expect(fsharps.map((e) => e.tiedFromPrev)).toEqual([false, false, true]);
    expect(mel.materialKey).toBe('obra:t');
  });

  it('notas marcadas no braço guardam corda e casa e viram a digitação', () => {
    const notes = [noteAt({ string: 2, fret: 1 }, inst, 4), noteAt({ string: 3, fret: 0 }, inst, 4)];
    expect(notes[0]!.written).toBe(72); // Dó5 escrito (soa Dó4)
    const mel = buildScoreMelody(def({ measures: splitIntoMeasures(notes, { num: 2, den: 4 }) }), inst);
    expect(mel.fingering.notes.map((f) => f.loc)).toEqual([
      { string: 2, fret: 1 },
      { string: 3, fret: 0 },
    ]);
  });

  it('recusa nota fora da extensão do violão', () => {
    expect(() => buildScoreMelody(def({ measures: [[{ units: 4, rest: false, written: 30 }]] }), inst)).toThrow(/extensão/);
  });
});

describe('tablatura em texto', () => {
  const tab = `Intro
e|-------0-----|-----------|
B|-----1---1---|---3-------|
G|---2---------|-----2-----|
D|-0-----------|-------0---|
A|-------------|-----------|
E|-------------|-----------|`;

  it('lê as casas em ordem e respeita casas de 2 dígitos', () => {
    const r = parseTab(tab, inst, 4, { num: 4, den: 4 });
    const locs = r.measures.flat().map((n) => n.loc);
    expect(locs).toEqual([
      { string: 4, fret: 0 },
      { string: 3, fret: 2 },
      { string: 2, fret: 1 },
      { string: 1, fret: 0 },
      { string: 2, fret: 1 },
      { string: 2, fret: 3 },
      { string: 3, fret: 2 },
      { string: 4, fret: 0 },
    ]);
    expect(r.measures).toHaveLength(2);
    const r2 = parseTab('e|--12--10--|\nB|--------|\nG|--------|\nD|--------|\nA|--------|\nE|--------|', inst, 2, { num: 2, den: 4 });
    expect(r2.measures.flat().map((n) => n.loc!.fret)).toEqual([12, 10]);
  });

  it('acorde vira a nota mais aguda', () => {
    const r = parseTab('e|--0--|\nB|--1--|\nG|--0--|\nD|--2--|\nA|--3--|\nE|-----|', inst, 4, { num: 4, den: 4 });
    expect(r.measures.flat()).toHaveLength(1);
    expect(r.measures[0]![0]!.loc).toEqual({ string: 1, fret: 0 });
    expect(r.warnings.join(' ')).toMatch(/acorde/);
  });

  it('explica quando não há tablatura', () => {
    expect(() => parseTab('Dó Ré Mi', inst, 4, { num: 4, den: 4 })).toThrow(/tablatura/);
  });
});

describe('MusicXML', () => {
  const xml = (clef: string, notes: string, time = '<time><beats>3</beats><beat-type>4</beat-type></time>') => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Estudo &amp; Valsa</work-title></work>
  <part-list><score-part id="P1"><part-name>Violão</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions><key><fifths>1</fifths></key>${time}${clef}</attributes>
      ${notes}
    </measure>
  </part>
</score-partwise>`;
  const note = (step: string, oct: number, dur: number, extra = '') => `<note><pitch><step>${step}</step><octave>${oct}</octave></pitch><duration>${dur}</duration><voice>1</voice>${extra}</note>`;

  it('lê o parser XML com entidades e comentários', () => {
    const d = parseXml('<a x="1"><!-- c --><b>Dó &amp; Ré</b><c/></a>');
    expect(d.children[0]!.children.map((c) => c.name)).toEqual(['b', 'c']);
    expect(d.children[0]!.children[0]!.text).toBe('Dó & Ré');
  });

  it('clave de Sol 8 (altura soante) vira altura escrita uma oitava acima', () => {
    const clef = '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>';
    const s = parseMusicXml(xml(clef, note('E', 2, 2) + note('G', 3, 2) + note('B', 3, 2)), inst);
    expect(s.title).toBe('Estudo & Valsa');
    expect(s.fifths).toBe(1);
    expect(s.meter).toEqual({ num: 3, den: 4 });
    expect(s.measures[0]!.map((n) => n.written)).toEqual([52, 67, 71]); // Mi3, Sol4, Si4 escritos
  });

  it('acordes ficam com a nota mais aguda; tablatura vira digitação', () => {
    const tech = '<notations><technical><string>2</string><fret>1</fret></technical></notations>';
    const s = parseMusicXml(
      xml('<clef><sign>G</sign><line>2</line></clef>', note('E', 4, 2) + `<note><chord/><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice>${tech}</note>` + note('D', 5, 4)),
      inst,
    );
    expect(s.measures[0]!.map((n) => n.written)).toEqual([72, 74]);
    expect(s.measures[0]![0]!.loc).toEqual({ string: 2, fret: 1 });
    expect(s.warnings.join(' ')).toMatch(/acorde/);
  });

  it('recusa quiálteras com mensagem clara', () => {
    const t = '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';
    expect(() => parseMusicXml(xml('', note('E', 4, 2, t)), inst)).toThrow(/quiálteras/);
  });
});

describe('avaliação para solfejo', () => {
  it('sem oitava, cantar uma oitava acima conta como certo', () => {
    const exp = [{ onsetMs: 0, sounding: 60 }];
    expect(evaluateReading(exp, [{ tMs: 10, sounding: 72 }], 1000, 150, 1000).perNote[0]!.status).toBe('wrong-pitch');
    expect(evaluateReading(exp, [{ tMs: 10, sounding: 72 }], 1000, 150, 1000, true).perNote[0]!.status).toBe('ok');
  });
});
