# ADR-0024 — Barril de `components/app` e a guarda de ciclo de importação

- Status: aceita
- Data: 2026-08-28
- Escopo: frontend (onda 6, fatia `o5-barrels`, CQ-04)

> Nota para a integração: os ADRs do projeto vivem hoje em `backend/docs/adr/`,
> fora deste worktree. Este arquivo nasceu na árvore do frontend porque a fatia
> não pode escrever no repositório irmão; se a decisão for manter um índice
> único, mova-o na integração preservando o número reservado (0024).

## Contexto

O CQ-04 é a metade de frontend do item de barrel imports; a metade de backend
fechou em `OO3-14+15`, com barril `index.ts` por módulo e por área de `shared`,
reexportando com `export *` só a API pública, e com os entrypoints de fora do
barril (`migrator`, `seed`, `seed-data` — "não são API de biblioteca").

O estado medido deste lado, antes de mexer:

| Área                | Imports profundos | Imports por barril | Tem `index.ts`? |
| ------------------- | ----------------: | -----------------: | --------------- |
| `components/app`    |               113 |                  0 | **não**         |
| `components/ui`     |                87 |                  0 | **não**         |
| `lib/gateways`      |  1 (+9 relativos) |                  0 | **não**         |
| `hooks`             |                 0 |                 28 | sim             |
| `lib/i18n`          |                 0 |                 56 | sim             |
| `lib/view-models`   |                 1 |                 24 | sim             |
| `lib/design`        |                 1 |                  8 | sim             |
| `lib/presenters`    |                 0 |                  8 | sim             |
| `lib/accessibility` |                 0 |                  3 | sim             |

Ou seja: as seis áreas que já tinham barril já eram consumidas por ele — as três
exceções são todas de `tests/`. O buraco real era `components/app`, com 113
importadores e nenhuma porta.

Dos 113: **55** em 18 arquivos de `src/` fora do diretório, **23** dentro do
próprio `components/app` e **35** em `tests/` e `e2e/`.

## Decisão

**1. Barril em `src/components/app/index.ts`, `export *`, como no backend.**
Os 18 consumidores de `src/` passam a entrar por `@/components/app`: 55 linhas
de import viram 20. Um arquivo que abria com quatro linhas de import do mesmo
diretório passa a abrir com uma.

**2. `charts-recharts` fica FORA do barril.** É o outro lado de um
`import()` dinâmico: `charts.tsx` carrega as figuras por `lazy()` justamente
para tirar o recharts (412 kB) do caminho crítico de toda rota que importa
`charts`. Reexportar o módulo no barril transformaria a aresta dinâmica em
estática e desfaria a divisão — regressão de bundle com a suíte verde. É o
mesmo critério do backend ao deixar `migrator`/`seed` fora do barril de
`persistence`: entrypoint não é API de biblioteca.

**3. `EmptyState` de `DataView` fica fora do barril, e `team.tsx` mantém as duas
origens explícitas.** Existem **dois** componentes distintos chamados
`EmptyState` — o de `DataView.tsx` (vazio de listagem, com "limpar filtros") e o
de `ui-bits.tsx` (cartão de estado vazio da página). `export *` não consegue
exportar os dois sob o mesmo nome: em ESM o nome ambíguo simplesmente deixa de
existir, sem erro. O barril exporta o de `ui-bits` (7 rotas) e reexporta de
`DataView` apenas `DataViewToolbar`, `Pagination` e os dois tipos. O único
arquivo que usa os dois, `src/routes/team.tsx`, importa cada um pelo caminho do
seu arquivo — ali o caminho profundo diz qual dos dois é, e o barril não diria.

**4. Dentro de uma área com barril, o import vai direto ao arquivo vizinho.**
Nunca pelo próprio barril. Essa é a regra que impede o ciclo, e vale para as
sete áreas com `index.ts`, não só para esta.

**5. Duas guardas de ciclo, porque não havia nenhuma.**

- `tests/lib/import-cycles.test.ts` monta o grafo de **runtime** de `src/`
  (via API do TypeScript) e exige zero ciclos. `import type`, `export type` e
  `import()` dinâmico não são aresta: o primeiro some na emissão, e o último é
  exatamente a aresta que _quebra_ ciclo — contá-la acusaria ciclo em
  `charts` ↔ `charts-recharts`, que não existe em runtime.
- `no-restricted-imports` por área no `eslint.config.js`, proibindo
  `@/<área>` dentro de `src/<área>/**`.

Ambas foram provadas contra um ciclo real antes de entrar. Com um `index.ts`
ingênuo e `ui-bits` importando o próprio barril, o teste aponta o caminho —

```
src/components/app/ui-bits.tsx -> src/components/app/index.ts
  -> src/components/app/ui-bits.tsx
```

— e o lint reprova a linha no arquivo. Sem a sabotagem, os dois voltam a verde.

## Onde se escolheu NÃO mexer

- **`components/ui` (87 imports).** É o diretório do shadcn, mantido pelo CLI
  (`components.json`): um barril escrito à mão envelheceria a cada componente
  adicionado. E `@/components/ui/button` já é o caminho mais óbvio que existe
  para `Button` — trocar por `@/components/ui` só apaga informação.
- **`lib/gateways` (10 sítios).** Nove são imports relativos de dentro do
  próprio `src/lib`, quase todos `import type` de um gateway específico. O
  barril não colapsaria linha nenhuma, tornaria `TextTemplateRecord` menos
  rastreável que `./gateways/config.gateway`, e arrastaria o `container.ts` —
  que conhece todos os gateways — para dentro do grafo de quem hoje só depende
  de um tipo.
- **`tests/` e `e2e/` (35 imports profundos).** Teste de unidade aponta para a
  unidade: `@/components/app/DataView` diz o que está sob teste; o barril não.
  Manter os testes intocados também é o que dá a esta fatia sua prova de
  comportamento — os 934 testes que existiam passaram sem uma linha alterada.
- **Os três imports profundos para áreas que já têm barril** (`lib/design/scale`,
  `lib/gateways/container`, `lib/view-models/mentoring-view-model`) — todos em
  `tests/`, pela mesma razão.

## Consequências

- Refatoração de zero mudança de comportamento, e o build mede isso: **71 chunks
  de cliente, 2841,60 kB no total, nome a nome e byte a byte idênticos** antes e
  depois. O rolldown remove os reexports não usados; o barril não custou bundle.
- A suíte foi de 934 para 937 testes — os três novos são a guarda de ciclo.
  Nenhum teste existente mudou.
- Fica registrado um achado que esta fatia **não** consertou: dois componentes
  distintos chamados `EmptyState`. Não é defeito de barril, é de nome, e
  renomear atravessa oito arquivos de rota — decisão de nomenclatura, para uma
  fatia de nomenclatura.
