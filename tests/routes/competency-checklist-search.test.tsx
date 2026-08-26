import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de outros testes de rota: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as MentoringRoute } from "@/routes/mentoring";
import { Route as LearningRoute } from "@/routes/learning-paths";
import { type AppState } from "@/lib/api";
import type { Competency } from "@/lib/domain";
import { fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * R2-ESC-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — checklists de
 * competências sem busca (Mentoria/Trilhas) ganham input de filtro local
 * quando o catálogo passa de 20 itens. Abaixo disso, o campo nem aparece —
 * não vale a pena filtrar 3 opções.
 */

const fetchMock = vi.fn();

const MANY_COMPETENCIES: Competency[] = Array.from({ length: 25 }, (_, i) => ({
  id: `comp-${i}`,
  name: i === 7 ? "Observabilidade e SRE" : `Competência ${String(i).padStart(2, "0")}`,
  capabilityId: "cloud",
  requirementType: "NON_RESTRICTIVE",
  expected: {
    "arquiteto-de-solucoes-i": 2,
    "arquiteto-de-solucoes-ii": 3,
    "arquiteto-de-solucoes-iii": 4,
  },
  active: true,
}));

const manyCompetenciesState: AppState = { ...fixtureState, competencies: MANY_COMPETENCIES };

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

function mockFetch(state: AppState) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { state });
}

const MentoringPage = MentoringRoute.options.component as () => ReactNode;
const LearningPage = LearningRoute.options.component as () => ReactNode;

describe("Checklists de competências — busca local acima de 20 itens (R2-ESC-07)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Mentoria: acima de 20 competências, filtro aparece e restringe a lista", async () => {
    mockFetch(manyCompetenciesState);
    renderWithApp(<MentoringPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    const filtro = await screen.findByLabelText("Buscar competência…");

    expect(screen.getByText("Observabilidade e SRE")).toBeTruthy();
    expect(screen.getByText("Competência 00")).toBeTruthy();

    await userEvent.type(filtro, "observabilidade");

    expect(screen.getByText("Observabilidade e SRE")).toBeTruthy();
    expect(screen.queryByText("Competência 00")).toBeNull();
  });

  it("Mentoria: abaixo de 20 competências (fixture padrão), o filtro nem aparece", async () => {
    mockFetch(fixtureState);
    renderWithApp(<MentoringPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    await screen.findByText("Kubernetes");

    expect(screen.queryByLabelText("Buscar competência…")).toBeNull();
  });

  it("Trilhas: acima de 20 competências, filtro aparece na criação de trilha", async () => {
    mockFetch(manyCompetenciesState);
    renderWithApp(<LearningPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova trilha" }));
    const filtro = await screen.findByLabelText("Buscar competência…");

    expect(screen.getByText("Observabilidade e SRE")).toBeTruthy();
    expect(screen.getByText("Competência 00")).toBeTruthy();

    await userEvent.type(filtro, "observabilidade");

    expect(screen.getByText("Observabilidade e SRE")).toBeTruthy();
    expect(screen.queryByText("Competência 00")).toBeNull();
  });
});
