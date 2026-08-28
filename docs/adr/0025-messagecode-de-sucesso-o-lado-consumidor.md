# ADR-0025 — `messageCode` de sucesso: o lado consumidor, e a cópia do fixture

- Status: aceita
- Data: 2026-08-28
- Escopo: frontend (onda 7, fatia `arq-18-consumidor`, ARQ-18)
- Fonte: `tests/lib/message-codes-de-sucesso.{test.ts,fixture.json}`

> Nota para a integração: os ADRs do projeto vivem hoje em `backend/docs/adr/`,
> fora deste worktree. Este arquivo nasceu na árvore do frontend porque a fatia
> não pode escrever no repositório irmão; se a decisão for manter um índice
> único, mova-o na integração preservando o número reservado (0025).

## Contexto

O ARQ-18 tem duas metades e a divisão não é organizacional, é técnica. A metade
emissora fechou no backend (ADR-0023 de lá): uma varredura pelo compilador do
TypeScript inventaria os 53 `messageCode` que as controllers emitem, e um
fixture congela código, rota, arquivo, linha e qual resposta o emitiu.

Aquele ADR declarou o próprio limite: **o inventário congela só o lado
emissor.** `backend/.git` e `frontend/.git` são repositórios separados e a CI
faz checkout de um só; um teste do backend que lesse `src/locales/pt.json`
daqui só passaria na máquina de quem tem os dois clonados lado a lado. Provar
que a chave existe do lado de cá é fatia daqui.

O defeito que sobra é falha silenciosa por construção. `successMessageOf` monta
`msg.${code}` e faz `key in baseMessages ? key : fallback`. Renomear um código
lá, ou esquecer a chave aqui, não gera erro de compilação, não gera lint e não
gera log: o toast degrada para o texto genérico do fallback. Cobertura antes
desta fatia, deste lado: **nenhuma**.

## Decisão

**A metade consumidora é um teste deste repositório, alimentado por uma cópia
versionada do fixture do backend, e ele verifica a corrente inteira — não duas
listas de string.**

Três escolhas, e cada uma responde a um jeito de o teste ficar cego:

**1. A verificação passa pelo caminho real.** Para cada código do inventário, o
teste sobe uma resposta `{ data, message: { code } }` pelo `ApiClient`, que
desembrulha o envelope e guarda o código no `WeakMap`, e só então chama
`successMessageOf`. Comparar `Object.keys(pt.json)` com as chaves do fixture
provaria que dois arquivos combinam; isto prova que o toast resolve. Se o
`WeakMap`, o hook de `preSerialization` ou a montagem da chave quebrarem, a
comparação de listas continuaria verde.

**2. A cópia do fixture é byte a byte, e a origem está escrita no teste.** A
fonte da verdade dos códigos é o fixture do backend; a cópia existe porque
nenhum dos dois repositórios pode ler o outro na CI. Manter o mesmo nome de
arquivo é deliberado: torna a atualização um `cp` literal, sem renomeação para
alguém errar.

**3. Contra a cópia órfã, duas defesas — e a segunda é oportunista de
propósito.** O canário de contagem (53) obriga a olhar quando o backend ganha
ou perde um código. A comparação contra o fixture original roda **quando os
dois repositórios estão lado a lado**, subindo a árvore a partir do arquivo de
teste, e se anuncia como pulada quando só este repositório está clonado.
Exigi-la seria escrever exatamente o teste que o ADR-0023 recusou. Como aviso,
ela é o que impede a cópia de envelhecer calada: na máquina de quem desenvolve,
uma divergência aparece no `npm test`, com o `cp` de conserto na mensagem de
falha.

**Os dois códigos quebrados ficam declarados, não consertados.** O invariante
estrito — todo código emitido tem chave — está **violado hoje**, e o teste foi
escrito primeiro na forma estrita para registrar o vermelho:

```
"auth.user.create.success (POST /auth/users, .../auth.controller.ts:132)",
"auth.user.update.success (PATCH /auth/users/:id, .../auth.controller.ts:168)"
```

O backend emite `auth.user.*`; este locale só define `msg.user.*`. Consertar
exige mexer nos dois repositórios no mesmo movimento — renomear o código lá OU
acrescentar as chaves aqui — e isso decide qual lado cede. É mudança de
contrato, não dívida de um lado só. Ficam como lista nomeada e canária: um
terceiro nome é dívida nova, um nome que saia é dívida paga, e as duas coisas
passam por uma edição consciente do arquivo.

## Consequências

- Renomear um `messageCode` no backend passa a produzir, aqui, uma falha que
  **nomeia o código, a rota e o arquivo:linha que o emite** — e, no mesmo
  `npm test`, a chave que ficou órfã e o `cp` da cópia defasada.
- Esquecer a chave de tradução de um código novo fica vermelho no `npm test`,
  sem Docker e sem subir o backend.
- **Duas chaves mortas ficam nomeadas e intactas:** `msg.user.create.success` e
  `msg.user.update.success`. `msg.user.update.success` não é lixo puro —
  `src/routes/users.tsx:65` a passa à mão como fallback, e é por isso que
  aquele toast mostra o texto certo apesar de o código não resolver;
  `msg.user.create.success` não é referenciada em lugar nenhum.
- **Limite declarado:** o teste prova que a chave existe e que a corrente
  resolve. Não prova que o **texto** está certo, nem que a rota que dispara o
  toast é a que o usuário acha que disparou. A paridade `pt`/`en` continua
  sendo de `tests/lib/i18n.test.ts`, que já a cobre.
- A comparação com o repositório irmão **pula** na CI. Um verde aqui não é
  prova de que a cópia está em dia; o canário de contagem é a parte que vale
  nos dois ambientes.
