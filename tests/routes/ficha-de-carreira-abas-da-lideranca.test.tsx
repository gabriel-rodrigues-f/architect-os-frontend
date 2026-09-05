import { cleanup, screen, waitFor } from "@testing-library/react";
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
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { apiPath } from "@/lib/api-path";
import {
  careerLevelsRoute,
  type FetchRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";

/**
 * O gêmeo de tela das ABAS da ficha de carreira — `/architects/$architectId/
 * evolution|roadmap|statement`.
 *
 * D2 (dono, 2026-09-05): a pessoa vê tudo o que é dela — radar, distâncias,
 * evolução, extrato. Até então as abas eram "leituras da liderança" e a tela
 * negava ao profissional a PRÓPRIA ficha (o dono tinha tirado dele os
 * próprios números em 01/09). A decisão foi invertida: Evolução, Extrato e
 * Roteiro da própria ficha abrem para o member, em leitura, e as consultas
 * sobre "ana" saem do navegador. Este arquivo prende a decisão nova.
 *
 * A guarda de navegação é CEGA À SESSÃO no SSR; a tela é quem decide, e ela
 * decide pela política (`canOpenCareerTabsOf` próprio = true).
 */
const fetchMock = vi.fn();

const ABAS: ReadonlyArray<readonly [string, () => ReactNode]> = [
  ["evolução", EvolutionRoute.options.component as () => ReactNode],
  ["roteiro", RoadmapRoute.options.component as () => ReactNode],
  ["extrato", StatementRoute.options.component as () => ReactNode],
];

const ABAS_DA_LIDERANCA =
  "Evolução, Extrato e Roteiro são leituras da liderança sobre a carreira de uma pessoa.";

/** Uma consulta de aba sobre a pessoa — pelo caminho (`/architects/ana/...`) ou pelo corpo (`architectId: "ana"`). */
function pediuAlgoSobre(architectId: string): boolean {
  return fetchMock.mock.calls.some(([entrada, init]) => {
    const href = String(entrada instanceof Request ? entrada.url : entrada);
    if (href.endsWith(apiPath("/auth/me")) || href.includes("/state")) return false;
    const corpo = String((init as RequestInit | undefined)?.body ?? "");
    return (
      href.includes(`/architects/${architectId}/`) ||
      corpo.includes(`"architectId":"${architectId}"`)
    );
  });
}

/** O mínimo que as abas pedem ao servidor sobre "ana" — vazio, mas na forma certa. */
const evolutionVazia = {
  architect: { id: "ana", name: "Ana Martins", role: "Pleno", careerLevelName: null },
  summary: {
    coverage: { covered: 0, total: 0 },
    initialAverage: null,
    currentAverage: null,
    averageDelta: null,
    mentoringCount: 0,
    assessmentCount: 0,
  },
  capabilitySeries: [],
  competencySeries: [],
  events: [],
  snapshots: [],
  comparisons: [],
};

const rotasDasAbas: FetchRoute[] = [
  careerLevelsRoute,
  (href, init) =>
    href.endsWith(apiPath("/evolution/architect")) && init?.method === "POST"
      ? jsonResponse(evolutionVazia)
      : undefined,
  (href) =>
    href.endsWith(apiPath("/architects/ana/career-level-transitions"))
      ? jsonResponse([])
      : undefined,
  (href, init) =>
    href.endsWith(apiPath("/reports/career-statement")) && init?.method === "POST"
      ? jsonResponse({
          architect: { id: "ana", name: "Ana Martins", role: "Pleno" },
          range: { from: "2000-01-01", to: "2026-12-31" },
          kinds: ["teamTransition"],
          totals: { teamTransition: 0 },
          entries: [],
        })
      : undefined,
];

function renderAs(user: SessionUser, Page: () => ReactNode) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAssignedManagerUser ? fixtureState : scopedFixtureStateFor(user),
    routes: rotasDasAbas,
  });
  return renderWithApp(<Page />);
}

describe("as abas da própria ficha são do profissional (D2, dono, 2026-09-05)", () => {
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
    "D2 (dono, 2026-09-05) — %s: o member abre a aba da própria ficha, com o nome dele na tela e sem a negativa",
    async (_nome, Page) => {
      renderAs(fixtureMemberUser, Page);
      expect((await screen.findAllByText(/Ana Martins/)).length).toBeGreaterThan(0);
      expect(screen.queryByText(ABAS_DA_LIDERANCA)).toBeNull();
    },
  );

  // O Roteiro só consulta o servidor quando a pessoa tem nível de carreira
  // (a Ana da fixture não tem); Evolução e Extrato pedem sempre.
  it.each([ABAS[0]!, ABAS[2]!])(
    "D2 (dono, 2026-09-05) — %s: a consulta sobre o próprio member sai do navegador",
    async (_nome, Page) => {
      renderAs(fixtureMemberUser, Page);
      await waitFor(() => expect(pediuAlgoSobre("ana")).toBe(true));
    },
  );

  it.each(ABAS)("%s: a tela aberta continua se explicando — o ? está lá", async (_nome, Page) => {
    renderAs(fixtureMemberUser, Page);
    expect(await screen.findByRole("button", { name: /como usar/i })).toBeTruthy();
    expect(screen.queryByText(ABAS_DA_LIDERANCA)).toBeNull();
  });

  it("D2 (dono, 2026-09-05) — a Visão geral da própria ficha abre para o member com as abas Evolução e Extrato", async () => {
    renderAs(fixtureMemberUser, ProfileRoute.options.component as () => ReactNode);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.queryByText(ABAS_DA_LIDERANCA)).toBeNull();
    // O `Link` está mockado sem href, então as abas não têm papel de link: o texto basta.
    expect(screen.getByText("Extrato")).toBeTruthy();
    expect(screen.getByText("Evolução")).toBeTruthy();
  });

  it("gerente vinculado abre a ficha de Ana com as quatro abas", async () => {
    renderAs(fixtureAssignedManagerUser, ProfileRoute.options.component as () => ReactNode);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.getByText("Extrato")).toBeTruthy();
    expect(screen.getByText("Evolução")).toBeTruthy();
  });
});
