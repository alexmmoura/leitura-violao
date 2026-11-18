import { useEffect, useRef, useState } from 'react';
import VexFlow, { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow/bravura';
import { vexKeySpec, type Fifths } from '../core/theory/keySignature';
import { crispLines, cssColor } from './staffLook';
import { LETTERS, spelledToMidi, toVexKey, vexAccidental, type Alter, type Letter, type SpelledPitch } from '../core/theory/pitch';

/**
 * Pauta (adaptador VexFlow) — especificação §12.3.
 * O VexFlow só DESENHA: recebe altura ESCRITA já grafada e o acidente a exibir,
 * calculados pelo núcleo de domínio. Nenhuma teoria musical é feita aqui.
 *
 * Com `onPick`, cada linha/espaço vira uma área clicável (CA-NOT-2): a altura é
 * identificada pela posição que o próprio VexFlow usa para desenhar a nota.
 */
export type NoteTone = 'normal' | 'ok' | 'bad' | 'accent';

export interface StaffNote {
  readonly pitch: SpelledPitch;
  /** Acidente a desenhar (null = nenhum; 0 = bequadro). */
  readonly accidental: Alter | null;
  readonly tone?: NoteTone;
}

interface Props {
  fifths: Fifths;
  notes: readonly StaffNote[];
  /** Chamado após a pintura (para iniciar o cronômetro, §7.1). */
  onRendered?: () => void;
  /** Torna linhas e espaços clicáveis (letra + oitava ESCRITAS). */
  onPick?: (letter: Letter, octave: number) => void;
  /** Desenha todas as notas empilhadas numa só haste (acorde). */
  chord?: boolean;
  label?: string;
}

const fontsReady = VexFlow.loadFonts('Bravura', 'Academico').catch(() => undefined);

const WIDTH = 300;
const HEIGHT = 190;
/** Faixa clicável: Mi3 escrito (corda 6 solta) até Si6 escrito. */
const PICK_FROM = 3 * 7 + 2;
const PICK_TO = 6 * 7 + 6;
const SVG_NS = 'http://www.w3.org/2000/svg';

function toneColor(el: Element, tone: NoteTone | undefined): string | null {
  if (!tone || tone === 'normal') return null;
  return cssColor(el, tone === 'ok' ? '--ok' : tone === 'bad' ? '--bad' : '--accent', '') || null;
}

/** Linhas suplementares em destaque: mais grossas, mais compridas e na cor de realce, para dar para contar. */
function boldLedger(sn: StaveNote, color: string): void {
  sn.renderOptions.strokePx = 8;
  sn.setLedgerLineStyle({ strokeStyle: color, lineWidth: 2.2 });
}

export default function Staff({ fifths, notes, onRendered, onPick, chord = false, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [error, setError] = useState<string | null>(null);
  const pickable = !!onPick;

  useEffect(() => {
    let cancelled = false;
    fontsReady.then(() => {
      const el = host.current;
      if (cancelled || !el) return;
      el.innerHTML = '';
      try {
        const ledgerColor = cssColor(el, '--accent', 'currentColor');
        const renderer = new Renderer(el, Renderer.Backends.SVG);
        renderer.resize(WIDTH, HEIGHT);
        const ctx = renderer.getContext();
        ctx.setFillStyle('currentColor');
        ctx.setStrokeStyle('currentColor');

        const stave = new Stave(10, 45, WIDTH - 20);
        stave.addClef('treble', 'default', '8vb');
        stave.addKeySignature(vexKeySpec(fifths));
        stave.setContext(ctx).draw();

        if (notes.length > 0 && chord) {
          // acorde: uma haste, teclas em ordem de altura, acidente por tecla
          const sorted = [...notes].sort((a, b) => spelledToMidi(a.pitch) - spelledToMidi(b.pitch));
          const sn = new StaveNote({ keys: sorted.map((n) => toVexKey(n.pitch)), duration: 'w', clef: 'treble' });
          boldLedger(sn, ledgerColor);
          sorted.forEach((n, i) => {
            if (n.accidental !== null) sn.addModifier(new Accidental(vexAccidental(n.accidental)), i);
          });
          const voice = new Voice({ numBeats: 4, beatValue: 4 });
          voice.addTickables([sn]);
          new Formatter().joinVoices([voice]).format([voice], WIDTH - 20 - (stave.getNoteStartX() - 10) - 30);
          voice.draw(ctx, stave);
        } else if (notes.length > 0) {
          const staveNotes = notes.map((n) => {
            const sn = new StaveNote({ keys: [toVexKey(n.pitch)], duration: 'w', clef: 'treble' });
            boldLedger(sn, ledgerColor);
            if (n.accidental !== null) sn.addModifier(new Accidental(vexAccidental(n.accidental)), 0);
            const color = toneColor(el, n.tone);
            if (color) sn.setStyle({ fillStyle: color, strokeStyle: color });
            return sn;
          });
          const voice = new Voice({ numBeats: 4 * staveNotes.length, beatValue: 4 });
          voice.addTickables(staveNotes);
          new Formatter().joinVoices([voice]).format([voice], WIDTH - 20 - (stave.getNoteStartX() - 10) - 30);
          voice.draw(ctx, stave);
        }

        const svg = el.querySelector('svg');
        if (svg) {
          svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.width = '';
          svg.style.height = '';
          svg.setAttribute('fill', 'currentColor');
          svg.setAttribute('stroke', 'currentColor');
          svg.setAttribute('role', pickable ? 'group' : 'img');
          svg.setAttribute('aria-label', label ?? 'Pauta');
          crispLines(svg);

          if (pickable) {
            svg.setAttribute('pointer-events', 'auto');
            const half = stave.getSpacingBetweenLines() / 2;
            const x = stave.getNoteStartX();
            const w = stave.getNoteEndX() - x;
            const layer = document.createElementNS(SVG_NS, 'g');
            layer.setAttribute('class', 'staff-pick');
            for (let d = PICK_FROM; d <= PICK_TO; d++) {
              const letter = LETTERS[d % 7]!;
              const octave = Math.floor(d / 7);
              const line = VexFlow.keyProperties(toVexKey({ letter, alter: 0, octave }), 'treble').line as number;
              const y = stave.getYForNote(line);
              const r = document.createElementNS(SVG_NS, 'rect');
              r.setAttribute('x', String(x));
              r.setAttribute('y', String(y - half / 2));
              r.setAttribute('width', String(w));
              r.setAttribute('height', String(half));
              r.setAttribute('data-pitch', `${letter}${octave}`);
              r.setAttribute('aria-label', `${letter}${octave}`);
              r.addEventListener('click', () => pickRef.current?.(letter, octave));
              layer.appendChild(r);
            }
            svg.appendChild(layer);
          }
        }
        setError(null);
        requestAnimationFrame(() => !cancelled && onRendered?.());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fifths, notes, onRendered, label, pickable, chord]);

  return (
    <div className={`staff${pickable ? ' is-pickable' : ''}`}>
      <div ref={host} className="staff-host" />
      {error && <p className="staff-error">Erro ao desenhar a pauta: {error}</p>}
    </div>
  );
}
