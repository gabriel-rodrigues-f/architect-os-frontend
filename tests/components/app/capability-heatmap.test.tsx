import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapabilityHeatmap } from "@/components/app/CapabilityHeatmap";
import { type AppState } from "@/lib/api";
import { createSelectors } from "@/lib/selectors";
import { fixtureState } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * OO3-11/D-1 — o heatmap pessoas × capacidades unificado entre o Painel e
 * /progression. Invariantes do componente compartilhado: célula sem média
 * mostra "—" (nunca 0), e coluna cortada pelo teto não renderiza.
 *
 * ONDA3/FE2 — o heatmap é uma das duas telas onde a cor É o dado. As asserções
 * novas cobrem o que sustenta a leitura sem cor: o nome da pessoa é cabeçalho
 * de linha (a célula é anunciada com a pessoa e a capacidade, não solta), o
 * número segue visível em cada célula, e a escala de níveis tem legenda própria
 * — sem legenda, o padrão de preenchimento seria ruído.
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

    const linhaBruno = (await screen.findByRole("rowheader", { name: "Bruno Almeida" })).closest(
      "tr",
    )!;
    const celulas = within(linhaBruno).getAllByRole("cell");
    expect(celulas.length).toBe(state.capabilities.length);
    for (const celula of celulas) {
      expect(celula.textContent).toBe("—");
      expect(celula.textContent).not.toBe("0");
    }
  });

  /**
   * O nome da pessoa era `<td>`: o leitor de tela anunciava "3" sem dizer de
   * quem. Como cabeçalho de linha ele volta ao anúncio da célula.
   */
  it("o nome da pessoa é cabeçalho da linha, não célula comum", async () => {
    mockAppFetch(fetchMock, { state: fixtureState });
    const sel = createSelectors(fixtureState);
    renderWithApp(
      <CapabilityHeatmap
        architects={fixtureState.architects}
        capabilities={fixtureState.capabilities}
        capabilityAveragesFor={sel.capabilityAverages}
      />,
    );

    expect(await screen.findByRole("rowheader", { name: "Ana Martins" })).toBeTruthy();
    expect(screen.queryByRole("cell", { name: "Ana Martins" })).toBeNull();
  });

  /** O segundo canal por célula: o número. Nenhuma célula avaliada pode ficar só na cor. */
  it("toda célula avaliada mostra o número do nível", async () => {
    mockAppFetch(fetchMock, { state: fixtureState });
    const sel = createSelectors(fixtureState);
    renderWithApp(
      <CapabilityHeatmap
        architects={fixtureState.architects}
        capabilities={fixtureState.capabilities}
        capabilityAveragesFor={sel.capabilityAverages}
      />,
    );

    const linhaAna = (await screen.findByRole("rowheader", { name: "Ana Martins" })).closest("tr")!;
    const textos = within(linhaAna)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(textos.length).toBeGreaterThan(0);
    for (const texto of textos) {
      expect(texto).toMatch(/^([0-5]|—)$/);
    }
    expect(textos.some((texto) => texto !== "—")).toBe(true);
  });

  /** A legenda explica cor e padrão; sem ela o padrão de preenchimento não significa nada. */
  it("a escala de níveis tem legenda com um item por nível", async () => {
    mockAppFetch(fetchMock, { state: fixtureState });
    const sel = createSelectors(fixtureState);
    renderWithApp(
      <CapabilityHeatmap
        architects={fixtureState.architects}
        capabilities={fixtureState.capabilities}
        capabilityAveragesFor={sel.capabilityAverages}
      />,
    );

    const legenda = await screen.findByRole("list", { name: "Escala de níveis" });
    const itens = within(legenda).getAllByRole("listitem");
    expect(itens.length).toBe(6);
    expect(itens.map((i) => i.textContent)).toContain("Sem avaliação");
    expect(itens.some((i) => i.textContent?.startsWith("L1"))).toBe(true);
    expect(itens.some((i) => i.textContent?.startsWith("L5"))).toBe(true);
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
