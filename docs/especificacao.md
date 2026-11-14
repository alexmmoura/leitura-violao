# Especificação de Produto — Plataforma de Leitura Musical e Domínio do Braço do Violão

**Versão:** 0.1 (especificação conceitual — sem código) · **Data:** 13/11/2026

> **Convenção de rótulos usada em todo o documento**
> - **[FATO]** — informação documentada em fonte citada (documentação oficial, artigo, editora).
> - **[HIPÓTESE]** — afirmação plausível que precisa ser validada (teste, protótipo ou consulta à fonte primária).
> - **[RECOMENDAÇÃO]** — decisão de projeto proposta por esta especificação.
> - **[A VERIFICAR]** — referência que não pôde ser conferida diretamente nesta pesquisa; confirmar antes de citá-la publicamente.

---

## Sumário

1. Visão geral e objetivos do produto
2. Análise crítica da proposta original
3. Pesquisa das metodologias musicais
4. Comparação dos aplicativos de referência
5. Currículo pedagógico estruturado por níveis
6. Descrição detalhada de cada módulo
7. Lógica de funcionamento dos exercícios
8. Modelo matemático do mapeamento entre pentagrama e braço
9. Algoritmo de identificação das respostas corretas
10. Estratégia de repetição espaçada
11. Métricas de desempenho e aprendizagem
12. Arquitetura tecnológica recomendada
13. Modelo conceitual de armazenamento dos dados
14. Proposta de interface e navegação
15. Integração com microfone
16. Viabilidade do sistema de foco
17. Segurança, privacidade e licenciamento
18. Planejamento de desenvolvimento por fases
19. Critérios objetivos de aceitação
20. Riscos técnicos e pedagógicos
21. Referências

---

## 1. Visão geral e objetivos do produto

### 1.1 Declaração do produto

Esta é uma plataforma web **local-first**, gratuita, sem cadastro, voltada inicialmente para desktop. O objetivo é formar a competência de **ler partitura diretamente no violão**: olhar a notação, saber o que soa, saber onde tocar e tocar em tempo, sem parar.

### 1.2 As três competências e a sua relação

| Competência | O que é | Tipo de conhecimento | Como se mede |
|---|---|---|---|
| **C1 — Leitura musical** | Decodificar a notação: altura escrita, acidentes, armadura, ritmo, compasso, articulações | Declarativo → automatizado | Precisão e tempo de reconhecimento, sem instrumento |
| **C2 — Domínio do braço** | Saber onde está cada altura, entender a organização intervalar do braço e as posições | Espacial/motor | Precisão e tempo de localização, cobertura de regiões |
| **C3 — Leitura à primeira vista** | Integrar C1 e C2 em tempo real, com continuidade, ritmo e escolha de digitação | Habilidade integrada (procedural) | Continuidade, precisão rítmica e de altura em andamento-alvo, olhar à frente (*eye-hand span*) |

**[RECOMENDAÇÃO]** O sistema trata C1 e C2 como pré-requisitos **necessários, mas não suficientes**, para C3. Reconhecer uma nota isolada em 1,5 s é ótimo para um flashcard e inútil a 80 bpm em colcheias, onde há cerca de 375 ms por nota. A plataforma só considera alguém "leitor" quando as métricas de C3 atingem o alvo, e não quando os flashcards estão todos "dominados".

### 1.3 Objetivos mensuráveis do produto

1. Levar o estudante a reconhecer e localizar qualquer nota escrita da tessitura do violão (Mi escrito abaixo da pauta até, no mínimo, Si acima da pauta) em qualquer posição configurada, com ≥ 95 % de acerto e tempo mediano ≤ 1,5 s.
2. Levar o estudante a ler, em uma posição fixa, frases de 4 a 8 compassos em semínimas e colcheias a 60–80 bpm, sem interromper e com ≥ 90 % das notas corretas em altura e tempo (validado por microfone quando disponível).
3. Manter um histórico individual fino (por nota, local, posição, intervalo, figura rítmica e conceito), que permita revisão espaçada e diagnóstico honesto.
4. Funcionar offline depois de instalado, sem enviar dados nem áudio a servidores.

### 1.4 Fora de escopo (nesta versão)

- Avaliar qualidade técnica da mão direita, timbre, postura ou dinâmica. Um aplicativo não substitui o professor nesses aspectos. **[RECOMENDAÇÃO]** Dizer isso explicitamente na interface.
- Sincronização em nuvem, contas e ranking entre usuários.
- Reprodução de partituras protegidas por direitos autorais.

---

## 2. Análise crítica da proposta original

A proposta é sólida e ambiciosa. Os pontos abaixo são **correções conceituais** ou **ajustes de escopo** que, se não forem resolvidos agora, causarão retrabalho.

### 2.1 Correções conceituais

| # | Ponto da proposta | Problema | Correção |
|---|---|---|---|
| 1 | "Primeira posição, segunda posição" como blocos | Em Leavitt, a posição é definida pela casa do dedo 1, e as aberturas (dedo 1 para trás, dedo 4 para frente) estendem a janela para 5 ou 6 casas. "Posição aberta" (com cordas soltas) e "I posição" também não são a mesma coisa. | Modelar a posição como **janela base de 4 casas + extensões opcionais + uso opcional de cordas soltas** (§8.5). |
| 2 | "Selecionar a localização no braço" (Módulo A) | Uma mesma altura tem até 5 localizações com 19–20 casas. A pergunta fica ambígua se não disser qual resposta se espera. | Cada exercício declara um **modo de resposta**: "qualquer local válido", "local dentro da posição X", "todos os locais" ou "corda específica" (§9). |
| 3 | Sentido 2 dos flashcards: "identificar a nota no pentagrama" | Uma casa não determina a **grafia**: a 1ª casa da corda Si pode ser Dó ou Si#; a 2ª casa da corda Sol pode ser Lá ou Si𝄫, e a 4ª casa da corda Ré pode ser Fá# ou Sol♭. | Sem contexto tonal, aceitar qualquer grafia enarmônica correta. Com armadura definida, exigir a grafia coerente e dar feedback específico de "grafia enarmônica" (§8.3). |
| 4 | Transposição de oitava | A proposta está correta. Falta dizer que a notação mais precisa é a **clave de Sol com 8 embaixo**, e que muitas partituras usam a clave de Sol comum com a transposição implícita. | O motor guarda alturas **escritas** e **soantes** separadamente, com `soante = escrita − 12 semitons` como invariante (§8.2). |
| 5 | Nomenclatura de oitavas | Há convenções conflitantes: no índice científico (ASA), o Dó central é C4; em alguns softwares e na tradição franco-brasileira, aparece como Dó3. Isso gera divergência silenciosa. | Representação interna única (índice científico + número MIDI) e **exibição configurável** da convenção. |
| 6 | Microfone para validar o local | A proposta já reconhece o limite. Falta notar que, **dentro de uma posição fixa sem aberturas, cada altura tem no máximo um local** (§8.6). | A validação por microfone usa altura + restrição de posição. A responsabilidade de manter a posição fica declarada ao estudante, e há opção de hardware com saída por corda (MIDI hexafônico). |
| 7 | Leitura à primeira vista avaliada por acerto de notas | Essa avaliação não mede o essencial: **continuidade e tempo**. Na leitura à primeira vista, parar para corrigir é o erro mais grave. | Métricas próprias de C3: continuidade, desvio rítmico, notas no tempo e olhar à frente (§11.4). |
| 8 | "Dominar a nota após X acertos" | Domínio não é contagem. Há confusão entre memória (lembrar) e fluência (lembrar rápido e sob carga). | Modelo de domínio em duas dimensões, retenção (FSRS) e fluência (tempo), com mínimo de dias distintos (§11.2). |
| 9 | Acordes pelo microfone | O reconhecimento polifônico é um problema de pesquisa e não é viável com a mesma confiabilidade do monofônico. | Na Fase 5, a validação de acordes acontece no **braço virtual**. O áudio polifônico fica como recurso experimental. |
| 10 | Bloqueio de distrações "obrigatório" | Em software controlado pelo próprio usuário, nenhum bloqueio é inviolável (ele pode desinstalar a extensão). | Posicionar o recurso como **compromisso voluntário**, com fricção, e não como cofre (§16). |
| 11 | WhatsApp/SMS no cadeado social | O envio automático por WhatsApp ou SMS exige APIs pagas, servidor e verificação empresarial. | Fluxo local: o próprio usuário envia a mensagem por link (`wa.me`/`sms:`), e a validação do código é criptográfica e offline (§16.5). |

### 2.2 Ajustes de escopo e redundâncias

- **Módulos A e B se sobrepõem.** O Módulo A ("nota no pentagrama → local no braço") é o Sentido 1 do Módulo B. **[RECOMENDAÇÃO]** Juntar os dois num único **motor de reconhecimento**. O "Módulo A" passa a ser a interface de *prática livre e configurável*, e o "Módulo B" passa a ser o *modo flashcard espaçado bidirecional*. Os dois compartilham itens e histórico.
- **"Treinamento auditivo" aparece na navegação, mas não tem módulo.** Esta especificação cria o **Módulo H — Percepção** (§6.8).
- **"Meu treinamento" não está definido.** Ele vira o **orquestrador de sessões** (revisões vencidas + conteúdo atual + aplicação em leitura), o coração da prática diária.
- **Fases.** A Fase 2 (aprendizagem adaptativa) não pode vir *depois* da Fase 1 em termos de dados: o registro de tentativas precisa existir desde o primeiro exercício (§18).

---

## 3. Pesquisa das metodologias musicais

### 3.1 William Leavitt — *A Modern Method for Guitar* (Berklee Press)

**[FATO]** Segundo a análise do Laboratório de Guitarra da UFPB sobre o sistema de digitações de Leavitt ([UFPB/LGEMU](https://www.cchla.ufpb.br/lgemu/contents/noticias/o-sistema-de-digitacoes-de-willian-g-leavitt)):

- **Posição** é a casa onde fica o dedo 1 na disposição natural (dedos 1–4 em casas vizinhas). Dedo 1 na casa 5 = V posição.
- Há três variações com **aberturas sem mudar de posição**: abertura do dedo 1 (para trás), abertura do dedo 4 (para frente) e abertura dos dois.
- Com aberturas, a referência mais confiável é o **dedo 2**: posição = casa do dedo 2 − 1, porque o dedo 2 nunca abre.
- As aberturas do dedo 4 são as mais difíceis e muitas vezes podem ser trocadas por pequenas mudanças de posição.
- O Volume 1 apresenta padrões de escala maior **móveis**; o Volume 2 acrescenta movimento horizontal para posições vizinhas; o Volume 3 apresenta o sistema de doze posições.
- O método está fortemente ligado à leitura em notação tradicional. As escalas são aprendidas *lendo*.

**[FATO]** A Berklee Press publica outras obras de leitura de Leavitt, como *Reading Studies for Guitar* e *Melodic Rhythms for Guitar* ([Berklee Press — William Leavitt](https://berkleepress.com/berklee-authors/william-leavitt/)). **[A VERIFICAR]** *Reading Studies* é descrito correntemente como organizado por posição e tonalidade. Confirmar no sumário da obra.

**Aplicação na plataforma [RECOMENDAÇÃO]:**
1. O **Módulo C** usa a definição de posição de Leavitt *literalmente*, inclusive a regra do dedo 2 para aberturas.
2. Cada posição tem **janela base** (4 casas) e **janela estendida** (5–6 casas). O estudante aprende primeiro a base e depois as aberturas, como um subnível.
3. A ordem inicial de posições recomendada é **II → V → VII → IX → XII → demais**. A II posição cobre quase toda a primeira região sem cordas soltas. A V e a XII ancoram em referências visuais (marcadores) e em uníssonos fáceis de verificar. **[A VERIFICAR]** Descrições correntes apontam que o Vol. 1 começa pela II posição; confirmar no livro. A ordem acima é decisão de projeto, não citação.
4. A mudança de posição é treinada como **habilidade própria** (Módulo D, nível 4+), e não como consequência.

### 3.2 Julio Sagreras — *Las Lecciones de Guitarra* (6 livros)

**[FATO]** Julio S. Sagreras (1879–1942, Argentina) escreveu uma série progressiva em seis livros. O primeiro conjunto (*Las Primeras Lecciones de Guitarra*) vai de cordas soltas a peças de iniciante avançado/intermediário inicial, e os seguintes avançam para o nível intermediário e intermediário avançado ([This is Classical Guitar](https://www.thisisclassicalguitar.com/sagreras-method-books-lessons/)). As lições são curtas, focadas, e cada uma explica seu objetivo.

**[HIPÓTESE / A VERIFICAR]** Organização geral comumente descrita: Livro 1 em primeira posição, começando por cordas soltas, depois melodia com baixos e arpejos simples; livros seguintes introduzem ligados, posições superiores, ornamentos e repertório de concerto. Confirmar livro a livro numa edição.

**Direitos autorais [FATO + RECOMENDAÇÃO]:** A morte do autor em 1942 sugere domínio público em países com prazo de vida + 70 anos (como Brasil e Argentina) desde 2013. Mesmo assim, **traduções, revisões e edições modernas** têm direitos próprios, e a situação em cada jurisdição (por exemplo, os EUA, onde vale a data de publicação) precisa ser verificada. **[RECOMENDAÇÃO]** A plataforma **não incorpora partituras de Sagreras**. Ela usa os **princípios** como regras do gerador:

| Princípio inferido de Sagreras | Regra do gerador |
|---|---|
| Progressão em passos muito pequenos | Cada nível acrescenta **uma** variável nova (nova corda, nova figura ou novo acidente) |
| Cordas soltas como âncora | Exercícios iniciais alternam cordas soltas e notas presas, e os baixos usam cordas soltas |
| Melodia + baixo (duas vozes) | Nível 4+: leitura a duas vozes (haste para cima/para baixo), baixo em cordas soltas |
| Estudos curtos com objetivo único | Cada exercício gerado mostra um "objetivo da lição" de uma linha |
| Fluência por repetição de peças curtas | Exercícios podem ser "fixados" para repetição deliberada, ao lado dos sempre novos |

### 3.3 Aaron Shearer — *Classic Guitar Technique* (Alfred)

**[FATO]** *Classic Guitar Technique, Vol. 1* (Alfred, ref. 00-FC01937) é uma das obras de referência da pedagogia norte-americana do violão clássico ([Alfred](https://www.alfred.com/products/classic-guitar-technique-volume-1-00-fc01937)).

**[A VERIFICAR — conferir nas obras]** Contribuições comumente atribuídas a Shearer, nesta obra e na série posterior *Learning the Classic Guitar* (3 partes):
- Separar e ordenar fundamentos técnicos (posição, ataque da mão direita, preparação dos dedos) antes de juntá-los.
- Ênfase em **entender o que se lê** (contagem rítmica explícita, compreensão intervalar) e não apenas em decodificar notas.
- **Ensaio mental / visualização** antes da execução física (*Learning the Classic Guitar, Parte 3*: memorização e performance).

**Aplicação [RECOMENDAÇÃO]:**
- **Contagem explícita** no Módulo E (o estudante conta em voz alta ou toca junto, com sílabas de contagem configuráveis).
- **Pré-leitura** (*study before playing*): antes de cada frase de leitura à primeira vista, há uma fase opcional de 10–30 s para examinar armadura, compasso, ritmos difíceis, região e mudanças de posição, uma prática comum também no ensino de leitura à primeira vista.
- **Visualização**: um modo em que o estudante "toca mentalmente" a frase marcando os locais no braço virtual sem som, antes de tocar no instrumento.
- **Fora do alcance do app**: a técnica da mão direita. O app pode lembrar a digitação da mão direita (p-i-m-a) mas não avaliá-la.

### 3.4 Integração: a metodologia própria — "Leitura Posicional Progressiva"

**Conceitos complementares (ensinar juntos):**
- Posições de Leavitt + reconhecimento de notas: cada nota é aprendida *dentro* de uma posição, o que dá contexto motor ao conhecimento.
- Progressão em passos pequenos de Sagreras + repetição espaçada: os dois favorecem pequenas doses frequentes.
- Compreensão rítmica de Shearer + metrônomo: contar antes de tocar.
- Organização intervalar do braço (contemporânea) + intervalos (Módulo F): o braço como grade de intervalos (corda vizinha = 4ª justa, exceto Sol–Si = 3ª maior).

**Conceitos a ensinar separadamente (e só depois integrar):**
- **Ritmo e altura**: o ritmo é treinado primeiro sem altura (Módulo E, uma nota só ou percussão) e a altura primeiro sem ritmo (Módulos A/B). A integração acontece no Módulo D. Juntar cedo demais sobrecarrega a memória de trabalho. **[HIPÓTESE]** baseada na teoria da carga cognitiva (Sweller, 1988).
- **CAGED e posições**: são dois sistemas de mapeamento do braço com recortes diferentes (formas de acorde × janelas de dedos). Ensinar os dois ao mesmo tempo confunde. **[RECOMENDAÇÃO]** Posições primeiro (base de leitura). CAGED entra no Módulo G como *mapa harmônico*, com uma tela de equivalência: "a forma de Mi do acorde de Lá vive na V posição".
- **Leitura de acordes na pauta e leitura de cifras**: são competências diferentes. A cifra não é leitura de partitura.
- **Repertório popular, blues e jazz**: notação de *swing* (colcheias escritas e tocadas em tercina), cifras sobre a pauta e síncopes antecipadas. Entra no nível 5+, com a convenção indicada sempre na partitura.

---

## 4. Comparação dos aplicativos de referência

> **Aviso [FATO + HIPÓTESE]:** as características abaixo vêm de conhecimento geral sobre os produtos. Modelos de preço e funções mudam com frequência; **verifique nos sites oficiais antes de citar**. A tabela serve para posicionar a proposta, não para documentar terceiros.

| Produto | Foco | Pontos fortes | Lacunas em relação a este projeto | Modelo |
|---|---|---|---|---|
| **musictheory.net / Tenuto** | Exercícios de teoria, incl. identificação de notas no braço | Simples, rápidos, configuráveis | Sem posições de Leavitt, sem repetição espaçada por item, sem leitura à primeira vista em tempo real | Web gratuita; app pago |
| **Yousician** | Ensino gamificado com microfone | Detecção de áudio em tempo real, feedback imediato | Ênfase em tablatura/cifra; pouca leitura de partitura; conteúdo fixo | Assinatura |
| **Rocksmith+** | Prática com músicas reais | Motivação, repertório | Tablatura, não partitura; exige assinatura | Assinatura |
| **Sight Reading Factory** | Gera exercícios de leitura à primeira vista | Geração ilimitada, níveis, inclui violão | Sem braço interativo, sem reconhecimento por posição, sem repetição espaçada | Assinatura |
| **Functional Ear Trainer** | Percepção funcional (notas em contexto tonal) | Método eficaz e conhecido | Só percepção | Gratuito |
| **Anki** (com baralhos de violão) | Repetição espaçada genérica | FSRS de alto nível | Sem interação musical, sem áudio de entrada, sem geração | Gratuito (desktop) |

**Lacuna identificada:** nenhuma ferramenta conhecida junta **(a)** leitura em notação tradicional, **(b)** modelo de posições de Leavitt, **(c)** repetição espaçada por item com medida de fluência e **(d)** leitura à primeira vista contínua com geração de frases. Esse é o diferencial do projeto.

---

## 5. Currículo pedagógico estruturado por níveis

Cada nível tem **critério de entrada**, **conteúdos por competência** e **critério de saída** (verificável pelo sistema). Os níveis não são trancados rigidamente: o estudante pode avançar manualmente, e o sistema avisa quando os pré-requisitos não estão consolidados.

### Nível 0 — Fundamentos da notação (sem violão)
- **C1:** pauta, clave de Sol (com 8), linhas e espaços, linhas suplementares inferiores (até Mi escrito), figuras (semibreve a colcheia) e pausas, compassos 2/4, 3/4 e 4/4, barra de compasso.
- **C2:** nomes das cordas soltas; numeração de cordas e casas; marcadores.
- **Saída:** identificar notas naturais escritas de Mi3 a Sol5 (convenção científica escrita) com ≥ 90 % de acerto e mediana ≤ 3 s.

### Nível 1 — Posição aberta, notas naturais
- **C1:** notas naturais escritas de Mi3 a Sol5 (cordas 1–6, casas 0–3).
- **C2:** cordas 1–3 primeiro, depois 4–6; uníssonos (3ª corda, casa 4 = 2ª corda solta).
- **Ritmo:** semibreve, mínima, semínima e pausas em 4/4.
- **C3:** melodias de 2–4 notas em graus conjuntos numa corda; depois em duas cordas vizinhas.
- **Saída:** 95 % dos itens do nível em estado ≥ "Consolidando" (§11.2); ler 4 compassos de semínimas a 60 bpm com continuidade ≥ 90 %.

### Nível 2 — Acidentes e primeiras tonalidades
- **C1:** sustenido, bemol e bequadro; vigência do acidente no compasso; armaduras de Dó, Sol, Ré e Fá maiores e Lá e Mi menores.
- **C2:** acidentes na posição aberta; equivalências enarmônicas.
- **Ritmo:** colcheias, ponto de aumento na mínima, ligadura de prolongamento.
- **Intervalos:** 2ªs e 3ªs (maiores/menores) na pauta.
- **Saída:** acerto ≥ 90 % em notas com acidentes em contexto tonal, incluindo o acidente "esquecido" da armadura (métrica específica de erro, §9.4).

### Nível 3 — II e V posições (Leavitt)
- **C2:** janela base da II e da V posições; depois com aberturas; mapa de uníssonos entre posições.
- **C1:** armaduras até 2 acidentes.
- **Ritmo:** semínima pontuada + colcheia; 3/4 e 2/4; contratempo simples.
- **Intervalos:** 4ªs, 5ªs e oitavas e seus desenhos no braço.
- **C3:** frases de 4–8 compassos *dentro* de uma posição; modo contínuo a 60–72 bpm.
- **Saída:** teste de conclusão de posição aprovado (Módulo C) para II e V.

### Nível 4 — Posições VII, IX, XII e mudanças de posição
- **C2:** novas posições; mudanças de posição (por corda solta, por deslize de dedo-guia e por salto); conjuntos de cordas.
- **C1:** armaduras até 3–4 acidentes; compassos compostos (6/8, 9/8, 12/8); semicolcheias.
- **Intervalos:** 6ªs, 7ªs; aumentados e diminutos.
- **C3:** frases que pedem mudança de posição; leitura a duas vozes (melodia + baixo em corda solta, inspirada em Sagreras).
- **Saída:** frases com uma mudança de posição a 72 bpm com continuidade ≥ 90 % e notas no tempo ≥ 85 %.

### Nível 5 — Braço inteiro e harmonia básica
- **C2:** todas as posições; qualquer nota em qualquer região; escolha de digitação.
- **C1:** todas as armaduras; síncopes; quiálteras; ligaduras através da barra; notação de swing.
- **Harmonia:** tríades maiores, menores, aumentadas e diminutas e inversões em conjuntos de 3 cordas; CAGED como mapa.
- **C3:** estudos curtos originais (16 compassos) com mudanças de posição; repertório popular, blues e jazz em notação.

### Nível 6 — Leitura avançada e voicings
- **Harmonia:** tétrades (maj7, 7, m7, m7♭5, °7), inversões, Drop 2 e Drop 3, condução de vozes em progressões II–V–I.
- **C3:** leitura de acordes na pauta em tempo; leitura a duas e três vozes; estudos com dinâmica e articulação.
- **Saída:** definida pelo usuário (metas pessoais), porque o nível é aberto.

---

## 6. Descrição detalhada de cada módulo

### 6.1 Módulo A — Reconhecimento (prática livre configurável)

**Objetivo:** reconhecer a nota escrita e localizá-la no braço.

**Fluxo:** o sistema mostra uma nota → o estudante responde (clique no braço, teclado ou violão + microfone) → validação (§9) → feedback com todas as localizações válidas destacadas.

**Configurações:**
- Conjunto de alturas: só naturais / com acidentes / lista manual (seleção de notas na pauta).
- Cordas habilitadas (1 a 6, qualquer combinação).
- Posição: aberta, I–XII ou "braço inteiro"; limites de casas (mín./máx.).
- Faixa de oitavas escritas (mín./máx.).
- Modo de resposta: "qualquer local válido", "dentro da posição", "todos os locais" ou "corda indicada" (o sistema sinaliza a corda e pede a casa).
- Armadura (para exigir grafia e testar acidentes implícitos).
- Limite de tempo (opcional) e número de questões.

**Distinção em relação ao Módulo B:** o A é prática **deliberada e escolhida**; o B é **revisão programada**. As tentativas do A também atualizam o histórico dos itens (com peso configurável, §10.6).

### 6.2 Módulo B — Flashcards bidirecionais (repetição espaçada)

- **Sentido 1 (pauta → braço):** como o Módulo A, com o modo de resposta definido pelo cartão.
- **Sentido 2 (braço → pauta):** uma casa acende no braço → o estudante escreve a nota na pauta (clicando na linha ou espaço e escolhendo o acidente) ou digita o nome + oitava.
- **Sentido 3 (opcional, auditivo):** o som da nota → o estudante localiza (ponte com o Módulo H).

**Regras anti-memorização unidirecional [RECOMENDAÇÃO]:**
1. Cada par (altura escrita, local) gera **cartões independentes** para cada sentido, com histórico FSRS próprio.
2. Os sentidos são **intercalados** na mesma sessão (*interleaving*, Kornell & Bjork, 2008).
3. Um cartão do sentido 2 só é apresentado depois do mesmo item no sentido 1 ter sido introduzido, e vice-versa. Os dois nunca aparecem consecutivamente para o mesmo item (intervalo mínimo de 3 cartões).
4. O painel mostra assimetrias ("você reconhece Fá#4 na pauta em 1,1 s, mas leva 3,4 s para nomear a corda 4, casa 4").

### 6.3 Módulo C — Treinamento por posição

Cada posição (aberta, I–XII, e extensões configuráveis) é uma **unidade de estudo** com:

1. **Aula explicativa:** definição da posição (regra do dedo 1 / dedo 2), janela base e aberturas, notas naturais e acidentes da região, uníssonos com posições vizinhas, digitação dos dedos por casa.
2. **Mapa de notas:** braço filtrado para a janela, com nomes; pauta com a tessitura da posição (nota mais grave e mais aguda).
3. **Exercícios de reconhecimento:** subconjunto progressivo (primeiro cordas 1–3 da posição, depois 4–6, depois tudo, depois aberturas).
4. **Exercícios aleatórios:** todas as notas da posição, ordem aleatória ponderada pela necessidade (§10).
5. **Sequências melódicas:** frases geradas dentro da janela (Módulo D restrito).
6. **Escalas e arpejos da posição:** escala maior (e depois menor) nas tonalidades que cabem na posição, como em Leavitt, lidas na pauta.
7. **Teste de conclusão:** 40 itens com amostragem estratificada (todas as cordas, ≥ 1 acidente por corda), mais 2 frases melódicas. Aprovação: ≥ 95 % de acerto, mediana ≤ 1,5 s e frases com continuidade ≥ 90 %.
8. **Histórico individual:** evolução por posição (acerto, tempo e cobertura).

**Combinação de posições vizinhas:** o estudante pode selecionar, por exemplo, "V + VII". O sistema gera exercícios que **exigem** a mudança (notas que só existem numa delas) e mostra a casa de mudança sugerida.

### 6.4 Módulo D — Leitura de melodias

**Progressão de dificuldade** (cada parâmetro em escala própria, §7.3):
1. 2 notas → 3 notas → 4–8 notas.
2. Graus conjuntos → 3ªs → saltos maiores.
3. Uma corda → cordas vizinhas → saltos de corda.
4. Sem acidentes → acidentes da armadura → acidentes ocorrentes.
5. Uma posição → mudança de posição.
6. Sem ritmo (notas em sequência, sem tempo) → ritmo simples → ritmo do nível atual.

**Submodos:**
- **Estático:** a frase inteira aparece; o estudante toca/responde nota a nota em seu tempo. Treina C1+C2 em sequência.
- **Contínuo com metrônomo:** a frase rola (ou o cursor avança) a um andamento fixo, e **a música não espera**. Erros são registrados, mas o estudante deve continuar. É este submodo que treina C3.
- **Revelação progressiva:** as notas aparecem uma a uma ou compasso a compasso, sem antecipar a resposta.
- **Janela de leitura à frente (*look-ahead*) [RECOMENDAÇÃO]:** depois que o cursor passa, a nota é **mascarada**. Isso força o olhar a ficar à frente da execução, a habilidade associada ao *eye-hand span* (Sloboda, 1974; Gudmundsdottir, 2010 — [A VERIFICAR] detalhes bibliográficos). O tamanho da janela visível pode diminuir para treinar a antecipação.
- **Pré-leitura:** fase de análise antes do início (§3.3).

**Entrada de respostas no modo contínuo:** violão + microfone (recomendado) ou teclado/clique, com avaliação de altura e de tempo de ataque (onset).

### 6.5 Módulo E — Leitura rítmica

**Conteúdos:** semibreve até semicolcheia; pausas correspondentes; ponto de aumento; ligadura; compassos simples (2/4, 3/4, 4/4) e compostos (6/8, 9/8, 12/8); síncope; quiálteras; subdivisões (binária e ternária); anacruse.

**Tipos de exercício:**
1. **Reconhecimento:** "quantos tempos dura?", "qual figura completa o compasso?", "este compasso está completo?".
2. **Contagem:** o estudante associa as sílabas de contagem (configuráveis, por exemplo "1 e 2 e" ou "1-e-&-a") a cada figura.
3. **Execução (*tapping*):** toca o ritmo com uma tecla (Espaço) ou com uma corda solta (microfone, por detecção de ataque) junto do metrônomo.
4. **Ditado rítmico (ponte com o Módulo H):** ouve e escreve.

**Avaliação da execução:** para cada ataque esperado, o desvio em ms em relação ao tempo ideal. Tolerância por nível (por exemplo, ±80 ms no nível 1, ±40 ms no nível 5). Nota extra = falso positivo; nota faltante = omissão. A latência do sistema precisa ser **calibrada** (§15.6).

**Metrônomo:** visual (pulso na tela, acento no tempo 1) e sonoro (com subdivisão opcional); contagem de entrada de 1 compasso; agendamento preciso com o relógio do Web Audio (§12.5).

### 6.6 Módulo F — Intervalos

- **Na pauta:** identificar o intervalo entre duas notas escritas (número + qualidade: 2ª menor... 8ª justa, aumentados e diminutos). O cálculo de *qualidade* exige **grafia**: Dó–Ré# é 2ª aumentada e Dó–Mi♭ é 3ª menor, embora soem igual.
- **No braço:** dada uma nota no braço e um intervalo, localizar a segunda nota (na mesma corda, em corda vizinha, num conjunto específico).
- **Desenhos intervalares:** o sistema ensina os "desenhos" e a exceção Sol–Si (3ª maior em vez de 4ª justa), que desloca os desenhos em 1 casa ao cruzar essa fronteira.
- **Execução:** tocar o intervalo melódico lido (microfone valida as duas alturas).
- **Harmônico vs. melódico:** os dois são reconhecidos na pauta; a execução pelo microfone é só melódica (o harmônico depende de polifonia, §15.8).

### 6.7 Módulo G — Acordes, inversões e voicings

**Conceitos e entidades:**
- **Acorde (abstrato):** fundamental + qualidade → conjunto de classes de altura com funções (1, 3, 5, 7...).
- **Voicing (concreto):** lista de alturas soantes, uma por corda, com casa e corda.
- **Inversão:** definida pela função da **nota mais grave** (fundamental = estado fundamental; 3ª = 1ª inversão; 5ª = 2ª; 7ª = 3ª).
- **Posição fechada:** todas as vozes dentro de uma oitava. **Drop 2:** a 2ª voz mais aguda da posição fechada desce uma oitava. **Drop 3:** a 3ª voz mais aguda desce uma oitava.
- **Conjunto de cordas:** por exemplo, Drop 2 nas cordas 1–4, 2–5 e 3–6; Drop 3 nas cordas 1-2-3-5 e 2-3-4-6 (com corda pulada).
- **CAGED:** cinco formas móveis de acorde maior (e menor) que cobrem o braço; mapeadas para as posições de Leavitt.

**Exercícios:**
1. **Pauta → braço:** um acorde escrito (por exemplo, Cmaj7) → o estudante monta um voicing no braço. Validação por regras (§9.6): **qualquer voicing válido é aceito**, e o feedback classifica o que foi construído ("Drop 2, 1ª inversão, cordas 2–5").
2. **Pedido específico:** "construa Cmaj7 em 2ª inversão Drop 3 nas cordas 6-4-3-2".
3. **Braço → pauta:** um voicing no braço → escrever na pauta (acorde empilhado) e nomear.
4. **Condução de vozes:** dada uma progressão (por exemplo, Dm7–G7–Cmaj7) e o primeiro voicing, escolher os próximos com o **menor movimento total das vozes**; o sistema calcula a soma dos deslocamentos em semitons e compara com o ótimo.
5. **Comparação de voicings:** mostrar dois voicings do mesmo acorde e explicar as diferenças (registro, nota mais aguda, espaçamento, extensão da mão).

### 6.8 Módulo H — Percepção (novo, proposto)

- Identificação de notas em **contexto tonal** (cadência + nota → grau), na linha do Functional Ear Trainer.
- Intervalos melódicos e harmônicos ouvidos.
- Qualidade de tríades e tétrades ouvidas.
- **Ditado melódico curto** (2–5 notas) com resposta **no braço virtual** ou na pauta. É aqui que percepção, leitura e braço se encontram.
- Síntese sonora local (§12.5) e sem dependência de internet.

### 6.9 "Meu treinamento" — orquestrador de sessões

Monta automaticamente sessões de **5, 10, 20 ou 30 min** com uma proporção configurável. Proporção padrão para 10 min:

| Bloco | Tempo | Conteúdo |
|---|---|---|
| Aquecimento / revisões vencidas | 25 % | Cartões FSRS vencidos de qualquer módulo (intercalados) |
| Conteúdo atual | 45 % | Itens novos e em aquisição do nível atual |
| Aplicação | 30 % | Leitura contínua (Módulo D) usando o material atual + um ritmo |

Regras: limite de itens novos por dia (padrão 10–20); se houver muitas revisões vencidas, o bloco de itens novos encolhe (proteção contra sobrecarga); a sessão sempre termina em **aplicação musical**, nunca em flashcard.

**Rotinas:** o estudante define dias e horários, uma duração por dia e foco opcional (por exemplo, "terças: ritmo"). Os lembretes são apenas notificações locais da PWA, quando permitidas (§12.7).

---

## 7. Lógica de funcionamento dos exercícios

### 7.1 Ciclo de vida de uma questão

1. **Seleção** (agendador, §10) → item ou modelo de exercício.
2. **Geração** de uma instância a partir de uma **semente aleatória registrada** (permite reproduzir exatamente a questão para depuração e revisão).
3. **Apresentação** (pauta/braço/áudio), com o cronômetro iniciado quando o estímulo está **completamente renderizado** (evento de pintura).
4. **Entrada** (clique, teclado, microfone e futuramente MIDI). Para o microfone, o tempo de resposta vai do estímulo ao **início estável** da nota (§15).
5. **Validação** (§9) → resultado + categoria de erro.
6. **Feedback** imediato: correto/incorreto; todas as respostas válidas; explicação pedagógica curta; para erros, a causa provável (por exemplo, "você leu uma linha acima: Mi → Sol").
7. **Registro** da tentativa (§13) e atualização do modelo (FSRS + fluência).
8. **Política de repetição imediata:** em caso de erro, o item volta na mesma sessão depois de 3–8 outros itens (passo de reaprendizagem), sem afetar o FSRS duas vezes no mesmo dia (§10.4).

### 7.2 Feedback pedagógico — princípios

- Feedback **imediato** nas fases de aquisição; feedback **adiado** (no fim da frase) no modo contínuo, para não interromper o fluxo, o que é coerente com o objetivo de C3.
- Sempre mostrar **por que** a resposta está certa: a altura escrita, a altura soante, a relação corda/casa ("Corda 3 = Sol; Lá está 2 semitons acima → casa 2").
- Para respostas certas em local não pedido: "Nota correta, mas fora da V posição. Na V posição, o Lá4 escrito fica na corda 4, casa 7." O texto é gerado a partir dos dados, nunca fixo.
- **Dicas progressivas** (opcionais, penalizam a pontuação de fluência): 1) nome da nota; 2) corda; 3) casa.

### 7.3 Vetor de dificuldade (para geradores)

Cada exercício gerado tem um vetor de dificuldade com dimensões independentes, para que o sistema aumente **uma variável de cada vez** (princípio Sagreras):

| Dimensão | Escala (exemplo) |
|---|---|
| Faixa de alturas | número de notas distintas possíveis |
| Acidentes | 0 = nenhum; 1 = da armadura; 2 = ocorrentes; 3 = enarmônicos/duplos |
| Armadura | número de acidentes na armadura |
| Perfil intervalar | proporção de graus conjuntos vs. saltos; salto máximo |
| Cordas | número de cordas e de mudanças de corda |
| Posição | 0 = fixa; 1 = com aberturas; 2 = uma mudança; 3 = várias |
| Ritmo | nível do vocabulário rítmico (§7.4) |
| Andamento | bpm-alvo |
| Comprimento | número de compassos |
| Texturas | 1 voz; 2 vozes; acordes |

### 7.4 Gerador de melodias — regras conceituais

1. **Estrutura:** frases de 2 + 2 compassos (antecedente/consequente) ou 4 + 4; o fim da frase recai sobre a tônica ou a dominante; a cadência final, sobre a tônica.
2. **Alturas:** passeio aleatório ponderado sobre a escala da tonalidade, com pesos por intervalo (graus conjuntos predominantes; um salto maior que 3ª é seguido de movimento contrário, regra clássica de contorno).
3. **Restrição de tessitura:** só alturas com pelo menos um local válido dentro das restrições do exercício (posição/cordas).
4. **Ritmo:** compassos montados a partir de um **vocabulário de células rítmicas** do nível atual, com soma igual à fórmula de compasso.
5. **Digitação:** um resolvedor de digitação (§8.7) calcula a digitação de referência e o número de mudanças de posição; exercícios que excedem a dificuldade-alvo são descartados e regenerados.
6. **Originalidade:** todos os exercícios são gerados algoritmicamente; nenhum trecho protegido é usado.
7. **Validação de musicalidade (heurística):** rejeitar frases com mais de 3 repetições seguidas da mesma nota (a menos que seja um exercício rítmico), com trítonos melódicos não resolvidos em níveis iniciais, ou que terminem em nota instável.

### 7.5 Estudos curtos

No nível 5+, há "estudos" de 16 compassos com forma A–B–A′, duas vozes opcionais (baixo em cordas soltas) e uma mudança de posição planejada no compasso 9. Eles podem ser **fixados** para a prática repetida até a fluência, porque a leitura à primeira vista e a preparação de peça são complementares.

---

## 8. Modelo matemático do mapeamento entre pentagrama e braço

### 8.1 Representações internas (duas camadas obrigatórias)

**Camada A — Altura grafada (*spelled pitch*)**, usada para notação, intervalos e enarmonia:

- `letra` ∈ {C, D, E, F, G, A, B} (índice 0–6)
- `alteração` ∈ {−2, −1, 0, +1, +2} (𝄫, ♭, ♮, ♯, 𝄪)
- `oitava` (índice científico: C4 = Dó central)

**Camada B — Altura absoluta (número MIDI)**, usada para o braço, o áudio e a comparação:

> `classe_natural(letra)` = [0, 2, 4, 5, 7, 9, 11] para C…B
> `midi(letra, alteração, oitava) = 12 × (oitava + 1) + classe_natural(letra) + alteração`

Exemplos: C4 = 60; A4 = 69; E2 = 40; B♯3 = 60 (enarmônico de C4, **mesmo midi, grafia diferente**).

**Invariante:** a camada A sempre pode ser convertida em B (função), mas B → A **não é função**: exige contexto (§8.3).

**Frequência (temperamento igual):**
> `f(m) = A_ref × 2^((m − 69) / 12)`, com `A_ref` = 440 Hz (configurável, por exemplo 415–466 Hz).

**Desvio em cents** entre a frequência medida `f` e a esperada `f_e`:
> `cents = 1200 × log2(f / f_e)`

### 8.2 Transposição do violão (escrita vs. soante)

> `midi_soante = midi_escrito + transposição_instrumento`, com `transposição_instrumento = −12` para o violão.

- Corda 6 solta: **soa** E2 (midi 40, ≈ 82,41 Hz); **escreve-se** E3 (abaixo da pauta, 3 linhas suplementares).
- Corda 1 solta: soa E4 (midi 64, ≈ 329,63 Hz); escreve-se E5 (4º espaço da pauta).
- Corda 1, casa 19: soa B5 (≈ 987,77 Hz); escreve-se B6.

**Regra de ouro [RECOMENDAÇÃO]:** o motor nunca guarda uma altura sem saber se ela é **escrita** ou **soante**. O tipo de dado distingue as duas (por exemplo, `AlturaEscrita` × `AlturaSoante`), e a conversão é feita num único ponto. A **pauta** só recebe alturas escritas; o **braço e o áudio** só recebem alturas soantes. Assim, a divergência que a proposta pede para impedir fica estruturalmente impossível.

### 8.3 Grafia (camada B → A)

Quando o sistema precisa escrever uma altura absoluta (sentido 2 dos flashcards, transcrição):

1. Se há **armadura**, usar a grafia diatônica da tonalidade quando a classe de altura pertence à escala.
2. Caso contrário (nota cromática), usar a convenção: **sustenido em movimento ascendente, bemol em descendente**; em tonalidades com bemóis, preferir bemol; com sustenidos, preferir sustenido.
3. Sem contexto (nota isolada, Dó maior): exibir as duas grafias possíveis e aceitar ambas.
4. Grafias com dobrado sustenido/bemol e Si#, Mi#, Dó♭ e Fá♭ só aparecem quando o nível as habilita.

### 8.4 Afinação e localizações

O instrumento é definido por:
- `cordas[i].solta_midi` (soante), com i = 1 (aguda) … N.
- `num_casas` (por exemplo, 19 no clássico típico, 22–24 na guitarra).
- `capotraste` (casa ≥ 0).

Afinação padrão: `[64, 59, 55, 50, 45, 40]` para as cordas 1–6.

**Conjunto de localizações de uma altura soante `s`:**
> `L(s) = { (i, c) | c = s − solta_midi[i], capotraste ≤ c ≤ num_casas }`

(Com capotraste, a casa absoluta c ≥ capotraste; uma corda "solta" passa a ser a casa do capotraste.)

**Exemplos verificáveis (afinação padrão, 19 casas):**

| Nota escrita | Midi soante | Localizações (corda, casa) |
|---|---|---|
| E3 (abaixo da pauta) | 40 | (6, 0) |
| C4 (Dó central escrito) | 48 | (5, 3), (6, 8) |
| E5 (4º espaço) | 64 | (1, 0), (2, 5), (3, 9), (4, 14), (5, 19) — (6, 24) excluída por limite de casas |
| G4 (2ª linha) | 55 | (3, 0), (4, 5), (5, 10), (6, 15) |

**Generalidade:** como tudo depende do vetor `solta_midi` e de `num_casas`, outras afinações (Ré drop, DADGAD, Sol aberto), violão de 7 cordas, baixo, cavaquinho ou ukulele (afinação reentrante, transposição 0) são apenas **dados de configuração**. Esse é o requisito de extensibilidade.

### 8.5 Modelo de posição (Leavitt)

Posição `p` (dedo 1 na casa `p`, p ≥ 1):

- **Janela base:** casas `[p, p+3]`, dedo = `c − p + 1`.
- **Abertura do dedo 1:** casa `p − 1` com dedo 1.
- **Abertura do dedo 4:** casa `p + 4` com dedo 4.
- **Janela estendida:** `[p − 1, p + 4]` (até 6 casas), conforme os flags `permite_abertura_1` e `permite_abertura_4`.
- **Cordas soltas:** permitidas por flag (sempre permitidas na "posição aberta"; opcionais nas demais, como o recurso de mudança de posição por corda solta).
- **Posição aberta:** casas `[0, 4]` com dedos 1–4 nas casas 1–4 (ou definida como II/I com soltas, conforme configuração didática).

**Identificação da posição a partir de uma digitação** (regra do dedo 2): se o dedo 2 está na casa `c2`, então `p = c2 − 1`.

### 8.6 Propriedade importante: unicidade dentro da posição

Cordas vizinhas na afinação padrão estão a 5 semitons, exceto Sol–Si (4 semitons).

- **Janela de 4 casas sem cordas soltas:** cada corda cobre 4 semitons consecutivos. Como a distância entre cordas vizinhas é ≥ 4, **não há sobreposição** e cada altura tem **no máximo um local**.
- **Janela de 5 casas** (uma abertura): só o par Sol–Si pode ter **uma** altura duplicada.
- **Janela de 6 casas** (duas aberturas): todos os pares vizinhos podem ter duplicatas nas extremidades.
- **Posição aberta com cordas soltas:** a duplicata clássica é Si (corda 3, casa 4 = corda 2 solta).

**Consequência:** em exercícios de posição fixa sem aberturas, **altura + posição determinam o local**. Isso viabiliza a validação por microfone com segurança razoável (§15.7), desde que o estudante mantenha a posição.

### 8.7 Resolvedor de digitação (para melodias)

Dada uma sequência de alturas soantes `s1…sn`, escolher para cada uma um local `(corda, casa, dedo)` que minimize o custo total, por **programação dinâmica (algoritmo de Viterbi)** sobre um grafo de estados, uma abordagem descrita na literatura de digitação para cordas (Sayegh, 1989, *Computer Music Journal* — [A VERIFICAR] volume/páginas; Radisavljevic & Driessen, 2004, ICMC — [A VERIFICAR]).

**Custo de transição (exemplo de componentes, pesos ajustáveis):**
- Mudança de posição: proporcional ao número de casas deslocadas (+ penalidade fixa por mudança).
- Uso de abertura: penalidade (maior para o dedo 4, segundo Leavitt).
- Troca de corda: pequena penalidade; corda pulada: penalidade maior.
- Mesmo dedo em casas diferentes em notas consecutivas: penalidade alta.
- Preferência por cordas soltas: configurável (o violão clássico às vezes prefere soltas; em alguns estilos, evitá-las).
- Restrições rígidas do exercício (posição fixa, conjunto de cordas): custo infinito fora delas.

Saída: digitação de referência, posições usadas, pontos de mudança e uma estimativa de dificuldade (custo total por nota). A digitação de referência é **sugestão**, nunca a única resposta correta.

---

## 9. Algoritmo de identificação das respostas corretas

### 9.1 Pipeline (descrição conceitual em passos)

1. **Entrada do estímulo:** nota(s) da pauta com letra, acidente explícito (se houver), oitava escrita, armadura vigente e compasso/posição dentro do compasso.
2. **Resolução da alteração efetiva** (§9.2) → altura escrita grafada completa.
3. **Conversão:** escrita → midi escrito → midi soante (−12).
4. **Consulta ao instrumento:** afinação, número de casas, capotraste.
5. **Geração do conjunto completo** `L(s)` (§8.4).
6. **Aplicação das restrições do exercício:** cordas habilitadas, faixa de casas, janela de posição (base/estendida), cordas soltas sim/não, corda imposta.
   → resultado: `V = L(s) ∩ Restrições` (conjunto de respostas válidas).
   - **Invariante de geração:** um exercício nunca pode ser gerado com `V = ∅`. O gerador verifica isso antes de exibir.
7. **Comparação** da resposta do estudante (§9.3).
8. **Classificação de erro** (§9.4) e **explicação** gerada a partir de `L(s)`, `V` e da resposta.

### 9.2 Resolução da alteração efetiva

Para uma nota com letra `X` e oitava `o` no compasso `k`:
1. Se a nota tem acidente **explícito**, ele vale (inclusive bequadro = 0).
2. Senão, se uma nota anterior **no mesmo compasso**, na mesma letra e **mesma oitava** (mesma linha/espaço), teve acidente explícito, ele vale (o acidente vale até a barra de compasso).
3. Senão, se a nota está **ligada** a uma nota do compasso anterior, herda a alteração da nota de origem.
4. Senão, vale a **armadura** para a letra `X` (em todas as oitavas).
5. Acidentes de cortesia (entre parênteses) não alteram o resultado e só servem para exibição.

**[FATO]** Essas regras seguem a convenção da notação ocidental padrão (por exemplo, Gould, *Behind Bars*, 2011). **[RECOMENDAÇÃO]** Implementá-las com testes de unidade exaustivos, porque são uma fonte clássica de bug.

### 9.3 Comparação por tipo de resposta

| Tipo de entrada | Critério de acerto |
|---|---|
| Clique no braço (corda, casa) | `(corda, casa) ∈ V` |
| "Todos os locais" | o conjunto marcado = `V` (acerto parcial = |marcado ∩ V| / |V|, com penalidade por marcados ∉ V) |
| Nome da nota (sentido 2) | mesmo midi **e**, se o exercício exige grafia, mesma letra + alteração |
| Nota escrita na pauta (sentido 2) | mesma altura escrita (linha/espaço + acidente) ou enarmônico aceito, conforme a configuração |
| Microfone | classe + oitava soante iguais a `s` (±tolerância em cents), com estabilidade mínima (§15.5); local inferido por posição quando aplicável |
| Acorde (voicing) | regras de §9.6 |

### 9.4 Taxonomia de erros (para diagnóstico)

| Código | Descrição | Detecção |
|---|---|---|
| E-OITAVA | Classe de altura correta, oitava errada | `Δmidi = ±12, ±24` |
| E-LINHA | Leu linha/espaço vizinhos (erro de terça na leitura) | Δ de 2 graus diatônicos (letra ±2) |
| E-GRAU | Nota vizinha (erro de um grau) | letra ±1 |
| E-ACIDENTE-ARMADURA | Ignorou a armadura | resposta = altura natural, e a armadura altera a letra |
| E-ACIDENTE-OCORRENTE | Ignorou o acidente vigente no compasso | igual, para acidente ocorrente |
| E-ENARMONIA | Grafia errada para o contexto, altura certa | mesmo midi, grafia diferente |
| E-CORDA | Casa certa na corda vizinha | mesma casa, corda ±1 |
| E-CASA | Casa ±1 na corda certa | mesma corda, Δcasa = ±1 |
| E-FORA-POSIÇÃO | Altura e local válidos no instrumento, mas fora das restrições | resposta ∈ L(s) \ V |
| E-CLAVE | Leu como clave de Fá ou outra | padrão de deslocamento consistente com outra clave |
| E-TEMPO | Altura certa, fora da janela temporal | desvio > tolerância (modo contínuo) |

Erros recorrentes de um mesmo código geram **recomendações** ("Você ignora o Fá# da armadura em 30 % das vezes → exercício focado").

### 9.5 Explicação pedagógica (modelo)

Toda explicação contém: (1) a nota escrita e a soante; (2) o cálculo corda + casa ("Corda 4 = Ré3 soante; Fá#3 está 4 semitons acima → casa 4"); (3) **todas** as localizações no braço, com as válidas destacadas e as fora das restrições esmaecidas; (4) quando houver erro, a causa provável (taxonomia).

### 9.6 Validação de acordes e voicings

Dada a resposta: um conjunto de pares (corda, casa) → alturas soantes.

1. **No máximo uma nota por corda** (restrição física).
2. **Classes de altura** da resposta = classes exigidas pelo acorde. Configuração: permitir omissão da 5ª justa; permitir dobras; exigir ou não a fundamental.
3. **Inversão:** função da nota mais grave.
4. **Tipo de voicing:** ordenar as alturas; reconstruir a posição fechada (subindo vozes em oitavas até caberem numa oitava) e determinar qual voz foi deslocada → fechado / Drop 2 / Drop 3 / Drop 2+4 / aberto.
5. **Tocabilidade:** abertura entre a menor e a maior casa presas ≤ 4 (configurável até 5); cordas puladas são permitidas só se o pedido as admitir (Drop 3 exige pular uma corda).
6. **Pedido específico** (inversão, tipo, conjunto de cordas): comparar cada atributo e dar feedback por atributo ("acorde e inversão certos, mas você fez Drop 2 e foi pedido Drop 3").
7. **Condução de vozes:** para voicings sucessivos com o mesmo número de vozes, custo = soma de |Δsemitons| por voz (com emparelhamento de vozes por ordem de registro); comparar com o mínimo calculado por busca exaustiva entre os voicings válidos do conjunto de cordas.

---

## 10. Estratégia de repetição espaçada

### 10.1 Comparação de algoritmos

| Algoritmo | Modelo | Vantagens | Limitações |
|---|---|---|---|
| **SM-2** (Woźniak, 1990) | Fator de facilidade + intervalo multiplicativo | Simples, testado há décadas | Heurístico; não modela a probabilidade de lembrar; o "inferno da facilidade" (*ease hell*) é conhecido |
| **FSRS** (Ye et al., 2022; open-spaced-repetition) | Modelo DSR: **D**ificuldade, **S**tabilidade, **R**etrievabilidade; intervalo escolhido para atingir a retenção desejada | Probabilidade explícita de lembrança (R), parâmetros otimizáveis com o histórico do usuário, integrado ao Anki desde a versão 23.10 | Modela *memória*, não *fluência motora*; precisa de dados para otimizar (funciona com parâmetros padrão no início) |
| **Elo / Teoria de Resposta ao Item** | Habilidade do estudante × dificuldade do item | Bom para escolher a *dificuldade* de exercícios gerados (sem cartão fixo) | Não agenda revisões no tempo |

**[FATO]** A biblioteca **ts-fsrs** (MIT) implementa o FSRS em TypeScript e suporta várias versões do modelo, com o agendador padrão no FSRS mais recente; um pacote de *binding* separado traz o otimizador, inclusive para navegador/WASI ([GitHub — ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)). **[A VERIFICAR]** o uso do otimizador no navegador num protótipo.

### 10.2 Escolha para a primeira versão [RECOMENDAÇÃO]

**FSRS (via ts-fsrs) para itens atômicos + modelo de fluência próprio + Elo para exercícios gerados.**

Justificativa:
1. O FSRS dá ao painel a **probabilidade estimada de lembrar** (R) e permite definir uma **retenção-alvo** (por exemplo, 90 %), algo que o SM-2 não oferece.
2. É de código aberto, com licença permissiva e implementação mantida em TypeScript, o que evita reimplementar o algoritmo.
3. O FSRS não sabe lidar com **velocidade**. Por isso, a fluência é modelada à parte (§10.3), e o tempo de resposta entra na **nota** (rating) dada ao FSRS de forma controlada.
4. Melodias e frases não são "cartões" fixos: o que se revisa nelas são **habilidades** (por exemplo, "leitura na V posição, ritmo nível 3"). Para escolher a dificuldade do próximo exercício gerado, um sistema Elo simples (habilidade × dificuldade do vetor) é mais adequado.

### 10.3 Itens atômicos (*Knowledge Components*)

Cada item tem identificador estável e histórico próprio. Tipos:

| Tipo | Exemplo de ID | Cartões/sentidos |
|---|---|---|
| Nota no local | `nota:E5@1:0` (escrita E5, corda 1, casa 0) | pauta→braço; braço→pauta; som→braço |
| Nota na posição | `notapos:A4@V` | pauta→braço (restrito à posição) |
| Intervalo | `int:M3:asc` | pauta→nome; nome+nota→braço |
| Figura rítmica / célula | `ritmo:seminima-pontuada+colcheia` | reconhecimento; execução |
| Armadura | `armadura:3#` | identificar tonalidade; aplicar a nota |
| Acorde/voicing | `acorde:maj7:drop2:inv1:cordas2-5` | pauta→braço; braço→nome |
| Conceito | `conceito:vigencia-acidente` | pergunta conceitual |

**Habilidades compostas** (avaliadas por Elo, não por FSRS): `leitura:posV:ritmoN3`, `mudanca:V-VII`, `leitura-continua:72bpm`.

### 10.4 Do desempenho à nota FSRS

O FSRS usa 4 notas: **Errei (Again), Difícil (Hard), Bom (Good), Fácil (Easy)**. A nota é **derivada automaticamente** (o estudante não autoavalia, o que elimina viés):

| Condição | Nota |
|---|---|
| Resposta errada, ou certa depois de dica | Errei |
| Certa, tempo > alvo_lento | Difícil |
| Certa, alvo_rápido < tempo ≤ alvo_lento | Bom |
| Certa, tempo ≤ alvo_rápido | Fácil |

- `alvo_rápido` e `alvo_lento` são definidos **por tipo de item** e ajustados à **mediana pessoal** do estudante para aquele tipo (por exemplo, alvo_lento = 2 × mediana pessoal; alvo_rápido = 0,7 × mediana pessoal, limitados por valores pedagógicos absolutos). Isso evita punir quem é globalmente mais lento ou mais rápido.
- Tempo de resposta com **microfone** inclui o tempo motor; os alvos são separados por método de entrada.
- **Apenas a primeira tentativa do dia** atualiza o FSRS para cada cartão. As repetições na mesma sessão (passos de reaprendizagem) atualizam só a fluência. O FSRS foi projetado para revisões espaçadas; repetições no mesmo dia distorcem a estabilidade. **[RECOMENDAÇÃO]** Usar os "passos de aprendizagem" (*learning steps*) de curto prazo como o Anki.

### 10.5 Modelo de fluência

Para cada item: média móvel exponencial (EWMA) do log do tempo de resposta das tentativas corretas, mais variância. A fluência é o percentil do tempo em relação ao alvo pedagógico. Separado da memória porque **lembrar devagar ≠ ler fluentemente** (lembrar é condição necessária, ser rápido é a meta de C3).

### 10.6 Seleção da próxima atividade (agendador de sessão)

Prioridade de cada candidato:
1. **Cartões vencidos** (R abaixo da retenção-alvo), ordenados pelo menor R.
2. **Itens em aquisição** com passo de reaprendizagem pendente.
3. **Itens com baixa fluência** (memória boa, tempo alto).
4. **Itens novos** do nível atual, até o limite diário.
5. **Exercícios de aplicação** escolhidos por Elo, com dificuldade tal que a probabilidade esperada de sucesso fique em torno de **70–85 %** (zona de desafio desejável; [HIPÓTESE] a calibrar com dados).

**Intercalação:** misturar tipos de item e módulos (Kornell & Bjork, 2008; Rohrer & Taylor, 2007, sobre intercalação). **Revisão automática de conteúdo anterior** acontece porque os cartões vencidos dos níveis antigos continuam no agendador mesmo quando o estudante avança.

**Peso de prática livre:** tentativas no Módulo A (escolhidas pelo estudante) atualizam a fluência e, se for a primeira exposição do dia ao cartão, também o FSRS.

### 10.7 Otimização dos parâmetros

- Começar com os **parâmetros padrão do FSRS**.
- Depois de N revisões (**[HIPÓTESE]**: ≥ 1.000, conforme a recomendação da comunidade FSRS, a confirmar), oferecer a otimização local dos parâmetros a partir do histórico, sem servidor.
- Retenção-alvo configurável (padrão 0,90; faixa 0,80–0,95), com a explicação de que mais retenção significa mais revisões por dia.

---

## 11. Métricas de desempenho e aprendizagem

### 11.1 Métricas por item

- `n_tentativas`, `n_acertos`, `dias_distintos_praticados`
- **Acerto com confiança:** limite inferior do **intervalo de Wilson** (95 %) da proporção de acertos. Com isso, 1/1 = 21 % e 20/20 = 84 %, e um acerto isolado não parece domínio.
- **Tempo:** mediana dos tempos corretos das últimas 10 tentativas (a mediana é robusta a distrações).
- **FSRS:** estabilidade S (dias), dificuldade D, retrievabilidade atual R.
- **Fluência:** EWMA do log-tempo.

### 11.2 Estados de domínio (sem "domínio após um acerto")

| Estado | Critério (padrões configuráveis) |
|---|---|
| **Não treinado** | 0 tentativas |
| **Em aquisição** | < 5 tentativas **ou** < 2 dias distintos |
| **Instável** | acerto nas últimas 20 tentativas < 70 % **ou** erro nas 2 últimas tentativas |
| **Consolidando** | nem instável nem dominado (acerto ok, mas tempo acima do alvo, poucos dias **ou** S < 7 dias) |
| **Dominado** | Wilson (últimas 20) ≥ 0,75, ≥ 8 tentativas em ≥ 3 dias distintos, mediana ≤ alvo, S ≥ 7 dias |
| **Automatizado** | Dominado + mediana ≤ alvo rápido + S ≥ 30 dias |
| **Esquecendo** (sobreposição) | Qualquer estado ≥ Consolidando com R < retenção-alvo |

> **Correção (v0.2, durante a Fase 2):** a v0.1 pedia Wilson ≥ 0,85 com ≥ 8 tentativas. Isso é inatingível: numa janela de 20 tentativas o máximo é 20/20 ⇒ 0,839, e 8/8 ⇒ 0,676. O limiar de 0,75 exige ao menos 12 acertos seguidos (11/11 ⇒ 0,741 não basta; 12/12 ⇒ 0,757) ou 19/20 (0,764). Para "Instável" passou-se a usar a proporção simples, porque com poucas tentativas o Wilson é baixo mesmo sem erros. Alvos iniciais (HIPÓTESE): pauta → braço 1,5 s (rápido 1,0 s); braço → pauta 2,5 s (rápido 1,8 s).

A **ausência de treino** (Não treinado) tem cor e padrão próprios no heatmap (por exemplo, hachurado neutro), **nunca** a mesma escala do "baixo acerto".

### 11.3 Mapa de calor do braço

- **Grade:** 6 cordas × (casas 0…N). Cada célula agrega os itens de nota daquele local (todos os sentidos ou um sentido escolhido).
- **Camadas selecionáveis:** estado de domínio (categórico), acerto (Wilson), tempo mediano, retrievabilidade atual, volume de prática (quantas tentativas) e itens vencidos.
- **Visões agregadas:** por corda, por casa, por posição (janela), por região (casas 0–4, 5–9, 10–14, 15+).
- **Escala:** sequencial e perceptualmente uniforme para métricas contínuas; categórica para estados; legenda sempre visível; padrões (não só cor) para acessibilidade em daltonismo.
- **Evolução:** controle deslizante semanal para ver o heatmap em datas passadas (a partir de instantâneos semanais, §13).

### 11.4 Métricas de leitura à primeira vista (C3)

| Métrica | Definição |
|---|---|
| **Notas no tempo (%)** | notas corretas em altura **e** com ataque dentro da janela de tolerância rítmica |
| **Precisão de altura (%)** | notas certas em altura, independentemente do tempo |
| **Desvio rítmico** | mediana do |desvio| de ataque em ms (e % do tempo) |
| **Continuidade (%)** | 1 − (tempo total de paradas > 1 tempo ÷ duração da frase). Parar é o erro mais grave na leitura à primeira vista |
| **Andamento sustentável** | maior bpm em que o estudante mantém notas no tempo ≥ 85 % e continuidade ≥ 90 % em 3 frases novas seguidas |
| **Janela à frente** | tamanho mínimo da janela visível (modo com máscara) em que o desempenho se mantém |
| **Recuperação** | após um erro, número de notas até voltar a acertar no tempo |

**Indicador principal de evolução [RECOMENDAÇÃO]: "andamento sustentável por nível de material"**, por exemplo "Nível 3, V posição: 76 bpm (era 60 há 4 semanas)". Ele mede capacidade musical adquirida, não volume de cliques.

### 11.5 Painel de estatísticas

- Resumo: minutos praticados (semana), sequência de dias, revisões vencidas hoje, andamento sustentável atual.
- Heatmap do braço (§11.3).
- Tabela de "pontos fracos": os 10 itens com menor Wilson ou maior tempo, com um botão "praticar estes".
- Erros por categoria (§9.4) ao longo do tempo.
- Curvas semanais: acerto, tempo mediano, itens por estado e andamento sustentável.
- Exercícios que precisam de revisão (vencidos e "esquecendo").

---

## 12. Arquitetura tecnológica recomendada

### 12.1 Visão geral

Aplicação web estática (SPA + PWA), **sem servidor de aplicação**, organizada em pacotes independentes por camada:

```
[ UI React (telas, componentes) ]
        │ usa
[ Adaptadores: Notação (VexFlow) | Braço (SVG próprio) | Áudio (Web Audio) ]
        │ consomem
[ Núcleo de domínio (TypeScript puro, sem dependência de UI ou navegador) ]
   ├─ teoria: alturas, grafia, intervalos, escalas, acordes, ritmo
   ├─ instrumento: afinações, mapeamento, posições, digitação
   ├─ exercícios: geradores, validadores, taxonomia de erros
   ├─ aprendizagem: FSRS (ts-fsrs), fluência, Elo, domínio
        │
[ Persistência: repositórios sobre IndexedDB (Dexie) ]
```

**Princípio [RECOMENDAÇÃO]:** o núcleo de domínio é **TypeScript puro e testável sem navegador**. A biblioteca de renderização (VexFlow) **não** é a fonte de verdade da teoria musical: ela só recebe instruções de desenho geradas pelo núcleo. Isso atende ao requisito explícito da proposta e permite trocar de renderizador.

### 12.2 Interface: React + TypeScript + Vite

**[RECOMENDAÇÃO]** Adequado. React tem ecossistema amplo; TypeScript é essencial para os tipos distintos (escrita/soante, grafada/absoluta); Vite oferece desenvolvimento rápido e build estático. Licenças: React (MIT), TypeScript (Apache-2.0), Vite (MIT). Estado de interface: uma store leve (por exemplo, Zustand, MIT). Testes: Vitest (MIT) para o núcleo; Playwright (Apache-2.0) para ponta a ponta.

### 12.3 Renderização musical: VexFlow

**[FATO]** O VexFlow é open-source (licença **MIT**), renderiza partituras e **tablatura** em **SVG e Canvas**, e a documentação atual usa a versão **5.0.0** nos exemplos ([GitHub — vexflow](https://github.com/vexflow/vexflow)). Ele tem métodos para clave e fórmula de compasso, e o repositório mostra manutenção ativa (milhares de commits, CI, changelog).

**[HIPÓTESE — confirmar no protótipo da Fase 1]** O suporte a armaduras, acidentes, ligaduras, pontos, quiálteras, acordes (várias cabeças numa haste) e clave de Sol com 8 é parte do conjunto de recursos documentado historicamente pelo VexFlow, mas a página principal consultada não lista todos. **Critério:** antes de fechar a decisão, um *spike* de 1–2 dias renderiza um "corpo de prova" com cada recurso exigido por esta especificação (§19, CA-NOT).

**[RECOMENDAÇÃO]** Renderizar em **SVG** (elementos endereçáveis para destaque, clique em linha/espaço, acessibilidade e zoom nítido). Canvas só se o modo contínuo mostrar problema de desempenho.

**Alternativas:** OpenSheetMusicDisplay (renderiza MusicXML sobre VexFlow; útil para importar partituras no futuro); abcjs (notação ABC). **[A VERIFICAR]** as licenças antes de adotar.

### 12.4 Braço virtual: SVG próprio

**[FATO]** O Fretboard.js existe (licença **ISC**, visualização em SVG de braço de guitarra/baixo, formas de escala e acordes, API de interação). A página do repositório mostra 230 commits, 13 *issues* e 8 *pull requests* abertos, sem releases publicadas, e não informa a data da última atividade ([GitHub — fretboard.js](https://github.com/moonwave99/fretboard.js)).

**[RECOMENDAÇÃO]** **Componente SVG próprio**, porque:
1. O braço é o **núcleo** da experiência (posições, aberturas, heatmap, canhotos, cliques por célula, realces múltiplos).
2. O modelo de dados (localizações, posições) já existe no núcleo; desenhar é a parte simples.
3. Evita dependência com manutenção incerta num componente crítico.
O Fretboard.js pode servir de referência de design (a licença ISC é permissiva).

**Requisitos do braço:** cordas com espessura proporcional (graves mais grossas); trastes com espaçamento **realista** (distância do traste n = escala × (1 − 2^(−n/12))) ou **uniforme** (opção, porque o uniforme facilita clicar nas casas agudas); numeração de casas; nomes/números de cordas; marcadores 3, 5, 7, 9, 12 (duplo), 15, 17, 19, 21, 24; orientação destro/canhoto (espelhamento horizontal) e opção "visão do jogador" (corda 6 em cima ou embaixo); quantidade de casas; modos "limpo" e "todas as notas"; realce de posição (janela base e estendida em tons diferentes); camada de heatmap; foco de teclado por célula.

### 12.5 Áudio

- **Entrada (microfone):** `getUserMedia` → `AudioContext` → **AudioWorklet** com detector de altura (YIN, §15). O detector roda fora da thread principal da interface.
- **Saída (síntese):** sons de referência (nota-alvo, intervalos, acordes, cadências) por **síntese local** (osciladores + envelope, ou síntese de corda dedilhada por Karplus–Strong) ou **amostras gravadas** distribuídas com o app (verificar a licença das amostras; por exemplo, bancos com licença livre). **[RECOMENDAÇÃO]** Começar com Karplus–Strong (zero dependências, zero licenças, offline); amostras depois.
- **Metrônomo:** agendamento com antecedência (*lookahead*) usando `AudioContext.currentTime`, a técnica descrita em "A Tale of Two Clocks" (Chris Wilson, web.dev). `setTimeout` sozinho não é preciso. Tone.js (MIT) é uma alternativa pronta, mas não é necessária.
- **Bibliotecas de altura existentes:** pitchy (licença 0BSD, usa o **McLeod Pitch Method**) é alternativa ou referência para comparação ([GitHub — pitchy](https://github.com/ianprime0509/pitchy)). **[RECOMENDAÇÃO]** Implementar YIN próprio (algoritmo publicado e simples) e usar o pitchy/MPM como *baseline* nos testes de precisão.

### 12.6 Armazenamento: IndexedDB

- **IndexedDB** (padrão do navegador) via **Dexie.js** (Apache-2.0): esquema versionado, índices, migrações e transações.
- **Persistência:** pedir `navigator.storage.persist()` para reduzir o risco de o navegador apagar os dados por pressão de espaço. **[FATO]** O Safari aplica política de remoção de armazenamento de sites sem interação recente, salvo quando instalados como app (ITP/WebKit). Mesmo no Chrome, sem persistência concedida, os dados podem ser apagados sob pressão de armazenamento.
- **Backup:** exportar/importar JSON versionado (`schemaVersion`), com lembrete periódico de exportação (por exemplo, semanal) e validação na importação.

### 12.7 PWA e funcionamento offline

- Service Worker com pré-cache de todos os recursos estáticos (JS, CSS, fontes musicais, amostras), via **vite-plugin-pwa** (MIT) + **Workbox** (MIT).
- **Funciona offline:** todos os módulos, o microfone (processamento local), a síntese, as estatísticas e o backup em arquivo.
- **Depende de internet:** a primeira carga/instalação; as atualizações do app; links externos (referências); no Módulo de foco, apenas o envio da mensagem por WhatsApp/SMS (feito pelo próprio usuário) — a validação do código é offline.
- **Notificações de rotina:** notificações locais exigem permissão; **[FATO]** lembretes agendados de forma confiável com o app fechado não são garantidos em todas as plataformas web. **[RECOMENDAÇÃO]** Tratar como "melhor esforço" e mostrar a rotina dentro do app.

### 12.8 Fontes musicais

O VexFlow 5 usa fontes SMuFL (como Bravura, licenciada sob **SIL Open Font License**). **[A VERIFICAR]** a lista de fontes do pacote e a licença de cada uma.

---

## 13. Modelo conceitual de armazenamento dos dados

### 13.1 Entidades

| Entidade | Atributos principais | Observações |
|---|---|---|
| **Perfil/Configurações** | nomenclatura (Dó-Ré-Mi / C-D-E), convenção de oitava, lateralidade, tema, retenção-alvo, limites diários, A_ref, tolerância em cents | Um perfil local; vários perfis opcionais no futuro |
| **Instrumento** | nome, transposição, cordas[] (solta_midi, espessura), num_casas, capotraste | Padrão: violão de 6 cordas, afinação padrão |
| **ItemConhecimento (KC)** | id estável, tipo, parâmetros (altura, local, posição...), nível | Criado sob demanda |
| **Cartão** | id, kc_id, sentido, estado FSRS (D, S, último review, vencimento), contadores | Um por (KC × sentido) |
| **RegistroRevisão** | cartão_id, timestamp, nota FSRS, correto, tempo_ms, método_entrada, código_erro, resposta_bruta, foi_primeira_do_dia | **Imutável (append-only)**; fonte de verdade para recalcular tudo |
| **Fluência** | kc_id × método_entrada → EWMA, variância, n | Derivável dos registros |
| **ModeloExercício** | id, módulo, vetor de dificuldade, restrições | Configurações nomeadas ("V posição, só naturais") |
| **InstânciaExercício** | id, modelo_id, semente, conteúdo gerado (notas, ritmo), digitação de referência | Reprodutível pela semente |
| **TentativaExercício** | instância_id, resultados por nota (altura, onset, desvio), métricas C3 | Para frases e melodias |
| **Habilidade (Elo)** | id_habilidade, rating, incerteza, n | Por exemplo, `leitura:posV:ritmoN3` |
| **Sessão** | início, fim, duração planejada, blocos, itens feitos | Para metas e sequências de dias |
| **Rotina / Meta** | dias, durações, foco | Local |
| **Conquista** | id, data, critério | Ligadas a capacidade real (§14.6) |
| **InstantâneoSemanal** | semana, agregados por item e local | Para a evolução e o heatmap histórico |
| **CalibraçãoÁudio** | dispositivo, latência medida, limiar de ruído, A_ref | Por dispositivo de entrada |

O sistema de foco (§16) guarda seus dados **no armazenamento da extensão**, separado da plataforma.

### 13.2 Princípios

- **Registro de eventos imutável:** todos os estados (FSRS, fluência, domínio) podem ser **recalculados** a partir de `RegistroRevisão`. Isso permite corrigir bugs de métricas e reotimizar o FSRS sem perder dados.
- **IDs estáveis e semânticos** para KCs (permitem migração e exportação legível).
- **Versões de esquema** com migrações declaradas; o backup JSON inclui `schemaVersion` e o importador migra versões antigas.
- **Volume estimado [HIPÓTESE]:** 200 revisões/dia × ~200 bytes ≈ 40 KB/dia → ~15 MB/ano, tranquilo para IndexedDB.

---

## 14. Proposta de interface e navegação

### 14.1 Navegação principal (barra lateral)

1. **Painel inicial** — botão "Começar sessão de X min", revisões vencidas, sequência de dias, andamento sustentável, alerta de backup.
2. **Meu treinamento** — orquestrador de sessões e rotinas (§6.9).
3. **Leitura de partituras** — Módulo D (melodias, leitura contínua, estudos).
4. **Treinamento por posição** — Módulo C (grade de posições com estado).
5. **Flashcards** — Módulos A (prática livre) e B (revisão espaçada).
6. **Ritmo** — Módulo E.
7. **Intervalos** — Módulo F.
8. **Acordes e harmonia** — Módulo G.
9. **Treinamento auditivo** — Módulo H.
10. **Estatísticas** — heatmap, evolução, pontos fracos.
11. **Configurações** — instrumento, nomenclatura, áudio/microfone, aparência, dados (backup), privacidade.

### 14.2 Tela de treinamento (desktop, ≥ 1280 px)

```
┌───────────────────────────────────────────────────────────────────┐
│ Módulo · Exercício            Progresso ██████░░░ 12/20   ⏱ 1,4 s │
├───────────────────────────────────────────────┬───────────────────┤
│                                               │ Exercício         │
│            PENTAGRAMA (nota/frase)            │ V posição, naturais│
│                                               │ Modo: dentro da pos│
├───────────────────────────────────────────────┤                   │
│                                               │ Feedback          │
│            BRAÇO DO VIOLÃO (interativo)       │ ✓ Correto — corda 4│
│                                               │ casa 7 (Lá4 escrito)│
├───────────────────────────────────────────────┤                   │
│ 🎤 Microfone: ATIVO ● (nível ▮▮▮▯)  Metrônomo │ Sessão: 6:12/10:00│
└───────────────────────────────────────────────┴───────────────────┘
```

- Pauta e braço **sempre visíveis ao mesmo tempo**; feedback ao lado, nunca em janelas modais que tapem o estímulo.
- O **indicador de microfone ativo** fica sempre visível quando o microfone está ligado (e o navegador também mostra o seu).
- O modo contínuo pode recolher o painel lateral para ampliar a pauta.

### 14.3 Atalhos de teclado (padrão, reconfiguráveis)

| Ação | Atalho |
|---|---|
| Iniciar/pausar sessão | Espaço (fora de campo de texto) / Esc |
| Próxima questão | Enter |
| Nome da nota | C D E F G A B (ou mapeamento Dó–Si) |
| Sustenido / bemol / bequadro | `#` ou `+` / `-` / `=` |
| Oitava | setas ↑/↓ |
| Corda + casa | dígito da corda (1–6), depois casa (0–24), Enter |
| Ouvir a nota | R |
| Dica | H |
| Mostrar/ocultar nomes no braço | N |
| Metrônomo liga/desliga | M; andamento ± com `[` `]` |
| Microfone liga/desliga | Ctrl+M |
| Ajuda de atalhos | `?` |

### 14.4 Configurações principais

Nomenclatura (latina/anglo-saxã, convenção de oitava); afinação e instrumento; número de casas; posição estudada; espaçamento dos trastes (realista/uniforme); lateralidade; andamento padrão; dificuldade; retenção-alvo; limite de itens novos; A_ref; tolerância em cents; método de entrada preferido; tema claro/escuro; tamanho da pauta.

### 14.5 Acessibilidade

Contraste AA; nada transmitido só por cor (heatmap com padrões); todos os controles navegáveis por teclado; leitores de tela para o texto do feedback (a pauta e o braço têm descrições textuais alternativas); possibilidade de reduzir animações.

### 14.6 Gamificação e rotina (sem competição vazia)

**Princípios [RECOMENDAÇÃO]**, apoiados na teoria da autodeterminação (Deci & Ryan) e no risco de o prêmio externo minar a motivação intrínseca:
- Recompensar **capacidade adquirida**, não cliques.
- Não há ranking entre pessoas (o app é pessoal); a comparação é com o próprio passado.

| Recurso | Implementação |
|---|---|
| Metas diárias | em minutos ou em revisões vencidas zeradas; ajustáveis |
| Sequência de dias | com 1–2 "dias de folga" por semana sem quebrar a sequência (evita ansiedade e abandono após uma falha) |
| Pontuação | ponderada por dificuldade e por *notas no tempo*, não por volume |
| Conquistas | ligadas a marcos reais: "V posição concluída", "72 bpm sustentáveis no nível 3", "todas as notas da corda 5 dominadas" |
| Níveis de domínio | os estados de §11.2 |
| Desafios semanais | gerados a partir dos pontos fracos ("esta semana: corda 4, casas 5–9") |
| Testes de velocidade/precisão | cronometrados, com recorde pessoal |
| Histórico | linha do tempo de marcos |

---

## 15. Integração com microfone

### 15.1 Distinção fundamental

| Pergunta | O microfone responde? |
|---|---|
| **Qual altura soou?** (frequência fundamental → nota + oitava) | **Sim**, com boa confiabilidade em sinal monofônico |
| **Quando a nota começou?** (onset) | **Sim**, com latência a calibrar |
| **Em qual corda e casa foi tocada?** | **Não com segurança.** A mesma altura em locais diferentes tem a mesma fundamental; as diferenças de timbre (inarmonicidade, espectro) são sutis e dependem do instrumento, das cordas e do microfone |
| **Qual acorde (voicing) soou?** | Só por análise polifônica, com confiabilidade bem menor (§15.8) |

### 15.2 Pipeline conceitual

1. **Permissão:** `navigator.mediaDevices.getUserMedia({ audio: … })`, só depois de uma ação explícita do usuário, com explicação prévia de que o áudio **não sai do computador**.
2. **Restrições de captura [RECOMENDAÇÃO]:** desligar `echoCancellation`, `noiseSuppression` e `autoGainControl`. Esses processamentos são otimizados para voz e distorcem notas sustentadas de instrumento. **[A VERIFICAR]** o comportamento por navegador/SO no protótipo.
3. **AudioWorklet:** processa blocos de 128 amostras (o *render quantum* da Web Audio API), acumula numa janela deslizante e executa a detecção.
4. **Detecção de f0:** YIN (§15.3).
5. **Pós-processamento:** suavização, estabilidade e decisão de nota (§15.5).
6. **Mensagem** para a thread principal: `{f0, confiança, nota, cents, timestamp_onset}`.
7. **Validação** pelo motor (§9.3).

### 15.3 YIN (de Cheveigné & Kawahara, 2002)

**[FATO]** O YIN é um estimador de frequência fundamental para fala e música, baseado na **função de diferença** (relacionada à autocorrelação), com a **função de diferença normalizada pela média cumulativa**, **limiar absoluto**, **interpolação parabólica** e uma etapa de busca do melhor estimador local; os autores relatam taxas de erro bem menores que as de métodos concorrentes ([PubMed 12002874](https://pubmed.ncbi.nlm.nih.gov/12002874/); *J. Acoust. Soc. Am.* 111(4), 2002).

**Parâmetros para violão [RECOMENDAÇÃO / HIPÓTESE a calibrar]:**
- **Faixa de busca:** ~70 Hz (abaixo de E2 = 82,41 Hz, para tolerar afinação baixa) até ~1.400 Hz (acima de C6 = 1.046,5 Hz, casa 20 da corda 1). Afinações alternativas mais graves ampliam a faixa.
- **Janela:** ≥ 2 períodos da menor frequência → ~25 ms para 80 Hz. Na prática, 2.048 amostras a 48 kHz (~43 ms) é um bom ponto de partida; a janela pode ser menor quando a nota-alvo é aguda (o alvo é conhecido no exercício).
- **Limiar do YIN:** 0,10–0,15.
- **Taxa de análise:** salto de 256–512 amostras (~5–10 ms).

### 15.4 Erros de oitava e notas "fantasma"

- **Erros de oitava** (detectar o dobro ou a metade de f0) são o modo de falha clássico. Mitigações: o limiar do YIN (que escolhe o *primeiro* mínimo abaixo do limiar, reduzindo erros de "sub-oitava"), **prior do exercício** (quando a nota esperada é conhecida, considerar a hipótese a ±12 semitons e decidir com cuidado, **sem "corrigir" a resposta do aluno para a esperada**), e estabilidade ao longo de vários quadros.
- **Ataque:** os primeiros ~20–40 ms depois do ataque são ruidosos e inarmônicos; descartar até a estabilização.
- **Cordas soltas ressoando por simpatia** e notas anteriores ainda soando: depois de um onset novo, a estimativa anterior é descartada.
- **Ruído ambiente:** porta de ruído (*noise gate*) com limiar calibrado (§15.6); exigir confiança mínima (valor do mínimo da função YIN).

### 15.5 Decisão de nota

- Converter f0 em midi contínuo: `m = 69 + 12 × log2(f0 / A_ref)`.
- **Nota detectada** = arredondamento de `m` se |desvio| ≤ tolerância.
- **Tolerância em cents** (configurável): ±50 cents é o limite teórico entre semitons; **padrão ±35 cents** para tolerar violão levemente desafinado e vibrato; um modo "afinação estrita" de ±15 cents treina a afinação. O estudante precisa ser avisado se o **instrumento** estiver desafinado (afinador embutido, que usa o mesmo detector).
- **Estabilidade:** exigir N quadros consecutivos (por exemplo, 3–5, ~30–50 ms) com a mesma nota.
- **Onset:** detecção por energia/fluxo espectral; o timestamp do onset (corrigido pela latência calibrada) é o que entra na avaliação rítmica.

### 15.6 Latência e calibração

- **Componentes:** latência de entrada do dispositivo (`AudioContext.baseLatency`/`outputLatency` ajudam no lado da saída; a entrada depende do SO/driver), janela de análise (~20–40 ms efetivos) e estabilização (~30–50 ms).
- **Meta [HIPÓTESE]:** feedback visual ≤ 150 ms após o ataque; para a avaliação rítmica, o **timestamp do onset** importa mais que a latência do feedback, e é corrigido pela calibração.
- **Calibração guiada:** o estudante toca junto com um metrônomo por 8–16 batidas; o sistema mede o desvio médio e grava o deslocamento por dispositivo. Mede-se também o ruído de fundo para ajustar o *gate*.

### 15.7 Problema da localização física: solução realista

**Classificação de viabilidade das abordagens:**

| Abordagem | Viabilidade | Comentário |
|---|---|---|
| **Altura + restrição de posição** (o exercício fixa a posição; dentro da janela base, cada altura tem um local, §8.6) | **Alta** — recomendada | O sistema confia que o estudante está na posição. Onde a janela tiver duplicatas (aberturas, Sol–Si, posição aberta), o exercício aceita os dois ou pede confirmação no braço virtual |
| **Altura pelo microfone + local confirmado por clique/teclado** | **Alta** | Útil em treino de localização: toca no violão, depois marca no braço onde tocou; o sistema confere a coerência altura × local |
| **Autodeclaração** ("toquei na corda 4") | Alta, mas não verificável | Aceitável para prática pessoal |
| **Inferência de corda pelo timbre** (inarmonicidade, envelope espectral) | **Baixa/experimental** | Há pesquisa acadêmica sobre detecção de corda em guitarra e baixo (por exemplo, Abeßer, 2012; Barbancho et al., 2012, sobre inarmonicidade — [A VERIFICAR]), mas a precisão depende do instrumento e das condições; não deve ser usada para *reprovar* o aluno |
| **Captador hexafônico + MIDI** (cada corda num canal MIDI) via **Web MIDI API** | **Alta precisão, custo de hardware** | Sistemas de guitarra MIDI com captador hexafônico enviam cada corda num canal; o navegador lê via Web MIDI (Chrome). É a única solução que identifica a corda de forma confiável. Recurso opcional, Fase 4+ |

### 15.8 Polifonia (acordes) — funcionalidade avançada

| Abordagem | Viabilidade | Observações |
|---|---|---|
| **Cromagrama + comparação com modelos** (verifica as classes de altura presentes) | Média para *qualidade do acorde*; baixa para *voicing exato* | Não identifica inversão nem voicing com confiança |
| **Transcrição polifônica por rede neural** (por exemplo, Basic Pitch, da Spotify, Apache-2.0, com versão para navegador — [A VERIFICAR] pacote, tamanho do modelo e desempenho) | Média, experimental | O modelo pesa mais (download inicial); latência maior; adequado para avaliar *depois* de tocar, não em tempo real |
| **Arpejar o acorde** (o estudante toca nota a nota) | **Alta** | Transforma o problema polifônico num monofônico; recomendado como primeira solução na Fase 5 |
| **MIDI hexafônico** | Alta | Igual a §15.7 |

### 15.9 Privacidade do áudio

- Processamento 100 % local; nenhuma gravação é salva por padrão.
- Gravação opcional de uma frase para autoavaliação fica só no dispositivo, com exclusão fácil.
- O indicador de microfone ativo fica sempre visível; o microfone é desligado ao sair da tela de exercício ou após X minutos ocioso.

---

## 16. Viabilidade do sistema de foco

### 16.1 Princípio

O sistema de foco é um **componente separado** (extensão do Chrome) que **não compartilha código obrigatório nem banco de dados** com a plataforma. A plataforma funciona plenamente sem ele.

**Aviso honesto [RECOMENDAÇÃO]:** em software controlado pelo próprio usuário, **todo bloqueio pode ser contornado** (desativar ou remover a extensão, usar outro navegador ou perfil, modo anônimo se permitido). O objetivo é criar **fricção e compromisso**, não uma prisão.

### 16.2 Diferenciação dos cenários

| Cenário | Viável? | Como | Limites |
|---|---|---|---|
| **1. Bloqueio de sites no navegador** | **Sim** | Extensão MV3 com `declarativeNetRequest` | Só no navegador e perfil onde a extensão está |
| **2. Tempo de uso de abas** | **Sim (aproximado)** | `chrome.tabs`, `chrome.windows` (foco), `chrome.idle`, `chrome.alarms` | Medição por eventos; pode haver imprecisão de segundos; o service worker da extensão pode ser suspenso |
| **3. Bloqueio de aplicativos desktop (Windows)** | **Não por página web nem por extensão** | Exigiria um aplicativo nativo (processo residente, permissões do SO) | Fora de escopo; possível no futuro com app nativo + *Native Messaging* |
| **4. Integração com apps externos** | **Parcial** | Só com APIs públicas/exportações do serviço externo, ou autodeclaração | Verificação real depende do serviço oferecer API |
| **5. Dispositivos móveis** | **Não com esta arquitetura** | O Chrome para Android não suporta extensões; no iOS, o controle de tempo exige app nativo com as APIs de Screen Time; no Android, app nativo com estatísticas de uso/acessibilidade | Fora de escopo |

### 16.3 APIs do Chrome Manifest V3 pertinentes

- **`declarativeNetRequest`** **[FATO]** ([documentação](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)):
  - **Regras dinâmicas:** até **30.000** regras "seguras" (block, allow, allowAllRequests, upgradeScheme) a partir do Chrome 121; regras "não seguras" (por exemplo, *redirect*) limitadas a **5.000**. Antes do Chrome 120, havia um limite combinado de 5.000.
  - **Regras de sessão:** até 5.000, apagadas ao fechar o navegador.
  - **Redirecionar para a página da extensão:** chave `extensionPath`; o recurso precisa estar em `web_accessible_resources`.
  - **Permissões:** com `declarativeNetRequest`, as regras de *block/allow* funcionam sem acesso ao host (com aviso na instalação); com `declarativeNetRequestWithHostAccess`, é preciso pedir permissão de host, e o redirecionamento exige permissão de host para o domínio.
- **`chrome.tabs` / `chrome.windows`:** aba ativa e janela em foco (para contar o tempo).
- **`chrome.idle`:** detectar inatividade e não contar o tempo ocioso.
- **`chrome.alarms`:** verificação periódica (**[A VERIFICAR]** o período mínimo atual, documentado como 30 s nas versões recentes).
- **`chrome.storage`:** configurações e contadores (local).
- **`externally_connectable`** / mensagens: comunicação **opcional** com a plataforma web, se hospedada num domínio conhecido.

### 16.4 Fluxo proposto

1. O usuário configura a lista de sites e uma cota (por exemplo, 10 min/dia ou por janela de tempo).
2. A extensão conta o tempo de aba ativa + janela focada + usuário não ocioso.
3. Ao atingir a cota → regra dinâmica de bloqueio (ou redirecionamento para a página "Desafio" da extensão).
4. **Desafio:** a página da extensão oferece:
   - (a) **mini-desafio embutido** na própria extensão (por exemplo, 10 questões de leitura de notas com ≥ 80 % de acerto). Verificável localmente, porque a extensão gera e corrige;
   - (b) **cumprir X minutos na plataforma**: a plataforma sinaliza a conclusão de uma sessão à extensão via mensagem. **Verificável em grau razoável**, mas falsificável por um usuário técnico (console);
   - (c) **atividade externa** (outro app educacional): **só autodeclaração**, a menos que o serviço tenha uma API de verificação.
5. Após o desafio → desbloqueio por tempo limitado (por exemplo, nova cota de 10 min), com registro.

### 16.5 Cadeado social (desbloqueio emergencial com aprovação externa)

**O que exige serviços pagos ou servidor [FATO]:**
- **Envio automático por WhatsApp:** a WhatsApp Business Platform (Cloud API) exige conta empresarial e, desde 1º de julho de 2025, cobra **por mensagem de template entregue**, inclusive templates de autenticação, com preço por país ([Meta — Pricing](https://developers.facebook.com/docs/whatsapp/pricing)). Também exige um servidor ou webhook. **Não é gratuito nem local.**
- **Envio automático por SMS:** provedores (por exemplo, Twilio) cobram por mensagem e exigem backend. **Não é gratuito.**

**Solução local e gratuita proposta [RECOMENDAÇÃO]** — o **usuário** envia a mensagem, e a validação é criptográfica e offline:

**Variante A — TOTP (simples):**
1. Na configuração, a extensão gera um segredo e mostra um QR Code; o **contato de confiança** escaneia o QR **no próprio celular** com um app autenticador (padrão TOTP, RFC 6238). A extensão não guarda o QR depois.
2. Pedido de desbloqueio: a extensão abre um link `https://wa.me/<número>?text=<mensagem>` (ou `sms:`) com o texto pronto: "Preciso de um código de desbloqueio. Motivo: …". O **usuário** envia manualmente.
3. O contato lê o código de 6 dígitos no app autenticador e responde.
4. A extensão valida o código **offline** (janela de ±1 intervalo de 30 s).
- **Fraqueza:** o segredo TOTP fica armazenado na extensão (precisa estar lá para validar); um usuário técnico pode extraí-lo.

**Variante B — Desafio-resposta com assinatura digital (mais forte):**
1. Na configuração, o contato abre uma **página estática** (parte do projeto, funciona offline no celular dele) que gera um par de chaves (por exemplo, Ed25519, disponível na Web Crypto API em navegadores recentes — [A VERIFICAR] suporte). A **chave privada fica só no celular do contato**; a chave pública é transferida para a extensão por QR.
2. Pedido: a extensão gera um **desafio** aleatório curto (com data/hora e validade) e o envia via `wa.me`/`sms:` pelo usuário.
3. O contato cola o desafio na página dele, que devolve uma **assinatura** (texto de ~88 caracteres em base64, ou um código compacto).
4. A extensão verifica a assinatura com a chave pública. **Não há segredo no computador do usuário**, então o código não pode ser forjado a partir dos dados locais.
- **Limite:** o usuário ainda pode desinstalar a extensão. A força criptográfica só impede *forjar o código*, não *fugir do sistema*.

**Regras comuns:**
- **Códigos temporários:** validade de 10–15 min; desafio de uso único (nonce registrado).
- **Limite de tentativas:** por exemplo, 5 tentativas erradas → bloqueio do pedido por 30 min.
- **Registro:** data, motivo, resultado e duração do desbloqueio (local).
- **Recuperação:** se o contato perder o celular ou o app autenticador, é preciso redefinir. **[RECOMENDAÇÃO]** Exigir um **período de espera** (por exemplo, 24 h) para remover ou trocar o contato pela própria extensão, o que cria fricção sem trancar o usuário para sempre.
- **Consentimento do contato:** o contato precisa saber e aceitar o papel; a extensão não envia nada sem a ação do usuário.

### 16.6 Distribuição da extensão

- Instalação local em "modo desenvolvedor" (gratuita).
- **[FATO]** A Chrome Web Store cobra uma **taxa única de registro de desenvolvedor** (historicamente US$ 5) para publicar. **[A VERIFICAR]** o valor atual.

---

## 17. Segurança, privacidade e licenciamento

### 17.1 Privacidade

- Sem conta, sem telemetria por padrão, sem servidores de aplicação.
- Todos os dados no IndexedDB do navegador do usuário; backup em arquivo controlado pelo usuário.
- Microfone: permissão explícita, indicador visível, processamento local, nada gravado por padrão.
- Fontes e bibliotecas **empacotadas no build** (sem CDNs em tempo de execução, o que também evita vazar o uso para terceiros e garante o funcionamento offline).
- Política de privacidade curta e em linguagem clara dentro do app.

### 17.2 Segurança

- **Content Security Policy** estrita (sem scripts de terceiros).
- O backup importado é **validado por esquema** antes de ser gravado (evitar dados malformados).
- Extensão: permissões mínimas; nenhum `host_permissions` amplo além do necessário para os domínios configurados; nenhum envio de histórico de navegação para fora do dispositivo.
- Cadeado social: comparação de códigos em tempo constante; nonce de uso único; limite de tentativas.

### 17.3 Tabela de licenças e custos

| Tecnologia | Finalidade | Licença | Limitações | Dependências | Servidor? | Custos potenciais | Alternativas open-source |
|---|---|---|---|---|---|---|---|
| React | UI | MIT | — | — | Não | Nenhum | Preact (MIT), Svelte (MIT) |
| TypeScript | Linguagem | Apache-2.0 | — | — | Não | Nenhum | — |
| Vite | Build/dev | MIT | — | Node.js no desenvolvimento | Não | Nenhum | — |
| **VexFlow 5** | Pauta/tablatura | **MIT** ([fonte](https://github.com/vexflow/vexflow)) | Não é motor de teoria; recursos exatos a validar | Fontes SMuFL | Não | Nenhum | OSMD, abcjs [A VERIFICAR licenças] |
| Fontes SMuFL (Bravura etc.) | Glifos musicais | SIL OFL [A VERIFICAR por fonte] | Regras de redistribuição da OFL | — | Não | Nenhum | — |
| Fretboard.js | Braço (referência) | **ISC** ([fonte](https://github.com/moonwave99/fretboard.js)) | Atividade de manutenção incerta | — | Não | Nenhum | **Componente SVG próprio (recomendado)** |
| **ts-fsrs** | Repetição espaçada | **MIT** ([fonte](https://github.com/open-spaced-repetition/ts-fsrs)) | Otimizador em pacote separado (binding) | — | Não | Nenhum | Implementação própria do FSRS (algoritmo aberto) |
| Dexie.js | IndexedDB | Apache-2.0 | — | IndexedDB | Não | Nenhum | idb (ISC) |
| pitchy | Altura (MPM), baseline | **0BSD** ([fonte](https://github.com/ianprime0509/pitchy)) | MPM, não YIN | — | Não | Nenhum | YIN próprio (recomendado) |
| Web Audio API / AudioWorklet / getUserMedia | Áudio | Padrão W3C (nativo do navegador) | Diferenças entre navegadores; exige HTTPS ou localhost | — | Não | Nenhum | — |
| Web MIDI API | MIDI hexafônico (opcional) | Padrão W3C | Suporte varia por navegador | Hardware MIDI | Não | **Hardware pago** (opcional) | — |
| Tone.js (opcional) | Agendamento de áudio | MIT | Tamanho do pacote | — | Não | Nenhum | Agendador próprio |
| Basic Pitch (opcional, experimental) | Polifonia | Apache-2.0 [A VERIFICAR] | Modelo pesado; não tempo real | TensorFlow.js | Não | Nenhum | Cromagrama próprio |
| vite-plugin-pwa + Workbox | PWA/offline | MIT | — | Service Worker | Não | Nenhum | Service Worker manual |
| Zustand | Estado | MIT | — | — | Não | Nenhum | Contexto React |
| Vitest / Playwright | Testes | MIT / Apache-2.0 | — | Node.js | Não | Nenhum | — |
| Hospedagem estática (GitHub Pages, Cloudflare Pages, Netlify) | Distribuição | Serviços | Termos de uso e limites dos planos gratuitos | — | **Sim (só arquivos estáticos)** | **Gratuito nos planos atuais; pode mudar** | Executar localmente (`localhost`) |
| Extensão Chrome (MV3) | Foco | Código próprio | Só no Chrome/Chromium | — | Não | **Taxa única da Chrome Web Store** para publicar | Instalação em modo desenvolvedor |
| WhatsApp Business Platform (Cloud API) | Envio automático de códigos | Termos da Meta | Conta empresarial, templates aprovados | Servidor/webhook | **Sim** | **Pago por mensagem** | `wa.me` + envio manual (recomendado) |
| SMS (Twilio etc.) | Envio automático | Comercial | — | Servidor | **Sim** | **Pago por mensagem** | `sms:` + envio manual |

### 17.4 Licença do próprio projeto [RECOMENDAÇÃO]

- **Código:** MIT ou Apache-2.0 (compatíveis com todas as dependências permissivas listadas; Apache-2.0 acrescenta uma concessão de patentes).
- **Conteúdo pedagógico** (textos das aulas, exercícios fixos): CC BY-SA 4.0.
- **Não incluir** partituras de terceiros. Material em domínio público (por exemplo, eventualmente Sagreras ou Carcassi) só depois de verificar o status **da edição usada** e da jurisdição.
- Nomes de métodos e autores (Leavitt, Sagreras, Shearer, CAGED) podem ser citados como referência pedagógica, sem sugerir endosso nem reproduzir conteúdo.

---

## 18. Planejamento de desenvolvimento por fases

### 18.1 Análise de dependências da proposta original

| Proposta | Problema | Ajuste |
|---|---|---|
| Fase 1 sem registro de dados | A Fase 2 ficaria sem histórico e exigiria retrabalho no modelo | **Registro imutável de tentativas desde a Fase 1** |
| Ritmo só na Fase 3 | O ritmo é independente de altura e pode começar cedo | Módulo E básico (reconhecimento + tapping) entra na **Fase 2** |
| Microfone só na Fase 4 | O maior risco técnico fica escondido até tarde | **Spike de detecção de altura na Fase 1** (protótipo descartável, só para medir viabilidade) |
| Harmonia na Fase 5 | Depende do núcleo (Fase 1) e de intervalos (Fase 3) | Mantida; correto |
| Foco na Fase 6 | Independente do núcleo | Mantida por último; pode ser feita em paralelo por quem quiser |

### 18.2 Plano revisado

**Fase 0 — Fundações (núcleo de domínio)**
- Tipos de altura (escrita/soante, grafada/midi), grafia, mapeamento, posições, resolução de alterações e taxonomia de erros, **com testes exaustivos**.
- Esquema de dados + registro imutável + backup JSON.
- Spikes: VexFlow (corpo de prova de notação) e YIN (precisão com gravações de violão).
- **Entrega:** biblioteca de domínio testada; relatórios dos spikes; decisão final de renderização.

**Fase 1 — Núcleo de leitura**
- Pauta (VexFlow), braço SVG próprio (todas as opções de §12.4), Módulo A (prática livre), Módulo C básico (aulas + reconhecimento + teste de conclusão das posições aberta, II e V), feedback com explicação, atalhos de teclado, configurações essenciais, PWA offline.

**Fase 2 — Aprendizagem adaptativa + ritmo básico**
- ts-fsrs, rating automático, fluência, estados de domínio, Módulo B bidirecional, "Meu treinamento" (sessões de 5–30 min), estatísticas e heatmap, Módulo E (reconhecimento, contagem, tapping com teclado) e metrônomo preciso.

**Fase 3 — Leitura avançada**
- Gerador de melodias, resolvedor de digitação, Módulo D (estático, contínuo, revelação progressiva, janela à frente), Módulo F (intervalos), posições restantes + mudanças de posição, métricas de C3, Elo.

**Fase 4 — Instrumento físico**
- Microfone (YIN no AudioWorklet), afinador, calibração de latência e ruído, validação de altura e onset nos Módulos A, C, D e E, validação por posição; Web MIDI opcional.

**Fase 5 — Harmonia**
- Módulo G (tríades, tétrades, inversões, Drop 2/3, CAGED, condução de vozes); Módulo H (percepção); validação de acordes no braço virtual e arpejada no microfone; polifonia experimental.

**Fase 6 — Ecossistema de foco — RETIRADA DO ESCOPO (14/11/2026)**
- Decisão do usuário: a função de foco não é necessária, e nada no projeto deve interferir na navegação, no trabalho ou nos estudos. As seções 10 e 16 ficam apenas como registro da análise de viabilidade.

### 18.3 Marcos de valor

- **Fim da Fase 1:** já é uma ferramenta útil de reconhecimento por posição (uso pessoal diário).
- **Fim da Fase 2:** substitui baralhos do Anki com vantagem (bidirecional, fluência, heatmap).
- **Fim da Fase 3:** passa a treinar **leitura à primeira vista** de verdade (C3).
- **Fim da Fase 4:** treino com o violão físico.

---

## 19. Critérios objetivos de aceitação

### CA-NUC — Núcleo de domínio
1. Para todas as alturas soantes de midi 40 a 83 (E2 a B5) e afinação padrão com 19 casas, `L(s)` é igual a uma tabela de referência gerada por força bruta (6 × 20 combinações).
2. Os exemplos de §8.4 (E3, C4, E5, G4 escritos) retornam exatamente as localizações listadas.
3. `soante = escrita − 12` em 100 % das conversões; nenhum ponto da UI recebe tipo de altura errado (garantido pela checagem de tipos + teste).
4. A resolução de alterações (§9.2) passa num conjunto de ≥ 50 casos de teste, incluindo acidente no compasso, bequadro, ligadura através da barra, armadura em todas as oitavas e acidente em outra oitava (que não se propaga).
5. Unicidade (§8.6): para cada posição I–XII sem aberturas e sem cordas soltas, cada altura tem ≤ 1 local (teste automatizado); com abertura do dedo 4, só o par Sol–Si gera duplicata.
6. Trocar a afinação para Ré drop altera apenas a corda 6 (casa 0 = D2) e todas as localizações se atualizam sem mudanças de código.

### CA-NOT — Notação
1. Renderiza corretamente (validação visual com capturas de referência): notas de E3 a B6 escritos com linhas suplementares; clave de Sol com 8; todas as armaduras maiores/menores; ♯ ♭ ♮ 𝄪 𝄫; figuras da semibreve à semicolcheia e pausas; ponto; ligadura; quiáltera; compassos 2/4–12/8; acorde de 4 notas numa haste.
2. Clicar numa linha ou espaço da pauta (sentido 2) identifica a altura com 100 % de precisão no teste automatizado.

### CA-BRA — Braço virtual
1. Clique em qualquer célula (corda, casa) é registrado corretamente com espaçamento realista e uniforme, de 12 a 24 casas.
2. O modo canhoto espelha o braço e a resposta continua correta.
3. Marcadores nas casas 3, 5, 7, 9, 12 (duplo), 15, 17, 19, 21 e 24, conforme o número de casas.
4. Navegação completa por teclado (seleção de corda e casa).

### CA-EXE — Exercícios e validação
1. Nenhum exercício é gerado com conjunto de respostas válidas vazio (teste de propriedade com 10.000 gerações aleatórias por configuração).
2. Resposta em local válido fora da posição recebe o código E-FORA-POSIÇÃO e não é marcada como "nota errada".
3. A explicação de cada feedback lista todas as localizações de `L(s)` e destaca `V`.
4. Mesma semente ⇒ mesmo exercício (reprodutibilidade).

### CA-SRS — Repetição espaçada
1. Só a primeira tentativa do dia de cada cartão atualiza o estado do FSRS.
2. O rating é derivado automaticamente (§10.4) e registrado com o tempo e o método de entrada.
3. Os estados de domínio seguem §11.2: uma nota com 1/1 acerto **nunca** aparece como "Dominado"; "Não treinado" tem visual distinto de "Instável".
4. Apagar os estados derivados e recalcular a partir do registro imutável produz exatamente os mesmos valores.

### CA-C3 — Leitura à primeira vista
1. No modo contínuo, o cursor avança no andamento definido sem esperar a resposta; desvio do metrônomo < 2 ms em relação a `AudioContext.currentTime` (medido por teste).
2. As métricas de §11.4 são calculadas e exibidas no fim de cada frase.
3. As melodias geradas respeitam 100 % das restrições declaradas (posição, cordas, tessitura, vocabulário rítmico, soma de durações por compasso).

### CA-AUD — Microfone
1. Num conjunto de teste de ≥ 300 notas gravadas de violão (cordas 1–6, casas 0–12, dinâmicas variadas, ≥ 2 instrumentos), acerto de nota ≥ 97 %, erros de oitava ≤ 1 % **[HIPÓTESE de meta, ajustar após o spike]**.
2. Latência mediana entre o ataque e o feedback ≤ 150 ms em hardware de referência.
3. Nenhuma requisição de rede contém áudio (verificado por inspeção de rede).
4. O indicador de microfone ativo é visível 100 % do tempo em que o fluxo de áudio está aberto.

### CA-DAD — Dados e offline
1. Depois da instalação, todos os módulos funcionam com a rede desligada (teste automatizado em modo offline).
2. Exportar → limpar dados → importar restaura o estado idêntico.
3. A importação de um backup de versão antiga do esquema é migrada sem perda.

### CA-FOC — Extensão de foco
1. Depois de atingir a cota configurada, a navegação nos domínios listados é bloqueada ou redirecionada em ≤ 1 minuto.
2. Um desafio embutido concluído desbloqueia pelo tempo configurado; o registro é gravado.
3. Variante B: assinaturas de outra chave, desafios expirados ou reutilizados são recusados.
4. A extensão não faz nenhuma requisição de rede própria.

### CA-UX — Interface
1. Na resolução de 1366 × 768, pauta, braço, feedback, progresso e tempo ficam visíveis sem rolagem na tela de treino.
2. Uma sessão completa de 10 min pode ser feita só com o teclado.
3. Contraste WCAG AA em todos os textos.

---

## 20. Riscos técnicos e pedagógicos

### 20.1 Riscos técnicos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Detecção de altura imprecisa em violões, salas e microfones reais | Média | Alto | Spike na Fase 0; calibração; tolerância configurável; nunca reprovar sem alta confiança ("não entendi, toque de novo") |
| Latência variável entre dispositivos prejudica a avaliação rítmica | Alta | Médio | Calibração por dispositivo; tolerâncias por nível; avaliação por onset corrigido |
| Processamento de voz do navegador (AGC/supressão de ruído) degrada o sinal | Média | Médio | Desativar nas restrições; testar por navegador |
| VexFlow sem suporte a algum recurso exigido, ou mudanças de API entre versões | Baixa/Média | Médio | Spike com corpo de prova; camada de adaptação isolando a biblioteca |
| Perda de dados no IndexedDB (limpeza do navegador, remoção pelo Safari) | Média | Alto | `storage.persist()`; lembretes de backup; instalação como PWA |
| FSRS distorcido por repetições no mesmo dia ou ratings mal calibrados | Média | Médio | Regra da primeira tentativa do dia; alvos de tempo pessoais; registro imutável permite recalcular |
| Complexidade crescente do gerador de melodias | Média | Médio | Vetor de dificuldade explícito; testes de propriedade; começar simples |
| Polifonia não confiável | Alta | Baixo (se tratada como opcional) | Validação no braço virtual e por arpejo |
| Mudanças nas políticas do Chrome (MV3) ou da Web Store | Média | Baixo | Extensão isolada; não crítica |
| Custos inesperados (hospedagem, APIs) | Baixa | Médio | Nenhuma dependência paga obrigatória; executar localmente é sempre possível |

### 20.2 Riscos pedagógicos

| Risco | Mitigação |
|---|---|
| **Confundir reconhecimento com leitura**: o estudante "domina" flashcards mas não lê | Métricas de C3 como indicador principal; toda sessão termina em aplicação musical |
| **Dependência visual do braço virtual**: aprende a clicar, não a tocar | Incentivar o modo microfone; exercícios com braço oculto; ênfase no violão físico a partir do nível 2 |
| **Dependência de nomes de notas**: traduz símbolo → nome → local em vez de símbolo → local | Exercícios cronometrados com alvo de tempo que torna a tradução lenta inviável; ocultar nomes por padrão |
| **Aprendizagem só em posição fixa** (incapacidade de mudar) | Módulo de mudanças de posição; combinação de posições vizinhas; resolvedor de digitação |
| **Ritmo negligenciado** (leitura só de alturas) | Módulo E independente; o modo contínuo exige tempo; métrica "notas no tempo" |
| **Gamificação desvia o foco** (praticar pela sequência, não pela música) | Recompensas atreladas à capacidade; folgas na sequência; nada de ranking |
| **Sobrecarga de revisões** (efeito avalanche) | Limite de novos itens; sessão adaptativa; aviso de sobrecarga |
| **Técnica incorreta não detectada** (postura, mão direita) | Aviso explícito do limite do app; recomendação de professor; dicas de digitação sem avaliar |
| **Material gerado pouco musical** | Regras de contorno e cadência; frases-modelo revisadas por humano; feedback do usuário ("esta frase soa estranha") |
| **Leitura em contexto único** (só violão clássico) | Repertório e convenções populares, blues e jazz no nível 5+ |

---

## 21. Referências

### Pedagogia do violão
- Leavitt, W. — *A Modern Method for Guitar*, Vols. 1–3; *Reading Studies for Guitar*; *Melodic Rhythms for Guitar*. Berklee Press. https://berkleepress.com/berklee-authors/william-leavitt/
- UFPB — Laboratório de Guitarra e Ensino Musical. *O sistema de digitações de William G. Leavitt.* https://www.cchla.ufpb.br/lgemu/contents/noticias/o-sistema-de-digitacoes-de-willian-g-leavitt
- Sagreras, J. S. — *Las Lecciones de Guitarra* (Livros 1–6). Panorama: https://www.thisisclassicalguitar.com/sagreras-method-books-lessons/
- Shearer, A. — *Classic Guitar Technique*, Vol. 1. Alfred Music. https://www.alfred.com/products/classic-guitar-technique-volume-1-00-fc01937
- Shearer, A. — *Learning the Classic Guitar*, Partes 1–3. Mel Bay, 1990. [A VERIFICAR edição]
- Gould, E. — *Behind Bars: The Definitive Guide to Music Notation*. Faber Music, 2011.

### Leitura à primeira vista e cognição [A VERIFICAR detalhes bibliográficos antes de citar publicamente]
- Sloboda, J. A. (1974). The eye-hand span: an approach to the study of sight reading. *Psychology of Music*, 2(2).
- Lehmann, A. C., & Ericsson, K. A. (1996). Performance without preparation: Structure and acquisition of expert sight-reading and accompanying performance. *Psychomusicology*, 15.
- Kopiez, R., & Lee, J. I. (2008). Towards a general model of skills involved in sight reading music. *Music Education Research*, 10(1).
- Gudmundsdottir, H. R. (2010). Advances in music-reading research. *Music Education Research*, 12(4).
- Mishra, J. (2014). Improving sightreading accuracy: A meta-analysis. *Psychology of Music*, 42(2).
- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science*, 12(2).
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning. *Psychological Science*, 17(3).
- Cepeda, N. J., et al. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3).
- Kornell, N., & Bjork, R. A. (2008). Learning concepts and categories: Is spacing the "enemy of induction"? *Psychological Science*, 19(6).
- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science*, 35.
- Deci, E. L., & Ryan, R. M. (2000). The "what" and "why" of goal pursuits. *Psychological Inquiry*, 11(4).

### Repetição espaçada
- Woźniak, P. A. (1990). *Optimization of learning* (SM-2). SuperMemo.
- Ye, J., Su, J., & Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. *Proc. ACM SIGKDD*. [A VERIFICAR]
- ts-fsrs (MIT): https://github.com/open-spaced-repetition/ts-fsrs
- Documentação do Anki sobre FSRS: https://docs.ankiweb.net/ (o link indicado na proposta, `/faqs/what-spaced-repetition-algorithm.html`, retornou **404** em 13/11/2026; procurar a seção atual sobre FSRS no manual do Anki)

### Áudio
- de Cheveigné, A., & Kawahara, H. (2002). YIN, a fundamental frequency estimator for speech and music. *J. Acoust. Soc. Am.*, 111(4), 1917–1930. https://pubmed.ncbi.nlm.nih.gov/12002874/
- McLeod, P., & Wyvill, G. (2005). A smarter way to find pitch. *Proc. ICMC*.
- pitchy (0BSD): https://github.com/ianprime0509/pitchy
- MDN — Web Audio API, AudioWorklet, MediaDevices.getUserMedia(): https://developer.mozilla.org/
- Wilson, C. — A Tale of Two Clocks (agendamento de áudio). web.dev.
- Abeßer, J. (2012). Automatic string detection for bass guitar and electric guitar. *CMMR*. [A VERIFICAR]
- Barbancho, I., et al. (2012). Inharmonicity-based method for the automatic generation of guitar tablature. *IEEE TASLP*, 20(6). [A VERIFICAR]

### Digitação
- Sayegh, S. I. (1989). Fingering for string instruments with the optimum path paradigm. *Computer Music Journal*, 13(3). [A VERIFICAR]
- Radisavljevic, A., & Driessen, P. (2004). Path difference learning for guitar fingering problem. *Proc. ICMC*. [A VERIFICAR]

### Tecnologia
- VexFlow (MIT): https://github.com/vexflow/vexflow
- Fretboard.js (ISC): https://github.com/moonwave99/fretboard.js
- Chrome — declarativeNetRequest: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- Meta — Pricing on the WhatsApp Business Platform: https://developers.facebook.com/docs/whatsapp/pricing
- RFC 6238 — TOTP: https://www.rfc-editor.org/rfc/rfc6238

---

*Fim da especificação v0.1. Próximo passo sugerido: revisar as decisões marcadas com [RECOMENDAÇÃO], resolver os itens [A VERIFICAR] críticos (recursos do VexFlow, precisão do YIN com o seu violão) e iniciar a Fase 0.*

