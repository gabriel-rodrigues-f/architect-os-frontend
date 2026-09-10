import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState } from "@/lib/api";
import type { Capability, Competency } from "@/lib/domain";
import { PageFillingPane, PaneHeight, PaneRhythm, ScrollPaneStyle } from "@/lib/design";
import { PageFrame } from "@/components/app/PageFrame";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono (2026-09-10): *"O grupo 'Níveis de Proficiência' vai subir. Vamos
 * diminuir a caixa de capacidades para mostrar apenas 3 capacidades, o resto
 * somente scrollando. Consequentemente conseguiremos ver também 'Arquivadas'
 * na tela, que hoje só é possível enxergar scrollando para baixo. Ocupe a
 * tela com a quantidade necessária de capacidades arquivadas para se enxergar
 * todo o conteúdo da página em zoom 100%. O restante, somente scrollando esse
 * grupo de 'Arquivadas'."*
 *
 * São DUAS caixas na MESMA tela, e é isso que esta régua guarda:
 *
 * - a de **capacidades** ganha TETO em conteúdo — três cartões, no ritmo do
 *   item (`--pane-item-h`), medida que é do dono e não do navegador;
 * - a de **arquivadas** não tem teto nenhum: é a caixa que ocupa o RESTO
 *   (`PageFillingPane`, `becfd24`), e quem mede é a coluna do quadro.
 *
 * O mecanismo do resto-da-página assume UMA caixa por tela — quem se anuncia
 * pelo marcador é quem estica. Ter uma segunda caixa ao lado só funciona
 * enquanto ela NÃO se anuncia: por isso a asserção de que existe um marcador
 * só, e a de que a caixa com teto não é ancestral da outra (senão a regra
 * genérica `*:has(marcador)` a vestiria de coluna elástica e o teto de três
 * itens viraria letra morta).
 */

const fetchMock = vi.fn();

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

/** Capacidades ativas o bastante para a caixa TER o que esconder atrás do teto. */
const ativas: Capability[] = [1, 2, 3, 4, 5].map((numero) => ({
  id: `ativa-${String(numero)}`,
  name: `Capacidade Ativa ${String(numero)}`,
  short: `A${String(numero)}`,
  active: true,
  curation: { activeCompetencyCount: 3, status: "READY" },
}));

/** E arquivadas o bastante para a caixa do resto valer a pena. */
const arquivadas: Capability[] = [1, 2, 3, 4, 5, 6].map((numero) => ({
  id: `arquivada-${String(numero)}`,
  name: `Capacidade Arquivada ${String(numero)}`,
  short: `X${String(numero)}`,
  active: false,
  curation: { activeCompetencyCount: 0, status: "READY" },
}));

const competenciaArquivada: Competency = {
  id: "ativa-1-morta",
  name: "Competência Arquivada",
  capabilityId: "ativa-1",
  active: false,
};

const state: AppState = {
  ...fixtureState,
  capabilities: [...ativas, ...arquivadas],
  competencies: [...fixtureState.competencies, competenciaArquivada],
};

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
const caixaPor = (rotulo: string): HTMLElement => {
  const encontrada = document.querySelector<HTMLElement>(
    `div[role="region"][aria-label="${rotulo}"]`,
  );
  if (!encontrada) throw new Error(`Não há caixa nenhuma rotulada "${rotulo}".`);
  return encontrada;
};

const caixaDeCapacidades = async (): Promise<HTMLElement> => {
  await screen.findByText(ativas[0]!.name);
  return caixaPor("Catálogo de competências");
};

const caixaDeArquivadas = async (): Promise<HTMLElement> => {
  await screen.findByText(arquivadas[0]!.name);
  return caixaPor("Capacidades e competências arquivadas");
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

describe("Catálogo de Competências: as duas caixas cabem na tela", () => {
  it("a caixa de capacidades mostra três cartões — a medida é de conteúdo, do dono", async () => {
    renderPagina();
    const pane = await caixaDeCapacidades();
    expect(pane.getAttribute("style")).toContain(
      `${PaneHeight.TOKEN}: ${PaneHeight.items(3, PaneRhythm.ITEM).css}`,
    );
    expect(pane.className.split(/\s+/)).toContain(ScrollPaneStyle.capClass);
  });

  it("a caixa de arquivadas não declara teto nenhum: a altura é medida", async () => {
    renderPagina();
    const pane = await caixaDeArquivadas();
    expect(pane.getAttribute("style")).toBeNull();
    expect(pane.className).not.toContain("max-h");
    expect(pane.hasAttribute(PageFillingPane.MARKER)).toBe(true);
    for (const classe of PageFillingPane.paneClass.split(/\s+/)) {
      expect(pane.className.split(/\s+/)).toContain(classe);
    }
  });

  it("o quadro da página vira coluna de altura cheia ao hospedar a caixa do resto", async () => {
    renderPagina();
    await caixaDeArquivadas();
    for (const classe of PageFillingPane.frameClass.split(/\s+/)) {
      expect(quadro().className.split(/\s+/)).toContain(classe);
    }
  });

  /**
   * O limite do mecanismo, escrito como asserção: quem estica é quem se
   * anuncia, e só pode haver um. Se a caixa de capacidades também se
   * anunciasse, as duas disputariam o mesmo resto e nenhuma teria a medida
   * que o dono pediu.
   */
  it("só uma das duas caixas se anuncia ao quadro", async () => {
    renderPagina();
    await caixaDeArquivadas();
    expect(document.querySelectorAll(`[${PageFillingPane.MARKER}]`)).toHaveLength(1);
    expect((await caixaDeCapacidades()).hasAttribute(PageFillingPane.MARKER)).toBe(false);
  });

  /**
   * A regra genérica veste de coluna elástica TODO ancestral do marcador. Se a
   * caixa com teto fosse ancestral da caixa do resto, ela seria vestida junto
   * — e o teto de três itens viraria letra morta.
   */
  it("a caixa com teto não é ancestral da caixa que ocupa o resto", async () => {
    renderPagina();
    expect((await caixaDeCapacidades()).contains(await caixaDeArquivadas())).toBe(false);
  });

  /** A cadeia que a regra genérica veste não pode ter grade nem linha. */
  it("nenhum ancestral entre o quadro e a caixa de arquivadas é grade ou linha", async () => {
    renderPagina();
    let atual = (await caixaDeArquivadas()).parentElement;
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

  it("em tela estreita não sobra caixa nenhuma: tudo que monta as duas é `xl:`", async () => {
    renderPagina();
    const daCaixaComTeto = (await caixaDeCapacidades()).className
      .split(/\s+/)
      .filter((classe) => classe.includes("max-h") || classe.includes("overflow-y"));
    expect(daCaixaComTeto.length).toBeGreaterThanOrEqual(2);
    for (const classe of daCaixaComTeto) expect(classe.startsWith("xl:")).toBe(true);
  });
});
