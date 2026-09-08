import { cleanup, screen } from "@testing-library/react";
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
 * ADENDO DO DONO, 2026-09-08 — o campo VOLTOU a ser muro, de propósito:
 * *"Ao invés de aparecer como linha clicável no filtro, vamos bloquear o
 * filtro e disponibilizamos o botão de criação mais abaixo, dentro do quadro
 * principal e centralizado na tela."* O que esta suíte guarda continua
 * valendo — não há "Todo o time" de ninguém, e nenhuma lista abre —, e o
 * TEXTO do campo passa a ser "Nenhum profissional cadastrado". Onde o botão
 * de cadastro aparece é assunto de `cadastro-no-centro-da-tela.test.tsx`.
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

/**
 * O que o CORPO e o CAMPO dizem quando não há ninguém — a MESMA frase, desde
 * a padronização de 2026-09-08 (item 3): a linha 1 é do assunto, não do
 * lugar. Por isso a busca é `findAllByText`: ela aparece duas vezes na tela.
 */
const mensagemDoCorpo = "Nenhum profissional cadastrado";
const mensagemDoCampo = "Nenhum profissional cadastrado";

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

    expect((await screen.findAllByText(mensagemDoCorpo)).length).toBeGreaterThan(0);
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

    expect((await screen.findAllByText(mensagemDoCorpo)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("combobox", { name: "Profissionais" })).toBeNull();
    expect(screen.queryByText(/Todo o time/)).toBeNull();
  });

  it("Comparativo (várias com teto): a mensagem, e nada de 'Todo o time'", async () => {
    comoAtor(fixtureAssignedTechLeadUser);
    renderWithApp(<ComparePage />);

    const seletor = await screen.findByRole("button", { name: "Profissionais para comparar" });
    expect(seletor.textContent).toContain(mensagemDoCampo);
    expect(seletor.getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(seletor);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByText(/Todo o time/)).toBeNull();
  });

  it("Avaliações (uma pessoa): a mesma frase, e o campo não abre nada", async () => {
    comoAtor(fixtureAssignedManagerUser);
    renderWithApp(<AssessmentsPage />);

    const seletor = await screen.findByRole("button", { name: "Profissional" });
    expect(seletor.textContent).toContain(mensagemDoCampo);
    expect(seletor.getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(seletor);
    expect(screen.queryByRole("listbox")).toBeNull();
    // O painel que abre é o CARTÃO que explica o bloqueio; lista de opções, nunca.
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
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
