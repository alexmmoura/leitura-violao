import { useEffect, useState } from 'react';
import { mic, useMicStatus } from '../audio/microphone';
import { requestPersistence } from '../data/db';
import MicPage from './MicPage';
import type { ModuleKey } from '../core/learning/kinds';
import { useSettings } from '../data/settings';
import MyTrainingPage from './MyTrainingPage';
import PositionsPage from './PositionsPage';
import PracticePage from './PracticePage';
import RhythmPage from './RhythmPage';
import ReadingPage from './ReadingPage';
import RepertoirePage from './RepertoirePage';
import IntervalsPage from './IntervalsPage';
import ChordsPage from './ChordsPage';
import EarPage from './EarPage';
import GuidePage from './GuidePage';
import ScoresPage from './ScoresPage';
import SettingsPage from './SettingsPage';
import StatsPage from './StatsPage';
import TheoryPage from './TheoryPage';
import ToolsPage from './ToolsPage';
import TodayPage, { TodayCard } from './TodayPage';
import { RhythmLessonsPage, SolfegeLessonsPage } from './LessonsPage';

/**
 * Estrutura: 4 abas (Estudar, Ferramentas, Teoria, Mais). No celular viram barra
 * inferior; no computador, barra lateral. Cada aba é uma lista de cartões que
 * abre as telas; as telas têm botão de voltar.
 */
type TabId = 'home' | 'tools' | 'theory' | 'more';
type PageId =
  | TabId
  | 'guide'
  | 'today'
  | 'training'
  | 'reading'
  | 'repertoire'
  | 'solfege'
  | 'rhythmLessons'
  | 'scores'
  | 'positions'
  | 'flashcards'
  | 'rhythm'
  | 'intervals'
  | 'chords'
  | 'ear'
  | 'stats'
  | 'mic'
  | 'settings';

const MODULE_PAGE: Record<ModuleKey, PageId> = {
  notes: 'flashcards',
  intervals: 'intervals',
  rhythm: 'rhythm',
  reading: 'reading',
  repertoire: 'repertoire',
  chords: 'chords',
  ear: 'ear',
};

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Estudar', icon: '✎' },
  { id: 'tools', label: 'Ferramentas', icon: '▤' },
  { id: 'theory', label: 'Teoria', icon: '❏' },
  { id: 'more', label: 'Mais', icon: '⚙' },
];

interface Entry {
  id: PageId;
  title: string;
  about: string;
  icon: string;
}
const STUDY: { group: string; items: Entry[] }[] = [
  {
    group: 'Atalhos',
    items: [
      { id: 'training', icon: '🎯', title: 'Meu treinamento (notas)', about: 'Só as notas no braço, de 5 a 30 min, com os detalhes do currículo.' },
      { id: 'guide', icon: '🧭', title: 'Como estudar (guia)', about: 'Rotina, ordem de estudo e o passo a passo de cada tela.' },
    ],
  },
  {
    group: 'Partitura',
    items: [
      { id: 'reading', icon: '🎼', title: 'Leitura de partituras', about: 'Frases novas a cada vez: clique no braço, toque no violão ou siga o cursor.' },
      { id: 'repertoire', icon: '🎻', title: 'Obras clássicas (níveis 1–5)', about: 'Trechos de Bach, Mozart, Beethoven e outros: nível escolhido ou automático, tipo Anki.' },
      { id: 'solfege', icon: '🎤', title: 'Solfejo (lições)', about: 'Lições numeradas por tonalidade: cante e o microfone confere.' },
      { id: 'rhythmLessons', icon: '🥁', title: 'Leitura rítmica (lições)', about: '40 ritmos em ordem de dificuldade para bater no tempo.' },
      { id: 'rhythm', icon: '🎲', title: 'Ritmo livre', about: 'Ritmos novos sorteados por nível e reconhecimento de figuras.' },
      { id: 'flashcards', icon: '⚡', title: 'Leitura imediata de notas', about: 'Flashcards: nota na pauta ↔ lugar no braço.' },
      { id: 'scores', icon: '📚', title: 'Minhas partituras', about: 'Suas músicas: crie no braço, cole uma tab ou importe MusicXML.' },
    ],
  },
  {
    group: 'Braço',
    items: [{ id: 'positions', icon: '🖐', title: 'Treinamento por posição', about: 'Mapa, dedos e teste de cada posição (Leavitt).' }],
  },
  {
    group: 'Intervalos e acordes',
    items: [
      { id: 'intervals', icon: '↕', title: 'Intervalos', about: 'Nomear na pauta e localizar no braço.' },
      { id: 'chords', icon: '🎶', title: 'Acordes e harmonia', about: 'Construir, identificar, CAGED e condução de vozes.' },
    ],
  },
  {
    group: 'Ouvido',
    items: [{ id: 'ear', icon: '👂', title: 'Treinamento auditivo', about: 'Graus, intervalos, tipos de acorde e ditado melódico.' }],
  },
];
const MORE: Entry[] = [
  { id: 'stats', icon: '📊', title: 'Estatísticas', about: 'Mapa do braço, evolução e seus pontos fracos.' },
  { id: 'mic', icon: '🎙', title: 'Microfone e afinação', about: 'Afinador, teste do microfone e calibração de ruído.' },
  { id: 'settings', icon: '⚙', title: 'Configurações', about: 'Nomes das notas, braço, tema, itens por dia e backup.' },
  { id: 'guide', icon: '🧭', title: 'Como estudar (guia)', about: 'O manual completo do app.' },
];

const PARENT: Partial<Record<PageId, TabId>> = { stats: 'more', mic: 'more', settings: 'more' };
const tabOf = (p: PageId): TabId => (TABS.some((t) => t.id === p) ? (p as TabId) : (PARENT[p] ?? 'home'));
const titleOf = (p: PageId) => (p === 'today' ? 'Sessão de hoje' : ([...STUDY.flatMap((g) => g.items), ...MORE].find((e) => e.id === p)?.title ?? ''));

export default function App() {
  const [settings, update] = useSettings();
  const [page, setPage] = useState<PageId>('home');
  const [from, setFrom] = useState<TabId>('home');

  useEffect(() => {
    void requestPersistence();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.staffPaper) root.setAttribute('data-staff', 'paper');
    else root.removeAttribute('data-staff');
  }, [settings.staffPaper]);

  // parâmetros do detector acompanham as configurações
  useEffect(() => {
    mic.configure({ aRef: settings.aRef, toleranceCents: settings.toleranceCents, gate: settings.micGate });
  }, [settings.aRef, settings.toleranceCents, settings.micGate]);

  // §15.9: o microfone desliga ao sair da tela em que foi ligado
  useEffect(() => () => mic.stop(), [page]);

  // fila de revisão vinda de "Meu treinamento" (itens vencidos de um módulo)
  const [review, setReview] = useState<{ page: PageId; ids: string[]; key: number } | null>(null);
  const goReview = (mod: ModuleKey, ids: string[]) => {
    const target = MODULE_PAGE[mod];
    setReview({ page: target, ids, key: Date.now() });
    setPage(target);
  };
  const reviewFor = (p: PageId) => (review && review.page === p ? { review: review.ids, onReviewDone: () => { setReview(null); setPage('training'); } } : {});
  /** Uma nova fila remonta a página (estado limpo). */
  const reviewKey = (p: PageId) => (review && review.page === p ? String(review.key) : p);
  // Menu lateral: recolhe sozinho (só ícones) nas telas de estudo; o botão ☰ abre/fecha.
  const [navOverride, setNavOverride] = useState<boolean | null>(null);
  const navigate = (p: PageId) => {
    setReview(null);
    setNavOverride(null);
    if (!TABS.some((t) => t.id === p)) setFrom(tabOf(page));
    setPage(p);
    window.scrollTo(0, 0);
  };

  const micState = useMicStatus();
  const isHub = TABS.some((t) => t.id === page);
  const activeTab = isHub ? (page as TabId) : (PARENT[page] ?? from);

  const navCollapsed = navOverride ?? !isHub;

  return (
    <div className={`shell${navCollapsed ? ' is-collapsed' : ''}`}>
      <nav className="tabbar" aria-label="Navegação principal">
        <div className="brand">
          <img className="brand-logo" src="./icon-192.png" alt="" width={28} height={28} />
          <span>Claves</span>
          <button type="button" className="nav-toggle" aria-expanded={!navCollapsed} title={navCollapsed ? 'Abrir o menu' : 'Recolher o menu'} aria-label={navCollapsed ? 'Abrir o menu' : 'Recolher o menu'} onClick={() => setNavOverride(!navCollapsed)}>
            {navCollapsed ? '☰' : '«'}
          </button>
        </div>
        {TABS.map((t) => (
          <button key={t.id} type="button" title={t.label} className={`tab${activeTab === t.id ? ' is-active' : ''}`} aria-current={activeTab === t.id ? 'page' : undefined} onClick={() => navigate(t.id)}>
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
        <p className="sidebar-foot muted small">Dados guardados só neste aparelho.</p>
      </nav>

      <main className="content">
        {(micState.status === 'on' || micState.status === 'test') && (
          <div className="mic-badge" role="status">
            <span className="mic-dot" aria-hidden /> {micState.status === 'test' ? 'Sinal de teste em análise' : 'Microfone ativo'}
            <button type="button" className="btn-ghost" onClick={() => mic.stop()}>Desligar</button>
          </div>
        )}
        {!isHub && (
          <button type="button" className="back-bar" onClick={() => navigate(activeTab)}>
            <span aria-hidden>‹</span> {TABS.find((t) => t.id === activeTab)!.label}
            <span className="back-title">{titleOf(page)}</span>
          </button>
        )}
        {page === 'home' && (
          <Hub title="Estudar" lead="Aperte começar para o treino do dia, ou escolha um exercício abaixo." groups={STUDY} go={navigate}>
            <TodayCard settings={settings} update={update} onStart={() => navigate('today')} />
          </Hub>
        )}
        {page === 'today' && <TodayPage settings={settings} onExit={() => navigate('home')} />}
        {page === 'more' && <Hub title="Mais" lead="Acompanhamento, microfone e ajustes." groups={[{ group: '', items: MORE }]} go={navigate} />}
        {page === 'tools' && <ToolsPage settings={settings} />}
        {page === 'theory' && <TheoryPage />}
        {page === 'guide' && <GuidePage go={navigate} settings={settings} />}
        {page === 'scores' && <ScoresPage settings={settings} />}
        {page === 'mic' && <MicPage settings={settings} update={update} />}
        {page === 'training' && <MyTrainingPage settings={settings} onReview={goReview} />}
        {page === 'flashcards' && <PracticePage settings={settings} />}
        {page === 'positions' && <PositionsPage settings={settings} />}
        {page === 'stats' && <StatsPage settings={settings} />}
        {page === 'rhythm' && <RhythmPage key={reviewKey('rhythm')} settings={settings} update={update} {...reviewFor('rhythm')} />}
        {page === 'reading' && <ReadingPage key={reviewKey('reading')} settings={settings} {...reviewFor('reading')} />}
        {page === 'repertoire' && <RepertoirePage key={reviewKey('repertoire')} settings={settings} {...reviewFor('repertoire')} />}
        {page === 'solfege' && <SolfegeLessonsPage settings={settings} />}
        {page === 'rhythmLessons' && <RhythmLessonsPage settings={settings} />}
        {page === 'intervals' && <IntervalsPage key={reviewKey('intervals')} settings={settings} {...reviewFor('intervals')} />}
        {page === 'chords' && <ChordsPage key={reviewKey('chords')} settings={settings} {...reviewFor('chords')} />}
        {page === 'ear' && <EarPage key={reviewKey('ear')} settings={settings} {...reviewFor('ear')} />}
        {page === 'settings' && <SettingsPage settings={settings} update={update} />}
      </main>
    </div>
  );
}

function Hub({ title, lead, groups, go, children }: { title: string; lead: string; groups: { group: string; items: Entry[] }[]; go: (p: PageId) => void; children?: React.ReactNode }) {
  return (
    <section className="page">
      <header className="page-head">
        <h1>{title}</h1>
        <p className="muted">{lead}</p>
      </header>
      {children}
      {groups.map((g) => (
        <div key={g.group} className="hub-group">
          {g.group && <h2>{g.group}</h2>}
          <div className="tool-list">
            {g.items.map((e) => (
              <button key={e.id + e.title} type="button" className="tool-card" onClick={() => go(e.id)}>
                <span className="tool-icon" aria-hidden>{e.icon}</span>
                <span>
                  <strong>{e.title}</strong>
                  <span className="muted">{e.about}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
