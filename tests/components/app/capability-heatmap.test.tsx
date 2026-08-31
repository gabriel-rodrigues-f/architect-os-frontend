import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapabilityHeatmap } from "@/components/app/CapabilityHeatmap";
import { MAX_HEATMAP_COLUMNS } from "@/components/app/gap-analysis-shared";
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

  const comCatalogoDe = (quantas: number): AppState => ({
    ...fixtureState,
    capabilities: Array.from({ length: quantas }, (_, i) => ({
      ...fixtureState.capabilities[0]!,
      id: `cap-${String(i)}`,
      name: `Capacidade ${String(i)}`,
      short: `C${String(i)}`,
    })),
  });

  const renderComCatalogoDe = (quantas: number) => {
    const state = comCatalogoDe(quantas);
    mockAppFetch(fetchMock, { state });
    const sel = createSelectors(state);
    renderWithApp(
      <CapabilityHeatmap
        architects={state.architects}
        capabilities={state.capabilities}
        capabilityAveragesFor={sel.capabilityAverages}
      />,
    );
  };

  it("coluna cortada pelo teto de colunas não renderiza; 'mostrar todas' traz de volta", async () => {
    // 21 capacidades (> MAX_HEATMAP_COLUMNS) — a de menor gap sai do corte.
    renderComCatalogoDe(MAX_HEATMAP_COLUMNS + 1);

    await screen.findByText("Ana Martins");
    const headers = screen.getAllByRole("columnheader");
    expect(headers.length).toBe(1 + MAX_HEATMAP_COLUMNS);
    expect(screen.getByRole("button", { name: /todas/i })).toBeTruthy();
  });

  /**
   * ONDA21/mapa-unico, item V7 do dono — o catálogo real tem 13 capacidades e
   * o teto de 12 escondia exatamente UMA, produzindo a frase "Mostrando as 12
   * capacidades com pior gap de 13", que o dono leu e perguntou o que
   * significava. Esconder 1 de 13 não encurta rolagem nenhuma: a tabela já
   * rola por desenho, com coluna de nome fixa e gradientes de borda. O teto
   * existe para o catálogo que de fato transbordou a tela, não para cobrar uma
   * capacidade escondida e uma frase confusa por meia rolagem economizada.
   */
  it("um catálogo do tamanho do real (13) aparece inteiro, sem aviso de corte", async () => {
    renderComCatalogoDe(13);

    await screen.findByText("Ana Martins");
    expect(screen.getAllByRole("columnheader").length).toBe(1 + 13);
    expect(screen.queryByText(/Mostrando as/)).toBeNull();
    expect(screen.queryByRole("button", { name: /todas/i })).toBeNull();
  });
});
