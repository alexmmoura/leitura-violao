# Claves — notas para o Claude

App de leitura de partitura no violão (PWA + app Android). Tudo em português do Brasil:
textos do app, mensagens de commit (sem acentos) e conversa com o usuário.

## Comandos

- `npm install` — primeira vez num PC novo (precisa do Node.js 20 ou mais novo).
- `npm run dev` — servidor de desenvolvimento (Vite).
- `npm test` — testes (vitest). `npm run build` — checa tipos e monta `dist/`.
- `dist/` é versionado de propósito (o `Iniciar.cmd` abre o app sem internet): rode
  `npm run build` antes de cada commit para ele acompanhar o código.

## Prévia de celular (para ajustar a tela junto com o usuário)

Com `npm run dev` ligado, abra **`/celular.html`** (ex.: `http://localhost:5173/celular.html`):
mostra o app em dois celulares lado a lado, em pé (412 × 915) e deitado (915 × 412), ao
vivo. Só existe no desenvolvimento; não vai para o site.

## Versões e publicação

- `CHANGELOG.md` explica o número MAIOR.MENOR.CORREÇÃO. Para lançar: anotar a seção,
  `npm version X.Y.Z --no-git-tag-version`, `npm run build`, testes, commit.
- Enviar para `main` publica o site (GitHub Pages: https://alexmmoura.github.io/leitura-violao/).
- A etiqueta `vX.Y.Z` monta o `Claves.apk` no GitHub; o app do celular avisa sozinho
  quando sai versão nova.
- Só enviar (`git push`) ou criar etiqueta com o OK do usuário.
- `claves-v2.ico` nunca entra em commit (está no `.gitignore`).
- A chave que assina o APK NÃO fica no repositório (secrets do GitHub); nunca pedir nem
  mostrar a senha dela.

## Como o usuário quer as telas no celular (decidido junto, nov/2026)

- **Foco total na pauta e no braço.** Em pé e deitado, o exercício vem primeiro; títulos,
  etapas, "Encerrar", microfone, "Nota inicial", "Mostrar nome", "Ver partitura inteira",
  "Cores" e textos de informação ficam **embaixo** do braço (CSS `order`, `styles.css`).
- **Simetria.** Títulos centralizados na tela (não no espaço que sobra); grupos de botões
  centralizados.
- **Deitado:** enunciado, ♭ ♮ ♯ e Confirmar sobem para a linha do "‹ Estudar"; a pauta
  ocupa toda a largura; pauta e braço cabem juntos sem rolar; depois de responder, uma
  caixinha verde ✔ / vermelha ✖ e o "Próxima ›" aparecem no canto da pauta.
- **Em pé:** um só botão de avançar — o "Próxima (Enter)" no meio do cabeçalho do quadro
  de retorno (resultado à esquerda, tempo à direita); as explicações continuam, centralizadas.
- **Pauta sem branco sobrando:** `Staff.tsx` amplia o desenho conforme as notas da
  questão, num quadro de altura fixa (o braço não muda de lugar). A pauta clicável
  ("Escreva na pauta") mostra a faixa toda, Mi3 a Si6.
- **Braço sem barra de rolagem:** desliza com o dedo; com o mouse também arrasta quando não
  cabe na tela. Toque/clique sem arrastar marca a nota.
