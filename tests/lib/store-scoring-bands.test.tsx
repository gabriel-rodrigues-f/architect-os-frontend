import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GapBadge } from "@/components/app/ui-bits";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * CFG-02 — `useScoringBands`/`useGapSeverityRuler` (`store.tsx`) na prática,
 * pelo consumidor mais visível (o `GapBadge`):
 *
 * - fallback: sem `GET /api/config/bands` respondendo faixas, a régua é o
 *   default byte-idêntico ao seed — gap 2 continua "Prioridade alta",
 *   exatamente o comportamento hardcoded antigo;
 * - carga: com o endpoint devolvendo uma GAP_SEVERITY recalibrada ("gap 2
 *   já é crítico no nosso time"), o MESMO badge passa a "Crítico" — sem
 *   deploy, só dado.
 */
const fetchMock = vi.fn();

const bandsRoute =
  (body: unknown): FetchRoute =>
  (href) =>
    href.endsWith("/api/config/bands") ? jsonResponse(body) : undefined;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useScoringBands via GapBadge (CFG-02)", () => {
  it("fallback: sem bands carregados, gap 2 mantém o rótulo antigo (Prioridade alta)", async () => {
    mockAppFetch(fetchMock, { routes: [bandsRoute({})] });
    renderWithApp(<GapBadge gap={2} />);
    expect(await screen.findByText("Gap 2 · Prioridade alta")).toBeTruthy();
  });

  it("bands do servidor mudam a régua: com critical a partir de 2, gap 2 vira Crítico", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        bandsRoute({
          GAP_SEVERITY: [
            {
              key: "adequate",
              minValue: null,
              maxValue: 1,
              labelKey: "gap.ok",
              tone: "ok",
              sortOrder: 1,
            },
            {
              key: "recommended",
              minValue: 1,
              maxValue: 2,
              labelKey: "gap.recommended",
              tone: "low",
              sortOrder: 2,
            },
            {
              key: "critical",
              minValue: 2,
              maxValue: null,
              labelKey: "gap.critical",
              tone: "critical",
              sortOrder: 3,
            },
          ],
        }),
      ],
    });
    renderWithApp(<GapBadge gap={2} />);
    expect(await screen.findByText("Gap 2 · Crítico")).toBeTruthy();
  });
});
