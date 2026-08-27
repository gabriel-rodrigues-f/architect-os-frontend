import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as PlansRoute } from "@/routes/development-plans";
import type { AppState } from "@/lib/api";
import { fixtureState } from "../helpers/fixtures";
import { type FetchRoute, jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * F3/Grupo 1 — perda de digitação no plano de ação do PDI.
 *
 * `ActionPlanField` sincronizava o rascunho local com a prop do servidor por
 * efeito (`useEffect(() => setDraft(value), [value])`). Qualquer `actionPlan`
 * novo vindo do servidor sobrescrevia — em silêncio — o texto que a pessoa
 * estava digitando naquele instante.
 *
 * O caminho reproduzido é o do próprio app (ver `store-remote-error.test.tsx`):
 * gravação otimista que o servidor recusa → `MutationRunner.optimistic` chama
 * `cache.invalidate()` → revalidação de `/api/state` → a prop volta ao valor
 * confirmado pelo servidor. A `version` do item **não** avança: nada superou a
 * edição em andamento, logo ela tem de sobreviver — inclusive para a pessoa
 * poder tentar salvar de novo.
 *
 * A perda é uma corrida, então o teste precisa de latência de verdade: o PATCH
 * fica represado até o teste soltar, senão a resposta chega antes de a escrita
 * otimista virar render e não há corrida nenhuma para observar.
 *
 * O padrão correto já existe na casa (`DevelopmentSummarySection`, em
 * `assessments-shared.tsx`): remontar o formulário por `key={data.version}`
 * quando o servidor devolve versão nova, em vez de sincronizar por efeito.
 */

const fetchMock = vi.fn();

const PlansPage = PlansRoute.options.component as () => ReactNode;

const PLANO_ANA = fixtureState.plans[0]!;
const ITEM_IAM = PLANO_ANA.items[0]!;
const ACTION_PLAN_PLACEHOLDER = /descreva as atividades práticas/;

/**
 * Marcador de sincronismo: a revalidação traz o objetivo do **outro** item do
 * plano reescrito. Quando esse texto aparece, o estado novo do servidor já foi
 * renderizado — e o marcador não depende do comportamento sob teste, porque o
 * objetivo é renderizado direto da prop, sem rascunho local nenhum.
 */
const OBJETIVO_REVISADO = "Evoluir Kubernetes (revisado pelo Tech Lead)";

function estadoRevalidado(): AppState {
  return {
    ...fixtureState,
    plans: fixtureState.plans.map((plan) => ({
      ...plan,
      items: plan.items.map((item) =>
        item.id === "pdi-ana-1" ? { ...item, objective: OBJETIVO_REVISADO } : item,
      ),
    })),
  };
}

function statePorChamada(...respostas: AppState[]): FetchRoute {
  let chamadas = 0;
  return (href) => {
    if (!href.endsWith("/api/state")) return undefined;
    const resposta = respostas[Math.min(chamadas, respostas.length - 1)]!;
    chamadas += 1;
    return jsonResponse(resposta);
  };
}

/** Instala o mock e devolve o gatilho que solta a resposta do PATCH represado. */
function mockComPatchRepresado(mensagem: string): () => void {
  let soltar = () => {};
  const patchRespondido = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  mockAppFetch(fetchMock, {
    routes: [
      (href, init) =>
        init?.method === "PATCH" && href.includes("/api/plans/pdi-ana/items/")
          ? jsonResponse({ error: "Conflict", message: mensagem }, 409)
          : undefined,
      statePorChamada(fixtureState, estadoRevalidado()),
    ],
  });
  const semLatencia = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const resposta = (await semLatencia(url, init)) as Response;
    if (init?.method === "PATCH") await patchRespondido;
    return resposta;
  });
  return soltar;
}

/** O cartão do item "Evoluir IAM" — a tela lista os dois itens do plano da Ana. */
function cartaoDoItemIam(): HTMLElement {
  const cartao = screen.getByText(ITEM_IAM.objective).closest("div.surface-card");
  if (!cartao) throw new Error(`Cartão do item ${ITEM_IAM.objective} não encontrado`);
  return cartao as HTMLElement;
}

function actionPlanField(): HTMLTextAreaElement {
  return within(cartaoDoItemIam()).getByPlaceholderText(
    ACTION_PLAN_PLACEHOLDER,
  ) as HTMLTextAreaElement;
}

function patchesDoItem(): unknown[] {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      (init as RequestInit | undefined)?.method === "PATCH" &&
      String(url).includes("/api/plans/pdi-ana/items/"),
  );
}

describe("PDI — plano de ação não perde o que está sendo digitado", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "?architectId=ana");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("mantém o texto em digitação quando a revalidação devolve o valor anterior sem avançar a versão", async () => {
    const soltarPatch = mockComPatchRepresado("Não foi possível salvar agora.");

    renderWithApp(<PlansPage />);
    await screen.findByText("Evoluir IAM");
    expect(actionPlanField().value).toBe(ITEM_IAM.actionPlan);

    // 1. Escreve e sai do campo: grava otimista (o cache já sobe para este
    //    valor) e sobe o PATCH, que fica represado.
    fireEvent.change(actionPlanField(), { target: { value: `${ITEM_IAM.actionPlan} + prova` } });
    fireEvent.blur(actionPlanField());
    await waitFor(() => expect(patchesDoItem()).toHaveLength(1));

    // 2. Volta ao campo e continua escrevendo, sem sair — nada commitado ainda.
    const emDigitacao = `${ITEM_IAM.actionPlan} + prova de certificação`;
    fireEvent.change(actionPlanField(), { target: { value: emDigitacao } });

    // 3. O servidor recusa: o runner revalida e a tela renderiza o estado
    //    confirmado (item 0 volta ao `actionPlan` original, `version` intacta).
    soltarPatch();
    await screen.findByText(OBJETIVO_REVISADO);

    // 4. O que estava sendo digitado sobrevive.
    expect(actionPlanField().value).toBe(emDigitacao);
  });

  it("recarrega o campo com o valor do servidor quando a versão do item avança", async () => {
    const planoDoServidor = "Plano reescrito pelo Tech Lead";
    mockAppFetch(fetchMock, {
      routes: [
        (href, init) =>
          init?.method === "PATCH" && href.includes("/api/plans/pdi-ana/items/")
            ? jsonResponse({ error: "Conflict", message: "Item alterado por outra pessoa." }, 409)
            : undefined,
        statePorChamada(fixtureState, {
          ...fixtureState,
          plans: fixtureState.plans.map((plan) => ({
            ...plan,
            items: plan.items.map((item) =>
              item.id === ITEM_IAM.id
                ? { ...item, actionPlan: planoDoServidor, version: item.version + 1 }
                : item,
            ),
          })),
        }),
      ],
    });

    renderWithApp(<PlansPage />);
    await screen.findByText("Evoluir IAM");

    fireEvent.change(actionPlanField(), { target: { value: `${ITEM_IAM.actionPlan} + prova` } });
    fireEvent.blur(actionPlanField());

    await waitFor(() => expect(actionPlanField().value).toBe(planoDoServidor));
  });
});
