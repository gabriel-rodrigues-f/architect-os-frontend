import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import type { AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { useCycleSelection } from "@/lib/context-scope";
import { fixtureAssignedManagerUser, fixtureState } from "../helpers/fixtures";
import {
  emptyEligibilityRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * BUG do dono (2026-09-08): *"Hoje quando mudo um ciclo, ainda vejo a mesma
 * avaliação de desempenho."*
 *
 * Uma avaliação pertence a UM ciclo. O seletor do cabeçalho é o filtro de
 * ciclo da casa (direção de 2026-09-08, regras 11 e 16: "as telas respondem
 * sempre sobre o par time + pessoa + ciclo selecionado"), então trocar ali
 * troca a avaliação lida — e ciclo sem avaliação mostra o vazio da casa.
 *
 * O que continua valendo: o link "Ver" do histórico da ficha abre o ciclo do
 * link (HIST-001), e não o ciclo ativo. As duas regras convivem — o link diz
 * por onde a tela ENTRA; o cabeçalho manda a partir da primeira troca.
 *
 * A sonda abaixo é o MESMO hook que alimenta o seletor do `AppShell`
 * (`useCycleSelection`), como em `cycles-ativar.test.tsx`.
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

function SeletorDoCabecalho() {
  const { cycles, setActiveCycle } = useCycleSelection();
  return (
    <div>
      {cycles.map((cycle) => (
        <button key={cycle.id} type="button" onClick={() => setActiveCycle(cycle.id)}>
          {`Ativar ${cycle.name}`}
        </button>
      ))}
    </div>
  );
}

const ativarNoServidor: FetchRoute = (href, init) => {
  if (!href.endsWith(apiPath("/settings/active-cycle")) || init?.method !== "PUT") return undefined;
  const body = JSON.parse(String(init.body)) as { cycleId: string };
  return jsonResponse({ cycleId: body.cycleId });
};

/** Ana tem "ana-h1" (final 3 em Kubernetes) e "ana-h2" (final 4) — e nada em H3. */
const comTerceiroCiclo: AppState = {
  ...fixtureState,
  cycles: [
    ...fixtureState.cycles,
    { id: "2026-h3", name: "2026 H3", start: "2027-01-01", end: "2027-06-30", status: "Planned" },
  ],
};

function abrirTela(state: AppState = fixtureState) {
  mockAppFetch(fetchMock, {
    user: fixtureAssignedManagerUser,
    state,
    routes: [emptyEligibilityRoute, ativarNoServidor],
  });
  renderWithApp(
    <>
      <SeletorDoCabecalho />
      <AssessmentsPage />
    </>,
  );
}

/** Colunas da tabela: competência, autoavaliação, líder, alvo, final, distância, notas. */
function notaFinalDeKubernetes(): string {
  const linha = screen.getByText("Kubernetes").closest("tr");
  return linha?.querySelectorAll("td")[4]?.textContent ?? "";
}

const trocarCicloPara = (nome: string) =>
  fireEvent.click(screen.getByRole("button", { name: `Ativar ${nome}` }));

describe("Avaliação de Desempenho — a avaliação é a do ciclo escolhido", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/assessments");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("trocar o ciclo no cabeçalho troca a avaliação exibida", async () => {
    abrirTela();
    await screen.findByText("Kubernetes");
    expect(notaFinalDeKubernetes()).toContain("4");

    trocarCicloPara("2026 H1");

    await waitFor(() => {
      expect(notaFinalDeKubernetes()).toContain("3");
    });
    // O prazo do `waitFor` desta casa é 5 s (`test-setup.ts`); o do teste
    // precisa ser maior, senão a espera morre antes de contar o que viu.
  }, 10_000);

  it("ciclo sem avaliação mostra o vazio da casa, com o convite de abrir para quem pode", async () => {
    abrirTela(comTerceiroCiclo);
    await screen.findByText("Kubernetes");

    trocarCicloPara("2026 H3");

    expect(await screen.findByText("Nenhuma avaliação neste ciclo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir avaliação do ciclo" })).toBeTruthy();
    expect(screen.queryByText("Kubernetes")).toBeNull();
  }, 10_000);

  it("o link do histórico da ficha continua abrindo o ciclo do link (HIST-001)", async () => {
    window.history.pushState({}, "", "/assessments?professionalId=ana&cycleId=2026-h1");
    abrirTela();
    await screen.findByText("Kubernetes");

    expect(notaFinalDeKubernetes()).toContain("3");
  });

  /**
   * A ordem é de MÃO ÚNICA. Quem só compara o ciclo ativo de agora com o do
   * mount volta a obedecer ao link assim que o cabeçalho passeia e retorna ao
   * ciclo de entrada — e a tela mostra outra vez a avaliação de outro ciclo,
   * com o cabeçalho dizendo outra coisa. É o defeito do dono de novo, pela
   * porta dos fundos.
   */
  it("depois da primeira troca o link não volta a mandar, nem no ciclo em que a tela entrou", async () => {
    window.history.pushState({}, "", "/assessments?professionalId=ana&cycleId=2026-h1");
    abrirTela();
    await screen.findByText("Kubernetes");
    expect(notaFinalDeKubernetes()).toContain("3");

    trocarCicloPara("2026 H1");
    await waitFor(() => {
      expect(notaFinalDeKubernetes()).toContain("3");
    });

    trocarCicloPara("2026 H2");

    await waitFor(() => {
      expect(notaFinalDeKubernetes()).toContain("4");
    });
  }, 10_000);
});
