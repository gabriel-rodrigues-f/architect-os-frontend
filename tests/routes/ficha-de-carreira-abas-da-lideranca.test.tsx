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
 * O gêmeo de tela das ABAS da ficha de carreira — `/architects/$architectId/
 * evolution|roadmap|statement`: Evolução, Extrato e Roteiro são leituras da
 * liderança sobre a carreira de alguém (aderência à régua, relatórios —
 * ADR-0070), e o servidor as reserva a quem lidera.
 *
 * Até 2026-09-05 a Visão geral também era negada ao profissional ("eu não
 * quero que o profissional veja seus números de avaliação", 01/09). O dono
 * devolveu "Minha carreira" a ele, em leitura: a Visão geral abre sem
 * guarda, sem ação e sem IA (`a-propria-ficha-e-leitura.test.tsx`); as
 * abas continuam da liderança, e é isso que este arquivo prende.
 *
 * A guarda de navegação é CEGA À SESSÃO no SSR. A barreira que sobra é a
 * tela: ela nega, e nenhuma consulta de aba sobre "ana" sai do navegador.
 */
const fetchMock = vi.fn();

const ABAS: ReadonlyArray<readonly [string, () => ReactNode]> = [
  ["evolução", EvolutionRoute.options.component as () => ReactNode],
  ["roteiro", RoadmapRoute.options.component as () => ReactNode],
  ["extrato", StatementRoute.options.component as () => ReactNode],
];

const ABAS_DA_LIDERANCA =
  "Evolução, Extrato e Roteiro são leituras da liderança sobre a carreira de uma pessoa.";

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

describe("as abas da ficha são da liderança — a tela é a última barreira", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(ABAS)(
    "%s: member recebe a negativa e nada sobre ele sai do navegador",
    async (_nome, Page) => {
      renderAs(fixtureMemberUser, Page);
      expect(await screen.findByText(ABAS_DA_LIDERANCA)).toBeTruthy();
      expect(pediuAlgoSobre("ana")).toBe(false);
    },
  );

  it.each(ABAS)("%s: a tela negada continua se explicando — o ? está lá", async (_nome, Page) => {
    renderAs(fixtureMemberUser, Page);
    await screen.findByText(ABAS_DA_LIDERANCA);
    expect(screen.getByRole("button", { name: /como usar/i })).toBeTruthy();
  });

  it("a Visão geral da própria ficha abre para o member, sem as abas da liderança", async () => {
    renderAs(fixtureMemberUser, ProfileRoute.options.component as () => ReactNode);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.queryByText(ABAS_DA_LIDERANCA)).toBeNull();
    // O `Link` está mockado sem href, então as abas não têm papel de link: o texto basta.
    expect(screen.queryByText("Extrato")).toBeNull();
    expect(screen.queryByText("Evolução")).toBeNull();
  });

  it("admin abre a ficha de Ana com as quatro abas", async () => {
    renderAs(fixtureAdminUser, ProfileRoute.options.component as () => ReactNode);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.getByText("Extrato")).toBeTruthy();
    expect(screen.getByText("Evolução")).toBeTruthy();
  });
});
