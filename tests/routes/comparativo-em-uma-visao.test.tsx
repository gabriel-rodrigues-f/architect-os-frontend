import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to: _to, ...rest }: ComponentProps<"a"> & { to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as CompareRoute } from "@/routes/compare";
import pt from "@/locales/pt.json";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Item V8 do dono (fila visual, 2026-08-30), literal: "Em Comparativo do Time
 * > Radar Sobreposto / Tabela Lado a Lado, eu nao quero rolar a tela para
 * baixo para ver o segundo grafico. Eu quero que vc insira um botao como em
 * Cobertura > Cobertura de Capacidades para trocar o tipo de grafico."
 *
 * O invariante que este teste prende: o Comparativo mostra UMA visão por vez,
 * escolhida por um seletor — nunca os dois blocos empilhados.
 */

const ComparePage = CompareRoute.options.component as () => ReactNode;

/** A figura do radar e a legenda de níveis da tabela: os dois corpos, não os dois títulos. */
const ROTULO_DO_RADAR = pt["chart.comparison.label"];
const ROTULO_DA_ESCALA = pt["level.scale.label"];

const fetchMock = vi.fn();

const renderCompare = () => {
  window.history.replaceState(null, "", "/compare?selected=ana,bruno");
  mockAppFetch(fetchMock);
  return renderWithApp(<ComparePage />);
};

describe("Comparativo — uma visão por vez, trocada por botão", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("abre no radar e NÃO desenha a tabela lado a lado embaixo", async () => {
    renderCompare();

    await screen.findByRole("heading", { name: "Radar Sobreposto" });
    expect(screen.getByRole("img", { name: ROTULO_DO_RADAR })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Tabela Lado a Lado" })).toBeNull();
    expect(screen.queryByRole("list", { name: ROTULO_DA_ESCALA })).toBeNull();
  });

  it("troca para a tabela pelo botão, e o radar sai da tela", async () => {
    renderCompare();

    await screen.findByRole("heading", { name: "Radar Sobreposto" });
    fireEvent.click(screen.getByRole("button", { name: "Tabela" }));

    await screen.findByRole("heading", { name: "Tabela Lado a Lado" });
    expect(screen.getByRole("list", { name: ROTULO_DA_ESCALA })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Radar Sobreposto" })).toBeNull();
    expect(screen.queryByRole("img", { name: ROTULO_DO_RADAR })).toBeNull();
  });

  it("o seletor declara qual visão está ativa", async () => {
    renderCompare();

    const radar = await screen.findByRole("button", { name: "Radar" });
    const tabela = screen.getByRole("button", { name: "Tabela" });
    expect(radar.getAttribute("aria-pressed")).toBe("true");
    expect(tabela.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(tabela);

    expect(screen.getByRole("button", { name: "Radar" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.getByRole("button", { name: "Tabela" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});
