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
