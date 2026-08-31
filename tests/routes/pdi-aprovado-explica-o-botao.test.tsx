import { cleanup, screen, within } from "@testing-library/react";
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
      search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => {
      const entries = Object.entries((search ?? {}) as Record<string, unknown>).filter(
        ([, value]) => value !== undefined && value !== null,
      );
      const query = new URLSearchParams(
        entries.map(([nome, valor]) => [nome, String(valor)]),
      ).toString();
      return (
        <a href={`${to ?? ""}${query ? `?${query}` : ""}`} {...rest}>
          {children}
        </a>
      );
    },
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import { Route as GapRoute } from "@/routes/gap-analysis";
import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import type { AppState } from "@/lib/api";
import type { Assessment, DevelopmentPlan } from "@/lib/domain";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Decisao do dono (opcao B): dos 16 "Tratar no PDI", 8 nao faziam nada — nao
 * por defeito, mas porque o PDI daquela pessoa esta APROVADO e plano aprovado
 * nao aceita item novo (`PlanWorkflowPolicy.canEditDiagnostic` exige
 * `Draft`). O botao aparecia igual ao que funciona e levava a uma tela vazia,
 * sem dizer por que. Escolha do dono: o botao FICA, desabilitado, e EXPLICA.
 *
 * O invariante desta rede: quando o plano nao aceita acao nova, o gatilho
 * continua VISIVEL, deixa de ser clicavel e carrega a razao em texto. E o
 * espelho importa tanto quanto: com o plano em rascunho ele volta a ser um
 * link de verdade, com pessoa e competencia no destino.
 */
const fetchMock = vi.fn();

const GapPage = GapRoute.options.component as () => ReactNode;
const ProfilePage = ProfileRoute.options.component as () => ReactNode;

const RAZAO_APROVADO = "PDI aprovado — peça ajustes para incluir nova ação";

/** Serverless vira lacuna da Ana e NAO esta no plano dela — o "+ PDI" visivel. */
function comServerlessEmAbertoParaAna(assessment: Assessment): Assessment {
  if (assessment.id !== "ana-h2") return assessment;
  return {
    ...assessment,
    items: assessment.items.map((item) =>
      item.competencyId === "cloud-serverless" ? { ...item, target: 5 } : item,
    ),
  };
}

const estadoBase: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map(comServerlessEmAbertoParaAna),
};

const comPlanoDaAnaEm = (status: DevelopmentPlan["status"]): AppState => ({
  ...estadoBase,
  plans: estadoBase.plans.map((plan) =>
    plan.architectId === "ana" ? { ...plan, status } : plan,
  ),
});

/** Bruno herda um plano aprovado para a linha de Prioridades dele travar tambem. */
const comBrunoTambemAprovado: AppState = {
  ...estadoBase,
  plans: [
    ...estadoBase.plans.map((plan) => ({ ...plan, status: "Approved" as const })),
    ...estadoBase.plans
      .filter((plan) => plan.architectId === "ana")
      .map((plan) => ({
        ...plan,
        id: "pdi-bruno",
        architectId: "bruno",
        status: "Approved" as const,
        items: [],
      })),
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Perfil — '+ PDI' com o plano aprovado", () => {
  it("continua visivel, desabilitado, e explica a regra do processo", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: comPlanoDaAnaEm("Approved") });
    renderWithApp(<ProfilePage />);

    const acao = await screen.findByRole("button", { name: "+ PDI" });
    expect(acao.hasAttribute("disabled")).toBe(true);
    expect(acao.getAttribute("title")).toBe(RAZAO_APROVADO);
    expect(screen.queryByRole("link", { name: "+ PDI" })).toBeNull();
  });

  it("com o plano em rascunho volta a ser link, com pessoa e competencia", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: comPlanoDaAnaEm("Draft") });
    renderWithApp(<ProfilePage />);

    const acao = await screen.findByRole("link", { name: "+ PDI" });
    const href = acao.getAttribute("href") ?? "";
    expect(href).toContain("architectId=ana");
    expect(href).toContain("competencyId=cloud-serverless");
    expect(screen.queryByRole("button", { name: "+ PDI" })).toBeNull();
  });
});

describe("Prioridades — 'Tratar no PDI' com o plano aprovado", () => {
  it("nao promete uma tela vazia: fica desabilitado e diz por que", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: comBrunoTambemAprovado });
    renderWithApp(<GapPage />);

    await screen.findByText("IAM");
    const linhaIam = screen.getByText("IAM").closest("li")!;
    const acao = within(linhaIam).getByRole("button", { name: "Tratar no PDI" });
    expect(acao.hasAttribute("disabled")).toBe(true);
    expect(acao.getAttribute("title")).toBe(RAZAO_APROVADO);
  });
});
