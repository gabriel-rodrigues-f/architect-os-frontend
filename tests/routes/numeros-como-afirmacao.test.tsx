import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `dashboard-roles.test.tsx`: `<Link>` exige RouterProvider real. */
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

import { Route as CapabilityRoute } from "@/routes/capability-map";
import { Route as GapRoute } from "@/routes/gap-analysis";
import { Route as TrainingNeedsRoute } from "@/routes/training-needs";
import {
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Referência FIAP 2026-09-06, §2 item 2 — "números como afirmação" também
 * fora do Painel: Plano de Capacitação diz quantas pessoas capacitar, Risco
 * de Concentração diz quantas capacidades dependem de uma pessoa só,
 * Prioridades de Desenvolvimento diz a distância média. O número grande
 * primeiro; a tabela ou a lista, abaixo, é o detalhe.
 */
const fetchMock = vi.fn();

const TrainingNeedsPage = TrainingNeedsRoute.options.component as () => ReactNode;
const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;
const GapPage = GapRoute.options.component as () => ReactNode;

const figuraDe = async (rotulo: string) => {
  const elemento = (await screen.findByText(rotulo)).closest("[data-key-figure]");
  expect(elemento, rotulo).not.toBeNull();
  return elemento as HTMLElement;
};

describe("números como afirmação nas telas de análise", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: scopedFixtureStateFor(fixtureAssignedManagerUser, fixtureState, [fixtureTeamId]),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Plano de Capacitação afirma quantas pessoas capacitar", async () => {
    renderWithApp(<TrainingNeedsPage />);
    const figura = await figuraDe("Profissionais a capacitar");
    expect(figura.querySelector(".key-figure-value")?.textContent).toMatch(/^\d+$/);
  });

  it("Risco de Concentração afirma quantas capacidades dependem de uma pessoa só", async () => {
    renderWithApp(<CapabilityPage />);
    const figura = await figuraDe("Capacidades com um profissional só");
    expect(figura.querySelector(".key-figure-value")?.textContent).toMatch(/^\d+$/);
  });

  /**
   * Dono (2026-09-10): *"Prioridades de Desenvolvimento > Distância Média:
   * arredonde para baixo e quero número inteiro, sem vírgula."* A figura
   * deixa de ter casa decimal — e a vírgula, que era o formato antigo, não
   * pode voltar por descuido.
   */
  it("Prioridades de Desenvolvimento afirma a distância média em número inteiro, sem vírgula", async () => {
    renderWithApp(<GapPage />);
    const figura = await figuraDe("Distância média");
    expect(figura.querySelector(".key-figure-value")?.textContent).toMatch(/^\d+$/);
  });
});
