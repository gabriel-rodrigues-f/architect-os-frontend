import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de training-needs-intervention.test.tsx: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to: _to, ...rest }: ComponentProps<"a"> & { to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as TrainingNeedsRoute } from "@/routes/training-needs";
import type { AppState } from "@/lib/api";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * CFG-05 / B6 — guard rail do limiar configurável: o "3+ pessoas" da
 * intervenção coletiva vem de `training.collectiveInterventionThreshold`.
 * A fixture tem DUAS pessoas (ana e bruno) com a mesma lacuna de segurança
 * — abaixo do default 3 (comportamento coberto por
 * `training-needs-intervention.test.tsx`, que precisa adicionar uma
 * terceira), mas elegível quando o servidor configura limiar 2.
 */

const fetchMock = vi.fn();
const TrainingNeedsPage = TrainingNeedsRoute.options.component as () => ReactNode;

const settingRecord = (key: string, value: string | number) => ({
  key,
  value,
  valueType: typeof value === "number" ? "int" : "enum",
  scope: "operational",
  description: null,
  updatedAt: "2026-08-26T00:00:00Z",
  updatedBy: null,
});

const thresholdTwoRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/settings")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({
        settings: [
          settingRecord("cycle.cadence", "SEMIANNUAL"),
          settingRecord("career.minimumQualifiedFloor", 3),
          settingRecord("training.collectiveInterventionThreshold", 2),
        ],
      })
    : undefined;

/** Sem trilha de partida — a fixture padrão já tem uma para security-iam. */
const state: AppState = { ...fixtureState, learningPaths: [] };

describe("Necessidades de Treinamento — limiar configurável (CFG-05/B6)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("com limiar 2 do servidor, a lacuna de 2 pessoas vira candidata a intervenção", async () => {
    mockAppFetch(fetchMock, { state, routes: [thresholdTwoRoute] });
    renderWithApp(<TrainingNeedsPage />);

    // O subtítulo reflete o limiar efetivo, não um "3" fixo.
    expect(
      await screen.findByText(
        "Competências com lacuna em 2 ou mais arquitetos — candidatas a treinamento coletivo.",
      ),
    ).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Criar trilha coletiva/ })).toBeTruthy();
  });

  it("sem a setting carregada, o fallback 3 mantém o comportamento antigo (2 pessoas não elegem)", async () => {
    mockAppFetch(fetchMock, { state });
    renderWithApp(<TrainingNeedsPage />);

    expect(
      await screen.findByText(
        "Competências com lacuna em 3 ou mais arquitetos — candidatas a treinamento coletivo.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Criar trilha coletiva/ })).toBeNull();
  });
});
