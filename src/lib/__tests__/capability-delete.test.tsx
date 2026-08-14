import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as CapabilityRoute } from "@/routes/capability-map";
import { setAuthToken, type AppState } from "../api";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureState } from "./fixtures";

/**
 * Exercita o Mapa de Capacidades de verdade: o componente da rota, ligado à
 * store, com `fetch` interceptado — o caminho que o usuário percorre ao clicar
 * na lixeira de uma capacidade.
 *
 * Na fixture, Ana e Bruno têm `strongDomain: "cloud"` e `gapDomain: "security"`,
 * então as duas capacidades nascem vinculadas. `freeState` solta a Cloud para
 * exercitar o caminho em que a exclusão é permitida.
 */

const fetchMock = vi.fn();

/** Ninguém aponta para "cloud": a exclusão deve passar. */
const freeState: AppState = {
  ...fixtureState,
  architects: fixtureState.architects.map((a) => ({
    ...a,
    strongDomain: "security",
    gapDomain: "security",
  })),
};

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <StoreProvider>{children}</StoreProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;

const renderPage = (state: AppState) => {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === "DELETE")
      return Promise.resolve(
        new Response(JSON.stringify({ competenciesRemoved: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    if (String(url).endsWith("/api/state")) {
      return Promise.resolve(
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  return render(
    <Wrapper>
      <CapabilityPage />
    </Wrapper>,
  );
};

describe("Mapa de Capacidades — exclusão", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("exclui quando nenhum arquiteto está vinculado", async () => {
    renderPage(freeState);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Excluir Cloud Architecture"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.queryByText("Cloud Architecture")).toBeNull());

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    expect(String(deleteCall?.[0])).toContain("/api/categories/cloud");
  });

  /**
   * Regressão: o DELETE ia com `content-type: application/json` e sem corpo, e o
   * Fastify respondia 400 (FST_ERR_CTP_EMPTY_JSON_BODY). A store revertia a
   * remoção otimista e a capacidade reaparecia na tela.
   */
  it("não manda content-type em requisição sem corpo", async () => {
    renderPage(freeState);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Excluir Cloud Architecture"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true),
    );

    const bodyless = fetchMock.mock.calls.filter(([, init]) => init?.body === undefined);
    expect(bodyless.length).toBeGreaterThan(0);
    for (const [, init] of bodyless) {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers["content-type"]).toBeUndefined();
    }
  });

  it("bloqueia e lista os arquitetos quando a capacidade está vinculada", async () => {
    renderPage(fixtureState);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Excluir Cloud Architecture"));

    expect(await screen.findByText(/Não é possível excluir Cloud Architecture/)).toBeTruthy();

    // escopado ao modal: os nomes também aparecem nas faixas do card
    const modal = within(await screen.findByRole("dialog"));
    expect(modal.getByText("Ana Martins")).toBeTruthy();
    expect(modal.getByText("Bruno Almeida")).toBeTruthy();
    expect(modal.getAllByText("domínio forte").length).toBe(2);

    // nada foi enviado e a capacidade continua na tela
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    expect(screen.getAllByText("Cloud Architecture").length).toBeGreaterThan(0);
  });

  /**
   * Leitura ocidental: as faixas sobem da esquerda para a direita, da menor
   * proficiência para a maior, no card e nos chips da nova capacidade.
   */
  it("mostra as faixas em ordem crescente de proficiência", async () => {
    renderPage(freeState);
    await screen.findByText("Cloud Architecture");

    const ordem = [
      "Lacunas (<2,5)",
      "Praticantes (2,5+)",
      "Avançados (3,5+)",
      "Especialistas (4,5+)",
    ];

    const noCard = screen
      .getAllByText(/^(Lacunas|Praticantes|Avançados|Especialistas) \(/)
      .map((el) => el.textContent);
    expect(noCard.slice(0, 4)).toEqual(ordem);

    await userEvent.click(screen.getByRole("button", { name: "Nova capacidade" }));
    const modal = within(await screen.findByRole("dialog"));
    const chips = modal
      .getAllByText(/^(Lacunas|Praticantes|Avançados|Especialistas) \(/)
      .map((el) => el.textContent);
    expect(chips).toEqual(ordem);
  });

  it("indica quando a capacidade é forte e de lacuna do mesmo arquiteto", async () => {
    renderPage({
      ...fixtureState,
      architects: [{ ...fixtureState.architects[0]!, strongDomain: "cloud", gapDomain: "cloud" }],
    });
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Excluir Cloud Architecture"));

    expect(await screen.findByText("domínio forte e domínio de lacuna")).toBeTruthy();
  });
});
