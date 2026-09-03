import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import { Route as RoadmapRoute } from "@/routes/architects.$architectId.roadmap";
import type { AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureCareerLevels, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * O backend devolve `adherence.percentage` como RAZÃO 0–1
 * (`adherence-policy.ts`: `attained / totalWeight`), e a tela exibia esse
 * número cru com um "%" colado. Toda aderência real caía em "0%" ou "1%":
 * duas situações OPOSTAS da mesma pessoa — o nível que ela já ocupa e o
 * próximo — davam o MESMO 1%, e um número que não distingue situações
 * opostas não informa nada.
 *
 * O invariante desta rede é a DISCRIMINAÇÃO: razões diferentes têm de virar
 * porcentagens diferentes na tela. O segundo número do CONTRATO ("quantas
 * competências estão abaixo do exigido") continua junto — nunca um só (onda 36:
 * a obrigatoriedade morreu, toda competência da régua conta).
 */
const fetchMock = vi.fn();

const RoadmapPage = RoadmapRoute.options.component as () => ReactNode;

function nomeDoNivel(id: string): string {
  const nivel = fixtureCareerLevels.find((candidato) => candidato.id === id);
  if (!nivel) throw new Error(`Fixture sem o nível ${id}`);
  return nivel.name;
}

const NIVEL_ATUAL = "arquiteto-de-solucoes-ii";
const PROXIMO_NIVEL = "arquiteto-de-solucoes-iii";
const NOME_ATUAL = nomeDoNivel(NIVEL_ATUAL);
const NOME_PROXIMO = nomeDoNivel(PROXIMO_NIVEL);

const anaNoNivelDois: AppState = {
  ...fixtureState,
  architects: fixtureState.architects.map((architect) =>
    architect.id === "ana" ? { ...architect, careerLevelId: NIVEL_ATUAL } : architect,
  ),
};

/**
 * Quase pronta no nível que ocupa (0,93) e a meio caminho do próximo (0,58):
 * situações opostas que, lidas como se já fossem porcentagem, colapsam
 * ambas em "1%" — o número que o PO mediu.
 */
const aderenciaRoute =
  (porNivel: Record<string, { percentage: number; missingCompetencies: number }>): FetchRoute =>
  (href) => {
    if (!href.includes(apiPath("/architects/ana/adherence"))) return undefined;
    const careerLevelId = new URL(href, "http://localhost").searchParams.get("careerLevelId") ?? "";
    const resposta = porNivel[careerLevelId];
    if (!resposta) return undefined;
    return jsonResponse({
      architectId: "ana",
      teamId: "time-plataforma",
      careerLevelId,
      adherence: {
        percentage: resposta.percentage,
        missingCompetencies: Array.from({ length: resposta.missingCompetencies }, (_, ordem) => ({
          competencyId: `abaixo-${ordem}`,
          currentLevel: 1,
          requiredLevel: 4,
        })),
      },
    });
  };

const opostas = aderenciaRoute({
  [NIVEL_ATUAL]: { percentage: 0.9348717948717951, missingCompetencies: 1 },
  [PROXIMO_NIVEL]: { percentage: 0.5833333333333333, missingCompetencies: 7 },
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Roteiro — a aderência discrimina situações opostas", () => {
  it("converte a razão do backend em porcentagem legível", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: anaNoNivelDois,
      routes: [careerLevelsRoute, opostas],
    });
    renderWithApp(<RoadmapPage />);

    expect(await screen.findByText("93%")).toBeTruthy();
    expect(await screen.findByText("58%")).toBeTruthy();
  });

  it("nível atual e próximo nível NÃO exibem o mesmo número", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: anaNoNivelDois,
      routes: [careerLevelsRoute, opostas],
    });
    renderWithApp(<RoadmapPage />);

    const atual = (await screen.findByText(`Nível atual · ${NOME_ATUAL}`)).closest("div")!;
    const proximo = (await screen.findByText(`Próximo nível · ${NOME_PROXIMO}`)).closest("div")!;
    const percentualDe = (cartao: HTMLElement) => cartao.textContent?.match(/(\d+)%/)?.[1];

    expect(percentualDe(atual)).not.toBe(percentualDe(proximo));
  });

  it("mantém os DOIS números do CONTRATO — porcentagem e competências abaixo do exigido", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: anaNoNivelDois,
      routes: [careerLevelsRoute, opostas],
    });
    renderWithApp(<RoadmapPage />);

    expect(await screen.findByText("1 competência abaixo do exigido")).toBeTruthy();
    expect(await screen.findByText("7 competências abaixo do exigido")).toBeTruthy();
  });

  it("aderência plena vira 100%, não 1%", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: anaNoNivelDois,
      routes: [
        careerLevelsRoute,
        aderenciaRoute({
          [NIVEL_ATUAL]: { percentage: 1, missingCompetencies: 0 },
          [PROXIMO_NIVEL]: { percentage: 0, missingCompetencies: 9 },
        }),
      ],
    });
    renderWithApp(<RoadmapPage />);

    expect(await screen.findByText("100%")).toBeTruthy();
    expect(await screen.findByText("0%")).toBeTruthy();
  });
});
