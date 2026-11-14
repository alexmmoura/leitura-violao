import { useMemo, useState } from 'react';
import { ERROR_LABEL, type ErrorCode } from '../core/exercise/validate';
import { makeGuitar } from '../core/instrument/instrument';
import { parseKcId } from '../core/learning/kc';
import { wilsonLower } from '../core/learning/metrics';
import { MASTERY_LABEL, MASTERY_ORDER, type MasteryState } from '../core/learning/model';
import { aggregateCells, cellState, groupStats, weakItems, weeklyStats, type HeatDirection } from '../core/learning/progress';
import { positionLabel } from '../core/instrument/position';
import { parsePositionKey } from '../core/learning/kc';
import { pitchName } from '../core/theory/pitch';
import { useLearningData } from '../data/learning';
import type { Settings } from '../data/settings';
import { secs } from './format';
import { describeKc } from './review';
import Fretboard, { type HeatCell } from './Fretboard';

/**
 * Estatísticas — mapa de calor do braço, estados de domínio e evolução (§8, §11).
 */
type Layer = 'state' | 'accuracy' | 'time' | 'volume' | 'due';
const LAYER_LABEL: Record<Layer, string> = {
  state: 'Estado de domínio',
  accuracy: 'Acerto (Wilson)',
  time: 'Tempo mediano',
  volume: 'Volume de prática',
  due: 'Revisões vencidas',
};

export default function StatsPage({ settings }: { settings: Settings }) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const { data } = useLearningData(settings.retention);
  const [layer, setLayer] = useState<Layer>('state');
  const [dir, setDir] = useState<HeatDirection>('both');
  const opts = { naming: settings.naming, octaves: settings.octaves };

  const view = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const cells = aggregateCells(data.model, inst, now, dir);
    const maxN = Math.max(1, ...[...cells.values()].map((c) => c.n));
    const heat = new Map<string, HeatCell>();
    for (let s = 1; s <= inst.strings.length; s++) {
      for (let f = 0; f <= inst.frets; f++) {
        const key = `${s}:${f}`;
        const c = cells.get(key);
        const st = cellState(c);
        if (!c || st === 'untrained') {
          heat.set(key, { cls: 'hm-untrained', title: 'Não treinado' });
          continue;
        }
        const w = wilsonLower(c.correct, c.n);
        const med = c.rts.length ? [...c.rts].sort((a, b) => a - b)[Math.floor(c.rts.length / 2)]! : null;
        const title = `${MASTERY_LABEL[st]} · ${c.correct}/${c.n} acertos · ${secs(med)}${c.due ? ` · ${c.due} vencida(s)` : ''}`;
        switch (layer) {
          case 'state':
            heat.set(key, { cls: `hm-${st}`, title });
            break;
          case 'accuracy':
            heat.set(key, { cls: 'hm-scale-ok', opacity: 0.15 + 0.85 * w, title });
            break;
          case 'time':
            heat.set(key, { cls: 'hm-scale-ok', opacity: med === null ? 0.1 : 0.15 + 0.85 * Math.max(0, Math.min(1, (4000 - med) / 3200)), title });
            break;
          case 'volume':
            heat.set(key, { cls: 'hm-scale-accent', opacity: 0.15 + 0.85 * (Math.log1p(c.n) / Math.log1p(maxN)), title });
            break;
          case 'due':
            heat.set(key, { cls: c.due ? 'hm-unstable' : 'hm-scale-neutral', opacity: c.due ? Math.min(1, 0.4 + 0.2 * c.due) : 0.25, title });
            break;
        }
      }
    }
    const counts = Object.fromEntries(MASTERY_ORDER.map((s) => [s, 0])) as Record<MasteryState, number>;
    for (const it of data.model.items.values()) counts[data.model.mastery(it)]++;
    // Leitura de notas; o ritmo tem métricas próprias (desvio em ms) e fica fora destes totais.
    const notes = data.attempts.filter((a) => a.direction === 'staff>fretboard' || a.direction === 'fretboard>staff');
    const reading = data.attempts.filter((a) => a.direction === 'reading');
    const intervals = data.attempts.filter((a) => a.direction === 'interval');
    const rhythm = data.attempts.filter((a) => a.direction === 'rhythm');
    const errors = new Map<ErrorCode, number>();
    for (const a of notes) if (a.errorCode) errors.set(a.errorCode, (errors.get(a.errorCode) ?? 0) + 1);
    return {
      heat,
      groups: groupStats(cells, inst),
      counts,
      weeks: weeklyStats(notes),
      weak: weakItems(data.model, now),
      errors: [...errors.entries()].sort((a, b) => b[1] - a[1]),
      total: notes.length,
      ok: notes.filter((a) => a.correct).length,
      rhythm: { n: rhythm.length, ok: rhythm.filter((a) => a.correct).length },
      reading: { n: reading.length, ok: reading.filter((a) => a.correct).length },
      intervals: { n: intervals.length, ok: intervals.filter((a) => a.correct).length },
      days: new Set(data.attempts.map((a) => a.day)).size,
      model: data.model,
      now,
    };
  }, [data, inst, layer, dir]);

  if (!view) return <section className="page"><p className="muted">Carregando…</p></section>;

  const itemLabel = (kcId: string) => {
    const r = parseKcId(kcId);
    if (!r) return describeKc(kcId, settings.naming);
    if (r.kind === 'fretboard>staff') return `Braço → pauta: corda ${r.loc.string}, ${r.loc.fret === 0 ? 'solta' : `casa ${r.loc.fret}`}`;
    const pos = parsePositionKey(r.posKey);
    return `Pauta → braço: ${pitchName(r.written, opts)}${pos ? ` (${positionLabel(pos)})` : ''}`;
  };

  return (
    <section className="page">
      <header className="page-head">
        <h1>Estatísticas</h1>
        <p className="muted">Tudo é recalculado a partir do registro local de tentativas.</p>
      </header>

      {view.total === 0 ? (
        <p>Nenhuma tentativa registrada ainda. Faça uma sessão em “Meu treinamento”.</p>
      ) : (
        <>
          <div className="kpis">
            <div><span className="big">{view.total}</span><span className="muted">tentativas</span></div>
            <div><span className="big">{Math.round((100 * view.ok) / view.total)}%</span><span className="muted">acerto geral</span></div>
            <div><span className="big">{view.counts.mastered + view.counts.automated}</span><span className="muted">itens dominados</span></div>
            <div><span className="big">{view.days}</span><span className="muted">dias praticados</span></div>
            {view.rhythm.n > 0 && (
              <div><span className="big">{Math.round((100 * view.rhythm.ok) / view.rhythm.n)}%</span><span className="muted">ritmo ({view.rhythm.ok}/{view.rhythm.n})</span></div>
            )}
            {view.reading.n > 0 && (
              <div><span className="big">{view.reading.ok}/{view.reading.n}</span><span className="muted">frases lidas com sucesso</span></div>
            )}
            {view.intervals.n > 0 && (
              <div><span className="big">{Math.round((100 * view.intervals.ok) / view.intervals.n)}%</span><span className="muted">intervalos ({view.intervals.ok}/{view.intervals.n})</span></div>
            )}
          </div>

          <div className="heat-head">
            <h2>Mapa do braço</h2>
            <div className="actions">
              <select value={layer} onChange={(e) => setLayer(e.target.value as Layer)} aria-label="Camada do mapa">
                {(Object.keys(LAYER_LABEL) as Layer[]).map((l) => (
                  <option key={l} value={l}>{LAYER_LABEL[l]}</option>
                ))}
              </select>
              <select value={dir} onChange={(e) => setDir(e.target.value as HeatDirection)} aria-label="Sentido">
                <option value="both">Os dois sentidos</option>
                <option value="staff>fretboard">Pauta → braço</option>
                <option value="fretboard>staff">Braço → pauta</option>
              </select>
            </div>
          </div>
          <Fretboard inst={inst} settings={{ ...settings, showNoteNames: false }} heat={view.heat} />
          <div className="legend small">
            {layer === 'state' ? (
              MASTERY_ORDER.map((s) => (
                <span key={s}>
                  <span className={`dot hm-${s}`} /> {MASTERY_LABEL[s]}
                  {s !== 'untrained' && ` (${view.counts[s]})`}
                </span>
              ))
            ) : (
              <span className="muted">
                Mais forte = {layer === 'accuracy' ? 'maior acerto' : layer === 'time' ? 'mais rápido' : layer === 'volume' ? 'mais praticado' : 'mais revisões vencidas'}. Hachurado = não treinado
                (não confundir com baixo desempenho). Passe o mouse para ver os números.
              </span>
            )}
          </div>

          <div className="two-col">
            <div>
              <h2>Por corda</h2>
              <GroupTable rows={view.groups.byString} />
            </div>
            <div>
              <h2>Por região</h2>
              <GroupTable rows={view.groups.byRegion} />
            </div>
          </div>

          <div className="two-col">
            <div>
              <h2>Evolução semanal</h2>
              <table className="small">
                <thead>
                  <tr><th>Semana</th><th className="num">Tentativas</th><th className="num">Acerto</th><th className="num">Tempo</th><th className="num">Dias</th></tr>
                </thead>
                <tbody>
                  {view.weeks.map((w) => (
                    <tr key={w.weekStart}>
                      <td>{new Date(`${w.weekStart}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                      <td className="num">{w.n}</td>
                      <td className="num">
                        <span className="bar" style={{ width: `${Math.round(w.accuracy * 60)}px` }} /> {Math.round(w.accuracy * 100)}%
                      </td>
                      <td className="num">{secs(w.medianMs)}</td>
                      <td className="num">{w.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h2>Precisam de atenção</h2>
              {view.weak.length === 0 ? (
                <p className="muted">Ainda sem itens com 3+ tentativas.</p>
              ) : (
                <table className="small">
                  <tbody>
                    {view.weak.map((it) => (
                      <tr key={it.kcId}>
                        <td>{itemLabel(it.kcId)}</td>
                        <td>{MASTERY_LABEL[view.model.mastery(it)]}</td>
                        <td className="num">{it.stats.recent.filter(Boolean).length}/{it.stats.recent.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h2>Erros por tipo</h2>
            {view.errors.length === 0 ? (
              <p className="muted">Nenhum erro.</p>
            ) : (
              <table className="small">
                <tbody>
                  {view.errors.map(([code, n]) => (
                    <tr key={code}><td>{ERROR_LABEL[code]}</td><td className="num">{n}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function GroupTable({ rows }: { rows: { label: string; n: number; accuracy: number; wilson: number; medianMs: number | null }[] }) {
  return (
    <table className="small">
      <thead>
        <tr><th></th><th className="num">Tentativas</th><th className="num">Acerto</th><th className="num">Tempo</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={r.n === 0 ? 'muted' : ''}>
            <td>{r.label}</td>
            <td className="num">{r.n}</td>
            <td className="num">{r.n ? `${Math.round(r.accuracy * 100)}%` : 'não treinado'}</td>
            <td className="num">{secs(r.medianMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
