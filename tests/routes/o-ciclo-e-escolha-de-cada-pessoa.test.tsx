import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { ContextScope, useCycleSelection } from "@/lib/context-scope";
import { CyclePreference } from "@/lib/cycle-preference";
import { useStore } from "@/lib/store";
import { fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono, 2026-09-10: *"O tech lead não consegue mais mudar o ciclo. O ciclo
 * está mudando de acordo com o admin. Quero que todos os perfis possam mudar
 * o ciclo enquanto logados. Essa mudança deve valer apenas para o seu perfil."*
 *
 * O seletor do rodapé deixa de ser escrita global (`PUT /settings/active-cycle`)
 * e vira preferência de leitura, por conta. Este arquivo prende as três
 * metades: o profissional escolhe; a escolha chega às telas (o `ContextScope`);
 * e nada vai ao servidor.
 */
const fetchMock = vi.fn();

function Rodape() {
  const { cycles, activeCycleId, setActiveCycle } = useCycleSelection();
  return (
    <div>
      <output data-testid="rodape">{activeCycleId}</output>
      {cycles.map((cycle) => (
        <button key={cycle.id} type="button" onClick={() => setActiveCycle(cycle.id)}>
          {`Ler ${cycle.name}`}
        </button>
      ))}
    </div>
  );
}

function Tela() {
  const store = useStore();
  return <output data-testid="tela">{store.activeCycleId}</output>;
}

function abrir() {
  mockAppFetch(fetchMock, { user: fixtureMemberUser, state: fixtureState, routes: [] });
  renderWithApp(
    <>
      <Rodape />
      <ContextScope contexts={["cycles", "activeCycle"]}>
        <Tela />
      </ContextScope>
    </>,
  );
}

const escreveuNoServidor = () =>
  fetchMock.mock.calls.some(
    ([entrada, init]) =>
      String(entrada instanceof Request ? entrada.url : entrada).endsWith(
        apiPath("/settings/active-cycle"),
      ) && (init as RequestInit | undefined)?.method === "PUT",
  );

describe("o ciclo em foco é escolha de cada pessoa (dono, 2026-09-10)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o profissional troca o ciclo no rodapé, a tela acompanha, e o servidor não é tocado", async () => {
    abrir();
    await waitFor(() => expect(screen.getByTestId("tela").textContent).toBe("2026-h2"));

    fireEvent.click(screen.getByRole("button", { name: "Ler 2026 H1" }));

    await waitFor(() => expect(screen.getByTestId("rodape").textContent).toBe("2026-h1"));
    await waitFor(() => expect(screen.getByTestId("tela").textContent).toBe("2026-h1"));
    expect(escreveuNoServidor()).toBe(false);
  });

  it("a escolha fica guardada na conta de quem escolheu", async () => {
    abrir();
    await waitFor(() => expect(screen.getByTestId("rodape").textContent).toBe("2026-h2"));
    fireEvent.click(screen.getByRole("button", { name: "Ler 2026 H1" }));
    await waitFor(() =>
      expect(CyclePreference.forBrowser(fixtureMemberUser).read()).toBe("2026-h1"),
    );
    expect(CyclePreference.forBrowser({ id: "outra-conta" }).read()).toBeNull();
  });

  it("uma escolha que já não existe no cadastro volta ao ciclo ativo da organização", async () => {
    CyclePreference.forBrowser(fixtureMemberUser).write("2019-h1");
    abrir();
    await waitFor(() => expect(screen.getByTestId("tela").textContent).toBe("2026-h2"));
    expect(screen.getByTestId("rodape").textContent).toBe("2026-h2");
  });
});
