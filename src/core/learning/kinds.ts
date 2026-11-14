import type { ChordQuality } from '../theory/chords';

/**
 * Tipos de item de conhecimento de TODOS os módulos — especificação §10.3:
 * "cada nota, posição, intervalo, figura rítmica ou conceito estudado poderá
 * apresentar um histórico próprio".
 *
 * Cada tipo diz como a tentativa vira nota FSRS:
 *  - timed: acerto + tempo de resposta (alvos pedagógicos, personalizados com dados);
 *  - scored: acerto + pontuação contínua (ritmo executado, frases lidas);
 *  - plain: só acerto (percepção, acordes — o tempo não é medido de forma comparável).
 */
export type ItemKind =
  | 'staff>fretboard'
  | 'fretboard>staff'
  | 'interval-name'
  | 'interval-locate'
  | 'rhythm-figure'
  | 'rhythm-measure'
  | 'rhythm-exec'
  | 'reading'
  | 'chord-build'
  | 'chord-id'
  | 'voice-leading'
  | 'ear-degree'
  | 'ear-interval'
  | 'ear-chord'
  | 'dictation';

export type ModuleKey = 'notes' | 'intervals' | 'rhythm' | 'reading' | 'chords' | 'ear';

export interface KindInfo {
  readonly module: ModuleKey;
  readonly label: string;
  readonly grading: 'timed' | 'scored' | 'plain';
  /** Alvos de tempo (ms) para a nota FSRS — só em 'timed'. */
  readonly fastMs?: number;
  readonly slowMs?: number;
  /** Mediana máxima para "Dominado"/"Automatizado" — só em 'timed'. */
  readonly masteryMs?: number;
  readonly automatedMs?: number;
}

/** Alvos de tempo: HIPÓTESES iniciais, a calibrar com dados reais. */
export const KIND_INFO: Readonly<Record<ItemKind, KindInfo>> = {
  'staff>fretboard': { module: 'notes', label: 'Nota: pauta → braço', grading: 'timed', fastMs: 1500, slowMs: 4000, masteryMs: 1500, automatedMs: 1000 },
  'fretboard>staff': { module: 'notes', label: 'Nota: braço → pauta', grading: 'timed', fastMs: 2500, slowMs: 6000, masteryMs: 2500, automatedMs: 1800 },
  'interval-name': { module: 'intervals', label: 'Intervalo: pauta → nome', grading: 'timed', fastMs: 3000, slowMs: 8000, masteryMs: 4000, automatedMs: 2500 },
  'interval-locate': { module: 'intervals', label: 'Intervalo: localizar no braço', grading: 'timed', fastMs: 3000, slowMs: 8000, masteryMs: 4000, automatedMs: 2500 },
  'rhythm-figure': { module: 'rhythm', label: 'Figura rítmica', grading: 'timed', fastMs: 2000, slowMs: 6000, masteryMs: 3000, automatedMs: 1800 },
  'rhythm-measure': { module: 'rhythm', label: 'Compasso completo?', grading: 'timed', fastMs: 3000, slowMs: 9000, masteryMs: 5000, automatedMs: 3000 },
  'rhythm-exec': { module: 'rhythm', label: 'Ritmo executado', grading: 'scored' },
  reading: { module: 'reading', label: 'Leitura de frases', grading: 'scored' },
  'chord-build': { module: 'chords', label: 'Acorde: construir', grading: 'plain' },
  'chord-id': { module: 'chords', label: 'Acorde: identificar', grading: 'plain' },
  'voice-leading': { module: 'chords', label: 'Condução de vozes', grading: 'plain' },
  'ear-degree': { module: 'ear', label: 'Ouvido: grau', grading: 'plain' },
  'ear-interval': { module: 'ear', label: 'Ouvido: intervalo', grading: 'plain' },
  'ear-chord': { module: 'ear', label: 'Ouvido: acorde', grading: 'plain' },
  dictation: { module: 'ear', label: 'Ditado melódico', grading: 'plain' },
};

export const MODULE_LABEL: Readonly<Record<ModuleKey, string>> = {
  notes: 'Notas (flashcards)',
  intervals: 'Intervalos',
  rhythm: 'Ritmo',
  reading: 'Leitura de partituras',
  chords: 'Acordes e harmonia',
  ear: 'Treinamento auditivo',
};

const PREFIX: readonly [string, ItemKind][] = [
  ['pball:', 'staff>fretboard'],
  ['pb:', 'staff>fretboard'],
  ['bp:', 'fretboard>staff'],
  ['intb:', 'interval-locate'],
  ['int:', 'interval-name'],
  ['ritmo:dur:', 'rhythm-figure'],
  ['ritmo:compasso:', 'rhythm-measure'],
  ['ritmo:exec:', 'rhythm-exec'],
  ['leitura:', 'reading'],
  ['acorde:', 'chord-build'],
  ['ident:', 'chord-id'],
  ['conducao:', 'voice-leading'],
  ['grau:', 'ear-degree'],
  ['ouvido-int:', 'ear-interval'],
  ['ouvido-acorde:', 'ear-chord'],
  ['ditado:', 'dictation'],
];

/** Tipo de um id canônico (os ids de notas já devem estar canonizados). */
export function kindOfKc(id: string): ItemKind | null {
  for (const [p, k] of PREFIX) if (id.startsWith(p)) return k;
  return null;
}

// ---------- acordes: itens independentes da fundamental ----------

const SUFFIX_TO_QUALITY: readonly [string, ChordQuality][] = [
  ['m7♭5', 'm7b5'],
  ['°7', 'dim7'],
  ['7M', 'maj7'],
  ['m7', 'min7'],
  ['7', 'dom7'],
  ['°', 'dim'],
  ['+', 'aug'],
  ['m', 'min'],
  ['', 'maj'],
];

/** Qualidade a partir de uma cifra ("F♯m7♭5" → m7b5). */
export function qualityFromSymbol(symbol: string): ChordQuality | null {
  const m = /^[A-G](?:𝄫|♭|♯|𝄪)?(.*)$/u.exec(symbol);
  if (!m) return null;
  return SUFFIX_TO_QUALITY.find(([s]) => s === m[1])?.[1] ?? null;
}

const QUALITIES = new Set<string>(['maj', 'min', 'dim', 'aug', 'maj7', 'dom7', 'min7', 'm7b5', 'dim7']);

/**
 * Ids de acordes descrevem a HABILIDADE (qualidade/tipo/inversão), não a
 * fundamental: "construir Drop 2 menor com 7ª em 1ª inversão" é o mesmo item em
 * qualquer tom. Converte também o formato antigo, que trazia a cifra.
 */
export function canonicalChordKc(id: string): string {
  let m = /^acorde:([^:]+):(.+)$/.exec(id);
  if (m && !QUALITIES.has(m[1]!)) {
    const q = qualityFromSymbol(m[1]!);
    return q ? `acorde:${q}:${m[2]}` : id;
  }
  m = /^(ident|conducao):(.+)$/.exec(id);
  if (m && !QUALITIES.has(m[2]!)) {
    const q = qualityFromSymbol(m[2]!);
    return q ? `${m[1]}:${q}` : id;
  }
  return id;
}
