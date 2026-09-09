import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: vi.fn(), dismiss: vi.fn() },
  Toaster: () => null,
}));

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import type { AssessmentDevelopmentSummary } from "@/lib/domain";
import { fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { emptyEligibilityRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono, 2026-09-09: *"não há retorno tátil após salvar. Após clicar no botão
 * de salvamento quero ver uma mensagem de 'Salvo com sucesso'."*
 *
 * O aviso é o da casa — `notifySuccess` com o `messageCode` que o servidor
 * publica —, não um texto solto. O backend já emite
 * `assessment.developmentSummary.update.success` neste PUT, e as duas línguas
 * já traduzem a chave `msg.` correspondente: o que faltava era o formulário
 * consumir o que já chegava na resposta.
 *
 * O rótulo "Salvo" ao lado do botão FICA — ele é o estado do formulário, e é
 * o que responde a quem lê com leitor de tela pelo `role="status"`. O aviso é
 * o retorno que o dono pediu, e vem do servidor.
 */

const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const draftState: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((avaliacao) =>
    avaliacao.id === "ana-h2" ? { ...avaliacao, status: "Draft" } : avaliacao,
  ),
};

function baseSummary(
  overrides: Partial<AssessmentDevelopmentSummary> = {},
): AssessmentDevelopmentSummary {
  return {
    assessmentId: "ana-h2",
    startDoing: "",
    stopDoing: "",
    continueDoing: "",
    updatedByUserId: null,
    updatedAt: null,
    version: 0,
    ...overrides,
  };
}

/** O envelope de sucesso do serviço: `{ data, message: { code } }`. */
function summaryResponse(summary: AssessmentDevelopmentSummary, code?: string): Response {
  return new Response(
    JSON.stringify(code === undefined ? summary : { data: summary, message: { code } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function mockSession(onPut: () => Response) {
  mockAppFetch(fetchMock, {
    user: fixtureAssignedTechLeadUser,
    state: draftState,
    routes: [
      (href, init) => {
        const method = init?.method ?? "GET";
        if (href.endsWith("/development-summary") && method === "GET") {
          return summaryResponse(baseSummary());
        }
        if (href.endsWith("/development-summary") && method === "PUT") return onPut();
        return undefined;
      },
      emptyEligibilityRoute,
    ],
  });
}

async function typeAndSave(): Promise<void> {
  const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
  await userEvent.type(start, "Documentar decisões arquiteturais");
  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

describe("Começar / Parar / Continuar — o salvar dá retorno", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    toastSuccess.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("salvar mostra o aviso de sucesso com a frase do código que o servidor publica", async () => {
    mockSession(() =>
      summaryResponse(
        baseSummary({ startDoing: "Documentar decisões arquiteturais", version: 1 }),
        "assessment.developmentSummary.update.success",
      ),
    );
    renderWithApp(<AssessmentsPage />);

    await typeAndSave();

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Resumo de desenvolvimento atualizado."),
    );
  });

  it("o rótulo 'Salvo' ao lado do botão continua ali — o aviso não o substitui", async () => {
    mockSession(() =>
      summaryResponse(
        baseSummary({ startDoing: "Documentar decisões arquiteturais", version: 1 }),
        "assessment.developmentSummary.update.success",
      ),
    );
    renderWithApp(<AssessmentsPage />);

    await typeAndSave();

    await waitFor(() => expect(screen.getByText("Salvo")).toBeTruthy());
  });

  it("erro no salvar não avisa sucesso", async () => {
    mockSession(
      () =>
        new Response(JSON.stringify({ error: "boom", message: "Falhou." }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );
    renderWithApp(<AssessmentsPage />);

    await typeAndSave();

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
