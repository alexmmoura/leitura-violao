import { useState, type ReactNode } from 'react';

/**
 * Teoria — textos curtos de consulta, escritos para este app, na ordem em que
 * os assuntos aparecem no estudo. Cada um aponta a tela onde praticar.
 */
interface Topic {
  id: string;
  title: string;
  about: string;
  body: ReactNode;
}

const T = ({ children }: { children: ReactNode }) => <table className="theory-table"><tbody>{children}</tbody></table>;

const TOPICS: Topic[] = [
  {
    id: 'intro',
    title: 'Introdução',
    about: 'Som, altura, duração: o básico da música escrita',
    body: (
      <>
        <p>Todo som musical tem quatro propriedades: <strong>altura</strong> (grave ou agudo), <strong>duração</strong> (curto ou longo), <strong>intensidade</strong> (fraco ou forte) e <strong>timbre</strong> (a “cor” de cada instrumento).</p>
        <p>A partitura registra principalmente as duas primeiras: a posição vertical da nota na <strong>pauta</strong> (as 5 linhas) indica a altura, e o desenho da nota (a figura) indica a duração.</p>
        <p>A música se organiza em três elementos: <strong>melodia</strong> (notas uma depois da outra), <strong>harmonia</strong> (notas ao mesmo tempo, os acordes) e <strong>ritmo</strong> (a organização das durações no tempo).</p>
      </>
    ),
  },
  {
    id: 'notas',
    title: 'Notas musicais e a pauta',
    about: 'Os sete nomes, as claves e a escrita do violão',
    body: (
      <>
        <p>São sete notas naturais: <strong>Dó, Ré, Mi, Fá, Sol, Lá, Si</strong> — nas cifras, <strong>C, D, E, F, G, A, B</strong>. Depois do Si, tudo recomeça uma <em>oitava</em> acima.</p>
        <p>Na pauta, cada linha e cada espaço é uma nota vizinha. A <strong>clave de Sol</strong> diz que a 2ª linha é o Sol. Daí: linhas (de baixo para cima) Mi–Sol–Si–Ré–Fá; espaços Fá–Lá–Dó–Mi.</p>
        <p>Notas fora da pauta usam <strong>linhas suplementares</strong>. O violão usa muitas abaixo da pauta (cordas 4, 5 e 6).</p>
        <p>O violão é escrito na clave de Sol com um pequeno “8” embaixo: ele <strong>soa uma oitava abaixo</strong> do que está escrito.</p>
      </>
    ),
  },
  {
    id: 'acidentes',
    title: 'Acidentes',
    about: 'Sustenido, bemol e bequadro; armadura de clave',
    body: (
      <>
        <p><strong>Sustenido (♯)</strong> sobe a nota um semitom (uma casa no violão). <strong>Bemol (♭)</strong> desce um semitom. <strong>Bequadro (♮)</strong> cancela.</p>
        <p>Um acidente escrito ao lado da nota vale <strong>até o fim do compasso</strong>, só para aquela altura. Uma nota ligada vinda do compasso anterior mantém o acidente.</p>
        <p>A <strong>armadura</strong>, logo depois da clave, vale para a música inteira e para todas as oitavas. Ordem dos sustenidos: Fá Dó Sol Ré Lá Mi Si; dos bemóis: o inverso.</p>
        <p>Dó♯ e Ré♭ soam igual no violão (são <em>enarmônicos</em>), mas são escritos em lugares diferentes da pauta.</p>
      </>
    ),
  },
  {
    id: 'tom',
    title: 'Tom e semitom',
    about: 'A menor distância entre duas notas',
    body: (
      <>
        <p><strong>Semitom</strong> é a menor distância: uma casa no violão. <strong>Tom</strong> são dois semitons: duas casas.</p>
        <p>Entre as notas naturais há um tom, exceto <strong>Mi–Fá</strong> e <strong>Si–Dó</strong>, que são semitons (por isso não existe tecla preta entre elas no piano).</p>
        <p>A escala maior segue sempre: tom – tom – semitom – tom – tom – tom – semitom.</p>
      </>
    ),
  },
  {
    id: 'ritmo',
    title: 'Figuras e compassos',
    about: 'Durações, pausas, ponto, ligadura, compassos simples e compostos',
    body: (
      <>
        <T>
          <tr><td>Semibreve</td><td>4 tempos</td></tr>
          <tr><td>Mínima</td><td>2 tempos</td></tr>
          <tr><td>Semínima</td><td>1 tempo</td></tr>
          <tr><td>Colcheia</td><td>½ tempo</td></tr>
          <tr><td>Semicolcheia</td><td>¼ de tempo</td></tr>
        </T>
        <p>Cada figura tem a sua <strong>pausa</strong> (silêncio) de mesma duração. O <strong>ponto</strong> aumenta a figura em metade do valor. A <strong>ligadura</strong> soma duas notas iguais: toca-se só a primeira.</p>
        <p>A <strong>fórmula de compasso</strong> diz quantos tempos cabem: em 3/4 são 3 semínimas. Nos compassos <strong>compostos</strong> (6/8, 9/8, 12/8) cada tempo é uma semínima pontuada, dividida em 3 colcheias.</p>
        <p>Pratique em <em>Estudar → Ritmo</em>.</p>
      </>
    ),
  },
  {
    id: 'intervalos',
    title: 'Intervalos',
    about: 'A distância entre duas notas: número e qualidade',
    body: (
      <>
        <p>O <strong>número</strong> vem da contagem das letras: Dó–Mi é uma 3ª (Dó, Ré, Mi). A <strong>qualidade</strong> vem dos semitons.</p>
        <T>
          <tr><td>2ª menor / maior</td><td>1 / 2 semitons</td></tr>
          <tr><td>3ª menor / maior</td><td>3 / 4</td></tr>
          <tr><td>4ª justa</td><td>5</td></tr>
          <tr><td>Trítono (4ª aum. / 5ª dim.)</td><td>6</td></tr>
          <tr><td>5ª justa</td><td>7</td></tr>
          <tr><td>6ª menor / maior</td><td>8 / 9</td></tr>
          <tr><td>7ª menor / maior</td><td>10 / 11</td></tr>
          <tr><td>8ª justa</td><td>12</td></tr>
        </T>
        <p>A grafia manda: Dó–Ré♯ é 2ª aumentada; Dó–Mi♭ é 3ª menor — mesmo som, nomes diferentes.</p>
        <p>Use <em>Ferramentas → Calculadora de intervalos</em> e pratique em <em>Estudar → Intervalos</em>.</p>
      </>
    ),
  },
  {
    id: 'escalas',
    title: 'Escalas',
    about: 'Maior, menores, pentatônicas, blues e modos',
    body: (
      <>
        <p>Escala é uma sequência de notas com distâncias fixas a partir de uma tônica.</p>
        <p><strong>Maior</strong>: T T S T T T S. <strong>Menor natural</strong>: T S T T S T T. A <strong>menor harmônica</strong> sobe o 7º grau; a <strong>melódica</strong> sobe o 6º e o 7º.</p>
        <p><strong>Relativas</strong> compartilham as mesmas notas: Dó maior e Lá menor. A relativa menor fica uma 6ª acima (ou 3 casas abaixo) da tônica maior.</p>
        <p><strong>Pentatônica</strong>: cinco notas (maior: 1 2 3 5 6; menor: 1 ♭3 4 5 ♭7). A <strong>penta blues</strong> acrescenta a ♭5. A <strong>hexafônica</strong> só tem tons inteiros. A <strong>diminuta</strong> alterna tom e semitom. A <strong>bebop</strong> acrescenta uma nota de passagem.</p>
        <p>Os <strong>modos</strong> (dórico, frígio, lídio, mixolídio, lócrio) são a escala maior começando de outros graus.</p>
        <p>Veja todas em <em>Ferramentas → Escalas</em>.</p>
      </>
    ),
  },
  {
    id: 'cifras',
    title: 'Cifras e formação de acordes',
    about: 'Tríades, tétrades e como ler uma cifra',
    body: (
      <>
        <p>Acordes se formam empilhando terças sobre a fundamental: <strong>1 – 3 – 5</strong> (tríade) e <strong>1 – 3 – 5 – 7</strong> (tétrade).</p>
        <T>
          <tr><td>C</td><td>maior: 1, 3, 5</td></tr>
          <tr><td>Cm</td><td>menor: 1, ♭3, 5</td></tr>
          <tr><td>C°</td><td>diminuto: 1, ♭3, ♭5</td></tr>
          <tr><td>C+</td><td>aumentado: 1, 3, ♯5</td></tr>
          <tr><td>C7M</td><td>1, 3, 5, 7</td></tr>
          <tr><td>C7</td><td>dominante: 1, 3, 5, ♭7</td></tr>
          <tr><td>Cm7</td><td>1, ♭3, 5, ♭7</td></tr>
          <tr><td>Cm7(♭5)</td><td>meio-diminuto: 1, ♭3, ♭5, ♭7</td></tr>
          <tr><td>Csus4 / Csus2</td><td>a 3ª é trocada pela 4ª / 2ª</td></tr>
          <tr><td>C6, Cadd9, C7(9)</td><td>notas acrescentadas (tensões)</td></tr>
        </T>
        <p>O nome do acorde não é uma digitação: as mesmas notas podem ser montadas de muitos jeitos no braço.</p>
      </>
    ),
  },
  {
    id: 'inversao',
    title: 'Inversão de acordes',
    about: 'Quando o baixo não é a fundamental',
    body: (
      <>
        <p>No <strong>estado fundamental</strong> a nota mais grave é a fundamental. Na <strong>1ª inversão</strong> o baixo é a 3ª (C/E); na <strong>2ª</strong>, a 5ª (C/G); na <strong>3ª</strong> (só tétrades), a 7ª.</p>
        <p>Na cifra, o baixo vem depois da barra: <strong>C/E</strong> = Dó maior com Mi no baixo. As inversões deixam a linha do baixo mais suave entre um acorde e outro.</p>
        <p>Veja em <em>Ferramentas → Inversão de acorde</em>.</p>
      </>
    ),
  },
  {
    id: 'campo',
    title: 'Campo harmônico',
    about: 'Os acordes que nascem de uma escala',
    body: (
      <>
        <p>Montando um acorde sobre cada nota da escala, usando só notas dela, obtém-se o campo harmônico. No tom <strong>maior</strong>:</p>
        <T>
          <tr><td>I</td><td>maior (7M)</td></tr>
          <tr><td>II</td><td>menor (m7)</td></tr>
          <tr><td>III</td><td>menor (m7)</td></tr>
          <tr><td>IV</td><td>maior (7M)</td></tr>
          <tr><td>V</td><td>maior (7 — dominante)</td></tr>
          <tr><td>VI</td><td>menor (m7)</td></tr>
          <tr><td>VII</td><td>diminuto (m7♭5)</td></tr>
        </T>
        <p>Em Dó: C, Dm, Em, F, G, Am, B°. Saber o campo é o primeiro passo para tirar músicas de ouvido: a grande maioria usa só esses acordes.</p>
      </>
    ),
  },
  {
    id: 'funcoes',
    title: 'Funções harmônicas',
    about: 'Tônica, subdominante e dominante',
    body: (
      <>
        <p>Cada acorde do campo cumpre um papel:</p>
        <p><strong>Tônica</strong> (repouso): I — e, mais fracos, VI e III. <strong>Subdominante</strong> (afastamento): IV e II. <strong>Dominante</strong> (tensão): V e VII.</p>
        <p>A tensão da dominante vem do <strong>trítono</strong> entre a 3ª e a 7ª do V7, que “pede” resolução na tônica.</p>
        <p>Acordes da mesma função podem se substituir. Ouça em <em>Ferramentas → Funções harmônicas</em> e <em>Substituição de acordes</em>.</p>
      </>
    ),
  },
  {
    id: 'cadencias',
    title: 'Cadências e o II–V–I',
    about: 'Como as frases harmônicas terminam',
    body: (
      <>
        <p>Cadência é o “ponto final” (ou vírgula) da harmonia.</p>
        <p><strong>Autêntica</strong>: V → I. <strong>Perfeita</strong>: IV → V → I. <strong>Plagal</strong>: IV → I. <strong>Meia cadência</strong>: termina no V. <strong>Deceptiva</strong>: V → VI (a resolução esperada não vem).</p>
        <p>O <strong>II–V–I</strong> (em Dó: Dm7 – G7 – C7M) percorre subdominante → dominante → tônica e é a base do jazz, da bossa nova e do choro.</p>
        <p>Ouça em <em>Ferramentas → Progressões e cadências</em>.</p>
      </>
    ),
  },
  {
    id: 'ciclo',
    title: 'Ciclo das quintas',
    about: 'O mapa das tonalidades',
    body: (
      <>
        <p>Subindo de quinta em quinta a partir do Dó (Dó, Sol, Ré, Lá, Mi, Si…), cada tonalidade ganha um sustenido. Descendo (Fá, Si♭, Mi♭…), ganha um bemol.</p>
        <p>Tons vizinhos no ciclo têm quase as mesmas notas, por isso modular entre eles soa natural. Os três acordes maiores de um tom (IV, I, V) ficam lado a lado no ciclo.</p>
        <p>Veja em <em>Ferramentas → Ciclo das quintas</em>.</p>
      </>
    ),
  },
  {
    id: 'dominantes',
    title: 'Dominantes secundárias e SubV7',
    about: 'Tensão extra para chegar a qualquer acorde',
    body: (
      <>
        <p>Qualquer acorde do campo (menos o VII) pode ser preparado pela sua própria dominante: em Dó, <strong>A7 → Dm</strong> (V7/II), <strong>E7 → Am</strong> (V7/VI), <strong>D7 → G</strong> (V7/V).</p>
        <p>O <strong>SubV7</strong> é a dominante substituta: um acorde dominante um trítono distante do V7, com o mesmo trítono interno. Em Dó: <strong>D♭7 → C</strong> no lugar de G7 → C. O baixo desce por semitom.</p>
        <p>O <strong>acorde diminuto</strong> de passagem (C – C♯° – Dm) faz o mesmo papel de dominante disfarçada.</p>
      </>
    ),
  },
  {
    id: 'modulacao',
    title: 'Transposição e modulação',
    about: 'Mudar de tom: a música inteira ou só um trecho',
    body: (
      <>
        <p><strong>Transpor</strong> é tocar a mesma música em outro tom: todos os acordes e notas se movem o mesmo intervalo (para se ajustar à voz de quem canta, por exemplo). Pensar em graus (I, IV, V) torna isso imediato.</p>
        <p><strong>Modular</strong> é mudar de tom no meio da música. O jeito mais comum é usar um acorde que pertence aos dois tons (acorde pivô) seguido da dominante do tom novo.</p>
      </>
    ),
  },
  {
    id: 'ouvido',
    title: 'Tocar de ouvido',
    about: 'Um método para tirar músicas',
    body: (
      <>
        <p>1. Ache a <strong>tônica</strong>: a nota em que a música “descansa” (em geral a última). 2. Descubra se o tom é maior ou menor. 3. Escreva o <strong>campo harmônico</strong> desse tom. 4. Ouça o <strong>baixo</strong> e teste primeiro I, IV e V; depois VI, II e III. 5. Só então procure acordes “de fora”.</p>
        <p>Treine o reconhecimento de graus, intervalos e tipos de acorde em <em>Estudar → Treinamento auditivo</em>.</p>
      </>
    ),
  },
  {
    id: 'posicoes',
    title: 'Posições no braço (leitura no violão)',
    about: 'Por que ler por posição funciona',
    body: (
      <>
        <p>A <strong>posição</strong> é a casa onde fica o dedo 1; os dedos 2, 3 e 4 ficam nas casas seguintes (um dedo por casa). A II posição cobre as casas 2 a 5.</p>
        <p>Dentro de uma posição, sem aberturas, <strong>cada nota escrita tem um único lugar</strong>. Por isso ler por posição é rápido: não há escolha a fazer.</p>
        <p>As <strong>aberturas</strong> estendem o dedo 1 uma casa para trás ou o dedo 4 uma casa para frente, sem mover a mão.</p>
        <p>Estude em <em>Estudar → Treinamento por posição</em>.</p>
      </>
    ),
  },
];

export default function TheoryPage() {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const topic = TOPICS.find((t) => t.id === open);
  if (topic) {
    const i = TOPICS.indexOf(topic);
    return (
      <section className="page theory">
        <header className="sub-head">
          <button type="button" className="back" onClick={() => setOpen(null)} aria-label="Voltar à lista">‹</button>
          <h1>{topic.title}</h1>
        </header>
        <article className="theory-body">{topic.body}</article>
        <div className="actions">
          {i > 0 && <button type="button" onClick={() => setOpen(TOPICS[i - 1]!.id)}>‹ {TOPICS[i - 1]!.title}</button>}
          {i < TOPICS.length - 1 && <button type="button" className="btn-primary" onClick={() => setOpen(TOPICS[i + 1]!.id)}>{TOPICS[i + 1]!.title} ›</button>}
        </div>
      </section>
    );
  }
  const f = filter.trim().toLowerCase();
  const list = TOPICS.filter((t) => !f || `${t.title} ${t.about}`.toLowerCase().includes(f));
  return (
    <section className="page">
      <header className="page-head">
        <h1>Teoria</h1>
        <p className="muted">Textos curtos de consulta, na ordem do estudo.</p>
      </header>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar assuntos…" aria-label="Filtrar assuntos" />
      <div className="tool-list">
        {list.map((t) => (
          <button key={t.id} type="button" className="tool-card" onClick={() => setOpen(t.id)}>
            <span>
              <strong>{t.title}</strong>
              <span className="muted">{t.about}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
