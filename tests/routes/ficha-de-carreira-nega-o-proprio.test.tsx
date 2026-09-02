import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão de `architect-profile-fora-do-escopo.test.tsx`: as quatro
 * telas leem `Route.useParams()`, que só existe dentro de uma árvore de
 * rotas montada. O parâmetro é fixado em "ana" — o arquiteto DA SESSÃO do
 * member, que é exatamente o caso que o dono fechou.
 */
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
    useRouter: () => ({ history: { push: vi.fn() } }),
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import type { SessionUser } from "@/lib/api";
import { Route as EvolutionRoute } from "@/routes/architects.$architectId.evolution";
import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import { Route as RoadmapRoute } from "@/routes/architects.$architectId.roadmap";
import { Route as StatementRoute } from "@/routes/architects.$architectId.statement";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * O gêmeo de tela da ficha de carreira — as quatro rotas
 * `/architects/$architectId/*` — para o caso que o dono fechou (2026-09-01):
 * "eu não quero que o profissional veja seus números de avaliação. isso pode
 * influenciá-lo negativamente".
 *
 * A guarda de navegação devolve o member ao painel, mas ela é CEGA À SESSÃO
 * no SSR. A barreira que sobra é a tela: ela nega, e nenhuma consulta sobre
 * "ana" sai do navegador — nem aderência, nem evolução, nem transições.
 *
 * A ficha de OUTRA pessoa não é assunto desta guarda: o recorte do servidor
 * já a nega como "não encontrado" (`architect-profile-fora-do-escopo`), e o
 * último caso abaixo fixa que a porta continua sendo essa.
 */
const fetchMock = vi.fn();

const TELAS: ReadonlyArray<readonly [string, () => ReactNode]> = [
  ["perfil", ProfileRoute.options.component as () => ReactNode],
  ["evolução", EvolutionRoute.options.component as () => ReactNode],
  ["roteiro", RoadmapRoute.options.component as () => ReactNode],
  ["extrato", StatementRoute.options.component as () => ReactNode],
];

const FICHA_LIDA_PELA_LIDERANCA = "A sua ficha de carreira é lida por quem lidera você.";

function pediuAlgoSobre(architectId: string): boolean {
  return fetchMock.mock.calls.some(([entrada]) =>
    String(entrada instanceof Request ? entrada.url : entrada).includes(
      `/architects/${architectId}/`,
    ),
  );
}

function renderAs(user: SessionUser, Page: () => ReactNode) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
    routes: [careerLevelsRoute],
  });
  return renderWithApp(<Page />);
}

describe("a ficha de carreira nega o próprio profissional — a tela é a última barreira", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(TELAS)(
    "%s: member recebe a negativa e nada sobre ele sai do navegador",
    async (_nome, Page) => {
      renderAs(fixtureMemberUser, Page);
      expect(await screen.findByText(FICHA_LIDA_PELA_LIDERANCA)).toBeTruthy();
      expect(screen.queryByText("Nível médio")).toBeNull();
      expect(pediuAlgoSobre("ana")).toBe(false);
    },
  );

  it.each(TELAS)("%s: a tela negada continua se explicando — o ? está lá", async (_nome, Page) => {
    renderAs(fixtureMemberUser, Page);
    await screen.findByText(FICHA_LIDA_PELA_LIDERANCA);
    expect(screen.getByRole("button", { name: /como usar/i })).toBeTruthy();
  });

  it("admin abre a ficha de Ana, com os números que o profissional não vê", async () => {
    renderAs(fixtureAdminUser, ProfileRoute.options.component as () => ReactNode);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.getByText("Nível médio")).toBeTruthy();
    expect(screen.queryByText(FICHA_LIDA_PELA_LIDERANCA)).toBeNull();
  });

  it("member em ficha de OUTRA pessoa passa pela guarda e cai no 'não encontrado' do recorte", async () => {
    renderAs(
      { ...fixtureMemberUser, architectId: "bruno" },
      ProfileRoute.options.component as () => ReactNode,
    );
    expect(await screen.findByText("Profissional não encontrado.")).toBeTruthy();
    expect(screen.queryByText(FICHA_LIDA_PELA_LIDERANCA)).toBeNull();
  });
});
