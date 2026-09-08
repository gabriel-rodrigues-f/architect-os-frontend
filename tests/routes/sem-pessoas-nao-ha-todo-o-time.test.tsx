import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `inativo-some-da-aplicacao.test.tsx`: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
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
import { Route as CalibrationRoute } from "@/routes/calibration";
import { Route as CompareRoute } from "@/routes/compare";
import { Route as GapAnalysisRoute } from "@/routes/gap-analysis";
import { Route as ProgressionRoute } from "@/routes/progression";
import type { AppState, SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import {
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureState,
} from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  emptyEligibilityRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Dono, 2026-09-06, literal: "Progressão > Progressão do time: quando não há
 * ninguém cadastrado ainda vejo 'Todo o time'. Quero ver apenas a mensagem de
 * Não há pessoas cadastradas. ... Prioridades incorreto (ainda vejo 'Todo o
 * time' quando não há ninguém no time); Progressão incorreto (idem); ...
 * Calibração está diferente, considero incorreto."
 *
 * Uma tela por forma da `PersonPicker`: várias com "Todo o time"
 * (Progressão, Prioridades), várias com teto (Comparativo) e uma pessoa
 * (Avaliações, Calibração). Com o alcance vazio, nenhuma delas desenha
 * "Todo o time"; todas dizem a mesma frase.
 *
 * ADENDO DO DONO, 2026-09-08 (item 2) — a frase MUDOU e o campo deixou de
 * ser um muro: *"o filtro hoje obscurecido (desabilitado) passa a poder ser
 * aberto, mostrando 'Nenhum profissional cadastrado — clique para cadastrar',
 * que leva ao cadastro"*. O que esta suíte guarda continua valendo — não há
 * "Todo o time" de ninguém, e nenhuma lista abre —, e o que ela afirma sobre
 * o TEXTO passa a ser a frase nova. Quem NÃO cadastra gente (o tech lead)
 * continua com o campo obscurecido e sem porta.
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;
const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;
const ComparePage = CompareRoute.options.component as () => ReactNode;
const GapAnalysisPage = GapAnalysisRoute.options.component as () => ReactNode;
const ProgressionPage = ProgressionRoute.options.component as () => ReactNode;

const semNinguem: AppState = {
  ...fixtureState,
  professionals: [],
  assessments: [],
  plans: [],
  evidences: [],
  mentoringSessions: [],
};

const calibracaoVazia: FetchRoute = (href) =>
  href.includes(apiPath("/calibration")) && !href.includes("assistance")
    ? jsonResponse({ cycleId: "2026-h2", evaluators: [], overall: { average: null } })
    : undefined;

const comoAtor = (user: SessionUser) =>
  mockAppFetch(fetchMock, {
    user,
    state: semNinguem,
    routes: [emptyAuthUsersRoute, careerLevelsRoute, emptyEligibilityRoute, calibracaoVazia],
  });

/** O que o CORPO da tela diz quando não há ninguém. */
const mensagemDoCorpo = "Não há profissionais cadastrados.";
/** O que o CAMPO diz — e, para quem cadastra, o convite em que se clica. */
const mensagemDoCampo = "Nenhum profissional cadastrado — clique para cadastrar";

describe("sem pessoas cadastradas não há 'Todo o time' (dono, 2026-09-06)", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Progressão (várias com 'Todo o time'): APENAS a mensagem — sem seletor, sem 'Todo o time'", async () => {
    comoAtor(fixtureAssignedManagerUser);
    renderWithApp(<ProgressionPage />);

    expect(await screen.findByText(mensagemDoCorpo)).toBeTruthy();
    // Nenhuma lista de pessoas para abrir: o que o campo abre é o convite.
    expect(screen.queryByRole("combobox", { name: "Profissionais" })).toBeNull();
    expect(screen.getByRole("button", { name: "Profissionais" }).textContent).toContain(
      mensagemDoCampo,
    );
    expect(screen.queryByText(/Todo o time/)).toBeNull();
  });

  it("Prioridades (várias com 'Todo o time'): idem", async () => {
    comoAtor(fixtureAssignedManagerUser);
    renderWithApp(<GapAnalysisPage />);

    expect(await screen.findByText(mensagemDoCorpo)).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Profissionais" })).toBeNull();
    expect(screen.queryByText(/Todo o time/)).toBeNull();
  });

  it("Comparativo (várias com teto): a mensagem, e nada de 'Todo o time'", async () => {
    comoAtor(fixtureAssignedTechLeadUser);
    renderWithApp(<ComparePage />);

    // O tech lead NÃO cadastra gente: campo obscurecido, sem porta nenhuma.
    const seletor = await screen.findByRole("button", { name: "Profissionais para comparar" });
    expect(seletor.textContent).toContain(mensagemDoCampo);
    expect(seletor.hasAttribute("disabled")).toBe(true);

    await userEvent.click(seletor);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByText(/Todo o time/)).toBeNull();
  });

  it("Avaliações (uma pessoa): a mesma frase, e o campo abre o convite ao cadastro", async () => {
    comoAtor(fixtureAssignedManagerUser);
    renderWithApp(<AssessmentsPage />);

    const seletor = await screen.findByRole("button", { name: "Profissional" });
    expect(seletor.textContent).toContain(mensagemDoCampo);

    await userEvent.click(seletor);
    // Não há lista de pessoas: o painel traz a frase e o caminho do cadastro.
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(
      within(await screen.findByRole("dialog")).getByRole("link", {
        name: "Cadastrar primeiro profissional",
      }),
    ).toBeTruthy();
  });

  it("Calibração (uma pessoa): usa a mesma combobox das outras telas, com a mesma mensagem", async () => {
    comoAtor(fixtureAssignedManagerUser);
    renderWithApp(<CalibrationPage />);

    const seletor = await screen.findByRole("button", {
      name: /Profissional para a leitura de apoio/,
    });
    expect(seletor.textContent).toContain(mensagemDoCampo);
    expect(seletor.nextElementSibling).toBeNull();
    expect(document.querySelector("select#calibration-assistance-professional")).toBeNull();
  });
});
