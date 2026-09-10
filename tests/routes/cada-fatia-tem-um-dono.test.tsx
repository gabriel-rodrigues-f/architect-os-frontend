import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `lideranca-nega-o-profissional.test.tsx`: `<Link>` exige RouterProvider real. */
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

import type { SessionUser } from "@/lib/api";
import { Route as CatalogPolicyRoute } from "@/routes/catalog-policy";
import { Route as EligibilityRoute } from "@/routes/eligibility";
import { Route as ScoringRulersRoute } from "@/routes/scoring-rulers";
import { Route as TextTemplatesRoute } from "@/routes/text-templates";
import { Route as VocabulariesRoute } from "@/routes/vocabularies";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureState,
  fixtureUnassignedTechLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * CADA FATIA TEM UM DONO — o gêmeo de tela das cinco rotas de configuração do
 * grupo Critérios de Progressão (dono, 2026-09-10).
 *
 * A tela única de 1390 linhas tinha TRÊS alcances dentro dela (`isLeadership`
 * na porta, `isAdmin` em cinco cartões, `canConfigureAnyTeamRules` na tabela
 * da política). Quem entrava e não alcançava um pedaço via a caixa sumir, sem
 * saber se era falta de permissão ou falta de configuração — o achado (C) do
 * inventário de alcance de 2026-09-05. Fatiada, cada rota nega por escrito.
 *
 * `tests/architecture/alcance-por-rota.test.ts` exige este arquivo como prova
 * de tela das cinco rotas restritas que nasceram aqui.
 */
const fetchMock = vi.fn();

const paginaDe = (route: { options: { component?: unknown } }) =>
  route.options.component as () => ReactNode;

const CONFIGURACAO_E_DE_QUEM_OPERA = "Esta configuração é de quem opera o sistema.";
const ELEGIBILIDADE_E_DE_QUEM_LIDERA = "A elegibilidade é regida por quem lidera um time.";

function renderAs(user: SessionUser, page: ReactNode) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
    routes: [careerLevelsRoute],
  });
  return renderWithApp(page);
}

const FATIAS_DO_SISTEMA: readonly { nome: string; pagina: () => ReactNode }[] = [
  { nome: "Réguas e limiares", pagina: paginaDe(ScoringRulersRoute) },
  { nome: "Textos", pagina: paginaDe(TextTemplatesRoute) },
  { nome: "Curadoria do Catálogo", pagina: paginaDe(CatalogPolicyRoute) },
  { nome: "Vocabulários", pagina: paginaDe(VocabulariesRoute) },
];

describe("as quatro fatias de sistema são de quem opera o sistema", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(FATIAS_DO_SISTEMA)(
    "$nome nega o tech lead sem vínculo por escrito, em vez de mostrar caixa vazia",
    async ({ pagina: Pagina }) => {
      renderAs(fixtureUnassignedTechLeadUser, <Pagina />);
      expect(await screen.findByText(CONFIGURACAO_E_DE_QUEM_OPERA)).toBeTruthy();
    },
  );

  it.each(FATIAS_DO_SISTEMA)("$nome nega o profissional", async ({ pagina: Pagina }) => {
    renderAs(fixtureMemberUser, <Pagina />);
    expect(await screen.findByText(CONFIGURACAO_E_DE_QUEM_OPERA)).toBeTruthy();
  });

  it.each(FATIAS_DO_SISTEMA)(
    "$nome negada continua se explicando — o ? está lá",
    async ({ pagina: Pagina }) => {
      renderAs(fixtureMemberUser, <Pagina />);
      await screen.findByText(CONFIGURACAO_E_DE_QUEM_OPERA);
      expect(screen.getByRole("button", { name: /como usar/i })).toBeTruthy();
    },
  );

  it.each(FATIAS_DO_SISTEMA)(
    "$nome abre para quem opera o sistema",
    async ({ nome, pagina: Pagina }) => {
      renderAs(fixtureAdminUser, <Pagina />);
      expect(await screen.findByRole("heading", { level: 1, name: nome })).toBeTruthy();
      expect(screen.queryByText(CONFIGURACAO_E_DE_QUEM_OPERA)).toBeNull();
    },
  );
});

describe("Elegibilidade é de quem rege a régua do time", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const EligibilityPage = paginaDe(EligibilityRoute);

  /**
   * O conserto que a fatia traz: até aqui o tech lead SEM VÍNCULO entrava na
   * tela e encontrava a tabela da política inteira desenhada, sem poder mexer
   * em nada e sem uma frase que dissesse por quê.
   */
  it("nega o tech lead sem vínculo por escrito", async () => {
    renderAs(fixtureUnassignedTechLeadUser, <EligibilityPage />);
    expect(await screen.findByText(ELEGIBILIDADE_E_DE_QUEM_LIDERA)).toBeTruthy();
  });

  it("nega o profissional", async () => {
    renderAs(fixtureMemberUser, <EligibilityPage />);
    expect(await screen.findByText(ELEGIBILIDADE_E_DE_QUEM_LIDERA)).toBeTruthy();
  });

  it("a tela negada continua se explicando — o ? está lá", async () => {
    renderAs(fixtureMemberUser, <EligibilityPage />);
    await screen.findByText(ELEGIBILIDADE_E_DE_QUEM_LIDERA);
    expect(screen.getByRole("button", { name: /como usar/i })).toBeTruthy();
  });

  it("abre para o gerente com vínculo", async () => {
    renderAs(fixtureAssignedManagerUser, <EligibilityPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Elegibilidade" })).toBeTruthy();
    expect(screen.queryByText(ELEGIBILIDADE_E_DE_QUEM_LIDERA)).toBeNull();
  });
});
