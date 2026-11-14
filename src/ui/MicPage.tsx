import { useEffect, useRef, useState } from 'react';
import { mic, useMicNotes, useMicStatus } from '../audio/microphone';
import { suggestGate, type NoteEvent } from '../core/audio/tracker';
import { STANDARD_TUNING } from '../core/instrument/instrument';
import { frequencyToMidi, midiToFrequency, pitchName, centsBetween } from '../core/theory/pitch';
import { preferredSpelling } from '../core/theory/spelling';
import type { Settings } from '../data/settings';

/**
 * Microfone e afinação — especificação §15: afinador, calibração de ruído,
 * Lá de referência, tolerância e teste ponta a ponta com sinal sintético.
 */
const TEST_NOTES = [40, 45, 50, 55, 59, 64, 52, 57, 62, 67, 71, 76]; // cordas soltas + casa 12 (soantes)

export default function MicPage({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const { status, error } = useMicStatus();
  const active = status === 'on' || status === 'test';
  const [frame, setFrame] = useState<{ freq: number | null; rms: number } | null>(null);
  const [notes, setNotes] = useState<NoteEvent[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [calib, setCalib] = useState<string | null>(null);
  const [testReport, setTestReport] = useState<string | null>(null);
  const testing = useRef<number[] | null>(null);
  const opts = { naming: settings.naming, octaves: settings.octaves };

  useEffect(() => {
    if (!active) return;
    let last = 0;
    return mic.onFrame((f) => {
      const now = performance.now();
      if (now - last < 50) return; // ~20 atualizações/s bastam para o mostrador
      last = now;
      setFrame({ freq: f.freq, rms: f.rms });
    });
  }, [active]);

  useMicNotes((n) => {
    setNotes((ns) => [n, ...ns].slice(0, 12));
    testing.current?.push(n.midi);
  }, active);

  useEffect(() => {
    if (status !== 'on') return;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((ds) => setDevices(ds.filter((d) => d.kind === 'audioinput')))
      .catch(() => undefined);
  }, [status]);

  // relatório do teste sintético quando o sinal termina
  useEffect(() => {
    if (status === 'off' && testing.current) {
      const got = testing.current;
      testing.current = null;
      const ok = TEST_NOTES.filter((m, i) => got[i] === m).length;
      setTestReport(
        `Sinal de teste: ${got.length} notas detectadas de ${TEST_NOTES.length}; ${ok} na ordem certa.` +
          (ok === TEST_NOTES.length ? ' A cadeia de detecção está funcionando.' : ' Detectado: ' + got.map((m) => pitchName(preferredSpelling(m), opts)).join(' ')),
      );
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const measureNoise = () => {
    setCalib('Fique em silêncio por 2 segundos…');
    const samples: number[] = [];
    const off = mic.onFrame((f) => samples.push(f.rms));
    setTimeout(() => {
      off();
      const g = suggestGate(samples);
      update({ micGate: Number(g.toFixed(4)) });
      setCalib(`Porta de ruído ajustada para ${g.toFixed(4)} (ruído medido em ${samples.length} quadros).`);
    }, 2000);
  };

  // ---------- leitura do afinador ----------
  const f = frame?.freq ?? null;
  const midiF = f ? frequencyToMidi(f, settings.aRef) : null;
  const near = midiF !== null ? Math.round(midiF) : null;
  const cents = midiF !== null && near !== null ? (midiF - near) * 100 : 0;
  const nearestString = near !== null ? STANDARD_TUNING.map((m, i) => ({ i, m, d: Math.abs(m - midiF!) })).sort((a, b) => a.d - b.d)[0]! : null;
  const stringCents = f && nearestString ? centsBetween(f, midiToFrequency(nearestString.m, settings.aRef)) : null;
  const levelPct = Math.min(100, ((frame?.rms ?? 0) / 0.2) * 100);
  const gatePct = Math.min(100, (settings.micGate / 0.2) * 100);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Microfone e afinação</h1>
        <p className="muted">
          O áudio é analisado no seu computador e nunca é gravado nem enviado. O microfone só liga quando você pede e desliga sozinho após 5 minutos sem notas.
        </p>
      </header>

      <div className="actions">
        {!active ? (
          <button type="button" className="btn-primary" onClick={() => void mic.start(settings.micDeviceId || undefined)}>
            🎤 Ligar microfone
          </button>
        ) : (
          <button type="button" onClick={() => mic.stop()}>Desligar</button>
        )}
        <button
          type="button"
          disabled={active}
          onClick={() => {
            testing.current = [];
            setTestReport(null);
            void mic.startTestSignal(TEST_NOTES, 0.5);
          }}
        >
          Testar com sinal sintético
        </button>
        {status === 'starting' && <span className="muted">Pedindo permissão…</span>}
        {error && <span className="warn">{error}</span>}
      </div>
      {testReport && <p className="small">{testReport}</p>}

      <div className="two-col">
        <div className="tuner">
          <div className="tuner-note">{near !== null ? pitchName(preferredSpelling(near), opts) : '—'}</div>
          <div className="tuner-sub muted">
            {f ? `${f.toFixed(1)} Hz · escrita: ${pitchName(preferredSpelling(near! + 12), opts)}` : active ? 'toque uma nota' : 'microfone desligado'}
          </div>
          <div className="cents-meter" aria-label={`Desvio: ${Math.round(cents)} cents`}>
            <span className="cents-zone" style={{ left: `${50 - settings.toleranceCents}%`, width: `${2 * settings.toleranceCents}%` }} />
            <span className="cents-needle" style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%`, opacity: f ? 1 : 0.2 }} />
          </div>
          <div className="small muted">{f ? `${cents > 0 ? '+' : ''}${Math.round(cents)} cents` : ''}</div>
          {nearestString && stringCents !== null && Math.abs(nearestString.m - midiF!) < 1 && (
            <p className="small">
              Corda {nearestString.i + 1} solta: {Math.abs(stringCents) < 5 ? 'afinada ✓' : `${stringCents > 0 ? 'alta' : 'baixa'} ${Math.abs(Math.round(stringCents))} cents`}
            </p>
          )}
          <div className="level">
            <span className="level-bar" style={{ width: `${levelPct}%` }} />
            <span className="level-gate" style={{ left: `${gatePct}%` }} title="Porta de ruído" />
          </div>
          <p className="muted small">Nível do sinal (a linha marca a porta de ruído).</p>
        </div>

        <div>
          <h2>Notas detectadas</h2>
          {notes.length === 0 ? (
            <p className="muted">Nenhuma ainda.</p>
          ) : (
            <ul className="note-log">
              {notes.map((n, i) => (
                <li key={i}>
                  {pitchName(preferredSpelling(n.midi), opts)} soante ({pitchName(preferredSpelling(n.midi + 12), opts)} escrita) · {n.cents > 0 ? '+' : ''}
                  {Math.round(n.cents)} cents · confirmada em {Math.round((n.confirmT - n.onsetT) * 1000)} ms após o ataque
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="config-grid">
        <fieldset>
          <legend>Calibração</legend>
          <button type="button" disabled={status !== 'on'} onClick={measureNoise}>Medir ruído de fundo</button>
          <p className="muted small">Porta atual: {settings.micGate}. {calib}</p>
          {devices.length > 1 && (
            <select value={settings.micDeviceId} onChange={(e) => update({ micDeviceId: e.target.value })} aria-label="Microfone">
              <option value="">Microfone padrão</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
              ))}
            </select>
          )}
        </fieldset>
        <fieldset>
          <legend>Afinação</legend>
          <label className="small" htmlFor="aref">Lá de referência</label>
          <select id="aref" value={settings.aRef} onChange={(e) => update({ aRef: Number(e.target.value) })}>
            {[415, 432, 435, 438, 440, 442, 444, 466].map((a) => (
              <option key={a} value={a}>Lá = {a} Hz</option>
            ))}
          </select>
          <label className="small" htmlFor="tol">Tolerância para aceitar a nota</label>
          <select id="tol" value={settings.toleranceCents} onChange={(e) => update({ toleranceCents: Number(e.target.value) })}>
            <option value={15}>±15 cents (afinação estrita)</option>
            <option value={25}>±25 cents</option>
            <option value={35}>±35 cents (padrão)</option>
            <option value={50}>±50 cents (só o nome da nota)</option>
          </select>
        </fieldset>
        <fieldset>
          <legend>O que o microfone sabe e não sabe</legend>
          <p className="small">
            Ele reconhece <strong>qual nota soou</strong> e <strong>quando</strong>. Ele <strong>não</strong> sabe em que corda e casa você tocou: o mesmo som existe em vários
            lugares do braço. Nos exercícios por posição isso não é problema (sem aberturas, cada nota tem um só lugar na posição). Para identificar a corda de verdade, use uma
            guitarra MIDI hexafônica (Configurações).
          </p>
        </fieldset>
      </div>
    </section>
  );
}
