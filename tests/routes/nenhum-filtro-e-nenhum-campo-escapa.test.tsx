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

/*
 * O FILTRO DE CAPACIDADES SAIU DA AVALIAÇÃO — dono (2026-09-10): *"Filtros:
 * fica só o nome."* Com ele fora, não há gatilho para bloquear nem frase de
 * assunto para dizer quando o catálogo está vazio: a tela lista TODAS as
 * capacidades, e o vazio do catálogo já é dito pelo estado vazio da casa
 * (`EmptyStateCallToAction`, testemunhado em `a-avaliacao-simplifica`).
 *
 * A régua que este bloco guardava — filtro sem opção nasce bloqueado, com a
 * frase do assunto — continua viva no filtro de PESSOAS e nos outros filtros
 * da casa, e continua testemunhada aqui embaixo.
 */

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
