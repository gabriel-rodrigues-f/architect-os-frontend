import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children }: { children?: unknown }) => <a>{children as never}</a>,
  };
});

import { CapabilityHeatmap } from "@/components/app/CapabilityHeatmap";
import type { CapabilityAverage } from "@/lib/selectors";
import { fixtureAdminUser, fixtureState } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";
import { SELECTOR_CONTEXTS } from "@/lib/context-scope";

/**
 * QA-UX gate 1 (2026-08-29), achado 3 — no Painel o heatmap corta as últimas
 * colunas seco, sem nenhum sinal de que há mais conteúdo (no macOS a barra de
 * rolagem overlay só aparece durante o gesto). O invariante: quando as
 * colunas excedem a largura visível, a borda cortada ganha um FADE de
 * affordance (`data-overflow-edge`), que acompanha a rolagem — some no
 * extremo alcançado e aparece no oposto. Nasceu VERMELHO: o contêiner antigo
 * era só `overflow-auto`, nenhum affordance existia.
 *
 * O jsdom não faz layout: as métricas de rolagem são definidas à mão e o
 * remeasure é disparado pelos MESMOS eventos que o hook escuta (scroll).
 */
const fetchMock = vi.fn();

const averages: CapabilityAverage[] = fixtureState.capabilities.map((capability) => ({
  capability,
  avg: 3,
  target: 4,
}));

function defineScrollMetrics(
  element: HTMLElement,
  metrics: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    get: () => metrics.scrollWidth,
  });
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    get: () => metrics.clientWidth,
  });
  Object.defineProperty(element, "scrollLeft", {
    configurable: true,
    get: () => metrics.scrollLeft,
    set: (value: number) => {
      metrics.scrollLeft = value;
    },
  });
}

describe("heatmap de capacidades — colunas excedentes ganham affordance de rolagem", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra o fade na borda cortada e o move conforme a rolagem", async () => {
    renderWithApp(
      <CapabilityHeatmap
        architects={fixtureState.architects}
        capabilities={fixtureState.capabilities}
        capabilityAveragesFor={() => averages}
      />,
      { contexts: SELECTOR_CONTEXTS },
    );

    const scroller = await screen.findByTestId("heatmap-scroll");
    const metrics = { scrollWidth: 900, clientWidth: 400, scrollLeft: 0 };
    defineScrollMetrics(scroller, metrics);
    fireEvent.scroll(scroller);

    expect(document.querySelector('[data-overflow-edge="end"]')).not.toBeNull();
    expect(document.querySelector('[data-overflow-edge="start"]')).toBeNull();

    metrics.scrollLeft = 500;
    fireEvent.scroll(scroller);

    expect(document.querySelector('[data-overflow-edge="end"]')).toBeNull();
    expect(document.querySelector('[data-overflow-edge="start"]')).not.toBeNull();
  });
});
