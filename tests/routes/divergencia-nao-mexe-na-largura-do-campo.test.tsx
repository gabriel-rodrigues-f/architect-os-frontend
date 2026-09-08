import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import {
  emptyEligibilityRoute,
  mockAppFetch,
  renderWithApp,
  stubNarrowViewport,
} from "../helpers/render-app";

/**
 * Item 4 do lote do dono (2026-09-08), Avaliação de Desempenho: *"o triângulo
 * não pode mudar a largura do campo"*. O campo da nota do líder era `w-full`
 * e dividia a célula com o ícone: a linha que DIVERGE ficava com o seletor
 * mais estreito do que a linha que não diverge, e a coluna inteira balançava
 * conforme o dado. Agora o campo tem largura fixa e o ícone mora num espaço
 * reservado à direita — que existe mesmo quando não há divergência.
 *
 * E o triângulo passa a EXPLICAR do que se trata: `Tooltip` da casa, com
 * gatilho focalizável ([F-02] — `title=` nativo não abre no toque nem por
 * teclado).
 *
 * A sonda é a fixture: "Serverless" diverge (self 4 · líder 3) e
 * "Kubernetes" não (4 · 4).
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const DIVERGE = "Serverless";
const NAO_DIVERGE = "Kubernetes";

async function blocoDe(competencia: string): Promise<HTMLElement> {
  const nome = await screen.findByText(competencia);
  return (nome.closest("tr") ??
    nome.closest("[data-testid='competency-stacked-card']")) as HTMLElement;
}

const campoDaNotaDoLider = (bloco: HTMLElement) =>
  bloco.querySelector("[data-leader-score]") as HTMLElement;

describe("Avaliação de Desempenho — o triângulo não mexe na largura do campo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: fixtureState,
      routes: [emptyEligibilityRoute],
    });
    renderWithApp(<AssessmentsPage />);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a linha que diverge e a que não divergem têm o campo do MESMO tamanho", async () => {
    const comTriangulo = campoDaNotaDoLider(await blocoDe(DIVERGE));
    const semTriangulo = campoDaNotaDoLider(await blocoDe(NAO_DIVERGE));

    expect(comTriangulo.className).toBe(semTriangulo.className);
  });

  it("a largura é fixa — não é 'a que sobrar' depois do ícone", async () => {
    const campo = campoDaNotaDoLider(await blocoDe(DIVERGE));

    expect(campo.className).toMatch(/\bw-\d/);
    expect(campo.className).not.toContain("w-full");
  });

  it("o espaço do ícone existe nas duas linhas — entrar não empurra nada", async () => {
    for (const competencia of [DIVERGE, NAO_DIVERGE]) {
      const bloco = await blocoDe(competencia);
      expect(bloco.querySelector("[data-divergence-slot]")).not.toBeNull();
    }
  });

  it("o triângulo é um gatilho alcançável por teclado, e só na linha que diverge", async () => {
    const queDiverge = within(await blocoDe(DIVERGE));
    const queNaoDiverge = within(await blocoDe(NAO_DIVERGE));

    expect(queDiverge.getByRole("button", { name: "Autoavaliação e Líder divergem" })).toBeTruthy();
    expect(
      queNaoDiverge.queryByRole("button", { name: "Autoavaliação e Líder divergem" }),
    ).toBeNull();
  });

  it("o gatilho diz do que se trata, e não só que existe", async () => {
    const bloco = await blocoDe(DIVERGE);

    expect(bloco.textContent).toContain("A nota do líder é diferente da autoavaliação");
  });
});

describe("no bloco empilhado, o campo do líder é o mesmo componente", () => {
  let restoreViewport: () => void = () => {};

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    restoreViewport = stubNarrowViewport(true);
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: fixtureState,
      routes: [emptyEligibilityRoute],
    });
    renderWithApp(<AssessmentsPage />);
  });

  afterEach(() => {
    restoreViewport();
    restoreViewport = () => {};
    cleanup();
    vi.unstubAllGlobals();
  });

  it("largura fixa, espaço reservado do ícone e gatilho com explicação", async () => {
    const bloco = await blocoDe(DIVERGE);

    expect(campoDaNotaDoLider(bloco).className).toMatch(/\bw-\d/);
    expect(bloco.querySelector("[data-divergence-slot]")).not.toBeNull();
    expect(
      within(bloco).getByRole("button", { name: "Autoavaliação e Líder divergem" }),
    ).toBeTruthy();
  });
});
