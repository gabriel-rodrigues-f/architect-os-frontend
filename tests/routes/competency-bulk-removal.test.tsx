import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { InMemoryCompetencyRemoval, type AffectedRecords } from "@/lib/gateways/catalog.gateway";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Onda 35, achado 16 do dono, literal: botão "Selecionar competências" ao
 * lado de "Recolher tudo" para excluir em massa; "isso deve afetar tudo e
 * todos vinculados a essas competências".
 *
 * A tela: liga caixas por competência (e por capacidade inteira), mostra
 * "Excluir selecionadas (N)", confirma dizendo o que será afetado, chama
 * `POST /competencies/bulk-removal` e mostra o resultado por competência
 * (excluída / arquivada) antes de atualizar a matriz.
 */

const fetchMock = vi.fn();

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const nothing: AffectedRecords = {
  assessments: 0,
  planItems: 0,
  evidences: 0,
  learningItems: 0,
  teamRuleRequirements: 0,
};

const renderMatrix = async () => {
  renderWithApp(
    <>
      <MatrixPage />
      <Toaster theme="light" position="bottom-right" duration={3000} />
    </>,
  );
  await screen.findByText("Cloud Architecture");
};

const enterSelection = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Selecionar competências" }));
};

describe("Matriz de Competências — selecionar e excluir em massa", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("'Selecionar competências' fica à direita de 'Recolher tudo' e só o admin o vê", async () => {
    await renderMatrix();

    const collapseAll = screen.getByRole("button", { name: "Recolher tudo" });
    const select = screen.getByRole("button", { name: "Selecionar competências" });
    expect(collapseAll.parentElement).toBe(select.parentElement);
    expect(collapseAll.nextElementSibling).toBe(select);
  });

  it("o não-admin não vê o botão", async () => {
    mockAppFetch(fetchMock, { user: fixtureMemberUser, routes: [careerLevelsRoute] });
    await renderMatrix();
    expect(screen.queryByRole("button", { name: "Selecionar competências" })).toBeNull();
  });

  it("ligar a seleção mostra caixas por competência e por capacidade, e a barra conta o que está marcado", async () => {
    await renderMatrix();
    expect(screen.queryByLabelText("Selecionar Kubernetes")).toBeNull();

    await enterSelection();

    const removeSelected = await screen.findByRole("button", {
      name: "Excluir selecionadas (0)",
    });
    expect(removeSelected).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByLabelText("Selecionar Kubernetes"));
    await userEvent.click(screen.getByLabelText("Selecionar IAM"));
    expect(screen.getByRole("button", { name: "Excluir selecionadas (2)" })).toHaveProperty(
      "disabled",
      false,
    );

    await userEvent.click(
      screen.getByLabelText("Selecionar todas as competências de Cloud Architecture"),
    );
    expect(screen.getByRole("button", { name: "Excluir selecionadas (3)" })).toBeTruthy();
    expect(screen.getByLabelText("Selecionar Serverless").getAttribute("data-state")).toBe(
      "checked",
    );

    await userEvent.click(
      screen.getByLabelText("Selecionar todas as competências de Cloud Architecture"),
    );
    expect(screen.getByRole("button", { name: "Excluir selecionadas (1)" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar seleção" }));
    expect(screen.queryByLabelText("Selecionar Kubernetes")).toBeNull();
  });

  it("confirmar diz o que será afetado, chama a remoção com os ids marcados, mostra o resultado por competência e atualiza a matriz", async () => {
    const gateway = new InMemoryCompetencyRemoval(
      fixtureState.competencies,
      new Map([["security-iam", { ...nothing, assessments: 2, teamRuleRequirements: 1 }]]),
    );
    vi.spyOn(api, "removeCompetencies").mockImplementation(gateway.removeCompetencies);
    // Onda 36: a remoção invalida a query de /state — o refetch serve o estado
    // pós-remoção, como o servidor faria (contagens de curadoria recalculadas).
    const stateAfterRemoval: FetchRoute = (href, init) =>
      gateway.removalsMade.length > 0 &&
      href.endsWith(apiPath("/state")) &&
      (init?.method ?? "GET") === "GET"
        ? jsonResponse({
            ...fixtureState,
            competencies: fixtureState.competencies
              .filter((competency) => competency.id !== "cloud-k8s")
              .map((competency) =>
                competency.id === "security-iam" ? { ...competency, active: false } : competency,
              ),
          })
        : undefined;
    mockAppFetch(fetchMock, { routes: [stateAfterRemoval, careerLevelsRoute] });

    await renderMatrix();
    await enterSelection();
    await userEvent.click(screen.getByLabelText("Selecionar Kubernetes"));
    await userEvent.click(screen.getByLabelText("Selecionar IAM"));
    await userEvent.click(screen.getByRole("button", { name: "Excluir selecionadas (2)" }));

    const confirmation = await screen.findByRole("dialog");
    expect(confirmation.textContent).toContain("Excluir 2 competências selecionadas?");
    expect(confirmation.textContent).toContain("Kubernetes");
    expect(confirmation.textContent).toContain("IAM");
    expect(confirmation.textContent).toMatch(
      /avaliações, itens de PDI, evidências, itens de trilha e exigências de régua/,
    );
    expect(gateway.removalsMade).toEqual([]);

    await userEvent.click(within(confirmation).getByRole("button", { name: "Excluir" }));

    const result = await screen.findByRole("dialog");
    expect(await within(result).findByText("Resultado da exclusão")).toBeTruthy();
    expect(within(result).getByText("Kubernetes").parentElement?.textContent).toContain("excluída");
    const iam = within(result).getByText("IAM").parentElement?.textContent ?? "";
    expect(iam).toContain("arquivada");
    expect(iam).toContain("2 avaliações");
    expect(iam).toContain("1 exigência de régua");
    expect(gateway.removalsMade).toEqual([["cloud-k8s", "security-iam"]]);

    await userEvent.click(within(result).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "Expandir tudo" }));
    expect(screen.queryByText("Kubernetes")).toBeNull();
    expect(screen.getByText("Serverless")).toBeTruthy();
    const archived = within(screen.getByText("Arquivadas").closest("section") as HTMLElement);
    expect(archived.getByText("IAM")).toBeTruthy();
    expect(screen.queryByLabelText("Selecionar Serverless")).toBeNull();
  });

  it("a recusa do serviço aparece com a mensagem dele e nada some da matriz", async () => {
    const recusa: FetchRoute = (href, init) =>
      href.endsWith(apiPath("/competencies/bulk-removal")) && init?.method === "POST"
        ? jsonResponse(
            {
              code: "VALIDATION_ERROR",
              message: "A remoção em massa aceita até 200 competências.",
            },
            400,
          )
        : undefined;
    mockAppFetch(fetchMock, { routes: [recusa, careerLevelsRoute] });

    await renderMatrix();
    await enterSelection();
    await userEvent.click(screen.getByLabelText("Selecionar Kubernetes"));
    await userEvent.click(screen.getByRole("button", { name: "Excluir selecionadas (1)" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Excluir" }),
    );

    expect(
      (await screen.findAllByText("A remoção em massa aceita até 200 competências.")).length,
    ).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Expandir tudo" }));
    expect(screen.getByText("Kubernetes")).toBeTruthy();
  });

  it("pelo container de produção: POST /competencies/bulk-removal com { competencyIds } e o resultado do serviço na tela", async () => {
    const removal: FetchRoute = (href, init) => {
      if (!href.endsWith(apiPath("/competencies/bulk-removal")) || init?.method !== "POST")
        return undefined;
      const body = JSON.parse(String(init.body)) as { competencyIds: string[] };
      return jsonResponse({
        data: {
          outcomes: body.competencyIds.map((competencyId) => ({
            competencyId,
            outcome: "removed",
            affected: nothing,
          })),
        },
        message: { code: "catalog.competency.bulkRemoval.success" },
      });
    };
    mockAppFetch(fetchMock, { routes: [removal, careerLevelsRoute] });

    await renderMatrix();
    await enterSelection();
    await userEvent.click(
      screen.getByLabelText("Selecionar todas as competências de Cloud Architecture"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Excluir selecionadas (2)" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Excluir" }),
    );

    const result = await screen.findByRole("dialog");
    await within(result).findByText("Resultado da exclusão");
    const call = fetchMock.mock.calls.find(
      ([href, init]) =>
        String(href).endsWith(apiPath("/competencies/bulk-removal")) && init?.method === "POST",
    );
    expect(call).toBeDefined();
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
      competencyIds: ["cloud-k8s", "cloud-serverless"],
    });
    expect(within(result).getAllByText(/excluída/).length).toBe(2);
  });
});
