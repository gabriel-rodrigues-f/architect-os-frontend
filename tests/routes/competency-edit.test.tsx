import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { type AppState } from "@/lib/api";
import { fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  mockAppFetch,
  renderWithApp,
  writeRefetchesState,
} from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * O lápis ao lado da lixeira: editar o NOME sem sair da Matriz de
 * Competências. Pós-Fase 2 (backend ADR-0032) o diálogo perdeu os níveis por
 * cargo e a obrigatoriedade — moram na régua do time, e o backend responde
 * 400 a campo extra no PATCH do catálogo.
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
        ...writeRefetchesState(
          (_href, init) =>
            init?.method === "PATCH" ? new Response(null, { status: 204 }) : undefined,
          {
            ...state,
            competencies: state.competencies.map((competency) =>
              competency.id === "cloud-k8s"
                ? { ...competency, name: "Kubernetes e Orquestração de Containers" }
                : competency,
            ),
          },
        ),
        careerLevelsRoute,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("abre com o nome preenchido — e SEM os controles de nível/obrigatoriedade (agora na régua do time)", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));

    expect(await screen.findByDisplayValue("Kubernetes")).toBeTruthy();
    expect(screen.queryByLabelText(/Nível esperado por cargo/)).toBeNull();
    expect(screen.queryByRole("option", { name: "Restritiva" })).toBeNull();
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

  it("o PATCH leva SÓ o nome — nunca expected/requirementType (o backend recusaria com 400)", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));
    await screen.findByLabelText("Nome");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeDefined();
      const body = JSON.parse(String(patchCall?.[1]?.body)) as Record<string, unknown>;
      expect(body).toEqual({ name: "Kubernetes" });
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
