import { useMemo, useState, type ReactNode } from 'react';
import { locationLabel } from '../core/exercise/explain';
import { locationsFor, makeGuitar, soundingAt, type FretLocation } from '../core/instrument/instrument';
import { fingerFor, fixedPosition, fretWindow, OPEN_POSITION, positionLabel, roman } from '../core/instrument/position';
import { asSounding, letterName } from '../core/theory/pitch';
import { preferredSpelling } from '../core/theory/spelling';
import type { Settings } from '../data/settings';
import Fretboard, { type Mark } from './Fretboard';
import Staff from './Staff';

/**
 * Guia de estudo — como usar cada função, passo a passo, e em que ordem estudar.
 * Fica dentro do app para estar à mão (inclusive offline).
 */
export type GuideTarget = 'training' | 'reading' | 'scores' | 'positions' | 'flashcards' | 'rhythm' | 'intervals' | 'chords' | 'ear' | 'stats' | 'mic' | 'settings';

function Sec({ id, title, open, children }: { id: string; title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="guide-sec" id={id} open={open}>
      <summary>{title}</summary>
      <div className="guide-body">{children}</div>
    </details>
  );
}

/** Posições do caminho de estudo (0 = aberta) e as casas que cada uma cobre. */
const DEMO_POSITIONS = [0, 2, 5, 7, 9];
const FINGERS = ['indicador', 'médio', 'anelar', 'mínimo'];
const posName = (p: number) => (p === 0 ? 'Aberta' : roman(p));

/** Diagrama interativo: escolha uma posição e veja a "janela" de casas, os dedos e as notas. */
function PositionDemo({ settings }: { settings: Settings }) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const [pos, setPos] = useState(5);
  const [show, setShow] = useState<'fingers' | 'names'>('fingers');
  const spec = pos === 0 ? OPEN_POSITION : fixedPosition(pos);
  const win = fretWindow(spec, inst.frets);
  const first = pos === 0 ? 1 : pos;

  const marks = useMemo(() => {
    const out: Mark[] = [];
    for (let s = 1; s <= inst.strings.length; s++) {
      for (let f = win.openStrings ? 0 : win.min; f <= win.max; f++) {
        if (f > 0 && f < win.min) continue;
        const loc: FretLocation = { string: s, fret: f };
        if (show === 'fingers') out.push({ loc, kind: 'valid', label: String(fingerFor(loc, spec, inst.frets) ?? '') });
        else {
          const p = preferredSpelling(soundingAt(loc, inst) - inst.transposition);
          if (p.alter === 0) out.push({ loc, kind: 'valid', label: letterName(p.letter, settings.naming) });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst, pos, show, settings.naming]);

  // faixa "onde cada posição mora": casas 0 a 12
  const col = (f: number) => 16 + f * 48;

  return (
    <div className="pos-demo">
      <div className="pill-row" role="group" aria-label="Posição do exemplo">
        {DEMO_POSITIONS.map((p) => (
          <button key={p} type="button" className={`pill${pos === p ? ' is-on' : ''}`} aria-pressed={pos === p} onClick={() => setPos(p)}>
            {posName(p)}
          </button>
        ))}
      </div>

      <svg className="pos-strip" viewBox="0 0 656 150" role="img" aria-label="Casas cobertas por cada posição">
        {Array.from({ length: 13 }, (_, f) => (
          <g key={f}>
            <text x={col(f) + 24} y={14} className="ps-num">{f === 0 ? 'solta' : f}</text>
            <line x1={col(f)} x2={col(f)} y1={20} y2={146} className="ps-grid" />
          </g>
        ))}
        <line x1={col(13)} x2={col(13)} y1={20} y2={146} className="ps-grid" />
        {DEMO_POSITIONS.map((p, i) => {
          const from = p === 0 ? 0 : p;
          const to = p === 0 ? 4 : p + 3;
          return (
            <g key={p} onClick={() => setPos(p)}>
              <rect x={col(from) + 2} y={24 + i * 25} width={(to - from + 1) * 48 - 4} height={21} rx={6} className={`ps-bar${pos === p ? ' is-on' : ''}`} />
              <text x={(col(from) + col(to + 1)) / 2} y={39 + i * 25} className="ps-label">
                {p === 0 ? 'Posição aberta' : `${roman(p)} posição`}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="pos-caption">
        <strong>{positionLabel(spec)}</strong>:{' '}
        {pos === 0
          ? 'a mão fica junto à pestana. Cordas soltas (0) e casas 1 a 4.'
          : `o dedo 1 fica na casa ${pos} e a mão não sai dali. Você só usa as casas ${pos} a ${pos + 3}.`}
      </p>
      <ul className="finger-row">
        {FINGERS.map((name, i) => (
          <li key={name}>
            <span className="finger-num">{i + 1}</span> {name} → casa {first + i}
          </li>
        ))}
      </ul>

      <div className="pill-row" role="group" aria-label="O que mostrar no braço">
        <button type="button" className={`pill${show === 'fingers' ? ' is-on' : ''}`} aria-pressed={show === 'fingers'} onClick={() => setShow('fingers')}>
          Ver os dedos
        </button>
        <button type="button" className={`pill${show === 'names' ? ' is-on' : ''}`} aria-pressed={show === 'names'} onClick={() => setShow('names')}>
          Ver as notas
        </button>
      </div>
      <Fretboard inst={inst} settings={{ ...settings, showNoteNames: false }} window={win} marks={marks} />
      <p className="muted small pos-caption">
        A faixa colorida no braço é a “janela” da posição. {show === 'fingers' ? 'Os números são os dedos da mão esquerda (0 = corda solta).' : 'Estas são as notas naturais que existem dentro da janela (sustenidos e bemóis ficam nas casas vazias).'}
      </p>
    </div>
  );
}

/** A mesma nota escrita existe em vários lugares do braço — é por isso que a posição importa. */
function SameNoteDemo({ settings }: { settings: Settings }) {
  const inst = useMemo(() => makeGuitar({ frets: settings.frets }), [settings.frets]);
  const locs = useMemo(() => locationsFor(asSounding(64), inst), [inst]);
  const staffNotes = useMemo(() => [{ pitch: preferredSpelling(64 - inst.transposition), accidental: null }], [inst.transposition]);
  const marks: Mark[] = useMemo(() => locs.map((loc) => ({ loc, kind: 'correct' as const })), [locs]);
  return (
    <div className="pos-demo">
      <div className="same-note">
        <Staff fifths={0} notes={staffNotes} label="Mi do 4º espaço" />
        <p className="pos-caption">
          Este <strong>Mi</strong> (4º espaço) pode ser tocado em <strong>{locs.length} lugares</strong>: {locs.map(locationLabel).join(' · ')}. Todos soam a mesma nota.
          A partitura não diz qual usar — <strong>a posição escolhida decide</strong>: na posição aberta é a corda 1 solta; na V posição é a corda 2, casa 5; na IX
          posição é a corda 3, casa 9.
        </p>
      </div>
      <Fretboard inst={inst} settings={{ ...settings, showNoteNames: false }} window={null} marks={marks} />
    </div>
  );
}

export default function GuidePage({ go, settings }: { go: (p: GuideTarget) => void; settings: Settings }) {
  const Go = ({ to, children }: { to: GuideTarget; children: ReactNode }) => (
    <button type="button" className="btn-link" onClick={() => go(to)}>
      {children}
    </button>
  );

  return (
    <section className="page guide">
      <header className="page-head">
        <h1>Como estudar</h1>
        <p className="muted">
          Guia completo: a rotina diária, a ordem de estudo e como usar cada tela. Clique num título para abrir. Os links azuis levam direto à tela.
        </p>
      </header>

      <Sec id="g-ideia" title="A ideia do app em 1 minuto" open>
        <p>
          Ler partitura no violão é responder três perguntas sem parar: <strong>que nota é esta?</strong>, <strong>onde ela fica no braço?</strong> e{' '}
          <strong>quando ela soa (ritmo)?</strong>. Cada tela treina uma parte; <Go to="training">Meu treinamento</Go> junta tudo e decide sozinho o
          que você deve revisar a cada dia (repetição espaçada: o que você acerta volta mais tarde; o que erra volta logo).
        </p>
        <p>Você pode responder de quatro jeitos, e todos são conferidos pelo app:</p>
        <ul>
          <li>
            <strong>Clicando no braço virtual</strong> (o desenho do violão na tela) — funciona em tudo, sem violão e sem microfone;
          </li>
          <li>
            <strong>pelo teclado</strong> (atalhos nos Flashcards e no Ritmo);
          </li>
          <li>
            <strong>tocando no violão de verdade</strong> — botões 🎤, o microfone ouve a nota;
          </li>
          <li>
            <strong>cantando (solfejo)</strong> — o microfone ouve a sua voz.
          </li>
        </ul>
        <p>
          E em <Go to="scores">Minhas partituras</Go> você coloca as suas próprias músicas: marcando as notas no braço virtual, colando uma tablatura ou importando
          um arquivo do MuseScore/Guitar Pro.
        </p>
        <p>
          O violão é escrito na <strong>clave de Sol com um “8” embaixo</strong>: ele soa uma oitava abaixo do que está escrito. Você lê normalmente e o app já faz
          essa conta.
        </p>
      </Sec>

      <Sec id="g-posicoes" title="Posições no braço: o que é “V posição” e como estudar com isso" open>
        <h3>A ideia em uma frase</h3>
        <p>
          <strong>Posição é o lugar do braço onde a mão esquerda fica parada.</strong> O número romano diz em que casa fica o <strong>dedo 1</strong> (indicador).
          “V posição” = dedo 1 na casa 5. Só isso.
        </p>
        <table className="theory-table">
          <tbody>
            <tr>
              <td>Número romano</td>
              <td>I = 1 · II = 2 · III = 3 · IV = 4 · V = 5 · VII = 7 · IX = 9 · XII = 12</td>
            </tr>
            <tr>
              <td>Regra</td>
              <td>um dedo por casa: dedo 1 na casa da posição, dedos 2, 3 e 4 nas três casas seguintes</td>
            </tr>
          </tbody>
        </table>

        <h3>Veja no braço (clique nas posições)</h3>
        <PositionDemo settings={settings} />

        <h3>Por que isso ajuda a ler partitura</h3>
        <p>
          No violão, a mesma nota escrita existe em vários lugares. Sem escolher uma posição, cada nota vira uma dúvida (“toco onde?”). Dentro de uma posição,{' '}
          <strong>cada nota da pauta tem um único lugar</strong> — você lê e o dedo já sabe aonde ir, sem olhar para a mão.
        </p>
        <SameNoteDemo settings={settings} />

        <h3>O que significa cada opção de “Região” nas telas</h3>
        <table>
          <tbody>
            <tr>
              <td><strong>Posição aberta</strong></td>
              <td>Cordas soltas e casas 1 a 4. É onde todo mundo começa.</td>
            </tr>
            <tr>
              <td><strong>II, V, VII, IX… posição</strong></td>
              <td>A mão parada com o dedo 1 nessa casa; só 4 casas são usadas (V = casas 5 a 8).</td>
            </tr>
            <tr>
              <td><strong>Mudança II → V</strong></td>
              <td>A frase começa numa posição e, no meio, a mão desliza para a outra. Só depois de dominar as duas separadas.</td>
            </tr>
            <tr>
              <td><strong>Braço inteiro</strong></td>
              <td>Sem restrição: qualquer lugar certo vale. É o objetivo final, não o começo.</td>
            </tr>
            <tr>
              <td><strong>Abertura do dedo 1 / dedo 4</strong></td>
              <td>O dedo 1 estica uma casa para trás, ou o dedo 4 uma casa para a frente, sem mover a mão. Deixe desligado no início.</td>
            </tr>
          </tbody>
        </table>

        <h3>Como estudar uma posição — passo a passo</h3>
        <p>Faça os 5 passos com a <strong>mesma posição</strong> escolhida em todas as telas. Só troque de posição depois do passo 5.</p>
        <ol className="guide-steps">
          <li>
            <p>
              <strong>Conheça o mapa.</strong> Em <Go to="positions">Treinamento por posição</Go>, escolha a posição e olhe onde está cada nota e qual dedo toca. Com o
              violão, toque corda por corda dizendo o nome das notas.
            </p>
          </li>
          <li>
            <p>
              <strong>Notas soltas, uma de cada vez.</strong> Em <Go to="flashcards">Leitura imediata de notas</Go>, escolha a mesma Região. Comece pelas cordas 1–3,
              depois 4–6, depois todas.
            </p>
          </li>
          <li>
            <p>
              <strong>Frases sem pressa.</strong> Em <Go to="reading">Leitura de partituras</Go>, mesma Região, modo <em>Estático</em>, “Só semínimas” e “Só graus
              conjuntos”. Meta: 90% de acerto em frases novas.
            </p>
          </li>
          <li>
            <p>
              <strong>Frases no tempo.</strong> Ainda na Leitura, passe para o modo com metrônomo, em andamento lento (50–60 bpm). Depois aumente o ritmo e os saltos,
              um de cada vez.
            </p>
          </li>
          <li>
            <p>
              <strong>Teste de conclusão.</strong> Volte ao <Go to="positions">Treinamento por posição</Go> e clique em <em>Fazer o teste</em>. Aprovado? Passe para a
              próxima posição.
            </p>
          </li>
        </ol>
        <p>
          <strong>Ordem sugerida:</strong> Aberta → II → V → VII → IX. Juntas elas cobrem o braço até a casa 12 (veja a faixa acima: uma começa onde a outra termina).
          Quando duas vizinhas estiverem firmes, treine a <em>Mudança</em> entre elas.
        </p>
      </Sec>

      <Sec id="g-rotina" title="Rotina diária recomendada">
        <h3>No trabalho (sem violão) — 15 a 30 min</h3>
        <ol>
          <li>
            <Go to="training">Meu treinamento</Go> → escolha <strong>10 min</strong>. É o mais importante: faça <em>todo dia</em>, mesmo que só 5 min.
          </li>
          <li>
            Ainda em Meu treinamento, em <strong>Revisões dos outros módulos</strong>, clique <strong>Revisar</strong> em cada módulo com itens vencidos.
          </li>
          <li>
            <Go to="reading">Leitura de partituras</Go>: 2 ou 3 frases no modo <strong>Estático</strong> na mesma posição que você está estudando.
          </li>
          <li>
            <Go to="rhythm">Ritmo</Go>: 5 min de <strong>Execução com metrônomo</strong> batendo na tecla Espaço (use fone de ouvido).
          </li>
        </ol>
        <h3>Em casa (com violão) — quando puder</h3>
        <ol>
          <li>
            <Go to="mic">Microfone e afinação</Go>: ligue o microfone, afine o violão e faça <strong>Medir ruído de fundo</strong> (uma vez por lugar).
          </li>
          <li>
            <Go to="reading">Leitura de partituras</Go> no modo <strong>No violão, com metrônomo</strong> e o microfone ligado — é a leitura “de verdade”, sem parar.
          </li>
          <li>
            Nos <Go to="flashcards">Flashcards</Go> e em Meu treinamento, use <strong>🎤 Responder tocando no violão</strong>.
          </li>
          <li>
            Toque as suas músicas em <Go to="scores">Minhas partituras</Go> no modo “No violão ou cantando”, com o microfone ligado.
          </li>
        </ol>
        <p className="muted small">Regra de ouro: pouco todo dia vale mais que muito uma vez por semana. As revisões são agendadas para o dia certo.</p>
      </Sec>

      <Sec id="g-ordem" title="Em que ordem avançar (o caminho)">
        <ol>
          <li>
            <strong>Posição aberta, cordas 1–3, Dó maior</strong> (sem acidentes). Meu treinamento já começa aqui sozinho.
          </li>
          <li>Posição aberta, cordas 4–6. Depois com acidentes (♯ e ♭).</li>
          <li>
            <strong>II posição</strong> → <strong>V posição</strong> → <strong>VII</strong> → <strong>IX</strong>. Para cada uma: estude o mapa em{' '}
            <Go to="positions">Treinamento por posição</Go>, pratique nos Flashcards e leia frases nela. Quando estiver seguro, faça o{' '}
            <strong>Teste de conclusão</strong>.
          </li>
          <li>Leitura: comece em “Só semínimas” e “Só graus conjuntos”; suba para ritmo nível 1, 2… e saltos maiores aos poucos.</li>
          <li>Tonalidades: Dó → Sol → Fá → Ré → Si♭ → Lá → Mi♭…</li>
          <li>
            Ritmo: níveis 1 a 4 em 2/4, 3/4, 4/4; depois os compostos (<strong>6/8</strong>, 9/8, 12/8).
          </li>
          <li>Em paralelo, quando quiser variar: Intervalos, Acordes e Treinamento auditivo.</li>
        </ol>
        <p>
          <strong>Quando avançar?</strong> Em <Go to="stats">Estatísticas</Go>, quando a maioria das notas da etapa estiver em “Consolidando” ou acima, e na
          leitura quando você acertar ≥ 90% das notas de frases novas.
        </p>
      </Sec>

      <Sec id="g-mapa" title="Cola: as notas da posição aberta na pauta">
        <p>Linhas e espaços contados de baixo para cima. “Suplementar” = linha extra abaixo da pauta.</p>
        <table>
          <thead>
            <tr>
              <th>Corda</th>
              <th>Solta (0)</th>
              <th>Casa 1</th>
              <th>Casa 2</th>
              <th>Casa 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1 (Mi aguda)</td>
              <td>Mi — 4º espaço</td>
              <td>Fá — 5ª linha</td>
              <td>(Fá♯)</td>
              <td>Sol — acima da pauta</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Si — 3ª linha</td>
              <td>Dó — 3º espaço</td>
              <td>(Dó♯)</td>
              <td>Ré — 4ª linha</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Sol — 2ª linha</td>
              <td>(Sol♯)</td>
              <td>Lá — 2º espaço</td>
              <td>(Lá♯)</td>
            </tr>
            <tr>
              <td>4</td>
              <td>Ré — logo abaixo da pauta</td>
              <td>(Ré♯)</td>
              <td>Mi — 1ª linha</td>
              <td>Fá — 1º espaço</td>
            </tr>
            <tr>
              <td>5</td>
              <td>Lá — na 2ª suplementar</td>
              <td>(Lá♯)</td>
              <td>Si — entre a 1ª e a 2ª suplementares</td>
              <td>Dó — na 1ª suplementar</td>
            </tr>
            <tr>
              <td>6 (Mi grave)</td>
              <td>Mi — abaixo da 3ª suplementar</td>
              <td>Fá — na 3ª suplementar</td>
              <td>(Fá♯)</td>
              <td>Sol — entre a 2ª e a 3ª suplementares</td>
            </tr>
          </tbody>
        </table>
        <p className="muted small">
          O <Go to="positions">Treinamento por posição</Go> mostra este mapa no braço, com os dedos, para qualquer posição.
        </p>
      </Sec>

      <Sec id="g-meu" title="Meu treinamento (o centro de tudo)">
        <ol>
          <li>
            Os números no topo: <strong>notas para revisar</strong> (vencidas hoje), <strong>itens novos</strong> liberados hoje, <strong>dominados</strong> e{' '}
            <strong>esquecendo</strong>.
          </li>
          <li>
            Clique na duração (<strong>5, 10, 20 ou 30 min</strong>). A sessão mistura revisões vencidas, notas novas (na ordem do currículo) e reforço do que você
            errou.
          </li>
          <li>Responda cada questão (veja os atalhos em “Flashcards”). Ao fim do tempo, a questão em andamento termina e vem uma frase curta de aplicação para ler.</li>
          <li>
            <strong>Revisões dos outros módulos</strong>: ritmo, leitura, intervalos, acordes e percepção também agendam revisões. Clique <strong>Revisar</strong> — o app
            abre o módulo já configurado com uma fila das questões vencidas (as mais esquecidas primeiro). Ao terminar, volta para cá.
          </li>
          <li>
            <strong>Etapa atual / Currículo</strong>: mostra em que etapa você está e quantos itens de cada etapa já começou e dominou.
          </li>
          <li>
            <strong>Estados de domínio</strong>: Em aquisição → Instável → Consolidando → Dominado → Automatizado. Dominar exige acertar com frequência <em>e</em>{' '}
            rápido, em dias diferentes.
          </li>
        </ol>
      </Sec>

      <Sec id="g-flash" title="Flashcards (Reconhecimento de notas)">
        <p>Treino rápido de nota isolada. Configure e clique <strong>Começar</strong>.</p>
        <ul>
          <li>
            <strong>Sentido</strong>: <em>Pauta → braço</em> (vê a nota escrita e marca onde toca), <em>Braço → pauta</em> (vê um lugar no braço e diz qual nota é) ou{' '}
            <em>Misto</em>.
          </li>
          <li>
            <strong>Modo de resposta</strong> (pauta → braço): <em>Qualquer local válido na região</em> (o normal), <em>Na corda indicada</em> (o app diz a corda), ou{' '}
            <em>Todos os locais da região</em> (marque todos os lugares onde a nota existe).
          </li>
          <li>
            <strong>Região</strong> e <strong>Cordas</strong>: limite onde as notas aparecem. Comece pequeno (posição aberta, cordas 1–3).
          </li>
          <li>
            <strong>Aberturas do dedo 1/dedo 4</strong>: incluem a casa antes/depois da posição (como no método Leavitt).
          </li>
          <li>
            <strong>Notas e armadura</strong>: só notas da tonalidade, ou com acidentes ocorrentes; e a armadura (de 7 bemóis a 7 sustenidos).
          </li>
          <li>
            <strong>Número de questões</strong>: 10 a 50, ou sem fim.
          </li>
        </ul>
        <h3>Atalhos de teclado</h3>
        <table>
          <thead>
            <tr>
              <th>Ação</th>
              <th>Pauta → braço</th>
              <th>Braço → pauta</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Responder</td>
              <td>
                número da corda (<kbd>1</kbd>–<kbd>6</kbd>), depois a casa, <kbd>Enter</kbd> — ou clique no braço
              </td>
              <td>
                letra <kbd>C</kbd>…<kbd>B</kbd> (C=Dó, D=Ré, E=Mi, F=Fá, G=Sol, A=Lá, B=Si), <kbd>↑</kbd>/<kbd>↓</kbd> oitava, <kbd>#</kbd> ou <kbd>+</kbd> sustenido,{' '}
                <kbd>-</kbd> bemol, <kbd>=</kbd> bequadro, <kbd>Enter</kbd> — ou clique na pauta
              </td>
            </tr>
            <tr>
              <td>Corrigir</td>
              <td>
                <kbd>Backspace</kbd> / <kbd>Esc</kbd>
              </td>
              <td>
                <kbd>Backspace</kbd> (tira o acidente) / <kbd>Esc</kbd>
              </td>
            </tr>
            <tr>
              <td>Próxima</td>
              <td colSpan={2}>
                <kbd>Enter</kbd> ou <kbd>Espaço</kbd>
              </td>
            </tr>
            <tr>
              <td>Encerrar</td>
              <td colSpan={2}>
                <kbd>Esc</kbd> (sem nada digitado)
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Depois de cada resposta o app explica o erro (ex.: “erro de oitava”, “casa vizinha”) e mostra os lugares certos. Com violão: <strong>🎤 Responder tocando no
          violão</strong> — toque a nota e o app confere.
        </p>
      </Sec>

      <Sec id="g-pos" title="Treinamento por posição">
        <ol>
          <li>
            Escolha a <strong>Posição</strong>. O braço mostra todas as notas dela com o número do dedo; a explicação diz a janela de casas e a extensão.
          </li>
          <li>Ligue as <strong>aberturas</strong> para ver as casas extras (dedo 1 uma casa atrás, dedo 4 uma casa à frente).</li>
          <li>Estude o mapa (no violão, toque tudo subindo e descendo dizendo o nome das notas).</li>
          <li>
            <strong>Fazer o teste</strong>: 40 notas em todas as cordas, com acidentes. Aprova com <strong>≥ 95% de acerto e tempo mediano ≤ 1,5 s</strong>, e depois 2
            frases curtas com ≥ 90% certas. O histórico fica abaixo do botão.
          </li>
        </ol>
      </Sec>

      <Sec id="g-leitura" title="Leitura de partituras (frases)">
        <p>Cada clique em Começar/Nova frase cria uma melodia nova, nunca repetida — é leitura à primeira vista de verdade.</p>
        <h3>Configurar</h3>
        <ul>
          <li>
            <strong>Região</strong>: a posição (ou uma <em>mudança</em> de posição, ex. II → V, ou o braço inteiro). <strong>Tonalidade</strong>: a armadura.
          </li>
          <li>
            <strong>Frase</strong>: fórmula de compasso (2/4 a 12/8), número de compassos e o <strong>ritmo</strong> (comece com “Só semínimas”).
          </li>
          <li>
            <strong>Melodia</strong>: tamanho dos saltos (comece com “Só graus conjuntos”) e se aparecem acidentes ocorrentes.
          </li>
          <li>
            <strong>Modo</strong>: veja abaixo.
          </li>
        </ul>
        <h3>Modo Estático (nota a nota) — o melhor para começar e para o trabalho</h3>
        <ol>
          <li>A nota da vez fica <strong style={{ color: 'var(--accent)' }}>azul</strong> na pauta.</li>
          <li>
            Clique no braço o lugar onde ela é tocada. Não há pressa — mas o tempo de cada nota é medido.
          </li>
          <li>
            A nota fica <strong style={{ color: 'var(--ok)' }}>verde</strong> se acertou, <strong style={{ color: 'var(--bad)' }}>vermelha</strong> se errou, ou{' '}
            <strong style={{ color: 'var(--warn)' }}>amarela</strong> se a nota está certa mas você tocou fora da região escolhida.
          </li>
          <li>
            No braço aparece o seu clique (verde/vermelho); se errou, um <strong>círculo com o nome da nota</strong> mostra onde ela estava. A frase{' '}
            <strong>segue mesmo se você errar</strong> — como numa leitura real.
          </li>
          <li>No fim: % de acertos, tempo por nota, lista dos erros e a digitação sugerida (números dos dedos) na pauta e no braço.</li>
        </ol>
        <h3>Modo Contínuo com metrônomo (clique no braço virtual) — o “jogo” sem violão</h3>
        <ol>
          <li>Escolha o andamento (bpm). Opções: pré-leitura (segundos para olhar a frase antes), metrônomo ligado, e apagar notas já tocadas (obriga a olhar à frente, mas esconde as cores).</li>
          <li>Há 1 compasso de contagem (os pontinhos mostram o tempo). Depois o cursor anda sozinho: clique cada nota no braço <strong>no tempo dela</strong>.</li>
          <li>
            <strong>As cores aparecem na hora</strong>: verde = certa e no tempo; amarela = nota certa com tempo impreciso; vermelha = nota errada ou não tocada. O
            placar ✔ / ≈ / ✖ no topo conta enquanto você toca.
          </li>
          <li>O cursor não espera. Se perder uma nota, pule para a próxima — parar é o erro mais grave.</li>
          <li>No fim: % no tempo, continuidade, altura certa, desvio de tempo e recuperação após erro.</li>
        </ol>
        <h3>Modo No violão ou cantando, com metrônomo (microfone)</h3>
        <ol>
          <li>
            Antes de começar, clique <strong>🎤 Ler tocando no violão (microfone)</strong>.
          </li>
          <li>Toque a frase no violão acompanhando o cursor, sem parar. O microfone verifica cada nota, com as mesmas cores ao vivo e o placar.</li>
          <li>Sem microfone, o app pede uma autoavaliação (“toquei sem parar”, etc.).</li>
        </ol>
        <h3>Solfejo (cantar)</h3>
        <ol>
          <li>
            Marque <strong>Cantar (solfejo)</strong> no quadro Modo. Funciona no modo Estático (no seu tempo) e no modo No violão/cantando (com o cursor).
          </li>
          <li>
            Clique <strong>🔊 Nota inicial</strong> para ouvir a primeira nota e afinar a voz. Depois ligue <strong>🎤 Cantar a frase</strong>.
          </li>
          <li>Cante cada nota (pode dizer o nome: “dó, ré, mi…”). O app confere a altura e aceita qualquer oitava — cada voz canta na sua região.</li>
          <li>Cante sustentando um pouco cada nota; sons muito curtos ou falados (sem altura) não são reconhecidos.</li>
        </ol>
        <p>
          No modo Estático, o botão 🎤 também funciona: toque cada nota no violão em vez de clicar. Nas posições (sem aberturas) cada nota tem um só lugar, por
          isso o microfone basta.
        </p>
        <p>
          <strong>Andamento sustentável</strong>: o app registra o maior bpm em que você leu <strong>3 frases novas seguidas</strong> com ≥ 85% no tempo e ≥ 90% de
          continuidade (modo contínuo). É o seu número de leitura real — tente subi-lo devagar.
        </p>
      </Sec>

      <Sec id="g-obras" title="Minhas partituras (suas músicas e tabs)">
        <p>Transforme qualquer música sua em exercício de leitura — com os mesmos modos acima (clicar no braço, tocar no violão, cantar).</p>
        <h3>Criar marcando no braço virtual</h3>
        <ol>
          <li>
            <Go to="scores">Minhas partituras</Go> → <strong>✏️ Criar marcando no braço</strong>. Dê um título e escolha tonalidade e compasso.
          </li>
          <li>
            Escolha a <strong>figura</strong> da próxima nota (teclas <kbd>1</kbd> semibreve, <kbd>2</kbd> mínima, <kbd>3</kbd> semínima, <kbd>4</kbd> colcheia,{' '}
            <kbd>5</kbd> semicolcheia; <kbd>.</kbd> pontuada).
          </li>
          <li>
            <strong>Clique no braço</strong> onde a nota é tocada — ela é escrita na pauta na hora, já com a digitação. <kbd>P</kbd> = pausa,{' '}
            <kbd>Backspace</kbd> = desfaz, “Ligar à próxima” = ligadura.
          </li>
          <li>As barras de compasso são colocadas sozinhas (uma nota que passa da barra vira duas notas ligadas). Use 🔊 Ouvir para conferir e Salvar.</li>
        </ol>
        <h3>Colar uma tablatura</h3>
        <ol>
          <li>
            <strong>🎸 Colar tablatura</strong> e cole o texto (blocos de 6 linhas, de <code>e|</code> até <code>E|</code>). Há um botão “Usar exemplo”.
          </li>
          <li>A tab não diz o ritmo: escolha todas semínimas, colcheias ou mínimas. Acordes viram a nota mais aguda. Depois de salvar, use Editar para acertar o ritmo.</li>
        </ol>
        <h3>Importar um arquivo</h3>
        <ol>
          <li>
            No <strong>MuseScore</strong> (gratuito) ou no <strong>Guitar Pro</strong>: <em>Arquivo → Exportar → MusicXML</em> (.musicxml ou .mxl).
          </li>
          <li>
            <strong>📄 Importar arquivo MusicXML</strong> → escolha o arquivo → confira a pré-visualização e os avisos → Salvar.
          </li>
          <li>O app usa a primeira parte e a voz principal; acordes viram a nota mais aguda; a digitação da tablatura do arquivo é aproveitada. Quiálteras (tercinas) ainda não são aceitas.</li>
        </ol>
        <h3>Praticar</h3>
        <p>
          Na lista, <strong>Praticar</strong> → escolha o modo (como na Leitura) → Começar. Os últimos resultados de cada música aparecem ao lado. Partituras próprias não
          entram nas revisões automáticas, e sim no seu próprio histórico.
        </p>
      </Sec>

      <Sec id="g-ritmo" title="Ritmo">
        <ol>
          <li>
            Antes de tudo, clique <strong>Calibrar latência</strong> e siga as instruções (bata o Espaço junto com os cliques). Faça uma vez em cada computador/fone.
          </li>
          <li>
            <strong>Execução com metrônomo</strong>: escolha nível, compasso, andamento e número de compassos. Tecle <kbd>Espaço</kbd> para começar: 1 compasso de
            contagem, depois bata <kbd>Espaço</kbd> no início de cada nota. Em pausas e notas ligadas, não bata.
          </li>
          <li>
            Opções: metrônomo durante o exercício (desligue para treinar sem muleta) e <strong>marcar a subdivisão</strong> (cliques fracos entre os tempos — 3 por
            tempo nos compostos).
          </li>
          <li>
            Nos compassos <strong>6/8, 9/8, 12/8</strong>, cada clique vale uma semínima pontuada (3 colcheias): conte “1-2-3, 2-2-3”.
          </li>
          <li>
            O resultado mostra cada toque adiantado/atrasado. Com violão, use <strong>🎤 Tocar no violão em vez do teclado</strong>.
          </li>
          <li>
            <strong>Reconhecimento</strong>: perguntas de quanto dura uma figura e se um compasso está completo — bom para aprender a teoria das figuras.
          </li>
        </ol>
      </Sec>

      <Sec id="g-int" title="Intervalos">
        <ul>
          <li>
            <strong>Pauta → nome</strong>: vê duas notas e diz o intervalo — primeiro o número (teclas <kbd>2</kbd>–<kbd>8</kbd>), depois a qualidade (maior,
            menor, justa…). A grafia manda: Dó–Ré♯ é 2ª aumentada; Dó–Mi♭ é 3ª menor.
          </li>
          <li>
            <strong>Nome → localizar no braço</strong>: o app dá a primeira nota e o intervalo; você clica onde fica a segunda. Aprenda os “desenhos” dos intervalos
            no braço.
          </li>
          <li>Nível 1 a 4 e direção (ascendente, descendente ou os dois).</li>
        </ul>
      </Sec>

      <Sec id="g-acordes" title="Acordes e harmonia">
        <ul>
          <li>
            <strong>Construir no braço</strong>: o app pede um acorde (ex. E+). Clique uma nota por corda no braço, depois <strong>Confirmar</strong>. Qualquer
            montagem correta é aceita, e o app explica qual você fez (inversão, tipo de voicing). <em>Limpar</em> recomeça; <em>Ouvir o meu</em> /{' '}
            <em>Ouvir o acorde</em> tocam o som. Opções: tríades/tétrades, tipo de voicing, pedir inversão. Com violão: <strong>🎤 Tocar arpejado</strong> (uma nota de
            cada vez).
          </li>
          <li>
            <strong>Identificar</strong>: vê um acorde no braço/pauta e diz o nome.
          </li>
          <li>
            <strong>Mapa CAGED</strong>: as 5 formas de cada acorde ao longo do braço, ligadas às posições.
          </li>
          <li>
            <strong>Condução de vozes</strong>: monte uma progressão II–V–I movendo os dedos o mínimo possível; o app mostra a solução ótima.
          </li>
        </ul>
      </Sec>

      <Sec id="g-ouvido" title="Treinamento auditivo (use fone)">
        <ul>
          <li>
            <strong>Grau da escala</strong>: toca uma cadência (para firmar a tonalidade) e depois uma nota — diga qual grau (1 a 7).
          </li>
          <li>
            <strong>Intervalos</strong> e <strong>Qualidade do acorde</strong>: ouça e escolha.
          </li>
          <li>
            <strong>Ditado melódico no braço</strong>: ouça uma melodia curta e marque as notas no braço.
          </li>
          <li>
            <strong>🔊 Ouvir de novo</strong> repete o som. Os níveis 1–4 aumentam a dificuldade.
          </li>
        </ul>
      </Sec>

      <Sec id="g-stats" title="Estatísticas">
        <ul>
          <li>Números gerais no topo (tentativas, acerto, dias praticados, ritmo, leitura, intervalos).</li>
          <li>
            <strong>Mapa do braço</strong>: cada casa colorida pela camada escolhida — estado de domínio, acerto, tempo, volume ou revisões vencidas — em um ou nos dois
            sentidos. Mostra onde estão os seus “buracos”.
          </li>
          <li>Tabelas por corda, por região e evolução semanal.</li>
          <li>
            <strong>Precisam de atenção</strong> (itens mais fracos) e <strong>Erros por tipo</strong> (oitava, casa vizinha, corda vizinha…) — diga a si mesmo qual
            erro você mais comete.
          </li>
        </ul>
      </Sec>

      <Sec id="g-mic" title="Microfone e afinação (só com violão)">
        <ol>
          <li>
            <strong>🎤 Ligar microfone</strong> e permita no navegador. Se aparecer “nenhum microfone encontrado”, o computador não tem microfone — responda pelo braço.
          </li>
          <li>Toque notas soltas: elas aparecem em “Notas detectadas” e o afinador mostra a afinação.</li>
          <li>
            <strong>Medir ruído de fundo</strong>: fique em silêncio alguns segundos — o app ajusta a porta de ruído para ignorar o ambiente.
          </li>
          <li>
            <strong>Lá de referência</strong> (padrão 440 Hz) e <strong>tolerância</strong> (±35 cents é o padrão; use ±50 se o violão estiver um pouco desafinado).
          </li>
          <li>
            O microfone sabe <em>qual nota</em> soou e <em>quando</em>, mas não <em>em que corda</em>. O áudio nunca é gravado nem enviado. Ele desliga sozinho ao sair da
            tela ou após 5 min sem notas.
          </li>
          <li>
            <strong>Testar com sinal sintético</strong>: confere a cadeia de detecção sem violão.
          </li>
        </ol>
      </Sec>

      <Sec id="g-config" title="Configurações e backup">
        <ul>
          <li>
            <strong>Nomenclatura</strong>: Dó-Ré-Mi ou C-D-E; convenção de oitava.
          </li>
          <li>
            <strong>Braço</strong>: número de casas, casas proporcionais ou iguais (iguais = mais fácil de clicar), canhoto, corda 1 em cima.
          </li>
          <li>
            <strong>Mostrar nomes das notas durante o treino</strong>: ajuda no começo, mas é muleta — desligue assim que puder.
          </li>
          <li>
            <strong>Itens novos por dia</strong> (10 é um bom começo) e <strong>retenção-alvo</strong> (90% recomendado; mais alto = mais revisões).
          </li>
          <li>Guitarra MIDI (só para quem tem captador hexafônico) e tema claro/escuro.</li>
          <li>
            <strong>Exportar backup (JSON)</strong> toda semana. Seu progresso fica só neste navegador; limpar os dados do navegador apaga o histórico.{' '}
            <strong>Importar backup…</strong> substitui os dados atuais (use para levar o progresso a outro computador).
          </li>
        </ul>
      </Sec>
    </section>
  );
}
