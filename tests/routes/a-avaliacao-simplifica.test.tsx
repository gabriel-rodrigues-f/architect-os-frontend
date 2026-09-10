import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import type { AppState, SessionUser } from "@/lib/api";
import { fixtureAssignedManagerUser, fixtureState } from "../helpers/fixtures";
import { emptyEligibilityRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * A AVALIAÇÃO SIMPLIFICA — dono (2026-09-10): *"A tela está confusa. Vamos
 * simplificar ela. A ordem agora é simplificar."*
 *
 * Cada bloco que ele mandou tirar tem aqui uma testemunha própria, e a que
 * ele mandou pôr — o bloco de capacidades › competências, ocupando a tela e
 * rolando por dentro — tem a dela.
 */

const fetchMock = vi.fn();
const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

function mockSession(user: SessionUser, state: AppState) {
  mockAppFetch(fetchMock, { user, state, routes: [emptyEligibilityRoute] });
}

/** Ana ("ana-h2") em Rascunho — a única etapa aberta que sobrou. */
const rascunho: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((assessment) =>
    assessment.id === "ana-h2" ? { ...assessment, status: "Draft" as const } : assessment,
  ),
};

describe("Avaliação de Desempenho — a tela simplificada (dono, 2026-09-10)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lista TODAS as capacidades do catálogo, sem ninguém escolher nada antes", async () => {
    mockSession(fixtureAssignedManagerUser, rascunho);
    renderWithApp(<AssessmentsPage />);

    // As duas capacidades da massa aparecem juntas, e as competências das duas.
    expect(await screen.findByText("Cloud Architecture")).toBeTruthy();
    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.getByText("Kubernetes")).toBeTruthy();
    expect(screen.getByText("Serverless")).toBeTruthy();
    expect(screen.getByText("IAM")).toBeTruthy();
  });

  it("o bloco rola por dentro e ocupa o resto da página — altura medida, não chutada", async () => {
    mockSession(fixtureAssignedManagerUser, rascunho);
    renderWithApp(<AssessmentsPage />);

    const caixa = await screen.findByRole("region", { name: "Todas as capacidades do ciclo" });
    // `PaneHeight.restOfPage()` se anuncia pelo marcador; teto por pixel não existe.
    expect(caixa.hasAttribute("data-pane-fills-page")).toBe(true);
    expect(caixa.getAttribute("style") ?? "").not.toContain("--pane-max-h");
    expect(caixa.className).toContain("overflow-y-auto");
  });

  it("o filtro de capacidades saiu — fica só o nome", async () => {
    mockSession(fixtureAssignedManagerUser, rascunho);
    renderWithApp(<AssessmentsPage />);

    expect(await screen.findByText("Cloud Architecture")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Capacidades/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Selecionar as do portfólio" })).toBeNull();
    // O filtro de PESSOA fica.
    expect(screen.getByRole("combobox", { name: /Profissional/ })).toBeTruthy();
  });

  it("não existe mais 'Enviar para revisão' — quem avalia já conclui", async () => {
    mockSession(fixtureAssignedManagerUser, rascunho);
    renderWithApp(<AssessmentsPage />);

    expect(await screen.findByText("Cloud Architecture")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull();
    expect(screen.getByRole("button", { name: "Concluir avaliação" })).toBeTruthy();
  });

  it("o bloco de situação saiu: nem rótulo, nem selo de estado", async () => {
    mockSession(fixtureAssignedManagerUser, rascunho);
    renderWithApp(<AssessmentsPage />);

    expect(await screen.findByText("Cloud Architecture")).toBeTruthy();
    expect(screen.queryByText("Situação")).toBeNull();
    expect(screen.queryByText("Rascunho")).toBeNull();
  });

  it("o Portfólio de Capacidades do Ciclo saiu inteiro", async () => {
    mockSession(fixtureAssignedManagerUser, rascunho);
    renderWithApp(<AssessmentsPage />);

    expect(await screen.findByText("Cloud Architecture")).toBeTruthy();
    expect(screen.queryByText("Portfólio de Capacidades do Ciclo")).toBeNull();
    expect(
      screen.queryByRole("combobox", { name: "Adicionar capacidade ao portfólio" }),
    ).toBeNull();
  });

  it("cada capacidade traz o cabeçalho e as sete colunas da captura do dono", async () => {
    mockSession(fixtureAssignedManagerUser, rascunho);
    renderWithApp(<AssessmentsPage />);

    expect(await screen.findByText(/2 competências/)).toBeTruthy();
    for (const coluna of [
      "Competência",
      "Autoavaliação",
      "Líder",
      "Alvo",
      "Final",
      "Distância",
      "Notas",
    ]) {
      expect(screen.getAllByRole("columnheader", { name: coluna }).length).toBeGreaterThan(0);
    }
  });
});
