# Synapse — Frontend

Interface de gestão de capacidades técnicas de um time de Arquitetos de Soluções: matriz de
competências, assessments, gaps, PDIs, OKRs, trilhas, mentorias, evidências e 9-box.

TanStack Start + React 19 + Tailwind 4, consumindo a API em
[architect-os-backend](https://github.com/gabriel-rodrigues-f/architect-os-backend).

## Rodar

Pré-requisito: **Node ≥ 20.19** (o Vite 8 / rolldown não roda em versões anteriores).

```sh
cd frontend
nvm use          # lê o .nvmrc (Node 24.16)
npm install
npm run dev      # servidor de desenvolvimento (vite); `npm start` sobe o build SSR em node (.output)
```

- App: http://localhost:8080
- Aponta para `http://localhost:4000` por padrão; para mudar, crie um `.env` a partir de
  `.env.example` com `VITE_API_URL` (e adicione a origem em `CORS_ORIGINS` no backend).
- Se a 8080 estiver ocupada, o Vite sobe em 8081/8082 e continua funcionando: o CORS do
  backend libera qualquer porta em `localhost`/`127.0.0.1`. Confira no log qual porta saiu.

**O frontend depende do backend no ar** — sem ele a tela mostra "Não foi possível carregar os
dados". Suba a API antes (`cd ../backend && docker compose up -d --build`).

## Deploy

Fora do escopo Docker deste repositório, por decisão explícita. Deploy via
Cloudflare Workers, já configurado no preset do Nitro:

```sh
npm run build
npx nitro deploy --prebuilt
```

`VITE_API_URL` do ambiente de build precisa apontar para a API de produção
(o backend real, não `localhost:4000`); o backend precisa liberar a origem
de produção do frontend em `CORS_ORIGINS`. Runbook operacional (incidentes,
observabilidade) do lado da API: [`../backend/docs/RUNBOOK.md`](../backend/docs/RUNBOOK.md)
— este repositório não tem infraestrutura própria além do CDN/edge do
Cloudflare, então não há um runbook de backend equivalente aqui.

## Primeiro acesso

O app exige login (e-mail e senha). Na instância nova, a tela de entrada aparece como
**"Primeiro acesso"** e a primeira conta criada vira administradora. As demais pessoas podem
criar conta pela mesma tela, em "Criar uma nova conta".

O token é guardado no `localStorage` e a sessão é revalidada a cada carga.

## Como conversa com a API

O front hidrata a store com uma chamada a `GET /api/v1/state` e, nas mutações, atualiza o cache
do React Query na hora e envia a alteração à API; em erro, revalida o snapshot.

O prefixo `/api/v1` mora num lugar só: `src/lib/api-path.ts`. O `ApiClient` compõe
`base + prefixo + recurso`, então os call sites dos gateways passam apenas o recurso
(`/state`, `/cycles/${id}`) — nenhum deles escreve `/api` à mão.

### Tipos gerados do contrato OpenAPI (ADR-0011, fase 1)

`npm run gen:api` gera `src/lib/api-contract.gen.ts` a partir do `docs/openapi.json` do
backend (caminho padrão `../backend/docs/openapi.json`; sobreponha com `OPENAPI_JSON=...`
quando rodar de um worktree). O arquivo gerado é commitado — o gate não depende do backend
estar por perto.

**Lacuna conhecida do contrato, registrada sem inventar:** o `openapi.json` do backend não
declara response schemas (todo 200 sai como `content?: never`) e nem toda rota declara o
querystring (ex.: `GET /api/v1/assessments` aceita `architectId`/`cycleId` que não estão no
documento). Por isso os tipos gerados valem para **paths, params e bodies**; as **respostas**
continuam validadas em runtime pelos schemas zod de `src/lib/api-schemas.ts`, exatamente os
mesmos que já validavam o `/state`. Quando o backend publicar response schemas, a derivação
por zod pode ser aposentada rota a rota.

### Estrangulamento do `/state` (ADR-0011, fase 1)

O blob `GET /api/v1/state` (~2 MB) está sendo estrangulado. As rotas listadas no
livro-razão (`defaultStranglerLedger`, em `src/lib/state-contexts.ts`) — hoje o Painel `/`,
`/team` e o índice `/architects/$architectId` — **não carregam o blob**: cada uma declara os
contextos de que precisa e o `ContextScope` (`src/lib/context-scope.tsx`) monta o mesmo
`AppState` parcial a partir dos endpoints por contexto (`/architects`, `/assessments`,
`/cycles`, …), servindo-o pelo MESMO `useStore()`/`useSelectors()` de sempre — telas,
view-models e presenters não sabem a diferença. Mutações dentro de um escopo estrangulado
escrevem de volta nas queries de contexto (e no cache do blob, quando existir), então a
invalidação é cirúrgica: só os contextos daquela tela.

As demais rotas continuam no blob (modo `"blob"` do `StoreProvider`, decidido pelo
`__root` consultando o livro-razão). Fase 2 amplia a lista até o blob morrer.

`src/lib/api-client.ts` é o único lugar que fala `fetch` e o único que constrói `ApiError` —
inclusive para falha de rede, que vira `status: 0` e `code: "NETWORK_UNAVAILABLE"` em vez de
`TypeError: Failed to fetch` na cara de quem usa o produto. Falha de rede não encerra sessão.

Nenhuma tela escreve `try/catch` por conta própria; erro é assunto de quatro abstrações:

| Situação                                              | Use              |
| ----------------------------------------------------- | ---------------- |
| Ler dados para pintar a tela (`useQuery`)             | `QuerySection`   |
| Escrever, com erro ao lado do campo                   | `useAsyncSubmit` |
| Escrever, com erro em toast (ação fora de formulário) | `useToastSubmit` |
| Escrever mexendo no cache do `/state`                 | `MutationRunner` |

`MutationRunner` deliberadamente não revalida no caminho feliz — é o que evita refazer o fetch
e o parse de um `/api/v1/state` de ~2 MB a cada edição.

A política de sessão não mora no transporte: é um interceptor explícito
(`src/lib/session-policy.ts`) que derruba a sessão só quando o código
(`AUTHENTICATION_REQUIRED`, `SESSION_INVALID`, `SESSION_REVOKED`) casa com um 401 — um 401 de
negócio, como `INVALID_CURRENT_PASSWORD`, não desloga ninguém.

## Idioma

A interface é toda em português. Os valores de status continuam gravados em inglês no banco
(`Draft`, `In Review`, `Not Started`, …) e são traduzidos só na exibição, pela camada de
rótulos em `src/lib/labels.ts` — trocar um rótulo não exige migração de dados.

Os 11 domínios de competência são sempre renderizados em ordem alfabética (`localeCompare`
pt-BR, no front e no backend).

## Scripts

```sh
npm run gate              # portão do repositório: typecheck + lint + test + build
npm run gen:api           # regenera src/lib/api-contract.gen.ts do openapi.json do backend
npm test                  # unitários
RUN_INTEGRATION=1 npm test  # inclui contrato contra a API real (backend no ar)
npm run typecheck
npm run lint
npm run build
```

`npm run gate` é o mesmo portão do backend, adaptado ao que este repositório
tem: cada etapa é medida pelo próprio código de saída (montar a cadeia à mão
já deixou um typecheck quebrado passar por verde), e a primeira que falhar
interrompe mostrando o erro cru. O **build é etapa do gate** — o preset de
saída já mudou de forma silenciosa uma vez. Não existe `gate:full` aqui: o
frontend não tem suíte de integração própria (a de contrato roda por
`RUN_INTEGRATION=1`, com o backend no ar).

## Gate de entrega

O harness de observação do QA-UX: navega a aplicação inteira logado, preenche
os fluxos principais de escrita e captura um PNG por rota.

```sh
npm run e2e:nav           # navegação completa + capturas (exige backend no ar)
npm run e2e:nav:report    # abre o relatório HTML da última rodada
npm run test:e2e          # suíte E2E inteira (jornadas + fluxos de escrita + navegação)
```

Pré-requisito: a stack do backend no ar (no repo do backend: `docker compose
up -d postgres redis`, `npm run dev`, `npm run seed:access-profiles`) — o
`e2e:nav` verifica `/health/ready` e falha com instrução clara se não estiver.
As credenciais locais default são as do `seed:access-profiles`
(`admin@synapse.local` / `dev@synapse.local`); na CI o job `e2e` injeta as
suas via env.

O que cada peça garante:

- **`e2e/route-inventory.ts`** deriva a lista de rotas do próprio
  `src/routes/` — rota nova sem cobertura declarada FALHA o teste de
  cobertura de `navigation-capture.spec.ts` (ausência congelada, não
  silêncio).
- **`e2e/navigation-capture.spec.ts`** loga com um papel, visita toda rota e
  grava `e2e/screenshots/<papel>/<tema>/<rota>.png` (gitignorado; viewport
  1440×900, tema claro; escuro com `E2E_NAV_DARK=1`). Tela com error
  boundary/404 falha o teste com a lista — a captura fica como prova. O
  anexo `navegacao-resumo` do relatório registra onde cada papel aterrissou
  (rota admin-only mostra aviso in-place (member NÃO é redirecionado — vê /users com aviso e /competency-matrix em leitura), e isso é o recorte por
  papel que o QA-UX compara).
- **Papel** via `E2E_NAV_ROLE=admin|member|lead` (default `admin`). O seed
  local só cria admin e member; `lead` exige `E2E_LEAD_EMAIL`/`_PASSWORD`
  de uma conta existente.
- **Fluxos de escrita pela UI**: sessão de mentoria (`mentoring.spec.ts`),
  check-in/status de item de PDI (`pdi-lifecycle.spec.ts`) e, em
  `write-flows.spec.ts`: avaliar competência e enviar para revisão
  (member), pontuar e concluir (lead), criar ação de PDI a partir do gap,
  registrar evidência e adicionar código de vocabulário (admin).

Os specs E2E não rodam no `npm run gate` (unitário) — a separação é o
`testDir: "./e2e"` do `playwright.config.ts` versus o Vitest.

## Decisões

As decisões arquiteturais estão registradas como ADR no backend:
[`architect-os-backend/docs/adr/`](https://github.com/gabriel-rodrigues-f/architect-os-backend/tree/main/docs/adr).

## Built with

- TanStack Start
- TypeScript
- React 19
- Tailwind CSS 4
