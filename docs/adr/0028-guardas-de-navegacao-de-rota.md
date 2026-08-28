# ADR-0028 — Guardas de navegação de rota, e a cópia de autorização que morre na fatia seguinte

- Status: aceita
- Data: 2026-08-28
- Escopo: frontend (onda 8, fatia `guardas-de-rota`)
- Fonte: `tests/routes/route-guards.test.ts`, `src/lib/route-guards.ts`

> Nota para a integração: os ADRs do projeto vivem hoje em `backend/docs/adr/`,
> fora deste worktree. Este arquivo nasceu na árvore do frontend porque a fatia
> não pode escrever no repositório irmão; se a decisão for manter um índice
> único, mova-o na integração preservando o número reservado (0028).

## Isto NÃO é autorização

Escrito primeiro porque é o jeito mais fácil de ler esta fatia errado.

**A autoridade continua sendo o backend.** Nada nesta fatia impede alguém de
chamar a API direto. Um `beforeLoad` roda no navegador do próprio usuário, com
código que ele pode pausar, editar e pular. Guarda de rota é **UX e defesa em
profundidade**: evita que a pessoa caia numa tela que vai falhar, ou pior, numa
tela que carrega meia informação porque metade das chamadas dela deu 403.

Quem quiser saber se o servidor está fechado deve ler as guardas do backend, não
este arquivo. A fatia `roster-fechado` está fechando o lado do servidor **em
paralelo a esta**. As duas não se substituem.

## Contexto

`grep -rn "beforeLoad" src/` voltava **vazio**. Nenhuma rota tinha guarda de
navegação. A única barreira das telas administrativas era o item de menu
escondido — `filterNavGroups` em `AppShell.tsx` filtra por `adminOnly` — e
esconder o menu não fecha a URL. `/users`, `/competency-matrix` e
`/architects/$architectId` eram alcançáveis digitando o endereço.

O sintoma não era só cosmético. `/users` faz a consulta com `enabled: isAdmin`:
um não-admin que digitasse a URL recebia a tela montada e **permanentemente
vazia**, sem erro, sem explicação e sem caminho de volta além do botão do
navegador.

## Qual política, e de onde ela veio

A fonte é o backend. O que ele impõe **hoje**, lido nas controllers:

| Rota do frontend | Endpoint que a sustenta | Guarda no backend hoje | Guarda escolhida aqui |
|---|---|---|---|
| `/users` | `GET /auth/users` | `requireAdmin` (`auth.controller.ts:116`) | admin |
| `/competency-matrix` | `GET /capabilities`, `GET /competencies` | **nenhuma na leitura**; `requireAdmin` em toda escrita (`catalog.controller.ts`) | admin |
| `/architects/$architectId` | `GET /architects/:id` | **nenhuma** | `canActFor` |

Duas das três linhas não são cópia literal do backend, e é melhor dizer isso do
que deixar quem vier depois descobrir sozinho:

**`/competency-matrix` é mais restrita aqui do que o backend é na leitura.** O
catálogo é legitimamente legível por todo mundo — `gap-analysis`, `assessments`
e outras telas o consomem o tempo todo, e continuam consumindo. O que esta rota
é, é o **console de edição** do catálogo: as afordâncias de escrita dela já eram
gated por `isAdmin` no componente (`competency-matrix.tsx:143,270,361,460`), e
cada uma bate num endpoint com `requireAdmin`. O menu já declarava `adminOnly: true` — a guarda torna verdadeira
uma intenção que o projeto já tinha escrito. Nenhum dado deixa de ser alcançável
por causa disto; só esta porta fecha.

**`/architects/$architectId` é mais restrita aqui do que o backend, porque o
backend está errado hoje.** `GET /architects/:id` não tem guarda nenhuma. Não
inventamos política: `canActFor` é a mesma regra que o próprio backend já aplica
aos sub-recursos daquele arquiteto — `/career-level-transitions` e
`/deactivations` (`people.controller.ts:94,121`). A guarda de navegação usa a
regra que o backend já considera correta para o entorno do recurso, no recurso.

## Decisão

**Três `beforeLoad`, uma origem de sessão, e nenhuma nova política.**

**1. A sessão vem do cache que os providers já usam.** `beforeLoad` roda antes
de qualquer componente montar, então não pode usar `useAuth()`. Em vez de abrir
um segundo caminho de sessão, `src/lib/session-query.ts` passou a ser a
definição única (`queryKey` + `queryFn`) de `auth/me` e de `app-state`;
`AuthProvider` e `StoreProvider` agora consomem essa definição, e a guarda
resolve pelo mesmo `queryClient.ensureQueryData`. Uma entrada de cache, uma
requisição. Se a guarda tivesse chamado `authApi.me()` por conta própria, todo
boot faria dois `GET /auth/me` e os dois poderiam divergir.

**2. Sessão desconhecida não redireciona.** Fora do navegador (SSR) e quando
`me` falha, a guarda **libera**. Não é descuido: quem não tem sessão é barrado
pelo `AuthGate` do `__root.tsx`, que mostra o `LoginScreen`. Redirecionar aqui
trocaria a tela de login por uma ida silenciosa à home. O app já trata SSR assim
— `StoreProvider` usa `enabled: typeof window !== "undefined"` pelo mesmo
motivo: o `fetch` do servidor não carrega o cookie de sessão.

**3. Arquiteto que não existe continua caindo em `notFound`, não em
redirect.** A guarda só redireciona quando **encontra** o arquiteto e a política
nega. Um id inexistente passa e a rota mostra o `notFoundComponent` dela, que já
existia. Sem isso, esta fatia teria trocado calada o 404 da tela por um pulo
para a home.

## O teste, e por que ele navega em vez de renderizar

`tests/routes/route-guards.test.ts` monta o roteador de verdade sobre o
`routeTree` gerado, com `createMemoryHistory`, e afirma **onde a navegação
pára** — `router.state.location.pathname` depois de `router.load()`. Nenhum
componente é renderizado.

Isso é deliberado. Um teste que renderizasse a tela e procurasse texto proibido
provaria o que a tela desenha; o defeito era a rota **resolver**. E testar a
função de guarda isolada provaria só que a função funciona, não que ela está
ligada na rota — que era exatamente o defeito (a política já existia em
`scope.ts`; ninguém a chamava na navegação).

**Vermelho registrado**, contra o código anterior, `exit 1`:

```
nega /users a quem não é admin                       recebeu "/users"
nega /competency-matrix a quem não é admin           recebeu "/competency-matrix"
nega o perfil de outra pessoa a um member            recebeu "/architects/bruno"
nega o perfil a um lead sem atribuição               recebeu "/architects/bruno"
nega /users a um lead                                recebeu "/users"
```

Os três casos **permissivos** — admin em `/users`, member no próprio perfil,
admin em perfil alheio — nascem verdes de propósito. São a linha de base contra
bloquear demais: sem eles, uma guarda que redirecionasse todo mundo passaria nos
cinco casos acima.

## ACHADO — `scope.ts` é recorte de servidor feito no cliente. Não apagar ainda.

`src/lib/scope.ts` é cópia manual, método a método, do `AuthorizationService` do
backend (`canActFor`, `isLeadOf`, `isAssignedTechLeadOf`, `isAdmin`). E
`selectors.ts:104-109` (`ArchitectSelectors.visibleTo`) usa essa cópia para
**filtrar o roster no navegador** — o recorte que deveria ser do backend, feito
no cliente, sobre uma lista que chegou inteira.

Que `GET /architects` devolve a lista inteira é verificável: o `scopeAppState`
do backend recorta `assessments`, `plans`, `evidences`, `mentoringSessions` e
`learningPaths` — e **não** recorta `state.architects`.

**A fatia `roster-fechado` está fechando o lado do servidor agora, em
paralelo.** Quando ela aterrissar, esta duplicação vira código morto. Apagá-la
antes deixaria o frontend sem recorte nenhum no intervalo — o roster inteiro
apareceria para todo mundo. **Não apague nesta fatia. Ela morre na seguinte.**

Pontos que consomem `scope.ts` hoje, para a fatia que for removê-la:

| Arquivo | Uso |
|---|---|
| `src/lib/selectors.ts:97,108` (`visibleTo`, 104-109) | **o recorte do roster** — `visibleTo`, o alvo principal |
| `src/lib/route-guards.ts:41,54,58` | criado por esta fatia — ver ressalva abaixo |
| `src/routes/architects.$architectId.index.tsx:122,123` | `canActFor` / `isLeadOf` para afordâncias de edição |
| `src/routes/development-plans.tsx:105,110,111` | `canActFor`, `isLeadOf`, `isAssignedTechLeadOf` |
| `src/routes/learning-paths.tsx:83` | `canActFor` |
| `src/routes/team.tsx:66` e `components/app/team-shared.tsx:50` | injetado em `TeamViewModel` |
| `src/routes/competency-matrix.tsx:48` | injetado em `CompetencyMatrixViewModel` |
| `src/components/app/assessments-shared.tsx:34` | injetado em `AssessmentViewModel` |
| `src/components/app/mentoring-shared.tsx:554` | `isAssignedTechLeadOf` |
| `src/lib/view-models/{assessment,team,competency-matrix}-view-model.ts` | recebem a política por construtor (tipo) |

**Ressalva sobre a guarda que esta fatia acabou de escrever:** quando o roster
passar a chegar recortado, `requireArchitectReach` fica **redundante por
construção** — o arquiteto proibido simplesmente não estará em `app-state`, a
guarda cairá no ramo "não encontrei, libero", e a negação passará a se manifestar
como o `notFound` da rota em vez de redirect para a home. Não é quebra, mas é
uma **mudança de UX que ninguém decidiu**. Quem integrar `roster-fechado` deve
escolher entre as duas telas de negação, e o teste desta fatia vai apontar a
troca: `nega o perfil de outra pessoa a um member` espera `"/"`.

## Consequências

- As três rotas deixam de ser alcançáveis por URL para quem não deveria
  alcançá-las. O menu escondido deixa de ser a única barreira.
- Um não-admin não vê mais a tela `/users` montada e eternamente vazia.
- `session-query.ts` passa a ser a definição única de `auth/me` e `app-state`.
  `STATE_QUERY_KEY` continua exportado de `store.tsx` — o único consumidor
  externo (`assessments-shared.tsx:28`) não mudou de import.
- **Limite declarado:** a guarda cobre `/users`, `/competency-matrix` e
  `/architects/$architectId`. As demais rotas seguem sem guarda — nenhuma delas
  se protegia escondendo o menu, e inventar política para elas seria exatamente
  o que esta fatia se proibiu.
- **Limite declarado:** nada aqui protege dado. Protege navegação. O 403 do
  backend continua sendo a única coisa entre um usuário e um recurso.
