import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `dashboard-roles.test.tsx`: `<Link>` exige RouterProvider real. */
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
import { Route as PlansRoute } from "@/routes/development-plans";
import { Route as MentoringRoute } from "@/routes/mentoring";
import type { AppState } from "@/lib/api";
import { fixtureMemberUser, fixtureState, scopedFixtureStateFor } from "../helpers/fixtures";
import { emptyEligibilityRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono, 2026-09-06, literal: "O menu Avaliações deve ser view-only para o
 * membro. Ele não pode executar nenhuma ação nessa tela. Hoje é possível ver
 * um botão de filtro de usuário. Esse menu não deve aparecer para o perfil
 * Membro. O mesmo vale para Plano de Desenvolvimento e Mentoria. Os botões de
 * busca por outros membros, em nenhuma parte da aplicação, devem ser
 * mostrados para um membro. Um membro pode ver apenas informações sobre si."
 *
 * Três telas, a mesma prova: o profissional vê o próprio nome no lugar do
 * seletor (nenhuma combobox), vê o que é dele, e não tem botão de ação.
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;
const PlansPage = PlansRoute.options.component as () => ReactNode;
const MentoringPage = MentoringRoute.options.component as () => ReactNode;

const rascunhoDeAna: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((assessment) =>
    assessment.id === "ana-h2" ? { ...assessment, status: "Draft" } : assessment,
  ),
};

const NENHUMA_ACAO = [
  "Enviar para revisão",
  "Concluir avaliação",
  "Abrir avaliação do ciclo",
  "Registrar",
  "Corrigir e reenviar",
  "Adicionar ao PDI",
  "Aprovar PDI",
  "Concluir PDI",
  "Registrar sessão",
  "Agendar follow-up",
];

describe("o profissional só vê a si — e só lê (dono, 2026-09-06)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: scopedFixtureStateFor(fixtureMemberUser, rascunhoDeAna),
      routes: [emptyEligibilityRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /** O único seletor que sobra é o de CAPACIDADE, em Avaliações — não é gente. */
  const semSeletorNemAcao = (seletorDePessoa: string) => {
    expect(screen.queryByRole("combobox", { name: seletorDePessoa })).toBeNull();
    for (const acao of NENHUMA_ACAO) {
      expect(screen.queryByRole("button", { name: acao }), acao).toBeNull();
    }
  };

  it("Avaliações: o nome dele no lugar do seletor, os números dele em texto, nenhuma ação", async () => {
    renderWithApp(<AssessmentsPage />);

    expect((await screen.findByLabelText("Profissional")).textContent).toBe("Ana Martins");
    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    expect(linha.querySelectorAll("textarea")).toHaveLength(0);
    // Começar/Parar/Continuar: lê, não escreve.
    const comecar = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    expect(comecar.disabled).toBe(true);
    semSeletorNemAcao("Profissional");
  });

  it("Plano de Desenvolvimento: o nome dele no lugar do seletor e nenhuma ação", async () => {
    renderWithApp(<PlansPage />);

    expect((await screen.findByLabelText("Profissional")).textContent).toBe("Ana Martins");
    expect(screen.queryByRole("combobox")).toBeNull();
    semSeletorNemAcao("Profissional");
  });

  it("Mentoria: a linha do tempo dele, sem filtro de mentorado e sem registrar sessão", async () => {
    renderWithApp(<MentoringPage />);

    expect((await screen.findByLabelText("Filtrar mentorado")).textContent).toBe("Ana Martins");
    expect(screen.queryByRole("combobox")).toBeNull();
    semSeletorNemAcao("Filtrar mentorado");
  });
});
