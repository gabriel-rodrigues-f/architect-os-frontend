import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as CyclesRoute } from "@/routes/cycles";
import type { AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { useCycleSelection } from "@/lib/context-scope";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Onda 35, achado 2 do dono (literal): "Botão 'Ativar' em Ciclos não faz
 * nada → o ciclo ativado aparece no seletor do canto superior direito."
 * Captura: ciclo "2026 H2" Planejado, botão Ativar.
 *
 * Diagnóstico, provado aqui antes do conserto:
 *   - a rota do backend EXISTE (`PUT /settings/active-cycle`, admin) e o
 *     clique a chama — o primeiro teste já nascia verde;
 *   - o estado local só mudava `activeCycleId`: o cartão continuava
 *     "Planejado" com o botão "Ativar" no lugar, e o ciclo antes ativo não
 *     passava a "Encerrado" (regra que o backend aplica);
 *   - o seletor do topo lê as fatias `cycles`/`activeCycle`, e a tela de
 *     ciclos escrevia só no blob `/state` — o seletor não via a ativação até
 *     um recarregamento.
 * A sonda abaixo é o mesmo hook que alimenta o seletor do `AppShell`.
 */
const fetchMock = vi.fn();
const CyclesPage = CyclesRoute.options.component as () => ReactNode;

function SondaDoSeletor() {
  const { cycles, activeCycleId } = useCycleSelection();
  return (
    <output data-testid="seletor">
      {activeCycleId || "nenhum"}|{cycles.map((cycle) => `${cycle.id}:${cycle.status}`).join(",")}
    </output>
  );
}

const semCicloAtivo: AppState = {
  ...fixtureState,
  cycles: [
    { id: "2026-h1", name: "2026 H1", start: "2026-01-01", end: "2026-06-30", status: "Closed" },
    { id: "2026-h2", name: "2026 H2", start: "2026-07-01", end: "2026-12-31", status: "Planned" },
  ],
  activeCycleId: "",
};

const comCicloAtivoAnterior: AppState = {
  ...fixtureState,
  cycles: [
    { id: "2026-h1", name: "2026 H1", start: "2026-01-01", end: "2026-06-30", status: "Active" },
    { id: "2026-h2", name: "2026 H2", start: "2026-07-01", end: "2026-12-31", status: "Planned" },
  ],
  activeCycleId: "2026-h1",
};

const ativacoes: string[] = [];

const ativarNoServidor: FetchRoute = (href, init) => {
  if (!href.endsWith(apiPath("/settings/active-cycle")) || init?.method !== "PUT") return undefined;
  const body = JSON.parse(String(init.body)) as { cycleId: string };
  ativacoes.push(body.cycleId);
  return jsonResponse({ cycleId: body.cycleId });
};

function prepararTela(state: AppState) {
  mockAppFetch(fetchMock, { state, routes: [ativarNoServidor] });
  renderWithApp(
    <>
      <CyclesPage />
      <SondaDoSeletor />
    </>,
  );
}

function cartaoDe(nome: string): HTMLElement {
  const titulo = screen.getByText(nome, { selector: "p" });
  const cartao = titulo.closest(".surface-card");
  if (!cartao) throw new Error(`cartão de ${nome} não encontrado`);
  return cartao as HTMLElement;
}

describe("Ciclos — 'Ativar' ativa de verdade", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    ativacoes.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o clique chama a operação do backend com o ciclo escolhido", async () => {
    prepararTela(semCicloAtivo);
    await userEvent.click(await screen.findByRole("button", { name: "Ativar" }));

    await waitFor(() => expect(ativacoes).toEqual(["2026-h2"]));
  });

  it("o cartão passa a 'Ativo' e o botão 'Ativar' dá lugar a 'Encerrar'", async () => {
    prepararTela(semCicloAtivo);
    await userEvent.click(await screen.findByRole("button", { name: "Ativar" }));

    await waitFor(() => expect(cartaoDe("2026 H2").textContent).toContain("Ativo"));
    expect(screen.queryByRole("button", { name: "Ativar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Encerrar" })).toBeTruthy();
  });

  it("sem ciclo ativo antes, o ativado vira o selecionado do seletor do topo", async () => {
    prepararTela(semCicloAtivo);
    await waitFor(() =>
      expect(screen.getByTestId("seletor").textContent).toBe(
        "nenhum|2026-h1:Closed,2026-h2:Planned",
      ),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Ativar" }));

    await waitFor(() =>
      expect(screen.getByTestId("seletor").textContent).toBe(
        "2026-h2|2026-h1:Closed,2026-h2:Active",
      ),
    );
  });

  it("ativar um ciclo encerra o que estava ativo — na tela e no seletor, como no backend", async () => {
    prepararTela(comCicloAtivoAnterior);
    await userEvent.click(await screen.findByRole("button", { name: "Ativar" }));

    await waitFor(() => expect(cartaoDe("2026 H1").textContent).toContain("Encerrado"));
    expect(cartaoDe("2026 H2").textContent).toContain("Ativo");
    await waitFor(() =>
      expect(screen.getByTestId("seletor").textContent).toBe(
        "2026-h2|2026-h1:Closed,2026-h2:Active",
      ),
    );
  });

  it("recusa do servidor devolve o cartão a 'Planejado' e avisa", async () => {
    mockAppFetch(fetchMock, {
      state: semCicloAtivo,
      routes: [
        (href, init) =>
          href.endsWith(apiPath("/settings/active-cycle")) && init?.method === "PUT"
            ? jsonResponse(
                { code: "CYCLE_NOT_FOUND", message: "Ciclo não encontrado.", correlationId: "x" },
                404,
              )
            : undefined,
      ],
    });
    renderWithApp(
      <>
        <CyclesPage />
        <SondaDoSeletor />
      </>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ativar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Ativar" })).toBeTruthy());
    expect(cartaoDe("2026 H2").textContent).toContain("Planejado");
    await waitFor(() =>
      expect(screen.getByTestId("seletor").textContent).toBe(
        "nenhum|2026-h1:Closed,2026-h2:Planned",
      ),
    );
  });
});
