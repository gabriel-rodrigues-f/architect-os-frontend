import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as LearningRoute } from "@/routes/learning-paths";
import { type AppState } from "../api";
import { fixtureState } from "./fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "./render-app";

/**
 * R2-UX-12 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — "Nova trilha" troca o
 * input solto no cabeçalho + "Criar trilha" em 2 tempos (nome sozinho,
 * depois reabrir "Editar" pra completar) por um único botão que abre um
 * modal já com nome, descrição, competências e atribuições.
 */

const fetchMock = vi.fn();

const state: AppState = { ...fixtureState, learningPaths: [] };

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const LearningPage = LearningRoute.options.component as () => ReactNode;

describe("Trilhas — criação via modal (mata os 2 tempos)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      state,
      routes: [
        (href, init) => {
          if (href.endsWith("/api/learning-paths") && init?.method === "POST") {
            const body = JSON.parse(String(init.body));
            return jsonResponse({ ...body, id: "lp-nova" }, 201);
          }
          return undefined;
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("botão 'Nova trilha' abre modal com nome, descrição, competências e atribuições", async () => {
    renderWithApp(<LearningPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova trilha" }));

    expect(screen.getByRole("heading", { name: "Nova trilha" })).toBeTruthy();
    expect(screen.getByLabelText("Nome")).toBeTruthy();
    expect(screen.getByLabelText("Descrição")).toBeTruthy();
    expect(screen.getByText("Competências")).toBeTruthy();
    expect(screen.getByText("Atribuída a")).toBeTruthy();
  });

  it("criar com nome, descrição e competência marcada envia tudo num POST só", async () => {
    renderWithApp(<LearningPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova trilha" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Trilha de Observabilidade");
    await userEvent.type(screen.getByLabelText("Descrição"), "Métricas, logs e tracing.");
    const primeiraCompetencia = fixtureState.competencies[0];
    await userEvent.click(screen.getByText(primeiraCompetencia!.name));
    await userEvent.click(screen.getByRole("button", { name: "Criar trilha" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/api/learning-paths") && (init as RequestInit)?.method === "POST",
        ),
      ).toBe(true),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/learning-paths") && (init as RequestInit)?.method === "POST",
    ) as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toMatchObject({
      name: "Trilha de Observabilidade",
      description: "Métricas, logs e tracing.",
      competencyIds: [primeiraCompetencia!.id],
      items: [],
    });

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Nova trilha" })).toBeNull());
  });
});
