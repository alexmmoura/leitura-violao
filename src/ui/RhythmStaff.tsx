import { useEffect, useRef, useState } from 'react';
import VexFlow, { Barline, Beam, Dot, Formatter, Fraction, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow/bravura';
import { figureFor, isCompound, meterLabel, toMeter, type MeterLike, type RhythmEvent } from '../core/rhythm/rhythm';
import { crispLines, cssColor } from './staffLook';

/**
 * Pauta rítmica (adaptador VexFlow): notas na linha central, fórmula de compasso
 * (simples ou composta), colcheias agrupadas pelo tempo (de 3 em 3 nos compostos)
 * e ligaduras de prolongamento, inclusive sobre a barra.
 */
interface Props {
  measures: readonly (readonly RhythmEvent[])[];
  /** Fórmula de compasso; número = n/4 (formato antigo). */
  meter: MeterLike;
  /** Desenhar o compasso mesmo incompleto (pergunta "está completo?"). */
  allowIncomplete?: boolean;
  /** Índice do evento destacado (em ordem global), ou null. */
  highlight?: number | null;
  label?: string;
}

const fontsReady = VexFlow.loadFonts('Bravura', 'Academico').catch(() => undefined);

export default function RhythmStaff({ measures, meter, allowIncomplete, highlight = null, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const m = toMeter(meter);
  const meterKey = meterLabel(m);

  useEffect(() => {
    let cancelled = false;
    fontsReady.then(() => {
      const el = host.current;
      if (cancelled || !el) return;
      el.innerHTML = '';
      try {
        const per = 250;
        const first = 70;
        const width = first + per * measures.length + 20;
        const height = 130;
        const renderer = new Renderer(el, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const ctx = renderer.getContext();
        ctx.setFillStyle('currentColor');
        ctx.setStrokeStyle('currentColor');
        const accent = cssColor(el, '--accent', '#2f5d8a');
        const unitsPerBeatValue = 16 / m.den;
        const groups = isCompound(m) ? [new Fraction(3, 8)] : undefined;

        let x = 10;
        let globalIdx = 0;
        const all: { sn: StaveNote; ev: RhythmEvent }[] = [];
        measures.forEach((meas, mi) => {
          const w = mi === 0 ? first + per : per;
          const stave = new Stave(x, 10, w);
          if (mi === 0) stave.addClef('percussion').addTimeSignature(meterKey);
          if (mi === measures.length - 1) stave.setEndBarType(Barline.type.END);
          stave.setContext(ctx).draw();

          const notes = meas.map((e) => {
            const f = figureFor(e.units);
            const sn = new StaveNote({ keys: ['b/4'], duration: `${f.vex}${e.rest ? 'r' : ''}`, dots: f.dotted ? 1 : 0, clef: 'percussion' });
            if (f.dotted) Dot.buildAndAttach([sn], { all: true });
            if (globalIdx === highlight) sn.setStyle({ fillStyle: accent, strokeStyle: accent });
            globalIdx++;
            all.push({ sn, ev: e });
            return sn;
          });
          const units = meas.reduce((s, e) => s + e.units, 0);
          const voice = new Voice({ numBeats: units / unitsPerBeatValue, beatValue: m.den });
          if (allowIncomplete) voice.setMode(Voice.Mode.SOFT);
          voice.addTickables(notes);
          const beams = Beam.generateBeams(notes.filter((n) => !n.isRest()), groups ? { groups } : undefined);
          new Formatter().joinVoices([voice]).format([voice], w - (stave.getNoteStartX() - x) - 20);
          voice.draw(ctx, stave);
          for (const b of beams) b.setContext(ctx).draw();
          x += w;
        });

        // ligaduras de prolongamento (a nota ligada continua soando, sem novo ataque)
        for (let i = 0; i < all.length - 1; i++) {
          if (all[i]!.ev.tie && !all[i]!.ev.rest && !all[i + 1]!.ev.rest) {
            new StaveTie({ firstNote: all[i]!.sn, lastNote: all[i + 1]!.sn, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
          }
        }

        const svg = el.querySelector('svg');
        if (svg) {
          svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
          crispLines(svg);
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.width = '';
          svg.style.height = '';
          svg.setAttribute('fill', 'currentColor');
          svg.setAttribute('stroke', 'currentColor');
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', label ?? 'Pauta rítmica');
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measures, meterKey, allowIncomplete, highlight, label]);

  return (
    <div className="rhythm-staff">
      <div ref={host} className="rhythm-host" />
      {error && <p className="staff-error">Erro ao desenhar o ritmo: {error}</p>}
    </div>
  );
}
