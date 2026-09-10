import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState } from "@/lib/api";
import type { Capability } from "@/lib/domain";
import { PageFillingPane } from "@/lib/design";
import { PageFrame } from "@/components/app/PageFrame";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * UMA CAIXA, E ELA OCUPA A TELA.
 *
 * De manhã (2026-09-10) o dono pediu DUAS: *"Vamos diminuir a caixa de
 * capacidades para mostrar apenas 3 capacidades, o resto somente scrollando.
 * Consequentemente conseguiremos ver também 'Arquivadas' na tela."* O teto de
 * três cartões existia POR CAUSA das Arquivadas — era preciso abrir espaço
 * embaixo para a segunda caixa.
 *
 * À tarde, do mesmo dono: *"remova o conceito de arquivado"*. A segunda caixa
 * saiu da tela, e com ela a razão do teto. Sobra UMA caixa, e ela volta a ser
 * a que ocupa o RESTO (`PageFillingPane`, `becfd24`) — quem mede é a coluna do
 * quadro, não um número escrito aqui.
 *
 * O que esta régua guarda continua sendo o MECANISMO: quem estica é quem se
 * anuncia pelo marcador, a cadeia inteira entre o quadro e ela vira coluna, e
 * em tela estreita não sobra caixa nenhuma.
 */

const fetchMock = vi.fn();
const MatrixPage = MatrixRoute.options.component as () => ReactNode;

/** Capacidades o bastante para a caixa TER o que rolar por dentro. */
const capacidades: Capability[] = [1, 2, 3, 4, 5, 6, 7, 8].map((numero) => ({
  id: `cap-${String(numero)}`,
  name: `Capacidade ${String(numero)}`,
  short: `C${String(numero)}`,
  curation: { competencyCount: 3, status: "READY" },
}));

const state: AppState = { ...fixtureState, capabilities: capacidades };

/** A tela DENTRO do quadro da casa — é a cadeia inteira que está sob teste. */
function renderPagina() {
  mockAppFetch(fetchMock, { user: fixtureAdminUser, state, routes: [careerLevelsRoute] });
  return renderWithApp(
    <PageFrame pathname="/competency-matrix">
      <MatrixPage />
    </PageFrame>,
  );
}

/*
 * Cartão e caixa se chamam parecido: o cartão é `<section aria-labelledby>`, a
 * caixa é `<div role="region" aria-label>`. Procurar por papel devolve os
 * dois; a caixa se acha pelo rótulo escrito nela.
 */
const caixaDeCapacidades = async (): Promise<HTMLElement> => {
  await screen.findByText(capacidades[0]!.name);
  const encontrada = document.querySelector<HTMLElement>(
    `div[role="region"][aria-label="Catálogo de competências"]`,
  );
  if (!encontrada) throw new Error(`Não há caixa nenhuma rotulada "Catálogo de competências".`);
  return encontrada;
};

const quadro = (): HTMLElement => {
  const main = document.querySelector("main[data-page-frame]");
  if (!main) throw new Error("A página não está dentro do quadro da casa.");
  return main as HTMLElement;
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Catálogo de Competências: a caixa ocupa o resto da página", () => {
  it("não declara teto nenhum: a altura é MEDIDA, não escrita", async () => {
    renderPagina();
    const pane = await caixaDeCapacidades();
    expect(pane.getAttribute("style")).toBeNull();
    expect(pane.className).not.toContain("max-h-(");
    expect(pane.hasAttribute(PageFillingPane.MARKER)).toBe(true);
    for (const classe of PageFillingPane.paneClass.split(/\s+/)) {
      expect(pane.className.split(/\s+/)).toContain(classe);
    }
  });

  it("o quadro da página vira coluna de altura cheia ao hospedar a caixa do resto", async () => {
    renderPagina();
    await caixaDeCapacidades();
    for (const classe of PageFillingPane.frameClass.split(/\s+/)) {
      expect(quadro().className.split(/\s+/)).toContain(classe);
    }
  });

  /**
   * Quem estica é quem se anuncia, e só pode haver UM. A aba "Arquivadas"
   * levou embora a segunda caixa desta tela; se uma terceira nascer sem saber
   * disso, as duas disputariam o mesmo resto.
   */
  it("há um marcador só na tela inteira", async () => {
    renderPagina();
    await caixaDeCapacidades();
    expect(document.querySelectorAll(`[${PageFillingPane.MARKER}]`)).toHaveLength(1);
  });

  /** A cadeia que a regra genérica veste não pode ter grade nem linha. */
  it("nenhum ancestral entre o quadro e a caixa é grade ou linha", async () => {
    renderPagina();
    let atual = (await caixaDeCapacidades()).parentElement;
    const vestidos: string[] = [];
    while (atual && atual !== quadro()) {
      vestidos.push(atual.className);
      atual = atual.parentElement;
    }
    expect(atual).toBe(quadro());
    for (const classes of vestidos) {
      expect(classes).not.toMatch(/(?:^|[\s:])(?:grid|flex-row|grid-cols-)/);
    }
  });

  it("em tela estreita não sobra caixa nenhuma: tudo que a monta é `xl:`", async () => {
    renderPagina();
    const daCaixa = (await caixaDeCapacidades()).className
      .split(/\s+/)
      .filter(
        (classe) =>
          classe.includes("min-h") || classe.includes("overflow-y") || classe.includes("flex-1"),
      );
    expect(daCaixa.length).toBeGreaterThanOrEqual(2);
    for (const classe of daCaixa) expect(classe.startsWith("xl:")).toBe(true);
  });
});
