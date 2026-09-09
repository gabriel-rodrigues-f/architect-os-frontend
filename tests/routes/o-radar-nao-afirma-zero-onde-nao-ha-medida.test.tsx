import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `painel-do-profissional-sem-numeros.test.tsx`: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { useGapAnalysisData } from "@/components/app/gap-analysis-shared";
import type { AppState } from "@/lib/api";
import { ContextScope, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { Route as DashboardRoute } from "@/routes/index";
import { fixtureMemberUser, fixtureState, scopedFixtureStateFor } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * OS DOIS ÚLTIMOS `?? 0` DO RADAR (dono, 2026-09-09).
 *
 * *"Ele não deveria gerar essa ponta assim, deveria conectar os pontos no
 * espaço já ocupado"*. A ponta não era desenho: capacidade sem média virava
 * zero, zero é o CENTRO do radar, e a aresta entre duas capacidades medidas
 * passava por lá — atravessando o próprio polígono. Pior que o desenho: a
 * tela AFIRMAVA "tem zero nesta capacidade" onde o certo é "não há medida".
 *
 * O Comparativo e a ficha já tinham sido corrigidos com `RadarRows`. Sobravam
 * dois lugares com o mesmo defeito, e são os dois que este arquivo prova:
 * o radar do próprio profissional no Painel e o radar de time na Análise de
 * Lacunas.
 *
 * A massa: a fixture tem duas capacidades (Cloud Architecture e Security) e
 * as avaliações medem as duas. Aqui a medida de Security é retirada de TODAS
 * as avaliações — ninguém tem média nessa capacidade, que é exatamente o caso
 * em que o `?? 0` desenhava um eixo em cima do centro. Nasceu vermelho: as
 * duas telas listavam "Security 0 0".
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

/** Nenhuma pessoa do time tem medida em Security — a capacidade fica sem média. */
function semMedidaDeSeguranca(state: AppState): AppState {
  return {
    ...state,
    assessments: state.assessments.map((assessment) => ({
      ...assessment,
      items: assessment.items.filter((item) => item.competencyId !== "security-iam"),
    })),
  };
}

const RADAR_TABLE = "Radar de nível atual versus esperado, por capacidade.";

function linhasDaTabela(tabela: HTMLElement): (string | null)[][] {
  return within(tabela)
    .getAllByRole("row")
    .slice(1)
    .map((linha) =>
      within(linha)
        .getAllByRole("cell")
        .map((celula) => celula.textContent),
    );
}

type GapAnalysisData = ReturnType<typeof useGapAnalysisData>;

const leituras: GapAnalysisData[] = [];

function SondaDeLacunas() {
  leituras.push(useGapAnalysisData());
  return null;
}

describe("o radar não afirma zero onde não há medida", () => {
  beforeEach(() => {
    leituras.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("no Painel do profissional, a capacidade sem média sai do radar em vez de ir ao centro", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: scopedFixtureStateFor(fixtureMemberUser, semMedidaDeSeguranca(fixtureState)),
    });
    renderWithApp(<DashboardPage />);

    await screen.findByText("Meu radar de capacidades");
    const tabela = await screen.findByRole("table", { name: RADAR_TABLE });

    expect(linhasDaTabela(tabela)).toEqual([["Cloud Architecture", "4", "4"]]);
  });

  it("na Análise de Lacunas, o time sem ninguém medido não vira um zero de time", async () => {
    mockAppFetch(fetchMock, { state: semMedidaDeSeguranca(fixtureState) });
    renderWithApp(
      <ContextScope contexts={SELECTOR_CONTEXTS}>
        <SondaDeLacunas />
      </ContextScope>,
    );

    await vi.waitFor(() => {
      expect(leituras.at(-1)?.professionals.map((pessoa) => pessoa.id)).toEqual(["ana", "bruno"]);
    });

    expect(leituras.at(-1)?.radar).toEqual([
      { capability: "Cloud Architecture", atual: 3.25, alvo: 3.5, covered: 2, total: 2 },
    ]);
  });

  it("a nota de cobertura continua contando a capacidade que saiu do radar", async () => {
    mockAppFetch(fetchMock, { state: semMedidaDeSeguranca(fixtureState) });
    renderWithApp(
      <ContextScope contexts={SELECTOR_CONTEXTS}>
        <SondaDeLacunas />
      </ContextScope>,
    );

    await vi.waitFor(() => {
      expect(leituras.at(-1)?.professionals.map((pessoa) => pessoa.id)).toEqual(["ana", "bruno"]);
    });

    // O eixo sai do desenho, mas a frase embaixo do radar é justamente quem
    // avisa que existe capacidade sem ninguém medido: 0 de 2 pessoas.
    expect(leituras.at(-1)?.radarCoverage.covered).toBe(0);
    expect(leituras.at(-1)?.radarCoverage.total).toBe(2);
  });
});
