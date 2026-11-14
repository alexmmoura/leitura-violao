import Dexie, { type EntityTable } from 'dexie';
import type { ErrorCode } from '../core/exercise/validate';
import type { FretLocation } from '../core/instrument/instrument';
import type { ScoreDef } from '../core/score/score';

/**
 * Persistência local (IndexedDB via Dexie) — especificação §12.6 e §13.
 *
 * O registro de tentativas é IMUTÁVEL (append-only): todos os estados derivados
 * (FSRS, fluência, domínio) poderão ser recalculados a partir dele na Fase 2.
 */
export const SCHEMA_VERSION = 3;

export type InputMethod = 'mouse' | 'keyboard' | 'microphone' | 'midi';
export type ModuleId = 'A' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type Direction = 'staff>fretboard' | 'fretboard>staff' | 'rhythm' | 'reading' | 'interval' | 'chord' | 'ear';

export interface AttemptRecord {
  id?: number;
  /** Epoch ms. */
  ts: number;
  /** Dia local (AAAA-MM-DD), para a regra "primeira tentativa do dia" (§10.4). */
  day: string;
  module: ModuleId;
  kcId: string;
  direction: Direction;
  seed: number;
  correct: boolean;
  /** Pontuação em [0,1] (modo "todos os locais"). */
  score: number;
  errorCode: ErrorCode | null;
  rtMs: number;
  inputMethod: InputMethod;
  /** Locais marcados (pauta → braço) ou nota escrita respondida (braço → pauta). */
  answer:
    | FretLocation[]
    | { written: string }
    | { expectedMs: number[]; tapsMs: number[] }
    | { choice: string }
    | { reading: ReadingSummary };
  /** Altura escrita esperada, em notação inglesa (ex.: "F♯4"). */
  written: string;
  sessionId: string;
}

/** Resultado de uma frase de leitura (Módulo D). */
export interface ReadingSummary {
  mode: 'static' | 'continuous' | 'guitar';
  materialKey: string;
  seed: number;
  bpm: number | null;
  notes: number;
  /** Estático: acerto na 1ª tentativa. Contínuo: notas certas e no tempo. */
  notesInTime: number;
  pitchAccuracy: number;
  /** null no modo estático; autoavaliação no modo "no violão". */
  continuity: number | null;
  selfAssessed: boolean;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number | null;
  module: ModuleId;
  config: unknown;
}

/** Resultado de um teste de conclusão de posição (§6.3). */
export interface PositionTestRecord {
  id?: number;
  ts: number;
  positionKey: string;
  label: string;
  total: number;
  correct: number;
  accuracy: number;
  medianMs: number | null;
  passed: boolean;
  sessionId: string;
  /** Pior frase da etapa 2 (fração certa); null = não concluída; ausente = teste anterior à Fase 3. */
  phraseAccuracy?: number | null;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  attempts!: EntityTable<AttemptRecord, 'id'>;
  sessions!: EntityTable<SessionRecord, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;
  positionTests!: EntityTable<PositionTestRecord, 'id'>;
  scores!: EntityTable<ScoreDef, 'id'>;

  constructor(name = 'leitura-violao') {
    super(name);
    this.version(1).stores({
      attempts: '++id, ts, day, kcId, module, sessionId, [kcId+day]',
      sessions: 'id, startedAt',
      settings: 'key',
    });
    // v2: testes de conclusão de posição. Registros antigos não mudam
    // (direction 'staff>fretboard' continua válido).
    this.version(2).stores({
      positionTests: '++id, ts, positionKey',
    });
    // v3: partituras do próprio aluno (MusicXML, tablatura, editor no braço)
    this.version(3).stores({
      scores: 'id, createdAt',
    });
  }
}

export const db = new AppDB();

export function localDay(ts = Date.now()): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

// ---------- Backup JSON (§12.6) ----------

export interface BackupFile {
  app: 'leitura-violao';
  schemaVersion: number;
  exportedAt: string;
  attempts: AttemptRecord[];
  sessions: SessionRecord[];
  settings: SettingRecord[];
  /** Ausente em backups da versão 1. */
  positionTests?: PositionTestRecord[];
  /** Ausente em backups anteriores à versão 3. */
  scores?: ScoreDef[];
}

export async function exportBackup(): Promise<BackupFile> {
  const [attempts, sessions, settings, positionTests, scores] = await Promise.all([
    db.attempts.toArray(),
    db.sessions.toArray(),
    db.settings.toArray(),
    db.positionTests.toArray(),
    db.scores.toArray(),
  ]);
  return { app: 'leitura-violao', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), attempts, sessions, settings, positionTests, scores };
}

export function validateBackup(data: unknown): BackupFile {
  const d = data as Partial<BackupFile> | null;
  if (!d || d.app !== 'leitura-violao') throw new Error('Arquivo não é um backup deste aplicativo.');
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion > SCHEMA_VERSION) throw new Error('Versão de backup não suportada.');
  if (!Array.isArray(d.attempts) || !Array.isArray(d.sessions) || !Array.isArray(d.settings)) throw new Error('Backup incompleto.');
  for (const a of d.attempts) {
    if (typeof a.ts !== 'number' || typeof a.kcId !== 'string' || typeof a.correct !== 'boolean') throw new Error('Tentativa inválida no backup.');
  }
  return d as BackupFile;
}

/** Substitui todos os dados locais pelo backup (após validação). */
export async function importBackup(data: unknown): Promise<void> {
  const b = validateBackup(data);
  await db.transaction('rw', [db.attempts, db.sessions, db.settings, db.positionTests, db.scores], async () => {
    await Promise.all([db.attempts.clear(), db.sessions.clear(), db.settings.clear(), db.positionTests.clear(), db.scores.clear()]);
    await db.attempts.bulkAdd(b.attempts);
    await db.sessions.bulkAdd(b.sessions);
    await db.settings.bulkAdd(b.settings);
    await db.positionTests.bulkAdd(b.positionTests ?? []);
    await db.scores.bulkAdd(b.scores ?? []);
  });
}
