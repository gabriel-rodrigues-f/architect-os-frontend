import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: toastError, dismiss: vi.fn() },
  Toaster: () => null,
}));

import { Route as PlansRoute } from "@/routes/development-plans";
import { apiPath } from "@/lib/api-path";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * A RÉGUA DA CASA, aplicada ao plano de ação do PDI.
 *
 * Ela já estava escrita neste mesmo módulo, no `removeItem` do view-model:
 * *"Otimista: `onConfirmed` roda quando o serviço confirma — o aviso de
 * sucesso vai lá, não no clique."* O `ActionPlanField` desobedecia: o
 * `commit()` fazia `onSave(draft); setSaved(true)` em sequência e
 * `saveActionPlan` devolvia `void` — dispara e esquece. Com o PATCH recusado,
 * a tela acendia "Salvo" do mesmo jeito.
 *
 * Isso é pior que silêncio: o dono pediu retorno tátil ao salvar (2026-09-09,
 * na seção Começar/Parar/Continuar da Avaliação), e um retorno tátil
 * mentiroso ensina a pessoa a confiar num rótulo que não vale nada.
 *
 * O irmão honesto deste campo é a `DevelopmentSummarySection`
 * (`assessments-shared.tsx`): o rótulo "Salvo" só acende dentro do
 * `result.ok`. Aqui a confirmação chega pelo mesmo seio que o `removeItem` já
 * usava — o `onConfirmed` do `MutationRunner`, cujo contrato
 * (`tests/lib/mutation-runner.test.ts`) já garante que ele não roda na recusa.
 */

const fetchMock = vi.fn();

const PlansPage = PlansRoute.options.component as () => ReactNode;

const PLANO_ANA = fixtureState.plans[0]!;
const ITEM_IAM = PLANO_ANA.items[0]!;
const ACTION_PLAN_PLACEHOLDER = /descreva as atividades práticas/;
const SALVO = "Salvo";

const ROTA_DO_ITEM = apiPath("/plans/pdi-ana/items/");

const ehPatchDoItem = (href: string, init?: RequestInit) =>
  init?.method === "PATCH" && href.includes(ROTA_DO_ITEM);

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

function selo(): HTMLElement | null {
  return within(cartaoDoItemIam()).queryByText(SALVO);
}

function patchesDoItem(): unknown[] {
  return fetchMock.mock.calls.filter(([url, init]) =>
    ehPatchDoItem(String(url), init as RequestInit | undefined),
  );
}

/** Escreve no campo e sai dele — é o gesto que dispara o `commit()`. */
function escreveEsai(texto: string): void {
  fireEvent.change(actionPlanField(), { target: { value: texto } });
  fireEvent.blur(actionPlanField());
}

const patchRecusado: FetchRoute = (href, init) =>
  ehPatchDoItem(href, init)
    ? jsonResponse({ error: "Conflict", message: "Item alterado por outra pessoa." }, 409)
    : undefined;

/**
 * Instala o mock com o PATCH REPRESADO — a resposta só chega quando o teste
 * soltar. Mesma técnica de `pdi-action-plan-draft.test.tsx`: sem latência de
 * verdade não há janela nenhuma entre o gesto e a confirmação para observar.
 */
function mockComPatchRepresado(): () => void {
  let soltar = () => {};
  const respondido = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  mockAppFetch(fetchMock, {
    routes: [(href, init) => (ehPatchDoItem(href, init) ? jsonResponse(PLANO_ANA) : undefined)],
  });
  const semLatencia = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const resposta = (await semLatencia(url, init)) as Response;
    if (ehPatchDoItem(String(url), init)) await respondido;
    return resposta;
  });
  return () => soltar();
}

describe("PDI — o plano de ação só diz 'Salvo' quando o serviço confirma", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    toastError.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "?professionalId=ana");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("não acende o selo quando o serviço recusa o PATCH — e a recusa aparece", async () => {
    mockAppFetch(fetchMock, { routes: [patchRecusado] });

    renderWithApp(<PlansPage />);
    await screen.findByText(ITEM_IAM.objective);
    escreveEsai(`${ITEM_IAM.actionPlan} + prova`);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(selo()).toBeNull();
  });

  it("segura o selo até a resposta chegar — não acende no gesto", async () => {
    const soltar = mockComPatchRepresado();

    renderWithApp(<PlansPage />);
    await screen.findByText(ITEM_IAM.objective);
    escreveEsai(`${ITEM_IAM.actionPlan} + prova`);

    // O PATCH já subiu; a resposta ainda não chegou. Nada foi confirmado.
    await waitFor(() => expect(patchesDoItem()).toHaveLength(1));
    expect(selo()).toBeNull();

    soltar();
    await waitFor(() => expect(selo()).not.toBeNull());
    expect(toastError).not.toHaveBeenCalled();
  });
});
