import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import type { SessionUser } from "@/lib/api";
import {
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
 * D2 (dono, 2026-09-05) — a revisão de papéis devolveu ao profissional os
 * PRÓPRIOS números: em `/assessments` ele preenche a autoavaliação E vê as
 * colunas do LÍDER, do ALVO, a nota FINAL e a Distância da própria avaliação.
 * Até 2026-09-02 valia o contrário ("não vê seus números de avaliação");
 * este arquivo foi invertido para prender a decisão nova. Tech lead e gerente
 * vinculados continuam vendo tudo; o admin não alcança a tela (D1).
 *
 * A prova é no DOM, não no CSS: `querySelectorAll("th"/"td")` conta o que
 * existe na árvore. O número que serve de sonda é o 3 da linha "Serverless"
 * da fixture: só existe na nota do líder (self 4 · leader 3 · target 4 ·
 * final 4). Se o 3 NÃO aparecer na linha do profissional, um número dele
 * ficou escondido.
 */

const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const COLUNAS_DE_NUMEROS = ["Líder", "Alvo", "Final", "Distância"];
const TODAS_AS_COLUNAS = [
  "Competência",
  "Autoavaliação",
  "Líder",
  "Alvo",
  "Final",
  "Distância",
  "Notas",
];

function mockSession(user: SessionUser) {
  mockAppFetch(fetchMock, { user, state: fixtureState, routes: [emptyEligibilityRoute] });
}

/*
 * A TELA LISTA TODAS AS CAPACIDADES desde 2026-09-10 (dono: *"Todas as
 * capacidades listadas"*), e cada uma traz a sua tabela. Os cabeçalhos que
 * interessam são os DA TABELA da linha sob teste — varrer o documento inteiro
 * devolveria as sete colunas repetidas uma vez por capacidade.
 */
function cabecalhosDaTabelaDe(linha: HTMLTableRowElement): string[] {
  const tabela = linha.closest("table") as HTMLTableElement;
  return Array.from(tabela.querySelectorAll("th")).map((th) => th.textContent?.trim() ?? "");
}

async function linhaDe(competencia: string): Promise<HTMLTableRowElement> {
  return (await screen.findByText(competencia)).closest("tr") as HTMLTableRowElement;
}

describe("Avaliações — o profissional vê os próprios números de avaliação (D2, dono, 2026-09-05)", () => {
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

  it("D2 (dono, 2026-09-05) — profissional: a tabela nasce com as sete colunas; líder, alvo, final e distância da própria avaliação existem no DOM", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<AssessmentsPage />);

    const serverless = await linhaDe("Serverless");
    expect(cabecalhosDaTabelaDe(serverless)).toEqual(TODAS_AS_COLUNAS);
    expect(serverless.querySelectorAll("td")).toHaveLength(TODAS_AS_COLUNAS.length);
    expect(serverless.textContent).toMatch(/3/);
    for (const coluna of COLUNAS_DE_NUMEROS) {
      expect(screen.getAllByText(coluna).length).toBeGreaterThan(0);
    }
  });

  it("D2 (dono, 2026-09-05) — profissional: o subtítulo promete as quatro colunas em vez de dizer que os números ficam com a liderança", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<AssessmentsPage />);

    await linhaDe("Kubernetes");
    expect(screen.getByText(/combina autoavaliação, avaliação do Líder, nível alvo/)).toBeTruthy();
    expect(screen.queryByText(/ficam com a liderança/)).toBeNull();
  });

  it("D2 (dono, 2026-09-05) — profissional, no empilhado abaixo de 768px: as quatro rubricas estão lá, com a nota do líder dentro", async () => {
    restoreViewport = stubNarrowViewport(true);
    mockSession(fixtureMemberUser);
    renderWithApp(<AssessmentsPage />);

    await screen.findByText("Serverless");
    const cartoes = screen.getAllByTestId("competency-stacked-card");
    const serverless = cartoes.find((cartao) => within(cartao).queryByText("Serverless"))!;
    for (const coluna of ["Autoavaliação", "Líder", "Alvo", "Final"]) {
      expect(within(serverless).getByText(coluna)).toBeTruthy();
    }
    expect(serverless.textContent).toMatch(/3/);
  });

  // O texto da ajuda do profissional ainda fala dos números como se fossem da
  // liderança (`help.assessments.member.what`) — achado de produção pós-D2,
  // relatado ao orquestrador; aqui só se prende que a ajuda abre e fala deles.
  it("profissional: a ajuda (?) abre e fala dos números de avaliação dele", async () => {
    mockSession(fixtureMemberUser);
    renderWithApp(<AssessmentsPage />);

    await linhaDe("Kubernetes");
    await userEvent.click(screen.getByRole("button", { name: /Como usar/ }));
    expect(await screen.findByText(/Seus números de avaliação/)).toBeTruthy();
  });

  // D1: o administrador não alcança /assessments — por isso não há linha dele aqui.
  it.each([
    ["tech lead do time", fixtureAssignedTechLeadUser],
    ["gerente do time", fixtureAssignedManagerUser],
    ["o próprio profissional (D2)", fixtureMemberUser],
  ])("%s vê as sete colunas, com a nota do líder dentro", async (_, user) => {
    mockSession(user);
    renderWithApp(<AssessmentsPage />);

    const serverless = await linhaDe("Serverless");
    expect(cabecalhosDaTabelaDe(serverless)).toEqual(TODAS_AS_COLUNAS);
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
    for (const coluna of ["Autoavaliação", "Líder", "Alvo", "Final"]) {
      expect(within(serverless).getByText(coluna)).toBeTruthy();
    }
    expect(serverless.textContent).toMatch(/3/);
  });
});
