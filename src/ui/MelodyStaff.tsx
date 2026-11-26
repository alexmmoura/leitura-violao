import { useEffect, useRef, useState } from 'react';
import VexFlow, { Accidental, Annotation, AnnotationVerticalJustify, Barline, Beam, Dot, Formatter, Fraction, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow/bravura';
import { melodyMeter, type Melody } from '../core/melody/melody';
import { figureFor, isCompound, measureSize, meterLabel } from '../core/rhythm/rhythm';
import { vexKeySpec } from '../core/theory/keySignature';
import { toVexKey, vexAccidental } from '../core/theory/pitch';
import { crispLines } from './staffLook';

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
  /** Clique numa nota JÁ RESPONDIDA (certa, errada ou amarela): recebe o índice do evento. */
  onNoteClick?: (eventIndex: number) => void;
  /** Evento destacado (nota que está sendo revista). */
  selected?: number | null;
  /**
   * Janela que acompanha a leitura: a pauta mostra só 1 ou 2 linhas (a da nota da vez
   * no topo) e rola sozinha, para o braço ficar logo abaixo sem rolar a página.
   */
  follow?: boolean;
  /** Avisa se a partitura é mais alta que a janela de acompanhamento (true = vale a pena usar). */
  onTall?: (tall: boolean) => void;
}

const fontsReady = VexFlow.loadFonts('Bravura', 'Academico').catch(() => undefined);
const PER_LINE = 4;
const FIRST_W = 110;
const MEASURE_W = 230;
/** Nas telas de prática o compasso é desenhado mais estreito e a pauta tem TAMANHO FIXO e grande (como nos apps de leitura): */
const MEASURE_W_FIT = 180;
/** pixels de tela por unidade do desenho: espaço entre linhas = 10 × 1,5 = 15 px. */
const FIT_SCALE = 1.5;
/** Altura de cada linha de pauta no desenho (unidades). */
const LINE_H = 150;
/** Linhas visíveis na janela de acompanhamento: até 2, ocupando no máximo metade da altura da tela. */
const followLines = (linePx: number) => Math.max(1, Math.min(2, Math.floor((window.innerHeight * 0.5) / linePx)));

export default function MelodyStaff({ melody, marks, showFingering = false, label, fit = false, onNoteClick, selected = null, follow = false, onTall }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [perLine, setPerLine] = useState(PER_LINE);
  useEffect(() => {
    const el = host.current;
    if (!fit || !el) return;
    // quantos compassos cabem por linha SEM encolher a pauta (no celular pode ser 1)
    const calc = () => setPerLine(Math.max(1, Math.min(PER_LINE, Math.floor((el.clientWidth / FIT_SCALE - FIRST_W - 30) / MEASURE_W_FIT))));
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
  const clickRef = useRef(onNoteClick);
  clickRef.current = onNoteClick;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const followRef = useRef(follow);
  followRef.current = follow;
  const tallRef = useRef(onTall);
  tallRef.current = onTall;
  /** Linha (0, 1, …) de cada evento e medidas do último desenho. */
  const lineOf = useRef<number[]>([]);
  const layout = useRef<{ width: number; lines: number } | null>(null);
  /** Pixels de tela de uma linha de pauta (depende da largura em que o svg foi desenhado). */
  const linePx = () => {
    const svg = host.current?.querySelector('svg');
    const L = layout.current;
    if (!svg || !L) return null;
    return (LINE_H * svg.getBoundingClientRect().width) / L.width;
  };
  /** Liga/desliga a janela de acompanhamento e rola até a linha da nota da vez. */
  const applyFollow = (currentIdx: number | null, smooth = true) => {
    const el = host.current;
    const px = linePx();
    const L = layout.current;
    if (!el || px === null || !L) return;
    const vis = followLines(px);
    tallRef.current?.(L.lines > vis);
    if (!followRef.current || L.lines <= vis) {
      el.classList.remove('is-follow');
      el.style.maxHeight = '';
      return;
    }
    const cs = getComputedStyle(el);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    el.classList.add('is-follow');
    el.style.maxHeight = `${Math.round(vis * px + (10 * px) / LINE_H + pad)}px`;
    if (currentIdx !== null) el.scrollTo({ top: (lineOf.current[currentIdx] ?? 0) * px, behavior: smooth ? 'smooth' : 'auto' });
  };
  const applyMarks = () => {
    let current: SVGElement | null = null;
    let currentIdx: number | null = null;
    noteEls.current.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('mel-current', 'mel-ok', 'mel-bad', 'mel-warn', 'mel-masked', 'mel-clickable', 'mel-selected');
      const mark = marksRef.current?.get(i);
      if (mark) el.classList.add(`mel-${mark}`);
      const clickable = !!clickRef.current && (mark === 'ok' || mark === 'bad' || mark === 'warn');
      if (clickable) el.classList.add('mel-clickable');
      el.style.pointerEvents = clickable ? 'auto' : '';
      if (i === selectedRef.current) el.classList.add('mel-selected');
      if (mark === 'current') {
        current = el;
        currentIdx = i;
      }
    });
    if (followRef.current) {
      // a janela rola sozinha; sem nota da vez, fica onde o usuário deixou
      applyFollow(currentIdx);
      return;
    }
    applyFollow(null);
    // músicas longas: mantém a nota atual à vista
    (current as SVGElement | null)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  useEffect(applyMarks, [marks, selected, onNoteClick, follow]);
  useEffect(() => {
    // a altura da janela depende da altura da tela
    const onResize = () => applyFollow(null, false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const per = fit ? MEASURE_W_FIT : MEASURE_W;
        // compasso incompleto (anacruse) fica mais estreito, proporcional ao que tem dentro
        const fullSize = measureSize(melodyMeter(c));
        const widthOf = (mi: number) => {
          const u = measures[mi]!.reduce((s, x) => s + x.e.units, 0);
          return per * Math.max(0.45, Math.min(1, u / fullSize));
        };
        let width = 0;
        for (let mi = 0; mi < c.measures; mi++) {
          const col = mi % PER_LINE;
          const lineW = Array.from({ length: Math.min(PER_LINE, c.measures - (mi - col)) }, (_, k) => widthOf(mi - col + k)).reduce((a, b) => a + b, 0);
          width = Math.max(width, first + lineW + 20);
        }
        const lineH = LINE_H;
        const height = lines * lineH + 10;
        const renderer = new Renderer(el, Renderer.Backends.SVG);
        renderer.resize(width, height);
        const ctx = renderer.getContext();
        ctx.setFillStyle('currentColor');
        ctx.setStrokeStyle('currentColor');
        const meter = melodyMeter(c);
        const unitsPerBeatValue = 16 / meter.den;
        // agrupamento das barras de colcheia: por tempo (semínima) nos simples; por 3 colcheias nos compostos e no 3/8
        const groups = isCompound(meter) || (meter.num === 3 && meter.den === 8) ? [new Fraction(3, 8)] : undefined;
        const drawn: { sn: StaveNote; line: number }[] = [];
        noteEls.current = [];
        lineOf.current = [];
        layout.current = { width, lines };

        measures.forEach((m, mi) => {
          const line = Math.floor(mi / PER_LINE);
          const col = mi % PER_LINE;
          const isFirst = col === 0;
          // o 1º compasso de cada linha é mais largo (clave e armadura)
          let before = 0;
          for (let k = mi - col; k < mi; k++) before += widthOf(k);
          const x = isFirst ? 10 : 10 + first + before;
          const w = isFirst ? first + widthOf(mi) : widthOf(mi);
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
            // linhas suplementares mais grossas e um pouco mais compridas, para dar para contar
            sn.renderOptions.strokePx = 5;
            sn.setLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 1.6 });
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
          // as pausas entram na lista para INTERROMPER a barra (como na partitura impressa)
          const beams = Beam.generateBeams(
            notes.map((n) => n.sn),
            { beamRests: false, ...(groups ? { groups } : {}) },
          );
          new Formatter().joinVoices([voice]).format([voice], w - (stave.getNoteStartX() - stave.getX()) - 20);
          voice.draw(ctx, stave);
          for (const b of beams) b.setContext(ctx).draw();
          for (const { sn, i } of notes) {
            const g = sn.getSVGElement() ?? null;
            noteEls.current[i] = g;
            lineOf.current[i] = line;
            // só responde quando a nota está marcada como clicável (ver applyMarks)
            g?.addEventListener('click', () => g.classList.contains('mel-clickable') && clickRef.current?.(i));
          }
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
          // tamanho fixo: a pauta não encolhe nem estica com a janela (fica nítida e sempre do mesmo tamanho)
          if (fit) {
            svg.style.width = `${Math.round(width * FIT_SCALE)}px`;
            svg.style.maxWidth = '100%';
            svg.classList.add('is-fit');
          }
          crispLines(svg);
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
