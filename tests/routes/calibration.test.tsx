import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calibrationApi, type SessionUser } from "@/lib/api";
import type { CalibrationGateway } from "@/lib/gateways/calibration.gateway";
import { Route as CalibrationRoute } from "@/routes/calibration";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureSupportUser,
  fixtureUnassignedTechLeadUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { apiPath } from "@/lib/api-path";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Tela 3 (spec §3) — calibração entre líderes, distribuição de notas por
 * avaliador LADO A LADO. CONTRATO PRD-03 lia "gerente + admin"; a revisão de
 * papéis (dono, 2026-09-05, D1) tirou o admin: calibração é rito de gestão,
 * do GERENTE COM VÍNCULO. O admin administra o sistema, não as pessoas.
 *
 * A rota era ADMIN-ONLY por FALTA de vocabulário: `lead` não distinguia
 * gerente de tech lead, e abrir para `lead` teria dado a leitura ao tech lead
 * — exatamente quem o contrato exclui. Com os quatro papéis (backend
 * ADR-0047) a distinção existe, e o contrato passa a ser dizível: o gerente
 * entra, o tech lead não.
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

/**
 * Fatia CALIBRAÇÃO — o cartão nomeia o time em vez de mostrar o
 * identificador, então a tela passou a pedir a listagem mínima de times
 * (`GET /teams`), e a leitura de apoio só é oferecida se houver provedor
 * (`GET /assistants/availability`). As duas são rotas de APOIO: o que estes
 * casos afirmam continua sendo o conteúdo da calibração.
 */
const teamsRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([
        { id: "team-integration", name: "Integração", active: true },
        { id: "team-architecture", name: "Arquitetura", active: true },
        { id: "team-platform", name: "Plataforma", active: true },
      ])
    : undefined;

const leituraConfigurada: FetchRoute = (href) =>
  href.endsWith(apiPath("/assistants/availability"))
    ? jsonResponse({ naturalLanguageReading: true })
    : undefined;

const rotasDeApoio: FetchRoute[] = [teamsRoute, leituraConfigurada];

describe("/calibration — distribuição de notas por avaliador", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // D1 (dono, 2026-09-05): a leitura é do gerente vinculado — o admin não calibra.
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: scopedFixtureStateFor(fixtureAssignedManagerUser, fixtureState, ["time-plataforma"]),
      routes: [calibrationRoute, ...rotasDeApoio],
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
describe("/calibration nega DADO a quem não calibra — a tela é a última barreira", () => {
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
      routes: [calibrationRoute, ...rotasDeApoio],
    });
    renderWithApp(<CalibrationPage />);
  };

  it("member não recebe a tela: aviso de acesso restrito, zero avaliadores, zero KPIs", async () => {
    renderAs(fixtureMemberUser);
    expect(await screen.findByText("Calibração é do gerente do time.")).toBeTruthy();
    expect(screen.queryByText("Marina Lopes")).toBeNull();
    expect(screen.queryByText("Paula Souza")).toBeNull();
    expect(screen.queryByText("Média geral")).toBeNull();
  });

  /**
   * O tech lead é a metade do antigo `lead` que o CONTRATO PRD-03 EXCLUI. Sem
   * este caso, "abrir para o gerente" viraria "abrir para quem lidera" — que é
   * o vazamento que a falta de vocabulário vinha impedindo por acidente.
   */
  it("tech lead não recebe a tela — o contrato reserva a leitura a gerente + admin", async () => {
    renderAs(fixtureUnassignedTechLeadUser);
    expect(await screen.findByText("Calibração é do gerente do time.")).toBeTruthy();
    expect(screen.queryByText("Marina Lopes")).toBeNull();
  });

  it("regra 6 (dono, 2026-09-08): o administrador recebe a tela inteira — ela faz tudo", async () => {
    renderAs(fixtureAdminUser);
    expect(await screen.findByText("Marina Lopes")).toBeTruthy();
    expect(screen.getByText("Média geral")).toBeTruthy();
    expect(screen.queryByText("Calibração é do gerente do time.")).toBeNull();
  });

  it("D1 (dono, 2026-09-05): o suporte não recebe a tela — ele opera o sistema, não calibra pessoas", async () => {
    renderAs(fixtureSupportUser);
    expect(await screen.findByText("Calibração é do gerente do time.")).toBeTruthy();
    expect(screen.queryByText("Marina Lopes")).toBeNull();
    expect(screen.queryByText("Média geral")).toBeNull();
  });

  it("o gerente recebe a tela INTEIRA — é dele a leitura que o contrato reserva", async () => {
    renderAs(fixtureAssignedManagerUser);
    expect(await screen.findByText("Marina Lopes")).toBeTruthy();
    expect(screen.getByText("Média geral")).toBeTruthy();
    expect(screen.queryByText("Calibração é do gerente do time.")).toBeNull();
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
describe("/calibration não CONSULTA para quem não calibra — o `enabled` é parte da barreira", () => {
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
      routes: [calibrationRoute, ...rotasDeApoio],
    });
    renderWithApp(<CalibrationPage />);
  };

  it("D1 (dono, 2026-09-05): suporte: a consulta não sai — o suporte não calibra", async () => {
    renderAs(fixtureSupportUser);
    await screen.findByText("Calibração é do gerente do time.");
    expect(calibrationSpy).not.toHaveBeenCalled();
  });

  it("regra 6: para o administrador a consulta SAI, com o ciclo ativo", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Marina Lopes");
    expect(calibrationSpy).toHaveBeenCalledWith("2026-h2");
  });

  it("member: a consulta não sai — nem para o ciclo ativo, nem para nenhum outro", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Calibração é do gerente do time.");
    expect(calibrationSpy).not.toHaveBeenCalled();
  });

  it("tech lead: a consulta não sai — CONTRATO PRD-03 reserva a calibração a gerente + admin", async () => {
    renderAs(fixtureUnassignedTechLeadUser);
    await screen.findByText("Calibração é do gerente do time.");
    expect(calibrationSpy).not.toHaveBeenCalled();
  });

  it("controle: para o gerente vinculado a consulta SAI, com o ciclo ativo — o `enabled` abre junto com a tela", async () => {
    renderAs(fixtureAssignedManagerUser);
    await screen.findByText("Marina Lopes");
    expect(calibrationSpy).toHaveBeenCalledWith("2026-h2");
  });
});

/**
 * Item 3 do lote de 2026-09-08: o aviso de *"Notas sem autor registrado"*
 * morava DENTRO do ramo `evaluators.length === 0` — só aparecia quando não
 * havia avaliador nenhum. Com dado MISTO (parte das notas com autor, parte
 * sem) ele sumia da tela, e as notas órfãs continuavam contando na "Média
 * geral": os números da Calibração deixavam de fechar entre si — a média dos
 * cartões não bate com a média geral — sem ninguém avisar.
 *
 * Nasceu VERMELHO: com os três avaliadores e 7 notas órfãs, a tela de hoje
 * não mostra o aviso.
 */
describe("o aviso de notas sem autor não depende de a tela estar vazia", () => {
  const comOrfas = (evaluators: typeof calibracaoDoServidor.evaluators) => ({
    ...calibracaoDoServidor,
    evaluators,
    unattributed: {
      distribution: distribuicaoDe([1, 2, 2, 1, 1]),
      average: 3,
      itemsCount: 7,
    },
  });

  const renderComResposta = (resposta: unknown) => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: scopedFixtureStateFor(fixtureAssignedManagerUser, fixtureState, ["time-plataforma"]),
      routes: [
        (href: string) =>
          href.includes(apiPath("/calibration")) ? jsonResponse(resposta) : undefined,
        ...rotasDeApoio,
      ],
    });
    renderWithApp(<CalibrationPage />);
  };

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("dado misto: o aviso aparece JUNTO com a distribuição dos avaliadores", async () => {
    renderComResposta(comOrfas(calibracaoDoServidor.evaluators));

    expect(await screen.findByText("Notas sem autor registrado")).toBeTruthy();
    expect(screen.getByText("Marina Lopes")).toBeTruthy();
    expect(screen.getByText("Média geral")).toBeTruthy();
  });

  it("o aviso diz QUANTAS notas estão fora da comparação", async () => {
    renderComResposta(comOrfas(calibracaoDoServidor.evaluators));

    const aviso = (await screen.findByText("Notas sem autor registrado")).closest("div");
    expect(aviso?.textContent).toContain("7");
  });

  it("sem avaliador nenhum, o aviso continua sendo o que a tela mostra", async () => {
    renderComResposta(comOrfas([]));

    expect(await screen.findByText("Notas sem autor registrado")).toBeTruthy();
    expect(screen.queryByText("Nenhuma avaliação com nota neste ciclo")).toBeNull();
  });

  it("sem nota órfã nenhuma, ninguém é avisado à toa", async () => {
    renderComResposta(calibracaoDoServidor);

    await screen.findByText("Marina Lopes");
    expect(screen.queryByText("Notas sem autor registrado")).toBeNull();
  });
});
