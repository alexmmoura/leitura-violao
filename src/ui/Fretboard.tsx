import { memo, useMemo, useRef } from 'react';
import { soundingAt, type FretLocation, type Instrument } from '../core/instrument/instrument';
import type { FretWindow } from '../core/instrument/position';
import { letterName, alterSymbol } from '../core/theory/pitch';
import { preferredSpelling } from '../core/theory/spelling';
import type { Settings } from '../data/settings';

/**
 * Braço virtual em SVG próprio — especificação §4.4 e §12.4.
 */
export type MarkKind = 'valid' | 'correct' | 'wrong' | 'selected' | 'muted';
export interface Mark {
  readonly loc: FretLocation;
  readonly kind: MarkKind;
  readonly label?: string;
}

/** Célula do mapa de calor: classe CSS (estado/escala), opacidade e dica. */
export interface HeatCell {
  readonly cls: string;
  readonly opacity?: number;
  readonly title?: string;
}

interface Props {
  inst: Instrument;
  /** Mapa de calor por célula (chave "corda:casa"). */
  heat?: ReadonlyMap<string, HeatCell>;
  settings: Pick<Settings, 'leftHanded' | 'string1OnTop' | 'spacing' | 'showNoteNames' | 'naming'>;
  window?: FretWindow | null;
  marks?: readonly Mark[];
  requiredString?: number;
  pendingString?: number | null;
  /** `timeStamp` = event.timeStamp (relógio do performance.now), para avaliar o tempo do clique. */
  onCellClick?: (loc: FretLocation, timeStamp: number) => void;
  disabled?: boolean;
}

const W = 1200;
const H = 230;
const LABEL_W = 34;
const OPEN_W = 46;
const TOP = 26;
const BOTTOM = H - 44;
const SINGLE_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_MARKERS = [12, 24];

function Fretboard({ inst, settings, heat, window: win, marks = [], requiredString, pendingString, onCellClick, disabled }: Props) {
  const n = inst.frets;
  const nStrings = inst.strings.length;
  /**
   * Toque na tela (dedo/caneta): só vale ao SOLTAR sem ter arrastado. Assim, deslizar o
   * braço para os lados não marca nota. Com o mouse, vale na hora (o tempo conta) — a não
   * ser que o braço não caiba na tela: aí o mouse também arrasta o braço para os lados
   * (como o dedo) e a nota vale ao soltar sem ter arrastado.
   */
  const touch = useRef<{ loc: FretLocation; x: number; y: number; t: number; id: number; mouse?: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const TAP_SLOP = 10;
  const nut = LABEL_W + OPEN_W;
  const boardLen = W - nut - 14;

  const fretX = useMemo(() => {
    const xs: number[] = [];
    const total = 1 - Math.pow(2, -n / 12);
    for (let f = 0; f <= n; f++) {
      xs.push(settings.spacing === 'uniform' ? nut + (boardLen * f) / n : nut + (boardLen * (1 - Math.pow(2, -f / 12))) / total);
    }
    return xs;
  }, [n, settings.spacing, nut, boardLen]);

  const X = (x: number) => (settings.leftHanded ? W - x : x);
  const gap = (BOTTOM - TOP) / (nStrings - 1);
  const stringY = (s: number) => (settings.string1OnTop ? TOP + (s - 1) * gap : TOP + (nStrings - s) * gap);
  const cellCenter = (fret: number) => (fret === 0 ? nut - OPEN_W / 2 : (fretX[fret - 1]! + fretX[fret]!) / 2);
  const cellBounds = (fret: number): [number, number] => (fret === 0 ? [LABEL_W, nut] : [fretX[fret - 1]!, fretX[fret]!]);

  const rect = (x1: number, x2: number) => {
    const a = X(x1);
    const b = X(x2);
    return { x: Math.min(a, b), width: Math.abs(b - a) };
  };

  const midY = (TOP + BOTTOM) / 2;
  const noteLabel = (loc: FretLocation) => {
    const p = preferredSpelling(soundingAt(loc, inst) - inst.transposition);
    return `${letterName(p.letter, settings.naming)}${alterSymbol(p.alter)}`;
  };

  return (
    <div
      ref={scroller}
      className="fb-scroll"
      onPointerMove={(e) => {
        const t = touch.current;
        if (t?.mouse !== undefined && t.id === e.pointerId && scroller.current) scroller.current.scrollLeft = t.mouse - (e.clientX - t.x);
      }}
      onPointerUp={() => (touch.current = null)}
      onPointerLeave={() => (touch.current = null)}
    >
    <svg
      className={`fretboard${disabled ? ' is-disabled' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label="Braço do violão"
    >
      <defs>
        <pattern id="hm-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="hm-hatch-line" />
        </pattern>
      </defs>
      {/* madeira */}
      <rect {...rect(nut, fretX[n]!)} y={TOP - 14} height={BOTTOM - TOP + 28} className="fb-wood" rx={3} />

      {/* mapa de calor */}
      {heat &&
        inst.strings.map((_, i) =>
          Array.from({ length: n + 1 }, (_, f) => {
            const cell = heat.get(`${i + 1}:${f}`);
            if (!cell) return null;
            const [x1, x2] = cellBounds(f);
            return (
              <rect
                key={`h${i}-${f}`}
                {...rect(x1 + 1.5, x2 - 1.5)}
                y={stringY(i + 1) - gap / 2 + 2}
                height={gap - 4}
                rx={4}
                className={`hm ${cell.cls}`}
                style={cell.opacity !== undefined ? { fillOpacity: cell.opacity } : undefined}
              >
                {cell.title && <title>{cell.title}</title>}
              </rect>
            );
          }),
        )}

      {/* janela de posição: estendida (clara) e base (escura) */}
      {win && win.max >= win.min && (
        <>
          <rect {...rect(fretX[win.min - 1]!, fretX[win.max]!)} y={TOP - 14} height={BOTTOM - TOP + 28} className="fb-window-ext" />
          <rect {...rect(fretX[win.baseMin - 1]!, fretX[win.baseMax]!)} y={TOP - 14} height={BOTTOM - TOP + 28} className="fb-window" />
        </>
      )}

      {/* marcadores */}
      {SINGLE_MARKERS.filter((f) => f <= n).map((f) => (
        <circle key={`m${f}`} cx={X(cellCenter(f))} cy={midY} r={7} className="fb-marker" />
      ))}
      {DOUBLE_MARKERS.filter((f) => f <= n).map((f) => (
        <g key={`d${f}`}>
          <circle cx={X(cellCenter(f))} cy={TOP + gap * 1.5} r={7} className="fb-marker" />
          <circle cx={X(cellCenter(f))} cy={BOTTOM - gap * 1.5} r={7} className="fb-marker" />
        </g>
      ))}

      {/* trastes e pestana */}
      {fretX.map((x, f) => (
        <line key={`f${f}`} x1={X(x)} x2={X(x)} y1={TOP - 14} y2={BOTTOM + 14} className={f === 0 ? 'fb-nut' : 'fb-fret'} />
      ))}

      {/* corda exigida */}
      {requiredString && (
        <rect {...rect(LABEL_W, fretX[n]!)} y={stringY(requiredString) - gap / 2 + 2} height={gap - 4} className="fb-required" rx={4} />
      )}
      {pendingString && (
        <rect {...rect(LABEL_W, fretX[n]!)} y={stringY(pendingString) - gap / 2 + 2} height={gap - 4} className="fb-pending" rx={4} />
      )}

      {/* cordas */}
      {inst.strings.map((s, i) => {
        const y = stringY(i + 1);
        return (
          <g key={`s${i}`}>
            <line x1={X(nut - OPEN_W + 4)} x2={X(fretX[n]!)} y1={y} y2={y} className="fb-string" strokeWidth={1.4 + s.gauge * 1.1} />
            <text x={X(LABEL_W / 2)} y={y + 4} className="fb-label" textAnchor="middle">
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* números das casas */}
      {Array.from({ length: n + 1 }, (_, f) => (
        <text key={`n${f}`} x={X(cellCenter(f))} y={H - 14} className={`fb-fretnum${SINGLE_MARKERS.includes(f) || DOUBLE_MARKERS.includes(f) ? ' is-marked' : ''}`} textAnchor="middle">
          {f}
        </text>
      ))}

      {/* nomes das notas (modo "todas as notas") */}
      {settings.showNoteNames &&
        inst.strings.map((_, i) =>
          Array.from({ length: n + 1 }, (_, f) => {
            const loc = { string: i + 1, fret: f };
            return (
              <text key={`t${i}-${f}`} x={X(cellCenter(f))} y={stringY(i + 1) + 4} className="fb-name" textAnchor="middle">
                {noteLabel(loc)}
              </text>
            );
          }),
        )}

      {/* áreas clicáveis */}
      {onCellClick &&
        inst.strings.map((_, i) =>
          Array.from({ length: n + 1 }, (_, f) => {
            const [x1, x2] = cellBounds(f);
            const loc = { string: i + 1, fret: f };
            return (
              <rect
                key={`c${i}-${f}`}
                {...rect(x1, x2)}
                y={stringY(i + 1) - gap / 2}
                height={gap}
                className="fb-cell"
                aria-label={f === 0 ? `corda ${i + 1} solta` : `corda ${i + 1}, casa ${f}`}
                onPointerDown={
                  disabled
                    ? undefined
                    : (e) => {
                        const sc = scroller.current;
                        const scrollable = !!sc && sc.scrollWidth > sc.clientWidth + 1;
                        if (e.pointerType === 'mouse' && !scrollable) return onCellClick(loc, e.timeStamp);
                        touch.current = { loc, x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, mouse: e.pointerType === 'mouse' ? sc!.scrollLeft : undefined };
                        if (e.pointerType === 'mouse') e.preventDefault();
                      }
                }
                onPointerUp={
                  disabled
                    ? undefined
                    : (e) => {
                        const t = touch.current;
                        touch.current = null;
                        if (!t || t.id !== e.pointerId || Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP) return;
                        onCellClick(t.loc, t.t);
                      }
                }
                onPointerCancel={() => (touch.current = null)}
              />
            );
          }),
        )}

      {/* marcas (por cima das áreas clicáveis, sem capturar o ponteiro) */}
      {marks.map((m, k) => (
        <g key={`k${k}`} className={`fb-mark is-${m.kind}`}>
          <circle cx={X(cellCenter(m.loc.fret))} cy={stringY(m.loc.string)} r={m.label && m.label.length > 1 ? 16 : 12} />
          {m.label && (
            <text x={X(cellCenter(m.loc.fret))} y={stringY(m.loc.string) + 4} textAnchor="middle">
              {m.label}
            </text>
          )}
        </g>
      ))}
    </svg>
    </div>
  );
}

export default memo(Fretboard);
