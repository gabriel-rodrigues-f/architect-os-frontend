import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * O seletor de capacidades virou combobox de seleção múltipla: dá para abrir
 * duas capacidades ao mesmo tempo e ver as competências das duas.
 *
 * Na fixture, "Cloud Architecture" tem Kubernetes e Serverless; "Security" tem
 * apenas IAM.
 */

const fetchMock = vi.fn();

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

/**
 * O app real só monta a árvore autenticada depois do `AuthGate` (em
 * `__root.tsx`) resolver a sessão guardada no navegador. Este teste não passa
 * por ele, então precisa do mesmo corte: sem isto, `AssessmentsPage` chamaria
 * `useCurrentUser()` no primeiro render, antes do `AuthProvider` terminar de
 * buscar `/api/auth/me`, e quebraria com "nenhuma sessão ativa".
 */
function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const renderPage = () =>
  render(
    <Wrapper>
      <AssessmentsPage />
    </Wrapper>,
  );

describe("Avaliações — seleção de capacidades", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (String(url).endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState), {
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

  it("começa com a primeira capacidade e mostra só as competências dela", async () => {
    renderPage();

    expect(await screen.findByText("Kubernetes")).toBeTruthy();
    expect(screen.getByText("Serverless")).toBeTruthy();
    expect(screen.queryByText("IAM")).toBeNull();
  });

  it("permite abrir duas capacidades e ver as competências de ambas", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByRole("combobox", { name: "Capacidades" }));
    await userEvent.click(await screen.findByRole("option", { name: "Security" }));

    // as duas capacidades aparecem, cada uma com suas competências
    await waitFor(() => expect(screen.getByText("IAM")).toBeTruthy());
    expect(screen.getByText("Kubernetes")).toBeTruthy();
    expect(screen.getByText("Serverless")).toBeTruthy();

    // a fixture tem exatamente 2 capacidades, então marcar as duas é "todas"
    expect(screen.getByRole("combobox", { name: "Capacidades" }).textContent).toContain(
      "Todas (2)",
    );
  });

  it("desmarcar remove a capacidade da tela", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    const combobox = screen.getByRole("combobox", { name: "Capacidades" });
    await userEvent.click(combobox);
    await userEvent.click(await screen.findByRole("option", { name: "Security" }));
    await waitFor(() => expect(screen.getByText("IAM")).toBeTruthy());

    await userEvent.click(await screen.findByRole("option", { name: "Cloud Architecture" }));
    await waitFor(() => expect(screen.queryByText("Kubernetes")).toBeNull());

    expect(screen.getByText("IAM")).toBeTruthy();
    expect(combobox.textContent).toContain("Security");
  });

  it("sem nenhuma capacidade marcada, orienta a escolher", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByRole("combobox", { name: "Capacidades" }));
    await userEvent.click(await screen.findByRole("option", { name: "Cloud Architecture" }));

    expect(await screen.findByText("Nenhuma capacidade selecionada")).toBeTruthy();
    expect(screen.queryByText("Kubernetes")).toBeNull();
  });

  /**
   * PLANO-360-AGENTES-SYNAPSE.md, Seção 9 (EPIC 01): o estado da avaliação
   * voltou a governar a tela — reverte a decisão anterior deste projeto de
   * tirá-lo daqui. A avaliação de Ana no ciclo ativo (fixture "ana-h2") é
   * `Completed`; para um admin, já concluída não sobra ação de transição.
   */
  it("mostra a situação da avaliação e trava a edição quando concluída", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    expect(await screen.findByText("Concluído")).toBeTruthy();
    expect(screen.getByText(/somente leitura/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Concluir avaliação/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Enviar para revisão/ })).toBeNull();
  });

  /** As opções passaram a ter caixinha, e há uma para marcar todas de uma vez. */
  it("marca e desmarca todas as capacidades pela caixinha do topo", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByRole("combobox", { name: "Capacidades" }));
    const todas = await screen.findByRole("option", { name: /Selecionar todas/ });

    // parcial: só a Cloud vem marcada
    expect(todas.querySelector("[data-state]")?.getAttribute("data-state")).toBe("indeterminate");

    await userEvent.click(todas);
    expect(await screen.findByText("IAM")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Capacidades" }).textContent).toContain(
      "Todas (2)",
    );

    await userEvent.click(screen.getByRole("option", { name: /Selecionar todas/ }));
    await waitFor(() => expect(screen.queryByText("Kubernetes")).toBeNull());
    expect(await screen.findByText("Nenhuma capacidade selecionada")).toBeTruthy();
  });

  it("cada opção mostra uma caixinha com o estado da seleção", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByRole("combobox", { name: "Capacidades" }));

    const cloud = await screen.findByRole("option", { name: "Cloud Architecture" });
    const security = await screen.findByRole("option", { name: "Security" });
    expect(cloud.querySelector("[data-state]")?.getAttribute("data-state")).toBe("checked");
    expect(security.querySelector("[data-state]")?.getAttribute("data-state")).toBe("unchecked");
  });

  it("o seletor de arquitetos continua sendo lista suspensa", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    const arquitetos = screen.getByRole("combobox", { name: "Arquiteto" });
    expect(arquitetos.tagName).toBe("SELECT");
    expect(within(arquitetos).getByRole("option", { name: "Ana Martins" })).toBeTruthy();
  });
});
