import { useEffect, useRef, useState } from 'react';
import VexFlow, { Accidental, Annotation, AnnotationVerticalJustify, Barline, Beam, Dot, Formatter, Fraction, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow/bravura';
import { melodyMeter, type Melody } from '../core/melody/melody';
import { figureFor, isCompound, meterLabel } from '../core/rhythm/rhythm';
import { vexKeySpec } from '../core/theory/keySignature';
import { toVexKey, vexAccidental } from '../core/theory/pitch';

/**
 * Pauta de melodias (adaptador VexFlow) — Módulo D.
 * Recebe a melodia já grafada pelo núcleo (alturas escritas + acidentes a desenhar).
 * Estados visuais por evento: atual, certo, errado, mascarado (janela à frente).
 */
export type EventMark = 'current' | 'ok' | 'bad' | 'warn' | 'masked';

interface Props {
  melody: Melody;
  /** Marca visual por índice de EVENTO (inclui pausas). */
  marks?: ReadonlyMap<number, EventMark>;
  /** Dedos sugeridos sob as notas. */
  showFingering?: boolean;
  label?: string;
  /** Ajusta os compassos por linha à largura disponível, para a pauta ficar GRANDE (telas de prática). */
  fit?: boolean;
}

const fontsReady = VexFlow.loadFonts('Bravura', 'Academico').catch(() => undefined);
const PER_LINE = 4;
const FIRST_W = 110;
const MEASURE_W = 230;

export default function MelodyStaff({ melody, marks, showFingering = false, label, fit = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [perLine, setPerLine] = useState(PER_LINE);
  useEffect(() => {
    const el = host.current;
    if (!fit || !el) return;
    const calc = () => setPerLine(Math.max(2, Math.min(PER_LINE, Math.floor((el.clientWidth - FIRST_W - 20) / MEASURE_W))));
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  // As marcas (cores) mudam a cada nota tocada; a pauta só é DESENHADA quando a melodia muda.
  // Trocar a cor é só trocar uma classe no elemento já desenhado: resposta visual imediata.
  const noteEls = useRef<(SVGElement | null)[]>([]);
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const applyMarks = () => {
    let current: SVGElement | null = null;
    noteEls.current.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('mel-current', 'mel-ok', 'mel-bad', 'mel-warn', 'mel-masked');
      const mark = marksRef.current?.get(i);
      if (mark) el.classList.add(`mel-${mark}`);
      if (mark === 'current') current = el;
    });
    // músicas longas: mantém a nota atual à vista
    (current as SVGElement | null)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  useEffect(applyMarks, [marks]);

  useEffect(() => {
    let cancelled = false;
    fontsReady.then(() => {
      const el = host.current;
      if (cancelled || !el) return;
      el.innerHTML = '';
      try {
        const c = melody.config;
        const measures = Array.from({ length: c.measures }, (_, mi) => melody.events.map((e, i) => ({ e, i })).filter((x) => x.e.measure === mi));
        const PER_LINE = perLine; // (sombra a constante: compassos por linha desta pauta)
        const lines = Math.ceil(c.measures / PER_LINE);
        const first = FIRST_W;
        const per = MEASURE_W;
        const width = first + per * Math.min(PER_LINE, c.measures) + 20;
        const lineH = 150;
        const height = lines * lineH + 10;
        const renderer = new Renderer(el, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const ctx = renderer.getContext();
        ctx.setFillStyle('currentColor');
        ctx.setStrokeStyle('currentColor');
        const meter = melodyMeter(c);
        const unitsPerBeatValue = 16 / meter.den;
        const groups = isCompound(meter) ? [new Fraction(3, 8)] : undefined;
        const drawn: { sn: StaveNote; line: number }[] = [];
        noteEls.current = [];

        measures.forEach((m, mi) => {
          const line = Math.floor(mi / PER_LINE);
          const col = mi % PER_LINE;
          const isFirst = col === 0;
          // o 1º compasso de cada linha é mais largo (clave e armadura)
          const x = isFirst ? 10 : 10 + first + per * col;
          const w = isFirst ? first + per : per;
          const stave = new Stave(x, 10 + line * lineH, w);
          if (isFirst) {
            stave.addClef('treble', 'default', '8vb').addKeySignature(vexKeySpec(c.fifths));
            if (mi === 0) stave.addTimeSignature(meterLabel(meter));
          }
          if (mi === c.measures - 1) stave.setEndBarType(Barline.type.END);
          stave.setContext(ctx).draw();

          const notes = m.map(({ e, i }) => {
            const f = figureFor(e.units);
            const sn = new StaveNote({
              keys: [e.rest || !e.pitch ? 'b/4' : toVexKey(e.pitch)],
              duration: `${f.vex}${e.rest ? 'r' : ''}`,
              dots: f.dotted ? 1 : 0,
              clef: 'treble',
              autoStem: true,
            });
            if (!e.rest && e.accidental !== null) sn.addModifier(new Accidental(vexAccidental(e.accidental)), 0);
            if (f.dotted) Dot.buildAndAttach([sn], { all: true });
            if (showFingering && !e.rest && e.noteIndex >= 0 && !e.tiedFromPrev) {
              const fn = melody.fingering.notes[e.noteIndex];
              if (fn) sn.addModifier(new Annotation(fn.finger === 0 ? '0' : String(fn.finger)).setVerticalJustification(AnnotationVerticalJustify.BOTTOM), 0);
            }
            drawn.push({ sn, line });
            return { sn, i };
          });
          const units = m.reduce((s, x) => s + x.e.units, 0);
          const voice = new Voice({ numBeats: units / unitsPerBeatValue, beatValue: meter.den });
          voice.addTickables(notes.map((n) => n.sn));
          const beams = Beam.generateBeams(notes.map((n) => n.sn).filter((n) => !n.isRest()), groups ? { groups } : undefined);
          new Formatter().joinVoices([voice]).format([voice], w - (stave.getNoteStartX() - stave.getX()) - 20);
          voice.draw(ctx, stave);
          for (const b of beams) b.setContext(ctx).draw();
          for (const { sn, i } of notes) noteEls.current[i] = sn.getSVGElement() ?? null;
        });

        // ligaduras de prolongamento; na troca de linha, duas meias-ligaduras
        melody.events.forEach((e, i) => {
          const next = melody.events[i + 1];
          if (!e.tie || !next || !next.tiedFromPrev) return;
          const a = drawn[i]!;
          const b = drawn[i + 1]!;
          if (a.line === b.line) {
            new StaveTie({ firstNote: a.sn, lastNote: b.sn, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
          } else {
            new StaveTie({ firstNote: a.sn, lastNote: null, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
            new StaveTie({ firstNote: null, lastNote: b.sn, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
          }
        });

        const svg = el.querySelector('svg');
        if (svg) {
          svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.width = '';
          svg.style.height = '';
          // frases curtas não devem ficar gigantes
          if (fit) svg.style.maxWidth = `${Math.round(width * 1.5)}px`;
          svg.setAttribute('fill', 'currentColor');
          svg.setAttribute('stroke', 'currentColor');
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', label ?? 'Melodia');
        }
        applyMarks();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [melody, showFingering, label, perLine, fit]);

  return (
    <div className="melody-staff">
      <div ref={host} className="melody-host" />
      {error && <p className="staff-error">Erro ao desenhar a melodia: {error}</p>}
    </div>
  );
}
