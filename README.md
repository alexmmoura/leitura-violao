# Leitura no Violão

Plataforma **local-first** e gratuita para desenvolver a leitura de partitura diretamente no violão.
A especificação completa está em [`docs/especificacao.md`](docs/especificacao.md).

## Como usar no dia a dia

1. **Dê dois cliques em `Iniciar.cmd`** (nesta pasta, `C:\Users\alex.moura\Documents\leitura-violao`) ou no atalho **Leitura no Violão** da Área de Trabalho.
   Abre uma janela preta (o servidor local) e o app no navegador, em `http://localhost:4173`.
2. Estude. Pode minimizar a janela preta; **para encerrar, feche-a**.
3. Opcional: no Chrome/Edge, use o ícone **Instalar** da barra de endereço para o app ganhar janela própria.
   Depois de aberto uma vez, ele funciona mesmo sem internet.

**Sem violão e sem microfone** (ex.: no trabalho), tudo funciona pelo mouse e teclado: flashcards e posições
(clicando no braço ou pelo teclado), leitura (clicando no braço; no modo contínuo, no tempo), ritmo (tecla
`Espaço`; calibre a latência uma vez em cada computador), intervalos, acordes, revisões e estatísticas.
O microfone só liga se você clicar em 🎤. Para o treinamento auditivo e o metrônomo, use fone de ouvido.

**Onde ficam os seus dados**: no navegador, ligados ao endereço `http://localhost:4173` (por isso a porta é
sempre a mesma). Eles **não** ficam nesta pasta e não passam de um computador para outro sozinhos.
Faça de vez em quando **Configurações → Exportar backup (JSON)** e guarde o arquivo. Para continuar em outro
computador: copie esta pasta para lá, abra com `Iniciar.cmd` e use **Importar backup…** (substitui os dados de lá).

**Em outro computador (ex.: em casa), sem instalar nada**: leve o arquivo `Documentos\LeituraNoViolao-portatil.zip`
(pendrive, Google Drive, e-mail para você mesmo), extraia numa pasta fixa e dê dois cliques em `Iniciar.cmd`. O pacote
já traz o Node.js dentro. Depois de mudanças no app, gere um pacote novo com
`powershell -ExecutionPolicy Bypass -File .\Gerar-pacote-portatil.ps1` (após `npm run build`).

**No celular Android** (o app é um PWA: instala pelo Chrome e funciona offline). Dois caminhos:

1. *Completo (recomendado)* — hospedar a pasta `dist/` num endereço **https** gratuito. Ex.: em
   [app.netlify.com/drop](https://app.netlify.com/drop), arraste o conteúdo de `Documentos\LeituraNoViolao-para-celular.zip`
   (extraído) e abra o endereço gerado no Chrome do celular → menu ⋮ → **Instalar app / Adicionar à tela inicial**.
   Com https funcionam o microfone e o uso sem internet. O app não envia dados: o progresso fica no próprio celular.
2. *Rápido, em casa* — dê dois cliques em `Iniciar-para-celular.cmd` e abra no celular (mesma rede Wi-Fi) o endereço
   `http://192.168…:4173` mostrado na janela. Sem https, o microfone e o modo offline **não** funcionam no celular,
   e qualquer aparelho da rede pode abrir o app enquanto a janela estiver aberta (não use na rede do trabalho).

O progresso do celular é separado do PC: leve-o com Exportar/Importar backup.

**Em outro computador, a partir desta pasta** só é preciso o [Node.js](https://nodejs.org) (versão LTS). A pasta `dist/` já é o app
pronto; se ela faltar, o `Iniciar.cmd` a reconstrói sozinho (na 1ª vez precisa de internet para baixar as dependências).

**Arquivos do iniciador**: `Iniciar.cmd` (procura o Node e chama o servidor) e `serve.mjs` (servidor local sem
dependências, só em `127.0.0.1`/`::1`, nada fica exposto na rede).

O passo a passo completo de cada função está dentro do app, em **Como estudar (guia)**.

## Estado atual — Fases 0 a 5

| Parte | Situação |
|---|---|
| Núcleo de domínio (alturas, grafia, armaduras, vigência de acidentes, mapeamento corda/casa, posições de Leavitt, gerador, validação, taxonomia de erros, explicações) | ✅ com testes |
| Registro imutável de tentativas em IndexedDB (esquema v2) + backup JSON | ✅ |
| Pauta (VexFlow 5, clave de Sol com 8), **clicável** por linha/espaço | ✅ |
| Braço virtual SVG (proporcional/uniforme, canhoto, marcadores, janela de posição, nomes) | ✅ |
| Módulos A/B — Flashcards: pauta → braço, braço → pauta e misto; 3 modos de resposta; mouse e teclado | ✅ |
| Módulo C — aula/mapa das posições + teste de conclusão (40 notas estratificadas, histórico) | ✅ (frases melódicas do teste: Fase 3) |
| PWA: instalável e 100 % offline após a primeira carga | ✅ |
| **Aprendizagem adaptativa**: FSRS-7 (ts-fsrs), nota derivada de acerto + tempo, fluência, estados de domínio, tudo recalculado do registro | ✅ com testes |
| **Meu treinamento**: sessões de 5/10/20/30 min (revisões vencidas, novos do currículo com limite diário, reaprendizagem, prática extra) | ✅ |
| **Estatísticas**: mapa de calor do braço (estado, acerto, tempo, volume, vencidas), por corda/região, evolução semanal, itens fracos | ✅ |
| **Módulo E — Ritmo (básico)**: execução com metrônomo e toques no Espaço, reconhecimento de figuras/compassos, calibração de latência | ✅ com testes |
| **Módulo D — Leitura de melodias**: gerador de frases originais (tonalidade, região, mudança de posição, ritmo, saltos, cromatismo), digitação de referência (Viterbi), modos estático / contínuo com metrônomo / no violão, olhar à frente, pré-leitura, métricas de C3 e andamento sustentável | ✅ com testes |
| **Módulo F — Intervalos**: pauta → nome (qualidade pela grafia) e nome → braço (com o "desenho") | ✅ com testes |
| Teste de conclusão de posição com as 2 frases; frase de aplicação ao fim de "Meu treinamento" | ✅ |
| **Microfone (Fase 4)**: YIN em AudioWorklet, rastreador de notas (estabilidade, ataques, notas repetidas), afinador, calibração de ruído, Lá de referência, tolerância em cents, sinal de teste sintético; resposta tocando no violão nos flashcards, na leitura (estática, contínua e "no violão" agora verificada) e no ritmo | ✅ com testes (sinal sintético; **falta validar com violão real**) |
| **Guitarra MIDI hexafônica** (opcional): canal → corda, nota → casa, via Web MIDI | ✅ com testes de mapeamento (**sem hardware para testar**) |
| **Módulo G — Acordes e harmonia**: tríades e tétrades com grafia correta; construir no braço com validação por atributo (funções, inversão, fechada/Drop 2/Drop 3/Drop 2+4, cordas, tocabilidade) aceitando qualquer voicing válido; identificar; mapa CAGED ligado às posições de Leavitt; condução de vozes II–V–I com o ótimo calculado; acorde arpejado pelo microfone | ✅ com testes |
| **Módulo H — Treinamento auditivo**: grau após cadência, intervalos (melódicos e harmônicos), qualidade de acordes, ditado melódico respondido no braço; som sintetizado localmente | ✅ com testes |
| Reconhecimento polifônico (acorde inteiro pelo microfone) | Não implementado — a especificação o classifica como experimental e pouco confiável; acordes são validados no braço ou arpejados |
| Extensão de foco (Fase 6) | **Retirada do escopo** por decisão do usuário (14/11/2026): não é necessária, e nada no projeto deve interferir na navegação |
| **Revisões espaçadas (FSRS) em todos os módulos**: intervalos, ritmo, frases de leitura, acordes e percepção viram itens próprios; "Meu treinamento" mostra os vencidos por módulo e o botão "Revisar" abre o módulo com uma fila de questões forçadas (menor probabilidade de lembrar primeiro) | ✅ com testes |
| **Compassos compostos e ligaduras**: 6/8, 9/8 e 12/8 no ritmo e na leitura (tempo = semínima pontuada, colcheias agrupadas de 3 em 3, metrônomo com subdivisão opcional, níveis próprios até a hemíola); ligaduras de prolongamento dentro do compasso e sobre a barra (a nota ligada não é atacada nem reavaliada; acidente não se repete na continuação) | ✅ com testes |
| **Guia "Como estudar"** dentro do app: rotina diária, ordem de estudo, cola da posição aberta e passo a passo de cada tela | ✅ |
| **Cores ao vivo** na leitura com metrônomo (clique no braço, violão ou voz): cada nota fica verde/amarela/vermelha na hora, com placar | ✅ |
| **Solfejo**: o microfone ouve a voz e aceita a nota certa em qualquer oitava (estático e com cursor); botão "Nota inicial" | ✅ com testes (lógica; **voz real não testada**) |
| **Minhas partituras**: criar marcando notas no braço virtual (figuras, pausas, ligaduras, barras automáticas), colar tablatura em texto, importar MusicXML (.musicxml/.xml/.mxl do MuseScore, Guitar Pro…); praticar em todos os modos; entram no backup | ✅ com testes (quiálteras ainda não) |
| **Visual 2**: tema preto, 4 abas (Estudar, Ferramentas, Teoria, Mais) — barra inferior no celular, lateral no computador —, listas de cartões, telas adaptadas a celular (braço e pauta rolam de lado) | ✅ |
| **Ferramentas** (12): braço com notas/intervalos, escalas (16), calculadora e audição de intervalos, calculadora de acordes pelo braço, campo harmônico, funções harmônicas, substituição, similaridade, inversão, progressões e cadências, ciclo das quintas, piano virtual | ✅ com testes do núcleo |
| **Teoria**: 17 textos próprios de consulta | ✅ |
| **Lições numeradas**: leitura rítmica (40 padrões em 2/4, 3/4, 4/4 e 6/8) e solfejo (28 lições em cada uma de 7 tonalidades, de 2 notas até a oitava); a lição aprovada fica marcada | ✅ com testes |
| Leitura: botão **mostrar/esconder o nome da nota** da vez; cores trocadas sem redesenhar a pauta (resposta imediata); desconto da latência de saída no julgamento do tempo pelo microfone; botão de batida na tela para o ritmo (celular) | ✅ |
| Não feito (existem no app de referência): bateria virtual, pads, player com controle de afinação/velocidade, dicionário de digitações de acordes, claves de Fá e Dó, quiálteras | — |
| Pendência: teste com violão real, com voz e num celular de verdade | — |

## Versões e publicação (GitHub) — para nada se perder nem regredir

O projeto já traz `.github/workflows/publicar.yml`. Depois de colocado num repositório do GitHub:

- cada alteração enviada fica registrada no histórico (dá para voltar a qualquer versão anterior);
- a cada envio o GitHub **roda os 169 testes**; se algum falhar, nada é publicado e a versão no ar continua a anterior;
- se passar, o app é publicado sozinho no **GitHub Pages** (endereço https gratuito, `https://USUARIO.github.io/REPOSITORIO/`),
  que é o endereço para instalar no celular Android (Chrome → ⋮ → Instalar app), com microfone e uso offline.

Passos (uma vez): instalar o Git; criar um repositório no GitHub; na pasta do projeto, `git init`, `git add .`,
`git commit -m "Versão inicial"`, `git branch -M main`, `git remote add origin <endereço do repositório>`, `git push -u origin main`;
no GitHub, em *Settings → Pages → Source*, escolher **GitHub Actions**.
Repositório público: Pages é gratuito. Repositório privado: Pages exige plano pago.

Regra para quem alterar o app: toda função nova do núcleo entra com teste em `src/**/*.test.ts`; rode `npm test` antes de enviar.

## Para desenvolver

Depois de mudar o código, rode `npm run build` para atualizar a pasta `dist/` que o `Iniciar.cmd` usa.

Requer Node.js (instalado em `%LOCALAPPDATA%\Programs\node-v26.13.1-win-x64`, já no PATH do usuário — abra um terminal novo).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes do núcleo (Vitest)
npm run build      # checagem de tipos + build de produção em dist/
```

Para testar o modo offline: `npm run build`, depois `npm run preview` (http://localhost:4173), abra uma vez, pare o servidor e recarregue.

## Atalhos (treino)

| Ação | Pauta → braço | Braço → pauta |
|---|---|---|
| Responder | corda (1–6), depois a casa, `Enter` | letra `C`…`B`, `↑`/`↓` oitava, `#`/`+` sustenido, `-` bemol, `=` bequadro, `Enter` |
| Corrigir | `Backspace` / `Esc` | `Backspace` (tira o acidente) / `Esc` |
| Próxima questão | `Enter` ou `Espaço` | idem |
| Encerrar sessão | `Esc` (sem nada digitado) | idem |

## Estrutura

```
src/
  core/                 TypeScript puro, sem navegador nem UI (testável)
    theory/             pitch, keySignature, accidentals, spelling
    instrument/         instrument (L(s), afinações), position (Leavitt)
    exercise/           constraints, noteQuestion (pauta → braço), fretQuestion (braço → pauta),
                        positionTest, validate, explain, rng
    learning/           kc (ids de itens), kinds (tipos de item de todos os módulos), rating (nota FSRS),
                        metrics (Wilson, fluência), model (FSRS + domínio), curriculum, planner (sessões),
                        progress (heatmap), reviews (vencidos por módulo)
    rhythm/             figuras, gerador de compassos, avaliação de toques
    melody/             melody (gerador de frases), fingering (Viterbi), sightReading (métricas C3)
    score/              partituras próprias: score (→ Melody), tab (tablatura em texto), musicxml + xml (importação)
    theory/intervals    intervalos: medida, transposição, nomes
    theory/chords       acordes: funções, cifras, empilhamento, campo harmônico
    harmony/            voicing (análise, Drop 2/3, enumeração, condução de vozes), caged, ear (percepção)
    audio/              yin (detector de altura), tracker (notas a partir dos quadros), synth (Karplus–Strong)
  audio/                metronome (cliques no relógio do AudioContext, conversão de toques),
                        pitch.worklet (YIN fora da thread da interface), microphone (serviço + hooks),
                        midiInput (Web MIDI)
  data/                 db (Dexie/IndexedDB, backup), settings
  ui/                   App, TrainingSession (executor de sessões), PracticePage, PositionsPage,
                        StatsPage, SettingsPage, Staff (adaptador VexFlow), Fretboard (SVG próprio)
docs/especificacao.md   especificação do produto
```

### Princípios que o código já garante

- **Escrita × soante**: `WrittenMidi` e `SoundingMidi` são tipos distintos; a conversão (`−12` no violão) acontece num só lugar.
- **VexFlow só desenha**: recebe grafia e acidente já calculados pelo núcleo.
- **Toda localização válida é aceita**: `V = L(s) ∩ restrições`; local certo fora da posição é um erro próprio (`OUT_OF_CONSTRAINTS`).
- **Reprodutibilidade**: cada questão vem de uma semente registrada.
- **Dados só locais**: nenhuma requisição de rede; backup manual em JSON.

## Licença

Código: MIT.
