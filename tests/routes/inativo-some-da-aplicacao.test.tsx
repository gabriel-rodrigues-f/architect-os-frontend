import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `estrangulamento-team.test.tsx`: `<Link>` exige RouterProvider real. */
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

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { Route as CompareRoute } from "@/routes/compare";
import { Route as GapAnalysisRoute } from "@/routes/gap-analysis";
import { Route as LearningPathsRoute } from "@/routes/learning-paths";
import { Route as MentoringRoute } from "@/routes/mentoring";
import { Route as TeamRoute } from "@/routes/team";
import type { AppState } from "@/lib/api";
import type { Architect } from "@/lib/domain";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  emptyEligibilityRoute,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";

/**
 * FATIA `inativo-some` — pedido literal do dono (2026-09-03), com a captura do
 * seletor de Avaliações mostrando "Raquel Marangoni (inativo)":
 *
 *   "quando eu desativar um profissional, ao invés de aparecer como inativo,
 *    ele não deve mais aparecer em nenhuma parte da aplicação."
 *
 * A régua: TODO lugar que lista, seleciona, desenha ou conta pessoas vê só
 * quem está ativo. A ÚNICA exceção, declarada ao dono, é a tela `/team` com o
 * filtro de status — hoje é o único lugar onde o administrador reencontra
 * quem desativou; sem ela a desativação seria irreversível pela interface.
 *
 * O ponto único é o store: `store.architects` passou a ser a lista ATIVA e o
 * acesso ao cru ficou NOMEADO (`store.architectsIncludingInactive`), usado só
 * por `/team`. Por isso estes testes exercitam TELAS, não o filtro: é a tela
 * que o dono viu errada.
 */

const fetchMock = vi.fn();

const raquel: Architect = {
  id: "raquel",
  name: "Raquel Marangoni",
  role: "Pleno",
  yearsAsArchitect: 5,
  specialization: "",
  email: "raquel@company.com",
  active: false,
  version: 1,
};

/**
 * A trilha da fixture ganha Raquel entre os atribuídos: é justamente o caso
 * que a régua antiga preservava ("ativos MAIS quem já está atribuído, mesmo
 * inativo") e que o pedido do dono derruba.
 */
const comInativa: AppState = {
  ...fixtureState,
  architects: [...fixtureState.architects, raquel],
  learningPaths: fixtureState.learningPaths.map((path) => ({
    ...path,
    assignedTo: [...path.assignedTo, raquel.id],
  })),
};

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;
const ComparePage = CompareRoute.options.component as () => ReactNode;
const GapAnalysisPage = GapAnalysisRoute.options.component as () => ReactNode;
const LearningPathsPage = LearningPathsRoute.options.component as () => ReactNode;
const MentoringPage = MentoringRoute.options.component as () => ReactNode;
const TeamPage = TeamRoute.options.component as () => ReactNode;

/** Nomes das opções abertas, seja `cmdk` (Command) ou o `listbox` do ArchitectFilter. */
const nomesDasOpcoes = (): string[] =>
  screen.getAllByRole("option").map((opcao) => opcao.textContent?.trim() ?? "");

/**
 * O `?` do PageHelp também é um trigger com `aria-expanded`; o filtro de
 * pessoas é o único `aria-haspopup="listbox"` da tela (mesma sonda de
 * `gap-analysis-restructure.test.tsx`).
 */
const gatilhoDoFiltroDePessoas = (): HTMLElement =>
  screen
    .getAllByRole("button", { expanded: false })
    .find((el) => el.getAttribute("aria-haspopup") === "listbox")!;

describe("profissional desativado some da aplicação", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: comInativa,
      routes: [emptyAuthUsersRoute, careerLevelsRoute, emptyEligibilityRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Avaliações: o seletor de profissional não oferece quem está desativado — o caso da captura do dono", async () => {
    renderWithApp(<AssessmentsPage />);

    await userEvent.click(await screen.findByRole("combobox", { name: "Profissional" }));

    const nomes = nomesDasOpcoes();
    expect(nomes).toContain("Bruno Almeida");
    expect(nomes).not.toContain("Raquel Marangoni");
    expect(nomes).not.toContain("Raquel Marangoni (inativo)");
  });

  it("Mentoria: o filtro de mentorado não oferece quem está desativado", async () => {
    renderWithApp(<MentoringPage />);

    await userEvent.click(await screen.findByRole("combobox", { name: "Filtrar mentorado" }));

    const nomes = nomesDasOpcoes();
    expect(nomes).toContain("Bruno Almeida");
    expect(nomes).not.toContain("Raquel Marangoni");
    expect(nomes).not.toContain("Raquel Marangoni (inativo)");
  });

  it("Comparativo: a lista de pessoas para comparar não oferece quem está desativado", async () => {
    renderWithApp(<ComparePage />);

    await screen.findByText("Comparativo de Profissionais");
    await userEvent.click(gatilhoDoFiltroDePessoas());

    const nomes = nomesDasOpcoes();
    expect(nomes).toContain("Ana Martins");
    expect(nomes).not.toContain("Raquel Marangoni");
  });

  it("Trilhas: a nova trilha não oferece quem está desativado para atribuição", async () => {
    renderWithApp(<LearningPathsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova trilha" }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Ana Martins")).toBeTruthy();
    expect(within(dialogo).queryByText("Raquel Marangoni")).toBeNull();
  });

  it("Trilhas: editar uma trilha não reoferece o desativado que já estava atribuído", async () => {
    renderWithApp(<LearningPathsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Ana Martins")).toBeTruthy();
    expect(within(dialogo).queryByText("Raquel Marangoni")).toBeNull();
  });

  it("Competências em evolução: com um inativo no payload, o recorte padrão continua sendo todo o time", async () => {
    renderWithApp(<GapAnalysisPage />);

    expect(await screen.findByText(/todo o time/)).toBeTruthy();
  });

  it("Time: o filtro 'Inativos' continua mostrando quem foi desativado — a exceção declarada", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByLabelText("Status"));
    await userEvent.click(await screen.findByRole("option", { name: "Inativos" }));
    await userEvent.keyboard("{Escape}");

    expect(await screen.findByText("Raquel Marangoni")).toBeTruthy();
  });
});
