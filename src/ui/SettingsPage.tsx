import { useRef, useState } from 'react';
import { connectMidi } from '../audio/midiInput';
import { exportBackup, importBackup } from '../data/db';
import type { Settings } from '../data/settings';

export default function SettingsPage({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const doExport = async () => {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leitura-violao-backup-${data.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`Backup exportado: ${data.attempts.length} tentativas.`);
  };

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Importar substitui TODOS os dados locais atuais. Continuar?')) return;
      await importBackup(data);
      setMsg('Backup importado. Recarregue a página para aplicar as configurações.');
    } catch (e) {
      setMsg(`Falha na importação: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <h1>Configurações</h1>
      </header>

      <div className="config-grid">
        <fieldset>
          <legend>Nomenclatura</legend>
          <select value={settings.naming} onChange={(e) => update({ naming: e.target.value as Settings['naming'] })} aria-label="Nomes das notas">
            <option value="latin">Dó, Ré, Mi…</option>
            <option value="english">C, D, E…</option>
          </select>
          <select value={settings.octaves} onChange={(e) => update({ octaves: e.target.value as Settings['octaves'] })} aria-label="Convenção de oitava">
            <option value="scientific">Dó central = Dó4 (científica)</option>
            <option value="minus-one">Dó central = Dó3</option>
          </select>
        </fieldset>

        <fieldset>
          <legend>Braço</legend>
          <select value={settings.frets} onChange={(e) => update({ frets: Number(e.target.value) as Settings['frets'] })} aria-label="Número de casas">
            {[12, 15, 19, 20, 22, 24].map((n) => (
              <option key={n} value={n}>{n} casas</option>
            ))}
          </select>
          <select value={settings.spacing} onChange={(e) => update({ spacing: e.target.value as Settings['spacing'] })} aria-label="Espaçamento das casas">
            <option value="realistic">Casas proporcionais (realista)</option>
            <option value="uniform">Casas iguais (mais fácil de clicar)</option>
          </select>
          <div className="checks">
            <label><input type="checkbox" checked={settings.leftHanded} onChange={(e) => update({ leftHanded: e.target.checked })} /> Canhoto (espelhar)</label>
            <label><input type="checkbox" checked={settings.string1OnTop} onChange={(e) => update({ string1OnTop: e.target.checked })} /> Corda 1 (Mi aguda) em cima</label>
            <label><input type="checkbox" checked={settings.showNoteNames} onChange={(e) => update({ showNoteNames: e.target.checked })} /> Mostrar nomes das notas durante o treino</label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Aprendizagem</legend>
          <label className="small" htmlFor="newPerDay">Itens novos por dia</label>
          <select id="newPerDay" value={settings.newPerDay} onChange={(e) => update({ newPerDay: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <label className="small" htmlFor="retention">Retenção-alvo (FSRS)</label>
          <select id="retention" value={settings.retention} onChange={(e) => update({ retention: Number(e.target.value) })}>
            {[0.8, 0.85, 0.9, 0.95].map((r) => (
              <option key={r} value={r}>{Math.round(r * 100)}%</option>
            ))}
          </select>
          <p className="muted small">Retenção mais alta = mais revisões por dia. 90% é o equilíbrio recomendado.</p>
        </fieldset>

        <fieldset>
          <legend>Guitarra MIDI (opcional)</legend>
          <p className="muted small">
            Para captadores hexafônicos que enviam cada corda num canal MIDI. Assim o app sabe exatamente a corda e a casa tocadas (o microfone só sabe a nota).
          </p>
          <select value={settings.midiString1Channel} onChange={(e) => update({ midiString1Channel: Number(e.target.value) })} aria-label="Canal da corda 1">
            <option value={0}>Desligada</option>
            {Array.from({ length: 11 }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c}>Corda 1 no canal {c} (corda 6 no canal {c + 5})</option>
            ))}
          </select>
          <div className="actions">
            <button
              type="button"
              disabled={settings.midiString1Channel === 0}
              onClick={() =>
                connectMidi()
                  .then((names) => setMsg(names.length ? `MIDI conectado: ${names.join(', ')}.` : 'MIDI liberado, mas nenhuma entrada encontrada.'))
                  .catch((e: unknown) => setMsg(e instanceof Error ? e.message : String(e)))
              }
            >
              Conectar MIDI
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Aparência</legend>
          <select value={settings.theme} onChange={(e) => update({ theme: e.target.value as Settings['theme'] })} aria-label="Tema">
            <option value="system">Seguir o sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
        </fieldset>

        <fieldset>
          <legend>Dados (somente neste computador)</legend>
          <p className="muted small">Nada é enviado para servidores. Exporte backups com regularidade: limpar os dados do navegador apaga o histórico.</p>
          <div className="actions">
            <button type="button" onClick={doExport}>Exportar backup (JSON)</button>
            <button type="button" onClick={() => fileRef.current?.click()}>Importar backup…</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          </div>
          {msg && <p className="small">{msg}</p>}
        </fieldset>
      </div>
    </section>
  );
}
