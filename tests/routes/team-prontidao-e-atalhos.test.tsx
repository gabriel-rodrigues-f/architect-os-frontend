import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import type { AppState } from "@/lib/api";
import type { Assessment, Level } from "@/lib/domain";
import { Route as TeamRoute } from "@/routes/team";
import { fixtureState, fixtureTeamId } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  type FetchRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";

const fetchMock = vi.fn();
const TeamPage = TeamRoute.options.component as () => ReactNode;

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([{ id: fixtureTeamId, name: "Integração", active: true }])
    : undefined;

/**
 * PEDIDO DO DONO (2026-09-09, com referência visual), Talentos do Time:
 * *"Gostei também da coluna 'Prontidão / Distância', que possui uma régua que
 * muda de cor dentro da linha de cada profissional"* — mais os atalhos de
 * filtro em chip com contagem.
 *
 * As quatro pessoas abaixo cobrem as quatro leituras da régua de GAP_SEVERITY,
 * que é a régua da casa (`scoring-bands.ts`) e não um corte novo: adequada
 * (<1), recomendada (1–2), alta (2–3) e crítica (3+) — mais a AUSÊNCIA, que
 * nunca é distância zero.
 */
const avaliacao = (
  professionalId: string,
  alvosEFinais: readonly (readonly [Level, Level])[],
): Assessment => ({
  id: `${professionalId}-h2`,
  professionalId,
  cycleId: "2026-h2",
  status: "Completed",
  modelVersion: 1,
  targetCareerLevelId: null,
  targetSemantics: null,
  version: 1,
  items: alvosEFinais.map(([target, final], indice) => ({
    competencyId: ["cloud-k8s", "cloud-serverless", "security-iam"][indice] ?? "cloud-k8s",
    self: final,
    leader: final,
    target,
    final,
    comments: [],
  })),
});

const pessoa = (id: string, name: string, nivel: string | null) => ({
  ...fixtureState.professionals[0]!,
  id,
  name,
  email: `${id}@company.com`,
  role: nivel as never,
  careerLevelId: nivel === "Pleno" ? "arquiteto-de-solucoes-ii" : null,
  cargo: "member" as const,
  teamId: fixtureTeamId,
});

const estado: AppState = {
  ...fixtureState,
  professionals: [
    pessoa("paula", "Paula Pronta", "Pleno"),
    pessoa("ana", "Ana Atenta", "Júnior"),
    pessoa("caio", "Caio Critico", "Júnior"),
    pessoa("sem", "Sem Avaliacao", null),
  ],
  assessments: [
    // Tudo no alvo — distância 0 em todas: PRONTA.
    avaliacao("paula", [
      [3, 3],
      [3, 3],
      [2, 2],
    ]),
    // Pior distância 1 — faixa "Recomendado": EM ATENÇÃO.
    avaliacao("ana", [
      [4, 3],
      [3, 3],
      [2, 2],
    ]),
    // Pior distância 3 — faixa "Crítico".
    avaliacao("caio", [
      [5, 2],
      [3, 3],
      [2, 2],
    ]),
    // "sem" não tem avaliação nenhuma: SEM DADOS.
  ],
  mentoringSessions: [
    {
      id: "1-1-ana",
      mentor: "Gerente do time",
      menteeId: "ana",
      date: "2026-08-20",
      durationMin: 60,
      topic: "Acompanhamento",
      notes: "",
    },
  ],
  activeCycleId: "2026-h2",
};

const abrirTabela = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Tabela" }));
};

const linhaDe = (nome: string) => screen.getByRole("row", { name: new RegExp(nome) });

const cartaoDe = (nome: string) => screen.getByText(nome).closest("div.surface-card");

describe("Talentos do Time — Prontidão / Distância e atalhos de filtro", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      state: estado,
      routes: [careerLevelsRoute, emptyAuthUsersRoute, rotaDeTimes],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a tabela tem a coluna Prontidão / Distância, com a régua tingida pela faixa", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Caio Critico");
    await abrirTabela();

    const cabecalho = screen.getByRole("columnheader", { name: "Prontidão / Distância" });
    expect(cabecalho.textContent).toBe("Prontidão / Distância");

    const critico = within(linhaDe("Caio Critico"));
    expect(critico.getByText("Distância 3 · Crítico").textContent).toBe("Distância 3 · Crítico");
    expect(critico.getByTestId("readiness-bar").getAttribute("data-readiness")).toBe("critical");

    const pronta = within(linhaDe("Paula Pronta"));
    expect(pronta.getByTestId("readiness-bar").getAttribute("data-readiness")).toBe("ready");
  });

  it("quem não tem avaliação concluída não vira distância zero: é a ausência", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Sem Avaliacao");
    await abrirTabela();

    const regua = within(linhaDe("Sem Avaliacao")).getByTestId("readiness-bar");
    expect(regua.getAttribute("data-readiness")).toBe("unknown");
    // O travessão, e não "Distância 0": ausência não é zero.
    expect(within(regua).queryByText("Distância 0 · Adequado")).toBeNull();
    expect(within(regua).getAllByText("—").length).toBeGreaterThan(0);
    expect(
      within(regua).getAllByText("Nenhuma avaliação oficial neste ciclo").length,
    ).toBeGreaterThan(0);
  });

  it("a contagem do chip é o que a lista desenha: Prontos (1) devolve uma linha", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Paula Pronta");

    for (const rotulo of ["Todos (4)", "Prontos (1)", "Em atenção (1)", "Críticos (1)"]) {
      expect(screen.getByRole("button", { name: rotulo }).textContent).toBe(rotulo);
    }
    expect(screen.getByRole("button", { name: "Não avaliados (1)" }).textContent).toBe(
      "Não avaliados (1)",
    );

    await userEvent.click(screen.getByRole("button", { name: "Prontos (1)" }));
    await abrirTabela();

    const tabela = within(screen.getByRole("table"));
    expect(tabela.getByText("Paula Pronta").textContent).toBe("Paula Pronta");
    expect(tabela.queryByText("Caio Critico")).toBeNull();
    // Cabeçalho + uma pessoa: a contagem do chip é o tamanho da lista.
    expect(tabela.getAllByRole("row")).toHaveLength(2);
  });

  it("o atalho é o filtro que já existe: Todos devolve a lista inteira", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Paula Pronta");

    await userEvent.click(screen.getByRole("button", { name: "Críticos (1)" }));
    expect(screen.queryByText("Paula Pronta")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Todos (4)" }));
    expect(screen.getByText("Paula Pronta").textContent).toBe("Paula Pronta");
    expect(screen.getByText("Sem Avaliacao").textContent).toBe("Sem Avaliacao");
  });

  it("a tabela nomeia o Nível atual, e põe o travessão em quem não tem", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Paula Pronta");
    await abrirTabela();

    expect(screen.getByRole("columnheader", { name: "Nível atual" }).textContent).toBe(
      "Nível atual",
    );
    expect(within(linhaDe("Paula Pronta")).getByTestId("career-level").textContent).toContain(
      "Pleno",
    );
    expect(within(linhaDe("Sem Avaliacao")).getByTestId("career-level").textContent).toContain("—");
  });

  it("a visão de Cartões não fica para trás: a régua e o nível atual estão nela", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Caio Critico");
    const cartao = cartaoDe("Caio Critico");
    expect(cartao).not.toBeNull();

    const dentro = within(cartao as HTMLElement);
    const regua = dentro.getByTestId("readiness-bar");
    expect(regua.getAttribute("data-readiness")).toBe("critical");
    expect(within(regua).getByText("Distância 3 · Crítico").textContent).toBe(
      "Distância 3 · Crítico",
    );
    expect(dentro.getByTestId("career-level").textContent).toContain("Júnior");
  });

  it("a coluna da última 1:1 mostra a data que a tela já carregava", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Atenta");
    await abrirTabela();

    expect(screen.getByRole("columnheader", { name: "Última 1:1" }).textContent).toBe("Última 1:1");
    expect(within(linhaDe("Ana Atenta")).getByTestId("last-mentoring").textContent).toBe(
      "20/08/2026",
    );
    expect(within(linhaDe("Paula Pronta")).getByTestId("last-mentoring").textContent).toBe("—");
  });
});
