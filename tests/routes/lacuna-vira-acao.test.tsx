import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O `<Link>` do TanStack exige RouterProvider real; aqui ele vira uma âncora
 * que SERIALIZA `to` + `search` no `href` — é justamente o `search` que este
 * arquivo prende, então descartá-lo (como fazem os mocks das outras telas)
 * apagaria o invariante sob teste.
 */
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
import { Route as PlansRoute } from "@/routes/development-plans";
import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import type { AppState } from "@/lib/api";
import type { Assessment, DevelopmentPlan } from "@/lib/domain";
import { fixtureAdminUser, fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * "Tratar no PDI" (Prioridades) e "+ PDI" (perfil) são o único caminho do
 * produto que liga DIAGNÓSTICO a AÇÃO. Antes desta fatia o primeiro apontava
 * para `/development-plans` cru e o segundo levava só a pessoa: quem clicava
 * na lacuna de IAM da Ana caía numa lista e tinha de reencontrar a lacuna a
 * mão. O invariante desta rede: o destino recebe PESSOA e COMPETÊNCIA, e o
 * plano abre a criação do item já naquela competência — sem nunca abri-la
 * para quem não pode editar o diagnóstico.
 */
const fetchMock = vi.fn();

const GapPage = GapRoute.options.component as () => ReactNode;
const PlansPage = PlansRoute.options.component as () => ReactNode;
const ProfilePage = ProfileRoute.options.component as () => ReactNode;

/**
 * Bruno fica MUITO mais longe do alvo em IAM (1 → 4) do que a Ana (2 → 3).
 * A linha de Prioridades é consolidada por competência e o selo que ela
 * exibe é o `maxGap` — logo a pessoa que o botão tem de carregar é a que
 * sustenta aquele selo: a que está mais longe.
 */
function comIamMaisLongeParaBruno(assessment: Assessment): Assessment {
  if (assessment.id !== "bruno-h2") return assessment;
  return {
    ...assessment,
    items: assessment.items.map((item) =>
      item.competencyId === "security-iam" ? { ...item, target: 4 } : item,
    ),
  };
}

/** Serverless vira lacuna da Ana e NÃO está no plano dela — é o "+ PDI" visível. */
function comServerlessEmAbertoParaAna(assessment: Assessment): Assessment {
  if (assessment.id !== "ana-h2") return assessment;
  return {
    ...assessment,
    items: assessment.items.map((item) =>
      item.competencyId === "cloud-serverless" ? { ...item, target: 5 } : item,
    ),
  };
}

const planoEmRascunho = (plan: DevelopmentPlan): DevelopmentPlan => ({
  ...plan,
  status: "Draft",
});

const estadoBase: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((assessment) =>
    comServerlessEmAbertoParaAna(comIamMaisLongeParaBruno(assessment)),
  ),
};

const estadoComPlanoEmRascunho: AppState = {
  ...estadoBase,
  plans: estadoBase.plans.map(planoEmRascunho),
};

const hrefDe = (elemento: HTMLElement): string => elemento.getAttribute("href") ?? "";

function irPara(busca: string): void {
  window.history.replaceState(null, "", `/development-plans${busca}`);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("Prioridades — 'Tratar no PDI' carrega pessoa e competência", () => {
  it("leva a competência da linha e a pessoa que está mais longe do alvo", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: estadoBase });
    renderWithApp(<GapPage />);

    await screen.findByText("IAM");
    const linhaIam = screen.getByText("IAM").closest("li")!;
    const acao = within(linhaIam).getByRole("link", { name: "Tratar no PDI" });

    const href = hrefDe(acao);
    expect(href).toContain("competencyId=security-iam");
    expect(href).toContain("architectId=bruno");
  });
});

/**
 * O estado é o de RASCUNHO desde a decisão do dono (opção B): com o PDI
 * aprovado o gatilho continua visível, porém desabilitado e explicando a
 * regra — quem prende esse caso é `pdi-aprovado-explica-o-botao.test.tsx`.
 * Aqui o que se prende é o DESTINO do gatilho quando ele funciona.
 */
describe("Perfil — '+ PDI' carrega a competência da linha clicada", () => {
  it("cada lacuna aponta para a própria competência, não para um destino genérico", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: estadoComPlanoEmRascunho });
    renderWithApp(<ProfilePage />);

    const acao = await screen.findByRole("link", { name: "+ PDI" });
    const href = hrefDe(acao);
    expect(href).toContain("architectId=ana");
    expect(href).toContain("competencyId=cloud-serverless");
  });
});

describe("Plano — o destino abre a criação do item já na competência recebida", () => {
  it("abre o diálogo da competência do link, sem a pessoa ter de reencontrá-la", async () => {
    irPara("?architectId=ana&competencyId=cloud-serverless");
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: estadoComPlanoEmRascunho });
    renderWithApp(<PlansPage />);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.textContent).toContain("Serverless");
  });

  it("não abre nada para quem não pode editar o diagnóstico daquela pessoa", async () => {
    irPara("?architectId=bruno&competencyId=security-iam");
    mockAppFetch(fetchMock, { user: fixtureMemberUser, state: estadoComPlanoEmRascunho });
    renderWithApp(<PlansPage />);

    await screen.findByText("Maiores gaps");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("não reabre competência que já é item do plano", async () => {
    irPara("?architectId=ana&competencyId=security-iam");
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: estadoComPlanoEmRascunho });
    renderWithApp(<PlansPage />);

    await screen.findByText("Maiores gaps");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  /**
   * O plano aprovado fecha o diagnóstico: a lista de sugestões some junto
   * com o gatilho de criar item. O endereço digitado à mão não pode ser a
   * porta lateral que reabre o que a aprovação fechou.
   */
  it("não abre em plano já aprovado, nem para quem pode agir pela pessoa", async () => {
    irPara("?architectId=ana&competencyId=cloud-serverless");
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: estadoBase });
    renderWithApp(<PlansPage />);

    await screen.findByText("Maiores gaps");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignora competência que não existe em vez de quebrar a tela", async () => {
    irPara("?architectId=ana&competencyId=competencia-que-nao-existe");
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: estadoComPlanoEmRascunho });
    renderWithApp(<PlansPage />);

    await screen.findByText("Maiores gaps");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
