import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { emptyEligibilityRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * QA-04 (onda 5) — o contador de comentários de cada competência é um botão de
 * DIVULGAÇÃO: abre e fecha o painel de notas logo abaixo. Sem `aria-expanded`
 * ele se anuncia como um botão comum: quem usa leitor de tela não sabe que há
 * algo para abrir, nem percebe que abriu depois de acionar — o painel aparece
 * fora do fluxo de leitura, sem nenhum aviso (WCAG 4.1.2). E o nome acessível
 * ("2 comentários") se repetia igual em toda competência da tabela, sem dizer
 * de qual competência é.
 *
 * O par de teclado e o par de mouse andam juntos de propósito: em 22/08 uma
 * fatia de acessibilidade nesta base consertou teclado e quebrou mouse nos
 * filtros com a suíte verde, e o defeito só apareceu 6 dias depois.
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const botaoDeNotas = async () => {
  const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
  return within(linha).getByRole("button");
};

describe("Avaliações — botão de notas anuncia que abre e fecha (QA-04)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [emptyEligibilityRoute] });
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("nasce recolhido e diz a qual competência pertence", async () => {
    renderWithApp(<AssessmentsPage />);
    const botao = await botaoDeNotas();

    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(botao.getAttribute("aria-label")).toContain("Kubernetes");

    const painelId = botao.getAttribute("aria-controls");
    expect(painelId).toBeTruthy();
    expect(document.getElementById(painelId!)).toBeNull();
  });

  it("teclado: Enter abre o painel e marca aria-expanded", async () => {
    renderWithApp(<AssessmentsPage />);
    const user = userEvent.setup();
    const botao = await botaoDeNotas();

    botao.focus();
    expect(document.activeElement).toBe(botao);
    await user.keyboard("{Enter}");

    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(botao.getAttribute("aria-controls")!)).toBeTruthy();
  });

  it("teclado: Espaço fecha o painel de volta", async () => {
    renderWithApp(<AssessmentsPage />);
    const user = userEvent.setup();
    const botao = await botaoDeNotas();

    botao.focus();
    await user.keyboard("{Enter}");
    expect(botao.getAttribute("aria-expanded")).toBe("true");

    await user.keyboard(" ");

    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(botao.getAttribute("aria-controls")!)).toBeNull();
  });

  it("mouse: clicar continua abrindo e fechando o painel", async () => {
    renderWithApp(<AssessmentsPage />);
    const user = userEvent.setup();
    const botao = await botaoDeNotas();

    await user.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(botao.getAttribute("aria-controls")!)).toBeTruthy();

    await user.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(botao.getAttribute("aria-controls")!)).toBeNull();
  });
});
