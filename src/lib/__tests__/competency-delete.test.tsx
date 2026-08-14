import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { setAuthToken, type AppState } from "../api";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureState } from "./fixtures";

/**
 * Exercita a Matriz de Competências de verdade: o componente da rota, ligado à
 * store, com `fetch` interceptado. É o caminho que o usuário percorre ao clicar
 * na lixeira de uma competência.
 */

const fetchMock = vi.fn();

/** Estado com duas competências no mesmo domínio, para checar a vizinha. */
const state: AppState = {
  ...fixtureState,
  competencies: fixtureState.competencies,
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

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const renderMatrix = () =>
  render(
    <Wrapper>
      <MatrixPage />
    </Wrapper>,
  );

describe("Matriz de Competências — exclusão", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
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
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("pede confirmação antes de excluir", async () => {
    renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Excluir Kubernetes"));

    // o diálogo cita a competência e o domínio
    expect(
      await screen.findByText(/Tem certeza que deseja excluir Kubernetes de Cloud Architecture\?/),
    ).toBeTruthy();
    // e nada foi enviado ainda
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    expect(screen.getAllByText("Kubernetes").length).toBeGreaterThan(0);
  });

  it("cancelar mantém a competência", async () => {
    renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Excluir Kubernetes"));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    expect(screen.getAllByText("Kubernetes").length).toBeGreaterThan(0);
  });

  it("confirmar remove da tela e chama DELETE na API", async () => {
    renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Excluir Kubernetes"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.queryByText("Kubernetes")).toBeNull());

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    expect(String(deleteCall?.[0])).toContain("/api/competencies/cloud-k8s");

    // as vizinhas continuam na tela
    expect(screen.getByText("Serverless")).toBeTruthy();
    expect(screen.getByText("IAM")).toBeTruthy();
  });
});
