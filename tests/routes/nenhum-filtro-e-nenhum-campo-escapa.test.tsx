import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
    Link: ({
      children,
      to,
      params: _params,
      search,
      ...rest
    }: ComponentProps<"a"> & {
      to?: string;
      params?: unknown;
      search?: Record<string, string> | undefined;
    }) => (
      <a href={search ? `${to ?? ""}?${new URLSearchParams(search).toString()}` : to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { Route as LearningPathsRoute } from "@/routes/learning-paths";
import type { AppState } from "@/lib/api";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  emptyEligibilityRoute,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";

/**
 * NENHUM FILTRO ESCAPA, E NENHUM CAMPO DE DIÁLOGO FICA MUDO — itens 1 e 2 do
 * dono (2026-09-08).
 *
 * Item 1: *"o filtro de CAPACIDADES sem capacidades cadastradas precisa ficar
 * bloqueado, exatamente como o de profissionais"*. Ele escapou porque não é
 * o seletor da casa: é uma combobox própria, e abria um painel de nada.
 *
 * Item 2: o campo "Competências" do diálogo de trilha dizia só "Nenhuma
 * competência encontrada." e não levava a lugar nenhum. Passa a convidar
 * pelo MESMO componente do campo "Atribuída a" — e a REGRA DE DOMÍNIO decide
 * o convite: competência nasce dentro de uma capacidade.
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;
const LearningPathsPage = LearningPathsRoute.options.component as () => ReactNode;

const bancoVazio: AppState = {
  ...fixtureState,
  capabilities: [],
  competencies: [],
  teamLevelRules: [],
  professionals: [],
  assessments: [],
  cycles: [],
  plans: [],
  learningPaths: [],
  mentoringSessions: [],
  evidences: [],
  activeCycleId: "",
};

const comBanco = (state: AppState) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    state,
    routes: [emptyAuthUsersRoute, careerLevelsRoute, emptyEligibilityRoute],
  });
};

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.setItem("synapse:locale", "pt");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Avaliação de Desempenho: o filtro de capacidades fica bloqueado como o de pessoas", () => {
  it("sem capacidade cadastrada, o gatilho diz a frase do assunto e não abre nada", async () => {
    comBanco(bancoVazio);
    renderWithApp(<AssessmentsPage />);

    const capacidades = await screen.findByRole("button", { name: "Capacidades" });
    expect(capacidades.textContent).toContain("Nenhuma capacidade cadastrada");
    expect(capacidades.hasAttribute("disabled")).toBe(true);

    await userEvent.click(capacidades);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Selecionar todas")).toBeNull();
  });

  it("é exatamente o que o filtro de profissionais já fazia — os dois bloqueados", async () => {
    comBanco(bancoVazio);
    renderWithApp(<AssessmentsPage />);

    const profissional = await screen.findByRole("button", { name: "Profissional" });
    const capacidades = screen.getByRole("button", { name: "Capacidades" });
    expect(profissional.hasAttribute("disabled")).toBe(true);
    expect(capacidades.hasAttribute("disabled")).toBe(true);
  });

  it("com capacidades cadastradas, o filtro é o de sempre e abre a lista", async () => {
    comBanco({ ...bancoVazio, capabilities: fixtureState.capabilities });
    renderWithApp(<AssessmentsPage />);

    /*
     * Com opções, o gatilho é uma COMBOBOX (`role="combobox"`); bloqueado, é
     * um `button` desabilitado. A diferença de papel é a prova de que o
     * bloqueio não é cosmético: não há lista a abrir.
     */
    const capacidades = await screen.findByRole("combobox", { name: "Capacidades" });
    expect(capacidades.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByRole("button", { name: "Capacidades" })).toBeNull();

    await userEvent.click(capacidades);
    expect(await screen.findByText("Selecionar todas")).toBeTruthy();
  });
});

describe("Cadastrar Trilha: o campo Competências convida como o campo Atribuída a", () => {
  const abrirDialogo = async () => {
    const botao = await screen.findByRole("button", { name: "Cadastrar Trilha" });
    await userEvent.click(botao);
    return within(await screen.findByRole("dialog"));
  };

  /** Sem NENHUMA capacidade, o convite é o da capacidade — a competência nasce dentro dela. */
  it("sem capacidade cadastrada: 'Nenhuma capacidade cadastrada' e o convite do catálogo", async () => {
    comBanco(bancoVazio);
    renderWithApp(<LearningPathsPage />);

    const dialogo = await abrirDialogo();
    expect(dialogo.getByText(/Nenhuma capacidade cadastrada/)).toBeTruthy();
    const convite = dialogo.getByRole("link", { name: "Cadastrar primeira capacidade" });
    expect(convite.getAttribute("href")).toBe("/competency-matrix?cadastrar=capacidade");
  });

  it("com capacidade e sem competência: 'Nenhuma competência cadastrada' e o convite do Catálogo", async () => {
    comBanco({ ...bancoVazio, capabilities: fixtureState.capabilities });
    renderWithApp(<LearningPathsPage />);

    const dialogo = await abrirDialogo();
    expect(dialogo.getByText(/Nenhuma competência cadastrada/)).toBeTruthy();
    const convite = dialogo.getByRole("link", { name: "Cadastrar primeira competência" });
    expect(convite.getAttribute("href")).toBe("/competency-matrix");
  });

  /** O campo de pessoas continua convidando — é o mesmo componente dos dois. */
  it("o campo 'Atribuída a' convida pelo mesmo componente", async () => {
    comBanco(bancoVazio);
    renderWithApp(<LearningPathsPage />);

    const dialogo = await abrirDialogo();
    expect(dialogo.getByText(/Nenhum profissional cadastrado/)).toBeTruthy();
    const convite = dialogo.getByRole("link", { name: "Cadastrar primeiro profissional" });
    expect(convite.getAttribute("href")).toBe("/users?cadastrar=profissional");
  });
});
