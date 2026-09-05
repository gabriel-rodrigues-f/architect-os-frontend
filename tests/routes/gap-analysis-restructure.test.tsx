import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de dashboard-roles.test.tsx: `<Link>` exige RouterProvider real. */
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

import { Route as GapRoute } from "@/routes/gap-analysis";
import { type AppState } from "@/lib/api";
import type { Assessment, Competency } from "@/lib/domain";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { configurationRoute, contextsOf, hrefOf, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * ORIENTACAO-NONA-RODADA ENT-09-012 — a tela de Gap Analysis restructurada:
 * bloqueante (RESTRICTIVE) e oportunidade (NON_RESTRICTIVE) nunca na mesma
 * lista, e Nível III (MASTERY) nunca tratado como "gap de progressão".
 * Nenhum teste de render existia antes desta rodada.
 */

const fetchMock = vi.fn();

/**
 * R2-UX-01 — o botão de ajuda contextual (`PageHelp`) também é um trigger
 * `aria-expanded`, então `getByRole("button", { expanded: false })` sozinho
 * passou a achar dois: ele e o chip de recorte do `ArchitectFilter`. Este é
 * o único `aria-haspopup="listbox"` da tela — o de ajuda é `"dialog"`.
 */
const getArchitectFilterTrigger = (): HTMLElement =>
  screen
    .getAllByRole("button", { expanded: false })
    .find((el) => el.getAttribute("aria-haspopup") === "listbox")!;

/**
 * Competência nova, com gap RESTRITIVO para Ana em 2026-h2 — sem isto, a
 * fixture padrão não tem nenhum bloqueante. Pós-Fase 2 a obrigatoriedade vem
 * da FOTO do item (régua do time no momento da avaliação), não do catálogo.
 */
const restrictiveCompetency: Competency = {
  id: "cloud-iac",
  name: "Infra as Code",
  capabilityId: "cloud",
  active: true,
};

function withBlockingItem(assessment: Assessment): Assessment {
  if (assessment.id !== "ana-h2") return assessment;
  return {
    ...assessment,
    items: [
      ...assessment.items,
      {
        competencyId: "cloud-iac",
        self: 2,
        leader: 2,
        target: 4,
        final: 2,
        comments: [],
      },
    ],
  };
}

/** bruno-h2 vira MASTERY: já está no topo da carreira, a diferença é aprofundamento, não bloqueio de progressão. */
function asMastery(assessment: Assessment): Assessment {
  if (assessment.id !== "bruno-h2") return assessment;
  return { ...assessment, targetSemantics: "MASTERY" };
}

const state: AppState = {
  ...fixtureState,
  competencies: [...fixtureState.competencies, restrictiveCompetency],
  assessments: fixtureState.assessments.map((a) => asMastery(withBlockingItem(a))),
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const GapPage = GapRoute.options.component as () => ReactNode;

const renderGap = () => renderWithApp(<GapPage />);

describe("Prioridades de Desenvolvimento — lista única + maestria", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = hrefOf(input);
      if (String(url).endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      const fatia = contextsOf(state)(String(url));
      if (fatia) return Promise.resolve(fatia);
      const configuration = configurationRoute(String(url));
      if (configuration) return Promise.resolve(configuration);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("as prioridades saem numa lista única — sem bloqueante × oportunidade (onda 36)", async () => {
    renderGap();
    await screen.findByText("Principais Prioridades de Desenvolvimento");

    expect(screen.queryByText("Bloqueantes de progressão")).toBeNull();
    expect(screen.queryByText("Oportunidades de desenvolvimento")).toBeNull();

    const prioritiesCard = screen
      .getByText("Principais Prioridades de Desenvolvimento")
      .closest(".surface-card") as HTMLElement;
    expect(prioritiesCard.textContent).toContain("Infra as Code");
    expect(prioritiesCard.textContent).toContain("IAM");
  });

  /**
   * ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 36 (A3) — mais de uma pessoa
   * com a mesma lacuna: os nomes aparecem todos (não só o primeiro), e a
   * contagem de pessoas bate com a quantidade de nomes únicos.
   */
  it("mostra todos os nomes quando mais de uma pessoa tem a mesma lacuna", async () => {
    const carlaState: AppState = {
      ...state,
      architects: [
        ...state.architects,
        {
          id: "carla",
          name: "Carla Souza",
          role: "Pleno",
          yearsAsArchitect: 5,
          specialization: "Dados",
          email: "carla@company.com",
          active: true,
          version: 1,
        },
      ],
      assessments: [
        ...state.assessments,
        {
          id: "carla-h2",
          architectId: "carla",
          cycleId: "2026-h2",
          status: "Completed",
          modelVersion: 1,
          targetCareerLevelId: null,
          targetSemantics: null,
          version: 1,
          items: [
            { competencyId: "security-iam", self: 2, leader: 2, target: 3, final: 2, comments: [] },
          ],
        },
      ],
    };
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = hrefOf(input);
      if (String(url).endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      const fatia = contextsOf(carlaState)(String(url));
      if (fatia) return Promise.resolve(fatia);
      const configuration = configurationRoute(String(url));
      if (configuration) return Promise.resolve(configuration);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    renderGap();
    await screen.findByText("Principais Prioridades de Desenvolvimento");

    const prioritiesCard = screen
      .getByText("Principais Prioridades de Desenvolvimento")
      .closest(".surface-card") as HTMLElement;
    // IAM tem gap para Ana e Carla (2 pessoas) — os dois nomes aparecem, não só o primeiro.
    const iamItem = within(prioritiesCard).getByText("IAM").closest("li") as HTMLElement;
    expect(within(iamItem).getByText(/Ana Martins, Carla Souza/)).toBeTruthy();
    expect(within(iamItem).getByText(/2 pessoa\(s\)/)).toBeTruthy();
  });

  it("o radar inclui uma coluna de cobertura na tabela equivalente acessível", async () => {
    renderGap();
    await screen.findByText("Radar de Capacidades");
    expect(screen.getByRole("columnheader", { name: "Cobertura" })).toBeTruthy();
  });

  /**
   * B-12 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1) — trocar o
   * recorte de arquitetos escreve na URL (não só em memória), para que F5 e
   * links copiados preservem o filtro em vez de sempre voltar ao time
   * inteiro.
   */
  it("trocar a seleção no filtro escreve o recorte na URL", async () => {
    renderGap();
    await screen.findByText("Radar de Capacidades");

    // Time inteiro nasce selecionado — desmarcar Bruno deixa só Ana.
    await userEvent.click(getArchitectFilterTrigger());
    await userEvent.click(screen.getByRole("option", { name: "Bruno Almeida" }));

    expect(window.location.search).toBe("?selected=ana");
  });

  it("abrir a tela com ?selected= na URL respeita o recorte, sem cair no time inteiro", async () => {
    window.history.replaceState(null, "", "/gap-analysis?selected=bruno");
    renderGap();
    await screen.findByText("Radar de Capacidades");

    const scopeChip = getArchitectFilterTrigger();
    expect(scopeChip.textContent).toContain("Bruno Almeida");
    expect(scopeChip.textContent).not.toContain("Todo o time");
  });

  /**
   * R2-ESC-05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `scopeLabel` alimenta
   * `t()`/PDF como string simples; acima de 3 pessoas selecionadas (e sem
   * ser o time inteiro) vira contagem, não a lista de primeiros nomes
   * crescendo sem teto.
   */
  it("scopeLabel vira contagem acima de 3 pessoas selecionadas, sem ser o time inteiro", async () => {
    const seisArquitetos: AppState = {
      ...state,
      architects: [
        ...state.architects,
        { ...state.architects[0]!, id: "c1", name: "C1", email: "c1@x.com" },
        { ...state.architects[0]!, id: "c2", name: "C2", email: "c2@x.com" },
        { ...state.architects[0]!, id: "c3", name: "C3", email: "c3@x.com" },
        { ...state.architects[0]!, id: "c4", name: "C4", email: "c4@x.com" },
      ],
    };
    fetchMock.mockImplementation((input: string | URL | Request) => {
      const url = hrefOf(input);
      if (String(url).endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      const fatia = contextsOf(seisArquitetos)(String(url));
      if (fatia) return Promise.resolve(fatia);
      const configuration = configurationRoute(String(url));
      if (configuration) return Promise.resolve(configuration);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    // 5 de 6 arquitetos — mais de 3, mas não o time inteiro.
    window.history.replaceState(null, "", "/gap-analysis?selected=ana,bruno,c1,c2,c3");
    renderGap();

    expect(await screen.findByText(/5 pessoas selecionadas/)).toBeTruthy();
  });
});
