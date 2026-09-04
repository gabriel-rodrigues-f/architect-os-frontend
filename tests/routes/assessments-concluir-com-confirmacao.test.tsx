import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import {
  emptyEligibilityRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";

/**
 * Revisão de PO (2026-09-02), achado 3 — "'Concluir avaliação' fecha o ciclo
 * de uma pessoa com um clique, sem nenhuma nota do líder... sem confirmação.
 * 'Distância 0 · Adequado' aparece antes de o líder avaliar."
 *
 * O domínio já recusa concluir com nota faltando; o que faltava na tela era
 * (1) confirmação explícita com os dados da própria avaliação, (2) o motivo
 * da pendência dito em texto, com as competências, (3) nenhuma distância
 * calculada sem nota final e (4) um seletor que deixa claro o que foi
 * escolhido para quem lê o DOM.
 */

const fetchMock = vi.fn();
const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

type FixtureAssessment = AppState["assessments"][number];

const inReview = (mutate: (assessment: FixtureAssessment) => FixtureAssessment) =>
  ({
    ...fixtureState,
    assessments: fixtureState.assessments.map((assessment) =>
      assessment.id === "ana-h2" ? mutate({ ...assessment, status: "In Review" }) : assessment,
    ),
  }) satisfies AppState;

const completeInReview = inReview((assessment) => assessment);

const missingLeaderInReview = inReview((assessment) => ({
  ...assessment,
  items: assessment.items.map((item) =>
    item.competencyId === "cloud-serverless" ? { ...item, leader: null, final: null } : item,
  ),
}));

describe("Avaliações — concluir com confirmação", () => {
  const statusCalls: string[] = [];

  beforeEach(() => {
    statusCalls.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function mockLead(state: AppState) {
    const current = state.assessments.find((assessment) => assessment.id === "ana-h2")!;
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state,
      routes: [
        (href, init) => {
          if (init?.method === "PATCH" && href.endsWith(apiPath("/assessments/ana-h2/status"))) {
            const body = JSON.parse(String(init.body)) as { status: string };
            statusCalls.push(body.status);
            return jsonResponse({ ...current, status: body.status });
          }
          return undefined;
        },
        emptyEligibilityRoute,
      ],
    });
  }

  it("'Concluir avaliação' abre um diálogo com os dados da avaliação e só conclui depois de confirmar", async () => {
    mockLead(completeInReview);
    renderWithApp(<AssessmentsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Concluir avaliação" }));

    const dialog = await screen.findByRole("dialog");
    // Nome da pessoa, N competências, em quantas o líder difere da autoavaliação
    // (na fixture: Serverless self=4, leader=3 → uma), e o que a nota final alimenta.
    expect(dialog.textContent).toContain("Ana Martins");
    expect(dialog.textContent).toContain("3 competências");
    expect(dialog.textContent).toMatch(/em 1 .*difere da autoavaliação/i);
    expect(dialog.textContent).toMatch(/nota final/i);
    expect(dialog.textContent).toMatch(/roteiro/i);
    expect(statusCalls).toEqual([]);

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(statusCalls).toEqual([]);
    expect(screen.getByRole("button", { name: "Concluir avaliação" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Concluir avaliação" }));
    const reopened = await screen.findByRole("dialog");
    await userEvent.click(within(reopened).getByRole("button", { name: "Confirmar e concluir" }));

    await waitFor(() => expect(statusCalls).toEqual(["Completed"]));
    expect(await screen.findByRole("button", { name: "Reabrir avaliação" })).toBeTruthy();
  });

  it("com nota faltando, o motivo aparece em texto listando a competência pendente e o diálogo não abre", async () => {
    mockLead(missingLeaderInReview);
    renderWithApp(<AssessmentsPage />);

    const complete = (await screen.findByRole("button", {
      name: "Concluir avaliação",
    })) as HTMLButtonElement;
    expect(complete.disabled).toBe(true);

    const reason = await screen.findByText(/falta .*Serverless/i);
    expect(reason.textContent).not.toContain("Kubernetes");

    await userEvent.click(complete);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(statusCalls).toEqual([]);
  });

  it("sem nota final, a coluna Distância diz que aguarda a nota — nunca 'Distância 0'", async () => {
    mockLead(missingLeaderInReview);
    renderWithApp(<AssessmentsPage />);

    const pendente = (await screen.findByText("Serverless")).closest("tr")!;
    expect(pendente.textContent).toMatch(/aguardando nota final/i);
    expect(pendente.textContent).not.toMatch(/Distância 0/);

    const avaliada = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(avaliada.textContent).toMatch(/Distância 0/);
  });

  it("o seletor de nível marca no DOM o valor escolhido; sem valor, '—' é o marcado", async () => {
    mockLead(missingLeaderInReview);
    renderWithApp(<AssessmentsPage />);

    const escolhido = (await screen.findByLabelText(
      "Nota do Líder — Kubernetes",
    )) as HTMLSelectElement;
    const marcadoEscolhido = escolhido.querySelector<HTMLOptionElement>(
      'option[aria-selected="true"]',
    );
    expect(marcadoEscolhido?.value).toBe("4");
    expect(escolhido.querySelectorAll('option[aria-selected="true"]')).toHaveLength(1);
    expect(escolhido.dataset["chosen"]).toBe("true");

    const vazio = (await screen.findByLabelText("Nota do Líder — Serverless")) as HTMLSelectElement;
    const marcadoVazio = vazio.querySelector<HTMLOptionElement>('option[aria-selected="true"]');
    expect(marcadoVazio?.value).toBe("");
    expect(marcadoVazio?.textContent?.trim()).toBe("—");
    expect(vazio.dataset["chosen"]).toBe("false");
  });
});
