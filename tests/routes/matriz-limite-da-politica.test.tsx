import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { type AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import type { Capability, Competency } from "@/lib/domain";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
  contextsOf,
} from "../helpers/render-app";

/**
 * Onda 36 (itens 2, 3 e 5 do dono) — a Matriz depois do fim da regra do 6 e
 * da obrigatoriedade:
 *
 *  - o contador da capacidade diz "N/{max} · mín. {min}" com os dois números
 *    vindos da régua (teto da política, piso do modelo), nunca um literal;
 *  - "Pronta" é min..max: capacidade abaixo do piso requer curadoria e o
 *    controle explica que falta cadastrar, não que "0 passou do teto";
 *  - competência arquivada só tem "Restaurar" — e quando o serviço recusa a
 *    reativação (5ª ativa), a tela mostra a mensagem DO serviço.
 */

const fetchMock = vi.fn();
const MatrixPage = MatrixRoute.options.component as () => ReactNode;

/** Política de curadoria com máximo 3 — para provar que nada usa literal 4. */
const curationPolicyMax3: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/curation-policy")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({ maxActiveCompetencies: 3 })
    : undefined;

const emptyCapability: Capability = {
  id: "vazia",
  name: "Data Platforms",
  short: "Data",
  active: true,
  curation: { activeCompetencyCount: 0, status: "REQUIRES_CURATION" },
};

const archivedCompetency: Competency = {
  id: "arquivada-1",
  name: "Chaos Engineering",
  capabilityId: "cloud",
  active: false,
};

const state: AppState = {
  ...fixtureState,
  capabilities: [...fixtureState.capabilities, emptyCapability],
  competencies: [...fixtureState.competencies, archivedCompetency],
};

const cardOf = (name: string) => {
  const card = screen.getByText(name).closest(".surface-card");
  if (!card) throw new Error(`card de ${name} não encontrado`);
  return within(card as HTMLElement);
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Matriz — o teto vem da política, e 4 é máximo, não meta", () => {
  it("o contador da capacidade mostra 'N/{max} · mín. {min}' com os dois vindos da régua", async () => {
    mockAppFetch(fetchMock, { state, routes: [careerLevelsRoute, curationPolicyMax3] });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    expect(cardOf("Cloud Architecture").getByText("2/3 · mín. 3")).toBeTruthy();
    expect(screen.queryByText(/\/6/)).toBeNull();
  });

  it("capacidade com 0 ativas requer curadoria e o controle explica que falta cadastrar", async () => {
    mockAppFetch(fetchMock, { state, routes: [careerLevelsRoute, curationPolicyMax3] });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Data Platforms");

    await userEvent.click(
      cardOf("Data Platforms").getByRole("button", { name: /Requer curadoria/ }),
    );

    const explanation = await screen.findByRole("dialog");
    expect(explanation.textContent).toContain("0 de 3 competências ativas");
    expect(explanation.textContent).toMatch(/cadastre/i);
    expect(explanation.textContent).not.toContain("acima do teto");
  });

  it("capacidade acima do máximo explica quantas passaram e como voltar a 'Pronta'", async () => {
    const over: Capability = {
      id: "over",
      name: "Over Capability",
      short: "Over",
      active: true,
      curation: { activeCompetencyCount: 5, status: "REQUIRES_CURATION" },
    };
    mockAppFetch(fetchMock, {
      state: { ...state, capabilities: [...state.capabilities, over] },
      routes: [careerLevelsRoute, curationPolicyMax3],
    });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Over Capability");

    await userEvent.click(
      cardOf("Over Capability").getByRole("button", { name: /Requer curadoria/ }),
    );

    const explanation = await screen.findByRole("dialog");
    expect(explanation.textContent).toContain("5 de 3 competências ativas");
    expect(explanation.textContent).toContain("2 acima do máximo");
  });
});

describe("Matriz — o contador cai depois de desvincular (item 2 do dono)", () => {
  it("excluir uma competência refaz a leitura do estado e o contador desce", async () => {
    let removed = false;
    const removalRoutes: FetchRoute[] = [
      (href, init) =>
        href.endsWith(apiPath("/competencies/cloud-k8s")) && init?.method === "DELETE"
          ? ((removed = true), jsonResponse({ archived: false }))
          : undefined,
      (href, init) =>
        removed
          ? contextsOf({
              ...state,
              capabilities: state.capabilities.map((capability) =>
                capability.id === "cloud"
                  ? {
                      ...capability,
                      curation: { activeCompetencyCount: 1, status: "READY" as const },
                    }
                  : capability,
              ),
              competencies: state.competencies.filter(
                (competency) => competency.id !== "cloud-k8s",
              ),
            })(href, init)
          : undefined,
    ];
    mockAppFetch(fetchMock, {
      state,
      routes: [...removalRoutes, careerLevelsRoute, curationPolicyMax3],
    });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");
    expect(cardOf("Cloud Architecture").getByText("2/3 · mín. 3")).toBeTruthy();

    await userEvent.click(screen.getByLabelText("Expandir Cloud Architecture"));
    await userEvent.click(await screen.findByLabelText("Excluir Kubernetes"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    expect(await cardOf("Cloud Architecture").findByText("1/3 · mín. 3")).toBeTruthy();
  });
});

describe("Matriz — arquivada só se restaura, e a recusa do serviço aparece", () => {
  it("a seção de arquivadas não oferece exclusão definitiva", async () => {
    mockAppFetch(fetchMock, { state, routes: [careerLevelsRoute, curationPolicyMax3] });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Arquivadas");

    const archived = screen.getByText("Chaos Engineering").closest("li") as HTMLElement;
    const actions = within(archived).getAllByRole("button");
    expect(actions.map((button) => button.textContent)).toEqual(["Restaurar"]);
  });

  it("restaurar recusado pelo serviço (limite de ativas) mostra a mensagem do serviço", async () => {
    const refusal =
      'A capacidade "Cloud Architecture" já está no limite de 3 competências ativas — arquive uma competência antes de ativar outra.';
    const refuseRestore: FetchRoute = (href, init) =>
      href.endsWith(apiPath("/competencies/arquivada-1")) && init?.method === "PATCH"
        ? jsonResponse(
            { code: "CAPABILITY_COMPETENCY_LIMIT_REACHED", message: refusal, correlationId: "x" },
            409,
          )
        : undefined;
    mockAppFetch(fetchMock, {
      state,
      routes: [refuseRestore, careerLevelsRoute, curationPolicyMax3],
    });
    renderWithApp(
      <>
        <MatrixPage />
        <Toaster theme="light" position="bottom-right" duration={3000} />
      </>,
    );
    await screen.findByText("Arquivadas");

    const archived = screen.getByText("Chaos Engineering").closest("li") as HTMLElement;
    await userEvent.click(within(archived).getByRole("button", { name: "Restaurar" }));

    expect(await screen.findByText(refusal)).toBeTruthy();
  });
});
