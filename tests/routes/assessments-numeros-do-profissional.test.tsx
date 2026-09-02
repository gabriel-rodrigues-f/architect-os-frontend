import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import type { SessionUser } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureState,
} from "../helpers/fixtures";
import {
  emptyEligibilityRoute,
  mockAppFetch,
  renderWithApp,
  stubNarrowViewport,
} from "../helpers/render-app";

/**
 * RUMO AO 100% (orquestrador, 2026-09-02), palavras do dono: o profissional
 * "não vê seus números de avaliação". Em `/assessments` ele continua
 * PREENCHENDO a autoavaliação — é participação —, mas as colunas do LÍDER,
 * do ALVO e a nota FINAL (e a Distância, que é a subtração das duas últimas)
 * deixam de ser mostradas a ele. Tech lead e gestor continuam vendo tudo.
 *
 * A prova é no DOM, não no CSS: `querySelectorAll("th"/"td")` conta o que
 * existe na árvore — uma coluna escondida por classe continuaria contando.
 * O número que serve de sonda é o 3 da linha "Serverless" da fixture: só
 * existe nas notas do líder (self 4 · leader 3 · target 4 · final 4). Se o
 * 3 aparecer na linha do profissional, um número vazou.
 *
 * Isto é TELA, não segurança: o `/state` continua trazendo `leader`,
 * `target` e `final` até o navegador dele. Cortar no backend é outra fatia.
 */

const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const COLUNAS_DO_PROFISSIONAL = ["Competência", "Autoavaliação", "Notas"];
const COLUNAS_DA_LIDERANCA = ["Tech Lead", "Alvo", "Final", "Distância"];
const TODAS_AS_COLUNAS = [
  "Competência",
  "Autoavaliação",
  "Tech Lead",
  "Alvo",
  "Final",
  "Distância",
  "Notas",
];

function mockSession(user: SessionUser) {
  mockAppFetch(fetchMock, { user, state: fixtureState, routes: [emptyEligibilityRoute] });
}

function cabecalhos(): string[] {
  return Array.from(document.querySelectorAll("th")).map((th) => th.textContent?.trim() ?? "");
}

async function linhaDe(competencia: string): Promise<HTMLTableRowElement> {
  return (await screen.findByText(competencia)).closest("tr") as HTMLTableRowElement;
}

describe("Avaliações — o profissional não vê seus números de avaliação", () => {
  let restoreViewport: () => void = () => {};

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    restoreViewport();
    restoreViewport = () => {};
    cleanup();
    vi.unstubAllGlobals();
  });

  it("profissional: a tabela nasce só com Competência, Autoavaliação e Notas — líder, alvo, final e distância não existem no DOM", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<AssessmentsPage />);

    const serverless = await linhaDe("Serverless");
    expect(cabecalhos()).toEqual(COLUNAS_DO_PROFISSIONAL);
    expect(serverless.querySelectorAll("td")).toHaveLength(COLUNAS_DO_PROFISSIONAL.length);
    expect(serverless.textContent).not.toMatch(/3/);
    for (const coluna of COLUNAS_DA_LIDERANCA) {
      expect(screen.queryByText(coluna)).toBeNull();
    }
  });

  it("profissional: o subtítulo da tela diz que os números ficam com a liderança, em vez de prometer quatro colunas", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<AssessmentsPage />);

    await linhaDe("Kubernetes");
    expect(screen.getByText(/ficam com a liderança/)).toBeTruthy();
    expect(
      screen.queryByText(/combina autoavaliação, avaliação do Tech Lead, nível alvo/),
    ).toBeNull();
  });

  it("profissional, no empilhado abaixo de 768px: só a Autoavaliação — sem Tech Lead, Alvo, Final nem Distância", async () => {
    restoreViewport = stubNarrowViewport(true);
    mockSession(fixtureMemberUser);
    renderWithApp(<AssessmentsPage />);

    await screen.findByText("Serverless");
    const cartoes = screen.getAllByTestId("competency-stacked-card");
    const serverless = cartoes.find((cartao) => within(cartao).queryByText("Serverless"))!;
    expect(within(serverless).getByText("Autoavaliação")).toBeTruthy();
    for (const coluna of COLUNAS_DA_LIDERANCA) {
      expect(within(serverless).queryByText(coluna)).toBeNull();
    }
    expect(serverless.textContent).not.toMatch(/3/);
  });

  it("profissional: a ajuda (?) explica que os números de avaliação ficam com a liderança", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<AssessmentsPage />);

    await linhaDe("Kubernetes");
    await userEvent.click(screen.getByRole("button", { name: /Como usar/ }));
    expect(await screen.findByText(/Seus números de avaliação/)).toBeTruthy();
  });

  it.each([
    ["tech lead do time", fixtureAssignedTechLeadUser],
    ["gestor do time", fixtureAssignedManagerUser],
    ["administrador", fixtureAdminUser],
  ])("%s continua vendo as sete colunas, com a nota do líder dentro", async (_, user) => {
    mockSession(user);
    renderWithApp(<AssessmentsPage />);

    const serverless = await linhaDe("Serverless");
    expect(cabecalhos()).toEqual(TODAS_AS_COLUNAS);
    expect(serverless.querySelectorAll("td")).toHaveLength(TODAS_AS_COLUNAS.length);
    expect(serverless.textContent).toMatch(/3/);
  });

  it("tech lead do time, no empilhado: as quatro rubricas continuam lá", async () => {
    restoreViewport = stubNarrowViewport(true);
    mockSession(fixtureAssignedTechLeadUser);
    renderWithApp(<AssessmentsPage />);

    await screen.findByText("Serverless");
    const cartoes = screen.getAllByTestId("competency-stacked-card");
    const serverless = cartoes.find((cartao) => within(cartao).queryByText("Serverless"))!;
    for (const coluna of ["Autoavaliação", "Tech Lead", "Alvo", "Final"]) {
      expect(within(serverless).getByText(coluna)).toBeTruthy();
    }
    expect(serverless.textContent).toMatch(/3/);
  });
});
