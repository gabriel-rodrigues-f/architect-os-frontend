import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as CalibrationRoute } from "@/routes/calibration";
import {
  fixtureAssignedManagerUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Fatia CALIBRAÇÃO — *"me diga a utilidade da tela de calibração… não estou
 * vendo valor nessa tela"* e *"estes gráficos precisam ser melhor
 * explicados"* (dono, 2026-09-09).
 *
 * A tela é a única que NÃO olha quem é avaliado — ela olha quem AVALIA — e em
 * lugar nenhum isso estava escrito. Sem essa frase, as barras parecem mais uma
 * distribuição de proficiência do time, que é o que quase toda outra tela
 * mostra. Estes casos afirmam as quatro coisas que faltavam ser ditas, e os
 * dois defeitos que faziam a tela mentir ou prometer.
 *
 * Os números não são inventados: saem do mesmo recorte que os testes de
 * calibração já usavam. Média geral 162/52 = 3.12; Marina 4.00 (+0.88),
 * Ricardo 3.00 (−0.12), Paula 2.13 (−0.99); o limiar do aviso é 0.50, que é o
 * que separa Marina e Paula de Ricardo.
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
      teamIds: ["seed-completo-time-dados"],
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
  ],
};

const calibrationRoute: FetchRoute = (href) =>
  href.includes(apiPath("/calibration")) && !href.includes("assistance")
    ? jsonResponse(calibracaoDoServidor)
    : undefined;

const teamsRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([
        { id: "seed-completo-time-dados", name: "Dados e Inteligência", active: true },
        { id: "team-architecture", name: "Arquitetura", active: true },
      ])
    : undefined;

const montarTela = (routes: FetchRoute[]) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAssignedManagerUser,
    state: scopedFixtureStateFor(fixtureAssignedManagerUser, fixtureState, ["time-plataforma"]),
    routes,
  });
  renderWithApp(<CalibrationPage />);
};

const cartaoDe = (name: string) =>
  screen.getByText(name).closest("[data-evaluator-card]") as HTMLElement;

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a tela diz o que ela é: ela olha quem AVALIA", () => {
  it("o subtítulo separa quem avalia de quem é avaliado", async () => {
    montarTela([calibrationRoute, teamsRoute]);

    await screen.findByText("Marina Lopes");
    expect(
      screen.getByText(/olha quem AVALIA, não quem é avaliado/i),
      "sem esta frase as barras passam por distribuição de proficiência do time",
    ).toBeTruthy();
  });

  it("a ajuda do cabeçalho faz a pergunta que a tela responde", async () => {
    montarTela([calibrationRoute, teamsRoute]);
    const usuario = userEvent.setup();

    await screen.findByText("Marina Lopes");
    await usuario.click(screen.getByRole("button", { name: /Calibração entre Líderes/ }));

    expect(await screen.findByText(/quer dizer a mesma coisa/i)).toBeTruthy();
  });
});

describe("os gráficos se explicam", () => {
  it("diz o que o eixo conta e o que é L1…L5 — nenhum dos dois tinha rótulo", async () => {
    montarTela([calibrationRoute, teamsRoute]);

    await screen.findByText("Marina Lopes");
    const marina = cartaoDe("Marina Lopes");
    expect(within(marina).getByText(/quantas notas/i)).toBeTruthy();
    expect(within(marina).getByText(/nível de proficiência/i)).toBeTruthy();
  });

  it("o 'vs geral' nomeia o número contra o qual compara", async () => {
    montarTela([calibrationRoute, teamsRoute]);

    await screen.findByText("Marina Lopes");
    expect(
      within(cartaoDe("Marina Lopes")).getByText(/\+0\.88 vs média geral \(3\.12\)/),
    ).toBeTruthy();
  });

  it("a linha de notas diz que ela é o PESO do avaliador na média", async () => {
    montarTela([calibrationRoute, teamsRoute]);

    await screen.findByText("Marina Lopes");
    const linha = within(cartaoDe("Marina Lopes")).getByText(/20 nota/);
    expect(linha.textContent).toMatch(/4 avaliaç/);
    expect(linha.textContent, "três avaliações não pesam como uma").toMatch(/peso/i);
  });

  /**
   * O limiar existia só no código (`DEVIATION_ALERT_THRESHOLD`). Quem via um
   * cartão acender e o vizinho não ficava sem a régua que separa os dois.
   */
  it("o limiar que acende o aviso aparece na tela, e é o número da classe", async () => {
    montarTela([calibrationRoute, teamsRoute]);

    await screen.findByText("Marina Lopes");
    expect(within(cartaoDe("Marina Lopes")).getByRole("status").textContent).toContain("0.50");
  });

  it("quem não passa do limiar não acende — e o cartão explica isso no ?", async () => {
    montarTela([calibrationRoute, teamsRoute]);
    const usuario = userEvent.setup();

    await screen.findByText("Ricardo Nunes");
    const ricardo = cartaoDe("Ricardo Nunes");
    expect(within(ricardo).queryByRole("status")).toBeNull();

    await usuario.click(within(ricardo).getByRole("button", { name: /Como ler/ }));
    expect((await screen.findByText(/acende a partir de 0\.50/i)).textContent).toBeTruthy();
  });
});

describe("o aviso é acionável: com quem falar e o que reconferir", () => {
  it("nomeia o avaliador com quem conversar", async () => {
    montarTela([calibrationRoute, teamsRoute]);

    await screen.findByText("Marina Lopes");
    expect(within(cartaoDe("Marina Lopes")).getByRole("status").textContent).toContain(
      "Marina Lopes",
    );
  });

  /**
   * "Vale conferir a régua" não dizia QUAIS notas. O degrau apontado é aquele
   * em que a distribuição deste avaliador mais se afasta da do ciclo: Marina
   * concentrou 9 das 20 notas em L4 (45% contra 25% do ciclo).
   */
  it("aponta quantas notas reconferir, e em qual nível", async () => {
    montarTela([calibrationRoute, teamsRoute]);

    await screen.findByText("Marina Lopes");
    const aviso = within(cartaoDe("Marina Lopes")).getByRole("status").textContent ?? "";
    expect(aviso).toMatch(/9 nota/);
    expect(aviso).toContain("L4");
  });
});

describe("DEFEITO: o time aparecia como identificador cru", () => {
  it("mostra o nome cadastrado do time, e nunca o identificador", async () => {
    montarTela([calibrationRoute, teamsRoute]);

    await screen.findByText("Marina Lopes");
    const marina = cartaoDe("Marina Lopes");
    expect(within(marina).getByText("Dados e Inteligência")).toBeTruthy();
    expect(marina.textContent).not.toContain("seed-completo-time-dados");
  });
});
