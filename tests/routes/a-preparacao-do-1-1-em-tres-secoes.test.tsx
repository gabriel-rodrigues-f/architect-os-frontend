import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({ ...options, options }),
  };
});

import { Route as MentoringRoute } from "@/routes/mentoring";
import { fixtureAssignedManagerUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Pedido do dono (2026-09-07), literal: *"ao clicar em Preparar 1:1 a IA deve
 * primeiro mostrar a liturgia do 1:1, mais abaixo um resumo do perfil e, por
 * fim, SWOT baseada no perfil, contexto e momento do profissional"*.
 *
 * O que este arquivo mede é a TELA: os três títulos que o backend instrui
 * viram três cabeçalhos, nesta ordem, e o SWOT vira grade quando os quatro
 * quadrantes vêm. E o outro lado da mesma moeda — sem os títulos (narrador
 * determinístico), o texto corre como sempre correu, sem cabeçalho órfão.
 */
const fetchMock = vi.fn();

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

const NARRACAO = [
  "Liturgia do 1:1:",
  "– Abrir perguntando como foi a semana.",
  "Resumo do perfil:",
  "Ana é arquiteta plena há três anos no time de Plataforma.",
  "SWOT:",
  "Forças:",
  "– Integração acima do exigido.",
  "Fraquezas:",
  "– Distância 2 em Domain Modeling.",
  "Oportunidades:",
  "– Trilha de dados em andamento.",
  "Ameaças:",
  "– Última 1:1 há 40 dias.",
].join("\n");

const preparacao = (narration: string) => ({
  subject: "preparação do 1:1 com Ana Martins",
  suggestion: true,
  notice: "Isto é uma sugestão. Quem decide é você.",
  facts: ["A conversa é com Ana Martins."],
  absences: [],
  narration,
  narrationUnavailable: null,
  profile: "moderate",
  scriptProvenance: "selo-opaco",
});

const rotaDaPreparacao =
  (corpo: unknown): FetchRoute =>
  (href) =>
    href.includes("one-on-one-preparation") ? jsonResponse(corpo) : undefined;

async function prepara(corpo: unknown): Promise<void> {
  mockAppFetch(fetchMock, { user: fixtureAssignedManagerUser, routes: [rotaDaPreparacao(corpo)] });
  renderWithApp(<MentoringPage />);
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole("button", { name: /Preparar o 1:1/ }));
  await screen.findByText("A conversa é com Ana Martins.");
}

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  window.history.pushState({}, "", "?architectId=ana");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("a preparação do 1:1 é desenhada em três seções, na ordem do dono", () => {
  it("liturgia, depois resumo do perfil, depois SWOT — cada uma com o próprio cabeçalho", async () => {
    await prepara(preparacao(NARRACAO));

    const bloco = screen.getByTestId("one-on-one-preparation");
    const cabecalhos = within(bloco)
      .getAllByRole("heading", { level: 3 })
      .map((cabecalho) => cabecalho.textContent);
    expect(cabecalhos).toEqual(["Liturgia do 1:1", "Resumo do perfil", "SWOT"]);

    expect(within(bloco).getByText(/Abrir perguntando/)).toBeTruthy();
    expect(within(bloco).getByText(/arquiteta plena/)).toBeTruthy();
  });

  it("o SWOT vem em grade 2×2 com os quatro quadrantes nomeados", async () => {
    await prepara(preparacao(NARRACAO));

    const grade = screen.getByTestId("swot-grid");
    expect(grade.className).toContain("grid-cols-2");
    for (const [quadrante, item] of [
      ["Forças", /Integração acima/],
      ["Fraquezas", /Domain Modeling/],
      ["Oportunidades", /Trilha de dados/],
      ["Ameaças", /Última 1:1/],
    ] as const) {
      const celula = within(grade).getByRole("region", { name: quadrante });
      expect(within(celula).getByText(item)).toBeTruthy();
    }
  });

  it("com três quadrantes só, o SWOT corre como texto — a grade não inventa célula vazia", async () => {
    await prepara(
      preparacao(
        ["SWOT:", "Forças:", "– Uma.", "Fraquezas:", "– Outra.", "Oportunidades:", "– Mais."].join(
          "\n",
        ),
      ),
    );

    expect(screen.getByRole("heading", { level: 3, name: "SWOT" })).toBeTruthy();
    expect(screen.queryByTestId("swot-grid")).toBeNull();
    expect(screen.getByText(/Uma\./)).toBeTruthy();
  });

  it("sem os títulos (narrador determinístico), o texto corre como sempre, sem cabeçalho órfão", async () => {
    await prepara(
      preparacao("Sobre preparação do 1:1 com Ana Martins: A conversa é com Ana Martins."),
    );

    expect(screen.queryByTestId("one-on-one-preparation")).toBeNull();
    expect(screen.queryByRole("heading", { level: 3, name: "Liturgia do 1:1" })).toBeNull();
    expect(screen.getAllByText(/Sobre preparação do 1:1/).length).toBeGreaterThan(0);
  });
});
