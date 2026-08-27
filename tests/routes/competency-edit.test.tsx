import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { type AppState } from "@/lib/api";
import { fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * O lápis ao lado da lixeira: editar nome e nível esperado por cargo sem sair
 * da Matriz de Competências, em vez de precisar excluir e recriar.
 */

const fetchMock = vi.fn();

const state: AppState = { ...fixtureState, competencies: fixtureState.competencies };

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

/** REVISAO-360-FRONTEND, Seção 40-42 — a matriz agora nasce recolhida; "Expandir tudo" reproduz o antigo padrão sempre-aberto que este teste pressupõe. */
const renderMatrix = async () => {
  renderWithApp(<MatrixPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Expandir tudo" }));
};

describe("Matriz de Competências — edição", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      state,
      routes: [
        (_href, init) =>
          init?.method === "PATCH" ? new Response(null, { status: 204 }) : undefined,
        careerLevelsRoute,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("abre com o nome e os níveis atuais preenchidos", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));

    expect(await screen.findByDisplayValue("Kubernetes")).toBeTruthy();
    expect(screen.getByLabelText(/Nível esperado por cargo — Nível I$/)).toHaveProperty(
      "value",
      "3",
    );
    expect(screen.getByLabelText(/Nível esperado por cargo — Nível III/)).toHaveProperty(
      "value",
      "5",
    );
  });

  it("salvar renomeia a competência na tela e envia PATCH", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));
    const nome = await screen.findByLabelText("Nome");
    await userEvent.clear(nome);
    await userEvent.type(nome, "Kubernetes e Orquestração de Containers");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByText("Kubernetes e Orquestração de Containers")).toBeTruthy(),
    );
    expect(screen.queryByText("Kubernetes")).toBeNull();

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(String(patchCall?.[0])).toContain(apiPath("/competencies/cloud-k8s"));
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      name: "Kubernetes e Orquestração de Containers",
    });
  });

  it("mudar o nível de um cargo não altera os outros dois", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));
    await userEvent.selectOptions(
      screen.getByLabelText(/Nível esperado por cargo — Nível I$/),
      "1",
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeDefined();
      const body = JSON.parse(String(patchCall?.[1]?.body)) as {
        expected?: Record<string, number>;
      };
      expect(body.expected?.["arquiteto-de-solucoes-i"]).toBe(1);
      expect(body.expected?.["arquiteto-de-solucoes-ii"]).toBe(4);
      expect(body.expected?.["arquiteto-de-solucoes-iii"]).toBe(5);
    });
  });

  it("cancelar não envia nada e preserva o nome original", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));
    const nome = await screen.findByLabelText("Nome");
    await userEvent.clear(nome);
    await userEvent.type(nome, "Nome que não deve ser salvo");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Kubernetes")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });
});
