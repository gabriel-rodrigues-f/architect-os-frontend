import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as LearningRoute } from "@/routes/learning-paths";
import { type AppState } from "@/lib/api";
import { fixtureMemberUser, fixtureState, scopedFixtureStateFor } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 10, T8 — o payload recortado (backend `d1edba4`) mantém a trilha
 * inteira quando UM dos atribuídos é visível: `assignedTo`/`progress` seguem
 * carregando ids fora do escopo, mas o `Architect` correspondente não vem.
 * A tela mostrava o id cru ("brn-7f3a…") como se fosse nome. O rótulo
 * decidido é `path.assignee.outOfScope`, via i18n — nunca o id.
 */
const fetchMock = vi.fn();

const stateComTrilhaCompartilhada: AppState = {
  ...fixtureState,
  learningPaths: [
    {
      id: "lp-dupla",
      name: "Trilha com duas pessoas",
      description: "",
      competencyIds: [],
      assignedTo: ["ana", "bruno"],
      items: [{ id: "item-1", title: "Curso X", type: "Curso", hours: 4 }],
      progress: [
        { architectId: "ana", itemId: "item-1", status: "In Progress", progress: 40 },
        { architectId: "bruno", itemId: "item-1", status: "Not Started", progress: 0 },
      ],
      createdBy: null,
    },
  ],
};

const LearningPage = LearningRoute.options.component as () => ReactNode;

describe("Trilhas — atribuído fora do escopo nunca aparece como id cru", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: scopedFixtureStateFor(fixtureMemberUser, stateComTrilhaCompartilhada),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("chip e linha de progresso mostram o rótulo de fora do escopo, não o id", async () => {
    renderWithApp(<LearningPage />);

    await screen.findByText("Trilha com duas pessoas");
    fireEvent.click(screen.getByLabelText("Expandir Trilha com duas pessoas"));
    await screen.findByText("Curso X");

    expect(screen.queryByText("bruno")).toBeNull();
    // Duas ocorrências: o chip de atribuídos e a linha de progresso do item.
    expect(screen.getAllByText("Fora do seu escopo")).toHaveLength(2);
    expect(screen.getAllByText("Ana Martins").length).toBeGreaterThan(0);
  });
});
