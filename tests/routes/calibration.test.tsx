import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calibrationApi, type SessionUser } from "@/lib/api";
import type { CalibrationGateway } from "@/lib/gateways/calibration.gateway";
import { Route as CalibrationRoute } from "@/routes/calibration";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureUnassignedLeadUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { apiPath } from "@/lib/api-path";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Tela 3 (spec §3) — calibração entre líderes, distribuição de notas por
 * avaliador LADO A LADO. CONTRATO PRD-03: visível só para gestor + admin.
 * TODO nominal da spec: hoje o papel `lead` não distingue gestor de tech
 * lead, então a rota fica ADMIN-ONLY (`requireAdminReach`) até o modelo de
 * 4 perfis existir (onda 12+) — abrir para gestor é trocar a guarda, e este
 * teste é o lembrete vivo dessa decisão.
 *
 * Os dados vêm de `GET /calibration` (onda 24 ligou o gateway HTTP no
 * container; antes era o InMemoryCalibrationGateway): Marina 4.00
 * (leniente), Ricardo 3.00 (central), Paula 2.13 (severa) — média geral
 * ~3.12; Marina e Paula passam do limiar de alerta (0.5). O recorte de quem
 * aparece na distribuição é do SERVIDOR; o que se afirma aqui é a leitura.
 */
const fetchMock = vi.fn();

const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;

const distribuicaoDe = (
  counts: [number, number, number, number, number],
): Record<"1" | "2" | "3" | "4" | "5", number> => ({
  "1": counts[0],
  "2": counts[1],
  "3": counts[2],
  "4": counts[3],
  "5": counts[4],
});

const calibracaoDoServidor = {
  cycleId: "2026-h2",
  overall: { distribution: distribuicaoDe([5, 11, 16, 13, 7]), average: 162 / 52 },
  evaluators: [
    {
      userId: "evaluator-lenient",
      name: "Marina Lopes",
      teamIds: ["team-integration"],
      distribution: distribuicaoDe([0, 1, 4, 9, 6]),
      average: 4,
      itemsCount: 20,
      assessmentsCount: 4,
    },
    {
      userId: "evaluator-central",
      name: "Ricardo Nunes",
      teamIds: ["team-architecture"],
      distribution: distribuicaoDe([1, 3, 8, 3, 1]),
      average: 3,
      itemsCount: 16,
      assessmentsCount: 3,
    },
    {
      userId: "evaluator-severe",
      name: "Paula Souza",
      teamIds: ["team-platform"],
      distribution: distribuicaoDe([4, 7, 4, 1, 0]),
      average: 2.125,
      itemsCount: 16,
      assessmentsCount: 3,
    },
  ],
};

const calibrationRoute: FetchRoute = (href) =>
  href.includes(apiPath("/calibration")) ? jsonResponse(calibracaoDoServidor) : undefined;

describe("/calibration — distribuição de notas por avaliador", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [calibrationRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra os 3 avaliadores lado a lado, do mais desviante para o menos", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    const names = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(["Paula Souza", "Marina Lopes", "Ricardo Nunes"]);
  });

  it("quem passa do limiar leva o aviso de desvio; quem está na média, não", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    const cardOf = (name: string) =>
      screen.getByText(name).closest("[data-evaluator-card]") as HTMLElement;
    expect(within(cardOf("Marina Lopes")).getByRole("status")).toBeTruthy();
    expect(within(cardOf("Paula Souza")).getByRole("status")).toBeTruthy();
    expect(within(cardOf("Ricardo Nunes")).queryByRole("status")).toBeNull();
  });

  it("linha de contexto: média geral, nº de avaliadores e nº de avaliações", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    expect(screen.getByText("Média geral").parentElement?.textContent).toContain("3.12");
    expect(screen.getByText("Avaliadores").parentElement?.textContent).toContain("3");
    expect(screen.getByText("Avaliações").parentElement?.textContent).toContain("10");
  });

  it("cada card expõe a distribuição como tabela acessível (segundo canal além do gráfico)", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    const marina = screen.getByText("Marina Lopes").closest("[data-evaluator-card]") as HTMLElement;
    const table = within(marina).getByRole("table");
    expect(table.textContent).toContain("L4");
  });
});

/**
 * QA da onda 17, achado BLOQUEANTE — por URL direta a tela abria INTEIRA para
 * member: no acesso direto (SSR + hidratação do TanStack Start) o
 * `beforeLoad` não roda no navegador, e o dado de calibração vem de gateway
 * em memória, sem servidor para recusar. Reproduzido em navegador real:
 * member em /calibration via URL viu os 3 avaliadores e a média geral.
 *
 * A correção copia o mecanismo que JÁ segura /users no mesmo cenário: a
 * PRÓPRIA TELA nega quem não é admin (`users.adminOnly` é o precedente), com
 * a consulta desligada para não-admin. O redirect do `beforeLoad` continua
 * valendo na navegação interna — coberto em `route-guards.test.ts`, agora
 * por comportamento (para onde a navegação vai), não por identidade de
 * função (o teste antigo `toBe(requireAdminReach)` sobrevivia a uma guarda
 * quebrada por dentro).
 *
 * Estes testes afirmam o COMPORTAMENTO: nenhum dado de calibração renderiza
 * para member/lead. Contra o código atual nasceram VERMELHOS (a tela
 * mostrava Marina/Ricardo/Paula para qualquer papel).
 */
describe("/calibration nega DADO a quem não é admin — a tela é a última barreira", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderAs = (user: typeof fixtureMemberUser) => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user,
      state: scopedFixtureStateFor(user),
      routes: [calibrationRoute],
    });
    renderWithApp(<CalibrationPage />);
  };

  it("member não recebe a tela: aviso de acesso restrito, zero avaliadores, zero KPIs", async () => {
    renderAs(fixtureMemberUser);
    expect(await screen.findByText("Calibração é restrita a administradores.")).toBeTruthy();
    expect(screen.queryByText("Marina Lopes")).toBeNull();
    expect(screen.queryByText("Paula Souza")).toBeNull();
    expect(screen.queryByText("Média geral")).toBeNull();
  });

  it("lead também não — CONTRATO PRD-03: gestor só entra quando os 4 perfis existirem", async () => {
    renderAs(fixtureUnassignedLeadUser);
    expect(await screen.findByText("Calibração é restrita a administradores.")).toBeTruthy();
    expect(screen.queryByText("Marina Lopes")).toBeNull();
  });
});

/**
 * Ressalva 1 da onda 17 — mutante VIVO. O `enabled: isAdmin && cycleId !== null`
 * de `calibration.tsx` não tinha teste que o pinasse: apagar o `isAdmin` da
 * condição deixava a suíte inteira verde, porque os testes acima só afirmam o
 * que a TELA renderiza, e a tela nega por conta própria (`if (!isAdmin)`).
 *
 * O dano deixou de ser teórico na onda 24, que ligou o gateway HTTP: a
 * consulta agora SAI para o servidor: com o `isAdmin` fora do `enabled`, ela
 * sairia em nome de quem não pode vê-la e a única barreira restante seria o
 * backend.
 *
 * Estes testes afirmam o DISPARO, não a renderização: o queryFn da calibração
 * não é chamado para member nem para lead. O primeiro caso é o controle — sem
 * ele o par não pinaria nada, porque um `enabled` sempre-falso (ciclo nulo,
 * por exemplo) também deixaria os dois negativos verdes.
 */
describe("/calibration não CONSULTA para quem não é admin — o `enabled` é parte da barreira", () => {
  let calibrationSpy: MockInstance<CalibrationGateway["calibration"]>;

  beforeEach(() => {
    calibrationSpy = vi.spyOn(calibrationApi, "calibration");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    calibrationSpy.mockRestore();
  });

  const renderAs = (user: SessionUser) => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user,
      state: scopedFixtureStateFor(user),
      routes: [calibrationRoute],
    });
    renderWithApp(<CalibrationPage />);
  };

  it("controle: para admin a consulta SAI, com o ciclo ativo da fixture", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Marina Lopes");
    expect(calibrationSpy).toHaveBeenCalledWith("2026-h2");
  });

  it("member: a consulta não sai — nem para o ciclo ativo, nem para nenhum outro", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Calibração é restrita a administradores.");
    expect(calibrationSpy).not.toHaveBeenCalled();
  });

  it("lead: a consulta não sai — CONTRATO PRD-03 reserva a calibração a gestor + admin", async () => {
    renderAs(fixtureUnassignedLeadUser);
    await screen.findByText("Calibração é restrita a administradores.");
    expect(calibrationSpy).not.toHaveBeenCalled();
  });
});
