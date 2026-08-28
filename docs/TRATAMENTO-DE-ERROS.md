# Tratamento de erro no frontend

Regra viva. Antes de escrever `try/catch` ou `.catch()` numa tela, escolha uma das quatro
abstrações abaixo. **Nenhuma tela chama `catch` por conta própria.**

## De onde vem o erro

`src/lib/api-client.ts` é o único lugar que fala `fetch` e o único que constrói `ApiError`.
Todo erro que chega numa tela é um `ApiError` com `status`, `code`, `details` e
`correlationId` — inclusive falha de rede (ver "Offline" abaixo).

A promessa **rejeita**. Ela nunca devolve o erro como valor: o React Query depende da
rejeição para `isError`, `retry` e error boundary funcionarem.

## Qual abstração usar

| Situação                                                           | Use                    |
| ------------------------------------------------------------------ | ---------------------- |
| Ler dados para pintar a tela (`useQuery`)                           | `QuerySection`         |
| Escrever, com erro **ao lado do formulário** (inline, junto do campo) | `useAsyncSubmit`       |
| Escrever, com erro **em toast** (ação fora de formulário)            | `useToastSubmit`       |
| Escrever mexendo no cache do `/state` (a store)                      | `MutationRunner`       |

### `QuerySection` — leitura

Recebe o objeto do `useQuery` e resolve carregando / erro + botão de repetir / vazio / dados.
A tela só descreve o caso feliz, no `children`. Se o "vazio" tem mensagem própria (não é
erro), trate dentro do `children`; `isEmpty` existe para o vazio que deve aparecer como falha.

### `useAsyncSubmit(fallback)` — escrita com erro inline

Devolve `{ submitting, error, clearError, run }`. `run` nunca lança: devolve
`{ ok: true, value }` ou `{ ok: false, error }`. `error` já é a string pronta para a tela.

### `useToastSubmit(fallback?)` — escrita com erro em toast

Mesma forma de `run`, mas a mensagem vai para `toast.error`. Sem argumento, usa
`authErrorMessage` (comportamento legado de algumas telas); prefira passar a chave i18n do
fallback.

### `MutationRunner` — escrita contra a store

`optimistic` pinta a mudança na hora e, **só em erro**, avisa e revalida.
`command`/`guarded` aplicam o resultado no cache.

> **Não invalide no caminho feliz.** `MutationRunner` deliberadamente não revalida quando a
> chamada dá certo — é o que evita refazer o fetch e o parse de um `/api/v1/state` de ~2 MB a
> cada edição. "Padronizar" isso para invalidar sempre é uma regressão grande e silenciosa.

## Mensagem de erro

`fallback` aceita string ou função. Com string, a regra é: **se for `ApiError`, mostre
`error.message` (a mensagem do servidor, já em português); senão, mostre o fallback.** É o que
`submitErrorMessage` faz — não reimplemente esse ternário na tela.

Nunca mostre `error.message` de um `Error` qualquer: é texto interno (zod, browser) vazando
para quem usa o produto.

## Quando a tela precisa do erro cru

Só para **desviar o fluxo** por `code` ou `status` — nunca para montar mensagem. Leia o erro
do resultado do `run`, sem `catch` próprio:

```tsx
const result = await run(() => viewModel.removeCapability(id, force));
if (result.ok) return invalidateAll();
if (!force && result.error instanceof ApiError && result.error.code === "PORTFOLIO_HAS_ANSWERED_ITEMS") {
  clearError();
  setPendingRemoval({ id, name });
}
```

Hoje existem exatamente dois desses, ambos em `assessments-shared.tsx`:
`PORTFOLIO_HAS_ANSWERED_ITEMS` (remoção precisa de confirmação) e `409` (conflito de versão do
resumo de desenvolvimento).

## Sessão

A política de sessão **não** mora no transporte. Ela é um interceptor explícito
(`src/lib/session-policy.ts`) que o container injeta no `ApiClient`; `auth.tsx` registra o que
fazer via `sessionPolicy.whenSessionEnded`.

O redirect para o login casa **código E status**: `AUTHENTICATION_REQUIRED`, `SESSION_INVALID`
ou `SESSION_REVOKED`, **com 401**. Um 401 de negócio (`INVALID_CURRENT_PASSWORD`) não desloga
ninguém.

> Errar a grafia de um desses três códigos, ou soltar o casamento com o 401, prende a pessoa
> numa sessão morta: erro atrás de erro, sem nunca voltar ao login. Nenhum teste de backend
> denuncia isso. `tests/lib/session-policy.test.ts` cobre os três códigos, os status vizinhos
> e as grafias parecidas — não mexa nos códigos sem rodar esse arquivo.

## Offline, DNS, timeout

Quando o `fetch` rejeita não existe `response`. O cliente normaliza isso num `ApiError` com
`status: 0` e `code: "NETWORK_UNAVAILABLE"`, guardando o erro original em `cause`. Consequência
prática: as telas não precisam de um ramo especial para rede, e o `TypeError: Failed to fetch`
do navegador nunca aparece para quem usa o produto.

Falha de rede **não** encerra a sessão — quem está offline não é quem foi deslogado.
