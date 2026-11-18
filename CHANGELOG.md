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
