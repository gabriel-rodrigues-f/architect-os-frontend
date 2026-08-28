# ADR-0022 — Invariantes de foco e de rótulo na interface

- Status: aceita
- Data: 2026-08-28
- Escopo: frontend (onda 5, fatia `o2-a11y-memo`, QA-04)

> Nota para a integração: os ADRs do projeto vivem hoje em `backend/docs/adr/`,
> fora deste worktree. Este arquivo nasceu na árvore do frontend porque a fatia
> não pode escrever no repositório irmão; se a decisão for manter um índice
> único, mova-o na integração preservando o número reservado (0022).

## Contexto

Três defeitos independentes desta fatia tinham a mesma forma: o componente
parecia certo na tela e passava na suíte, mas prometia à camada de
acessibilidade algo que não entregava.

1. **Item recolhido continua focável.** As seções colapsáveis do menu
   (`AppShell`) encolhem cada item com `grid-template-rows: 0fr` +
   `overflow-hidden`. O nó continua montado — é o que dá a animação suave — e
   portanto continua na sequência de tabulação. Quem navega por teclado saía do
   item visível e caía num link de altura zero: foco invisível, sem pista de
   posição.
2. **`<label for>` apontando para elemento não rotulável.** `for` só associa a
   `button`, `input`, `meter`, `output`, `progress`, `select` e `textarea`.
   Apontando para uma `div` (grupos de checkbox da mentoria) ou um `span` (o
   ciclo em modo leitura do cabeçalho), o navegador não cria associação nenhuma:
   o rótulo vira texto solto e o grupo/valor fica sem nome acessível.
3. **Controle de divulgação sem estado.** O contador de comentários de cada
   competência abre e fecha um painel, mas se anunciava como botão comum: sem
   `aria-expanded` não há como saber que existe algo para abrir nem perceber
   que abriu.

## Decisão

Três invariantes, válidos para qualquer tela nova:

1. **Escondeu visualmente, tira da ordem de tabulação e da árvore de
   acessibilidade.** Item que só encolheu (sem desmontar) recebe `tabIndex={-1}`
   e `aria-hidden`. Em `AppShell` isso mora num único ponto
   (`outOfReachProps`), aplicado tanto ao menu de desktop quanto ao drawer
   mobile.
2. **`for` só aponta para elemento rotulável.** Para nomear um agrupamento de
   controles, usa-se `role="group"` + `aria-labelledby` apontando para o id do
   rótulo (`FieldLabel` aceita `labelId` para esse caso). Valor em modo leitura
   não ganha rótulo associado falso: vira texto adjacente.
3. **Controle que abre e fecha declara `aria-expanded` e `aria-controls`**, e
   seu nome acessível diz sobre o quê. Em avaliações isso virou o componente
   `CommentToggleButton`, usado pela tabela e pelo cartão empilhado.

## Consequências

- Cada correção de teclado nesta base passa a nascer com o par de mouse escrito
  junto. A lição é cara: em 22/08 uma fatia de acessibilidade consertou teclado
  e quebrou o mouse nos filtros com a suíte verde, e o defeito só apareceu seis
  dias depois. Os testes desta fatia cobrem os dois caminhos para cada conserto.
- A verificação de rótulo órfão virou um auxiliar de teste reutilizável
  (`rotulosOrfaos`), porque dois pontos distintos caíam nela — a regra da casa
  de 2+ ocorrências vale para teste também.
- `FieldLabel` ganhou `labelId` e `htmlFor` passou a ser opcional. Os seis usos
  existentes continuam iguais.
