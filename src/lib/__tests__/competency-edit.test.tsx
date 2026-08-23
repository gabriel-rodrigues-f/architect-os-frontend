import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * O lápis ao lado da lixeira: editar nome e nível esperado por cargo sem sair
 * da Matriz de Competências, em vez de precisar excluir e recriar.
 */

const fetchMock = vi.fn();

const state: AppState = { ...fixtureState, competencies: fixtureState.competencies };

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthReady>
            <StoreProvider>{children}</StoreProvider>
          </AuthReady>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

/** REVISAO-360-FRONTEND, Seção 40-42 — a matriz agora nasce recolhida; "Expandir tudo" reproduz o antigo padrão sempre-aberto que este teste pressupõe. */
const renderMatrix = async () => {
  render(
    <Wrapper>
      <MatrixPage />
    </Wrapper>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Expandir tudo" }));
};

describe("Matriz de Competências — edição", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (init?.method === "PATCH") return Promise.resolve(new Response(null, { status: 204 }));
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
  });

  it("abre com o nome e os níveis atuais preenchidos", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));

    expect(await screen.findByDisplayValue("Kubernetes")).toBeTruthy();
    expect(screen.getByLabelText(/Nível esperado por cargo — Nível I$/)).toHaveProperty(
      "value",
      "3",
    );
    expect(screen.getByLabelText(/Nível esperado por cargo — Nível III/)).toHaveProperty(
      "value",
      "5",
    );
  });

  it("salvar renomeia a competência na tela e envia PATCH", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));
    const nome = await screen.findByLabelText("Nome");
    await userEvent.clear(nome);
    await userEvent.type(nome, "Kubernetes e Orquestração de Containers");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.queryByText("Kubernetes e Orquestração de Containers")).toBeTruthy(),
    );
    expect(screen.queryByText("Kubernetes")).toBeNull();

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(String(patchCall?.[0])).toContain("/api/competencies/cloud-k8s");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      name: "Kubernetes e Orquestração de Containers",
    });
  });

  it("mudar o nível de um cargo não altera os outros dois", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));
    await userEvent.selectOptions(
      screen.getByLabelText(/Nível esperado por cargo — Nível I$/),
      "1",
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeDefined();
      const body = JSON.parse(String(patchCall?.[1]?.body)) as {
        expected?: Record<string, number>;
      };
      expect(body.expected?.["arquiteto-de-solucoes-i"]).toBe(1);
      expect(body.expected?.["arquiteto-de-solucoes-ii"]).toBe(4);
      expect(body.expected?.["arquiteto-de-solucoes-iii"]).toBe(5);
    });
  });

  it("cancelar não envia nada e preserva o nome original", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Editar Kubernetes"));
    const nome = await screen.findByLabelText("Nome");
    await userEvent.clear(nome);
    await userEvent.type(nome, "Nome que não deve ser salvo");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Kubernetes")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });
});
