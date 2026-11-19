# O que mudou no Claves

Cada versão tem um número **MAIOR.MENOR.CORREÇÃO**:

- **CORREÇÃO** (1.0.**1**): conserto de algo que não funcionava, sem novidade.
- **MENOR** (1.**1**.0): novidade ou melhoria visível, sem quebrar nada.
- **MAIOR** (**2**.0.0): mudança grande, que muda o jeito de usar.

O número da versão aberta aparece no fim da tela **Configurações**. Cada versão
também é marcada no Git (etiqueta `v1.0.0` etc.), o que permite voltar exatamente a ela.

## Como lançar uma versão nova

1. Anote abaixo, em "Ainda não lançado", o que mudou.
2. Troque o número em `package.json` (`"version"`) e o título da seção abaixo.
3. Salve e publique, e marque a versão: `git tag v1.1.0` e `git push origin v1.1.0`.

## Ainda não lançado

(nada por enquanto)

## 1.6.0 — 19/11/2026

- **App Android de verdade (Claves.apk)**: instala como qualquer app, abre em tela cheia (não como aba do navegador),
  funciona sem internet desde a instalação e usa o microfone. Baixe no celular em
  https://github.com/alexmmoura/leitura-violao/releases/latest/download/Claves.apk e abra o arquivo.
- O .apk é montado de graça pelo GitHub a cada versão marcada, com ícone e tela de abertura do Claves, e sempre
  assinado com a mesma chave — cada versão nova instala por cima da anterior sem perder o progresso.
- No app, um aviso mostra quando sai versão nova (consulta anônima ao GitHub, no máximo uma vez por dia).
- No app, **Exportar backup** abre o Compartilhar do Android (Drive, WhatsApp, e-mail…).
- Configurações (no navegador) ganhou o link para baixar o app Android.
- Margem para a barra de status do celular no topo das telas.

## 1.5.0 — 19/11/2026

- **302 obras originais de violão** na tela Obras clássicas: Giuliani (85), Sor (56), Horetzky (48), Carcassi (33),
  Kníže, Aguado, Bach (Suíte BWV 1006a, Prelúdio BWV 997), Mertz, Carulli, Coste, Matiegka, Tárrega ("Lágrima",
  "Adelita", "Capricho Árabe") e outros — todos mortos há mais de 70 anos (domínio público no Brasil), nas
  edições livres do Mutopia Project. Ficam na tonalidade e na oitava originais (clave de Sol com 8).
- Delas fica a **melodia** (a voz de cima; nos duos de violão, a parte do 1º violão), sem baixo nem acompanhamento.
  Obras com quiálteras ou fusas param antes do primeiro compasso que as tem; as que as têm logo no começo ficaram
  de fora (66), assim como os compositores vivos ou mortos há menos de 70 anos.
- Opção **"Só obras originais de violão"**: vale para a lista e para a escolha da próxima obra (automático tipo Anki).
- Cada obra do Mutopia mostra o crédito da edição e a licença (domínio público, CC BY ou CC BY-SA).
- Nomes de compositor das melodias irlandesas sem aspas soltas ("Tradicional (Irlanda; recolhida por F. O'Neill)").
- Baden Powell, Villa-Lobos, Pixinguinha, Dilermando Reis e outros autores do século XX **não** entram: as obras
  deles ainda têm direitos autorais.

## 1.4.0 — 18/11/2026

- **1.932 obras em domínio público** na tela Obras clássicas: aos 22 trechos escritos à mão somam-se 1.910 melodias
  baixadas do corpus aberto do music21 — 391 corais de Bach (voz do soprano), O'Neill's Music of Ireland e
  Ryan's Mammoth Collection (1883). Tonalidades difíceis transpostas para Fá, Dó, Sol, Ré, Lá ou Mi e oitava
  ajustada ao braço. Ficaram de fora: melodias com quiálteras (ainda não suportadas) e títulos ofensivos da época.
- Níveis recalibrados (59 / 247 / 1.025 / 308 / 271 obras do nível 1 ao 5); no automático o nível seguinte abre
  com 10 obras aprovadas (ou 80% do nível, o que for menor).
- Lista por **abas de nível**, **busca** por obra ou compositor e "mostrar mais"; o acervo carrega à parte
  (não pesa na abertura do app) e funciona sem internet.
- **Partitura em "papel"**: tinta preta em fundo creme, como partitura impressa; linhas alinhadas aos pixels
  (sem borrão); pauta de tamanho fixo e grande; barras de colcheia param nas pausas e agrupam por tempo;
  anacruse mais estreita. Pode ser desligada em Configurações → Aparência.
- Importação de MusicXML junta "fim de repetição + anacruse" num compasso só (sem pausas inventadas).

## 1.3.0 — 18/11/2026

- **Sessão de hoje** na tela inicial: o treino do dia já montado (notas, revisões dos outros módulos,
  leitura de frases, leitura rítmica e uma obra clássica), com um botão para começar.
- **Editar** a sessão: quanto tempo você tem hoje (5 a 45 min), quais atividades entram e, se quiser,
  um nível fixo. Dá para pular uma etapa ou parar e continuar mais tarde no mesmo dia.
- **Dificuldade automática** quando você começa sem editar: a leitura de frases sobe um degrau com
  3 frases aprovadas seguidas e desce com 2 reprovadas (13 degraus); as obras sobem de nível como no Anki;
  as lições rítmicas seguem a ordem.
- **Sua semana**: dias seguidos de estudo, exercícios e acerto dos últimos 7 dias.

## 1.2.0 — 18/11/2026

- **Obras clássicas (níveis 1–5)**: nova tela com 22 trechos de obras e canções em domínio público
  (Beethoven, Mozart, Bach/Petzold, Dvořák, Pachelbel, Haydn, Satie, tradicionais), só a melodia, escrita para violão.
- **Nível escolhido ou automático (tipo Anki)**: cada obra tem agendamento próprio (FSRS): as que você lê bem
  voltam cada vez mais tarde, as que erra voltam logo; o nível sobe sozinho com 80% do nível aprovado.
- As revisões de obras vencidas aparecem em **Meu treinamento**.
- Os mesmos modos da leitura de partituras: nota a nota, contínuo, no violão e solfejo.

## 1.1.0 — 17/11/2026

- **Frases (leitura de partituras e solfejo)**: a nota inteira fica colorida ao responder
  (antes só a haste mudava de cor) e a pauta ficou ~25% maior.
- **Revisão de notas**: no modo nota a nota, clique numa nota já respondida para ver o que era
  pedido, o que você marcou e onde ficava no braço.
- **Legenda das cores** discreta no canto (ⓘ Cores): azul = nota da vez, verde = certa,
  amarelo = nota certa fora da região (ou fora do tempo, nos modos com metrônomo), vermelho = errada.
- **Mais nitidez**: linhas da pauta mais grossas; cordas e trastes do braço mais grossos e claros.

## 1.0.0 — 17/11/2026

Primeira versão numerada. Reúne tudo feito até aqui:

- **Leitura de partituras**: frases geradas por região do braço (posição aberta, II, V…),
  com modo foco (as opções somem durante a prática e o menu lateral se recolhe) e
  pauta que se ajusta à largura da tela.
- **Leitura imediata de notas (flashcards)**: quadro de resposta com rótulos
  ("Pedida", "Você marcou", "Como achar", "Dica") e nome da nota nas bolinhas do braço.
- **Frases e solfejo**: a bolinha que você marcou mostra o nome da nota, ao lado da
  nota certa; botão 👀 para mostrar/esconder o nome da nota da vez.
- **Pauta**: linhas suplementares mais grossas e fáceis de contar.
- **Guia "Como estudar"**: seção visual sobre posições no braço (o que é “V posição”).
- Solfejo, leitura rítmica, ritmo livre, treinamento por posição, intervalos, acordes,
  treinamento auditivo, minhas partituras, estatísticas e backup dos dados.
- Funciona sem internet (app instalável) e é publicado no GitHub Pages.
- Testes automáticos da lógica (169) e das telas principais (6).
