import { useState } from 'react';
import { DEGREE_LABEL } from '../core/harmony/ear';
import { VOICING_LABEL, type VoicingType } from '../core/harmony/voicing';
import { KIND_INFO, kindOfKc } from '../core/learning/kinds';
import { parseKcId, parsePositionKey } from '../core/learning/kc';
import { parseMaterialKey } from '../core/melody/melody';
import { pieceById } from '../core/repertoire/pieces';
import { positionLabel } from '../core/instrument/position';
import { figureName, LEVEL_LABEL } from '../core/rhythm/rhythm';
import { INVERSION_LABEL, QUALITY_LABEL, type ChordQuality } from '../core/theory/chords';
import { intervalName, parseIntervalCode } from '../core/theory/intervals';
import { keyLabel } from '../core/theory/keySignature';
import { pitchName, type Naming } from '../core/theory/pitch';

/**
 * Fila de revisão de um módulo (itens vencidos do FSRS, menor R primeiro).
 * O módulo gera cada questão FORÇADA para o item atual; ao terminar, volta ao normal.
 */
export interface ReviewProps {
  review?: string[];
  onReviewDone?: () => void;
}

export function useReviewQueue(review: string[] | undefined) {
  const [idx, setIdx] = useState(0);
  const total = review?.length ?? 0;
  const active = !!review && idx < total;
  return {
    current: active ? review![idx]! : null,
    index: idx,
    total,
    active,
    finished: !!review && total > 0 && idx >= total,
    advance: () => setIdx((i) => i + 1),
  };
}

export function ReviewBanner({ q, naming, onExit }: { q: ReturnType<typeof useReviewQueue>; naming: Naming; onExit?: () => void }) {
  if (!q.total) return null;
  if (q.finished)
    return (
      <div className="review-banner is-done" role="status">
        ✓ Revisões deste módulo concluídas ({q.total}). Agora é prática livre.
        {onExit && (
          <button type="button" className="btn-ghost" onClick={onExit}>
            Voltar a Meu treinamento
          </button>
        )}
      </div>
    );
  return (
    <div className="review-banner" role="status">
      <strong>Revisão {q.index + 1} de {q.total}</strong> · {describeKc(q.current!, naming)}
      {onExit && (
        <button type="button" className="btn-ghost" onClick={onExit}>
          Encerrar revisão
        </button>
      )}
    </div>
  );
}

/** Descrição legível de qualquer item. */
export function describeKc(id: string, naming: Naming = 'latin'): string {
  const kind = kindOfKc(id);
  if (!kind) return id;
  const ref = parseKcId(id);
  if (ref?.kind === 'staff>fretboard') {
    const pos = parsePositionKey(ref.posKey);
    return `Nota ${pitchName(ref.written, { naming })} (pauta → braço${pos ? `, ${positionLabel(pos)}` : ''})`;
  }
  if (ref?.kind === 'fretboard>staff') return `Corda ${ref.loc.string}, ${ref.loc.fret === 0 ? 'solta' : `casa ${ref.loc.fret}`} (braço → pauta)`;
  const parts = id.split(':');
  switch (kind) {
    case 'interval-name':
    case 'interval-locate': {
      const iv = parseIntervalCode(parts[1]!);
      return `${iv ? intervalName(iv) : parts[1]} ${parts[2] === 'desc' ? 'descendente' : 'ascendente'} (${kind === 'interval-name' ? 'nomear' : 'localizar no braço'})`;
    }
    case 'rhythm-figure': {
      const u = Number(parts[2]!.replace('r', ''));
      return `Duração: ${figureName({ units: u, rest: parts[2]!.endsWith('r') })}`;
    }
    case 'rhythm-measure':
      return `Compasso completo? ${LEVEL_LABEL[Number(parts[2]!.slice(1)) - 1] ?? ''} em ${parts[3]}`;
    case 'rhythm-exec':
      return `Executar ritmo nível ${parts[2]!.slice(1)} em ${parts[3]}`;
    case 'reading': {
      const c = parseMaterialKey(id.slice('leitura:'.length));
      return c ? `Frases: ${positionLabel(c.region)}${c.shiftTo ? ` → ${positionLabel(c.shiftTo)}` : ''}, ${keyLabel(c.fifths).split(' (')[0]}, ritmo ${c.rhythmLevel || 'só semínimas'}` : 'Leitura de frases';
    }
    case 'repertoire': {
      const p = pieceById(id.slice('repertorio:'.length));
      return p ? `Obra: ${p.title} (${p.composer}, nível ${p.level})` : 'Obra clássica';
    }
    case 'chord-build': {
      const q = QUALITY_LABEL[parts[1] as ChordQuality] ?? parts[1];
      const type = parts[2] && parts[2] !== 'livre' && parts[2] !== 'arpejo' ? `, ${VOICING_LABEL[parts[2] as VoicingType]}` : '';
      const inv = parts[3] && parts[3] !== 'x' ? `, ${INVERSION_LABEL[Number(parts[3])]?.split(' (')[0]}` : '';
      return `Construir acorde ${q}${type}${inv}`;
    }
    case 'chord-id':
      return `Identificar acorde ${QUALITY_LABEL[parts[1] as ChordQuality] ?? parts[1]}`;
    case 'voice-leading':
      return 'Condução de vozes II–V–I';
    case 'ear-degree':
      return `Ouvir o grau ${DEGREE_LABEL[Number(parts[1]) - 1] ?? parts[1]}`;
    case 'ear-interval': {
      const iv = parseIntervalCode(parts[1]!);
      return `Ouvir ${iv ? intervalName(iv) : parts[1]} (${parts[2] === 'harmonic' ? 'harmônico' : parts[2] === 'desc' ? 'descendente' : 'ascendente'})`;
    }
    case 'ear-chord':
      return `Ouvir acorde ${QUALITY_LABEL[parts[1] as ChordQuality] ?? parts[1]}`;
    case 'dictation':
      return `Ditado de ${parts[1]} notas`;
    default:
      return KIND_INFO[kind].label;
  }
}
