import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `dashboard-roles.test.tsx`: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & {
      to?: string;
      params?: Record<string, string>;
      search?: unknown;
    }) => (
      <a
        {...rest}
        href={Object.entries(params ?? {}).reduce(
          (caminho, [chave, valor]) => caminho.replace(`$${chave}`, valor),
          to ?? "",
        )}
      >
        {children}
      </a>
    ),
  };
});

import { Route as DashboardRoute } from "@/routes/index";
import type { AppState, SessionUser } from "@/lib/api";
import {
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, operationsOverviewRoute, renderWithApp } from "../helpers/render-app";

/**
 * ONDA 1 do Painel Executivo, na tela: o que a análise chamou de "valor sem
 * significado" e "agregado que apaga o nome"
 * (`direcao/painel-executivo-analise-2026-09-09.md`, A.3 e A.5).
 *
 * Nenhum caso aqui fala de seta, sparkline ou comparação entre ciclos: com 7
 * pessoas comparáveis a direção da seta inverte conforme a metodologia
 * (seção G), e isso é onda 3.
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

function renderAs(user: SessionUser, state: AppState) {
  mockAppFetch(fetchMock, { user, state, routes: [operationsOverviewRoute] });
  return renderWithApp(<DashboardPage />);
}

const comoLider = (state: AppState) =>
  renderAs(
    fixtureAssignedManagerUser,
    scopedFixtureStateFor(fixtureAssignedManagerUser, state, [fixtureTeamId]),
  );

const blocoDe = (titulo: string) => screen.getByText(titulo).closest("section")!;

/** Ana e Bruno com avaliação concluída; tirar a do Bruno derruba a cobertura a 1 de 2. */
const semAvaliacaoDoBruno: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.filter(
    (assessment) => assessment.professionalId !== "bruno",
  ),
};

/** Bruno com tudo em 1 contra alvo 5: distância 4 em cada competência avaliada. */
const comCriticasDoBruno: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((assessment) =>
    assessment.professionalId === "bruno"
      ? {
          ...assessment,
          items: assessment.items.map((item) => ({
            ...item,
            final: 1 as const,
            target: 5 as const,
          })),
        }
      : assessment,
  ),
};

describe("Painel Executivo — faixa no lugar da cor única, nome no lugar do agregado", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("cobertura de 50% sai em tom crítico — abaixo de 70% o ciclo não foi lido", async () => {
    comoLider(semAvaliacaoDoBruno);
    await screen.findByText("Painel Executivo");

    const cobertura = blocoDe("Avaliação do Ciclo").querySelector("[data-key-figure]")!;
    expect(within(cobertura as HTMLElement).getByText("1 de 2")).toBeTruthy();
    expect(cobertura.getAttribute("data-tone")).toBe("critical");
    expect(within(cobertura as HTMLElement).getByText(/Ciclo ainda não lido/)).toBeTruthy();
  });

  it("cobertura cheia sai em tom bom — a mesma tela, duas cores", async () => {
    comoLider(fixtureState);
    await screen.findByText("Painel Executivo");

    const cobertura = blocoDe("Avaliação do Ciclo").querySelector("[data-key-figure]")!;
    expect(cobertura.getAttribute("data-tone")).toBe("good");
  });

  it("o bloco de distâncias nomeia quem as carrega, e o nome leva à ficha", async () => {
    comoLider(comCriticasDoBruno);
    await screen.findByText("Painel Executivo");

    const distancias = blocoDe("Distâncias por severidade");
    expect(within(distancias).getByText("Quem carrega as distâncias críticas")).toBeTruthy();

    const bruno = within(distancias).getByText("Bruno Almeida");
    expect(bruno.getAttribute("href")).toBe("/professionals/bruno");
  });

  it("sem nenhuma distância crítica, o bloco diz isso em vez de listar nome", async () => {
    comoLider(fixtureState);
    await screen.findByText("Painel Executivo");

    const distancias = blocoDe("Distâncias por severidade");
    expect(within(distancias).getByText("Ninguém do time com distância crítica.")).toBeTruthy();
    expect(within(distancias).queryByText("Bruno Almeida")).toBeNull();
  });

  it("os três sinais de acompanhamento aparecem, cada um terminando em nome", async () => {
    const comSinais: AppState = {
      ...fixtureState,
      mentoringSessions: [
        {
          id: "s-ana",
          mentor: "Gestora",
          menteeId: "ana",
          date: "2026-07-08",
          durationMin: 60,
          topic: "1:1",
          notes: "",
          nextSession: "2026-08-01",
        },
      ],
      learningPaths: fixtureState.learningPaths.map((path) => ({
        ...path,
        progress: path.progress.map((entry) => ({ ...entry, status: "In Progress" as const })),
      })),
    };

    comoLider(comSinais);
    await screen.findByText("Painel Executivo");

    const bloco = blocoDe("Acompanhamento do time");
    expect(within(bloco).getByText("Dias desde a última 1:1")).toBeTruthy();
    expect(within(bloco).getByText("1:1 de retorno vencida")).toBeTruthy();
    expect(within(bloco).getByText("Trilha atribuída e parada")).toBeTruthy();

    // Quem nunca teve 1:1 aparece declarado como ausência, nunca como zero dias.
    expect(within(bloco).getByText("Nenhuma 1:1 registrada")).toBeTruthy();
    expect(within(bloco).getByText(/Retorno marcado para/)).toBeTruthy();
    expect(within(bloco).getByText(/Security Path — nenhum item concluído/)).toBeTruthy();

    // Todo nome do bloco leva à ficha da pessoa.
    for (const nome of within(bloco).getAllByText(/Ana Martins|Bruno Almeida/)) {
      expect(nome.getAttribute("href")).toMatch(/^\/professionals\//);
    }
  });

  it("sem 1:1 vencida e sem trilha parada, os dois sinais dizem o vazio", async () => {
    comoLider(fixtureState);
    await screen.findByText("Painel Executivo");

    const bloco = blocoDe("Acompanhamento do time");
    expect(within(bloco).getByText("Nenhum retorno de 1:1 vencido.")).toBeTruthy();
    expect(within(bloco).getByText("Nenhuma trilha parada.")).toBeTruthy();
  });
});
