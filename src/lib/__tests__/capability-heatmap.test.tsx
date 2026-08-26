import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapabilityHeatmap } from "@/components/app/CapabilityHeatmap";
import { type AppState } from "../api";
import { createSelectors } from "../selectors";
import { fixtureState } from "./fixtures";
import { mockAppFetch, renderWithApp } from "./render-app";

/**
 * OO3-11/D-1 — o heatmap pessoas × capacidades unificado entre o Painel e
 * /progression. Invariantes do componente compartilhado: célula sem média
 * mostra "—" (nunca 0), e coluna cortada pelo teto não renderiza.
 */
const fetchMock = vi.fn();

describe("CapabilityHeatmap", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('célula sem média mostra "—", nunca 0', async () => {
    // bruno sem assessment: toda célula dele fica sem média.
    const state: AppState = {
      ...fixtureState,
      assessments: fixtureState.assessments.filter((a) => a.architectId !== "bruno"),
    };
    mockAppFetch(fetchMock, { state });
    const sel = createSelectors(state);
    renderWithApp(
      <CapabilityHeatmap
        architects={state.architects}
        capabilities={state.capabilities}
        capabilityAveragesFor={sel.capabilityAverages}
      />,
    );

    const linhaBruno = (await screen.findByText("Bruno Almeida")).closest("tr")!;
    const celulas = [...linhaBruno.querySelectorAll("td")].slice(1);
    expect(celulas.length).toBe(state.capabilities.length);
    for (const celula of celulas) {
      expect(celula.textContent).toBe("—");
      expect(celula.textContent).not.toBe("0");
    }
  });

  it("coluna cortada pelo teto de colunas não renderiza; 'mostrar todas' traz de volta", async () => {
    // 13 capacidades (> MAX_HEATMAP_COLUMNS = 12) — a de menor gap sai do corte.
    const manyCaps = Array.from({ length: 13 }, (_, i) => ({
      ...fixtureState.capabilities[0]!,
      id: `cap-${i}`,
      name: `Capacidade ${i}`,
      short: `C${i}`,
    }));
    const state: AppState = { ...fixtureState, capabilities: manyCaps };
    mockAppFetch(fetchMock, { state });
    const sel = createSelectors(state);
    renderWithApp(
      <CapabilityHeatmap
        architects={state.architects}
        capabilities={state.capabilities}
        capabilityAveragesFor={sel.capabilityAverages}
      />,
    );

    await screen.findByText("Ana Martins");
    const headers = screen.getAllByRole("columnheader");
    // 1 coluna de arquiteto + 12 capacidades visíveis (uma cortada).
    expect(headers.length).toBe(1 + 12);
    expect(screen.getByRole("button", { name: /todas/i })).toBeTruthy();
  });
});
