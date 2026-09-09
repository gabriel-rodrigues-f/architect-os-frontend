import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShellHeader } from "@/lib/design";
import { Route as PlansRoute } from "@/routes/development-plans";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono (2026-09-09, com captura): *"Plano de Desenvolvimento Individual >
 * Maiores Distâncias: deve ser scrollável. A tela não pode rolar para baixo
 * por conta do grupo 'Maiores Distâncias'."*
 *
 * Medida antes de consertar (janela 1440x900, réplica fiel da casca e da
 * grade): as duas colunas são células da MESMA linha da grade e a célula
 * estica (`align-self: stretch`), então a linha ganha a altura da coluna MAIS
 * ALTA. Com o plano em 828px e a coluna de apoio em 1303px, a grade foi a
 * 1303, o `main` a 1565 e o documento a 1638 contra 900 de janela — 738px
 * abaixo da dobra. Nenhuma caixa rolava por dentro (`scrollHeight ===
 * clientHeight` em todas): o único rolador era o DOCUMENTO, e quem o esticava
 * era a coluna da direita.
 *
 * O invariante desta régua: em tela larga a coluna de apoio se solta do
 * esticamento (`self-start`), gruda abaixo do cabeçalho pelo TOKEN de altura
 * (nunca um número solto) e rola dentro de si. Em tela estreita as colunas
 * empilham e NADA disso vale — caixa de rolagem dentro de página que já rola
 * é pior que o defeito original. Por isso toda classe que monta a caixa
 * carrega o variante `xl:`, e o variante vem colado no literal: o Tailwind v4
 * só compila a classe que enxerga inteira no fonte.
 */

const PlansPage = PlansRoute.options.component as () => ReactNode;
const fetchMock = vi.fn();

/** As classes que, juntas, montam a caixa de rolagem presa à janela. */
const DA_CAIXA = /(?:^|:)(?:sticky|self-start|overflow-y-auto|h-screen)$|(?:^|:)(?:top|max-h)-/;

describe("a coluna de apoio do PDI rola em si, e só em tela larga", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock);
    window.history.pushState({}, "", "?professionalId=ana");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  /** A coluna é quem HOSPEDA as Maiores distâncias — achada pelo conteúdo, não pelo rótulo. */
  const colunaDeApoio = async (): Promise<HTMLElement> => {
    renderWithApp(<PlansPage />);
    const distancias = await screen.findByRole("region", { name: "Maiores distâncias" });
    const coluna = distancias.parentElement;
    if (!coluna) throw new Error("As Maiores distâncias não estão dentro de coluna nenhuma.");
    return coluna;
  };

  it("solta-se do esticamento da grade e gruda abaixo do cabeçalho pelo token", async () => {
    const coluna = await colunaDeApoio();
    const classes = coluna.className.split(/\s+/);
    for (const classe of ShellHeader.sideRailClass.split(/\s+/)) expect(classes).toContain(classe);
    expect(coluna.className).toContain(ShellHeader.TOKEN);
    expect(coluna.className).not.toContain(String(ShellHeader.HEIGHT_PX));
  });

  it("a barra de rolagem é a da casa e a coluna é alcançável por teclado", async () => {
    const coluna = await colunaDeApoio();
    expect(coluna.className.split(/\s+/)).toContain("scroll-visible");
    expect(coluna.tabIndex).toBe(0);
    expect(coluna.className).toContain("focus-visible:focus-ring");
    expect(coluna.getAttribute("role")).toBe("region");
    expect(coluna.getAttribute("aria-label")).toBe("Apoio ao plano");
  });

  it("em tela estreita não sobra caixa de rolagem: tudo que a monta é `xl:`", async () => {
    const coluna = await colunaDeApoio();
    const daCaixa = coluna.className.split(/\s+/).filter((classe) => DA_CAIXA.test(classe));
    expect(daCaixa.length).toBeGreaterThanOrEqual(4);
    for (const classe of daCaixa) expect(classe.startsWith("xl:")).toBe(true);
  });
});
