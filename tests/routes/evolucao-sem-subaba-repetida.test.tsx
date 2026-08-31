import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/architects/ana/evolution",
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import { apiPath } from "@/lib/api-path";
import type { ArchitectEvolutionResult } from "@/lib/domain";
import { Route as EvolutionRoute } from "@/routes/architects.$architectId.evolution";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 21 / apagar-o-vazio — a aba Evolução do perfil abria QUATRO subvisões
 * e duas delas não eram tarefas próprias:
 *
 *   · "Linha do tempo" listava os degraus de competência que a aba VIZINHA
 *     "Extrato de carreira" já lista, e o Extrato é superconjunto (acrescenta
 *     PDIs, evidências e o link de origem);
 *   · "Capacidades" repetia, célula por célula, o mesmo gráfico "Evolução por
 *     capacidade" já desenhado no "Resumo" — o que ela tinha de próprio era o
 *     seletor de foco por capacidade, não um segundo gráfico.
 *
 * O corte é assimétrico de propósito: a Linha do tempo SOME (o conteúdo mora
 * na aba irmã) e as Capacidades se FUNDEM ao Resumo (o foco por capacidade é
 * conteúdo real e não pode se perder junto com a duplicata).
 */

const fetchMock = vi.fn();

const degrau = {
  id: "evento-1",
  architectId: "ana",
  competencyId: "k8s",
  fromLevel: 2,
  toLevel: 3,
  sourceType: "ASSESSMENT",
  sourceId: "assessment-1",
  effectiveDate: "2026-08-01",
  recordedAt: "2026-08-01T00:00:00.000Z",
  actorUserId: "admin",
  note: null,
} as const satisfies ArchitectEvolutionResult["events"][number];

const resultado: ArchitectEvolutionResult = {
  architect: {
    id: "ana",
    name: "Ana Martins",
    role: "Arquiteto de Soluções II",
    careerLevelName: null,
  },
  summary: {
    coverage: { covered: 1, total: 2 },
    initialAverage: 2,
    currentAverage: 3,
    averageDelta: 1,
    improved: 1,
    stable: 0,
    regressed: 0,
    mentoringCount: 0,
    assessmentCount: 1,
  },
  capabilitySeries: [
    {
      capabilityId: "cloud",
      capabilityName: "Cloud Architecture",
      points: [
        { date: "2026-06-01", averageLevel: 2, coveredCount: 1 },
        { date: "2026-08-01", averageLevel: 3, coveredCount: 1 },
      ],
    },
  ],
  competencySeries: [
    {
      competencyId: "k8s",
      competencyName: "Kubernetes",
      capabilityId: "cloud",
      events: [degrau],
    },
  ],
  events: [degrau],
  snapshots: [],
  comparisons: [
    {
      competencyId: "k8s",
      competencyName: "Kubernetes",
      capabilityId: "cloud",
      capabilityName: "Cloud Architecture",
      initialLevel: 2,
      currentLevel: 3,
      delta: 1,
      lastSourceType: "ASSESSMENT",
    },
  ],
};

const EvolutionPage = EvolutionRoute.options.component as () => ReactNode;

/**
 * Títulos de `SectionCard` presentes no DOM, inclusive dentro de painel
 * oculto. Varre h1–h6 porque o nível do `SectionCard` vem de contexto: fixar
 * a tag deixaria a contagem em zero e a asserção passaria à toa.
 */
const tituloDeSecao = (container: HTMLElement, titulo: string): Element[] =>
  [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(
    (titulos) => titulos.textContent?.trim() === titulo,
  );

describe("Evolução do arquiteto — nenhuma subvisão repete a vizinha", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      routes: [
        (href) =>
          href.endsWith(apiPath("/evolution/architect")) ? jsonResponse(resultado) : undefined,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * As asserções aqui são de DOM, não de papel acessível: `getByRole` pula o
   * `[role="tabpanel"][hidden]`, então a versão por papel passaria com o
   * painel inteiro ainda montado atrás da aba — medido, foi o primeiro
   * estado deste teste.
   */
  it("não oferece a subvisão 'Linha do tempo' — a história mora no Extrato de carreira", async () => {
    const { container } = renderWithApp(<EvolutionPage />);
    await screen.findByRole("tab", { name: "Resumo" });

    expect(screen.queryByRole("tab", { name: "Linha do tempo" })).toBeNull();
    expect(
      tituloDeSecao(container, "Linha do tempo"),
      "o painel da linha do tempo continuava montado, só oculto",
    ).toEqual([]);
  });

  it("não oferece a subvisão 'Capacidades' como seletor separado", async () => {
    renderWithApp(<EvolutionPage />);
    await screen.findByRole("tab", { name: "Resumo" });

    expect(screen.queryByRole("tab", { name: "Capacidades" })).toBeNull();
  });

  it("o gráfico 'Evolução por capacidade' é montado uma única vez no documento", async () => {
    const { container } = renderWithApp(<EvolutionPage />);
    await screen.findByRole("tab", { name: "Resumo" });

    expect(
      tituloDeSecao(container, "Evolução por capacidade"),
      "o mesmo gráfico estava montado em duas subvisões",
    ).toHaveLength(1);
  });

  it("o foco por capacidade sobrevive à fusão, dentro da subvisão visível", async () => {
    const { container } = renderWithApp(<EvolutionPage />);
    await screen.findByRole("tab", { name: "Resumo" });

    const visivel = container.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');
    expect(visivel, "nenhuma subvisão visível").toBeTruthy();
    const painel = within(visivel!);

    expect(painel.getByText("Nível médio inicial")).toBeTruthy();
    expect(painel.getByText("Maiores mudanças no período")).toBeTruthy();
    expect(
      painel.getByText(
        "Selecione uma capacidade abaixo para ver a evolução das suas competências.",
      ),
    ).toBeTruthy();
    expect(painel.getByRole("button", { name: "Cloud Architecture" })).toBeTruthy();
  });

  it("as subvisões que restam são só Resumo e Competências", async () => {
    renderWithApp(<EvolutionPage />);
    await screen.findByRole("tab", { name: "Resumo" });

    expect(screen.getAllByRole("tab").map((aba) => aba.textContent)).toEqual([
      "Resumo",
      "Competências",
    ]);
  });
});
