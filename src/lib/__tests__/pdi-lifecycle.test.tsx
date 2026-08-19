import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as PlansRoute } from "@/routes/development-plans";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * EPIC 3 (quarta rodada) — PDI real: sem percentual paralelo ao status, sem
 * "Learn + 4 meses" fabricado ao converter um gap em ação, e com o ciclo de
 * vida do plano (Draft → Approved → Completed) exposto como ação de verdade,
 * não um campo solto. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md.
 */

const fetchMock = vi.fn();

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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
  return <>{children}</>;
}

const PlansPage = PlansRoute.options.component as () => ReactNode;

describe("PDI — ciclo de vida do plano e ações sem fabricação", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState satisfies AppState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (init?.method === "PATCH" && href.includes("/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: "pdi-ana", status: "Completed", items: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (init?.method === "POST" && href.includes("/api/plans/")) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: "pdi-bruno", status: "Draft", items: [] }), {
            status: 201,
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
    window.history.pushState({}, "", "/");
  });

  it("item do PDI não mostra percentual — só o status", async () => {
    window.history.pushState({}, "", "?architectId=ana");
    render(
      <Wrapper>
        <PlansPage />
      </Wrapper>,
    );
    await screen.findByText("Evoluir IAM");

    expect(screen.queryByText(/^\d+%$/)).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("mostra a situação do plano e permite concluir o PDI já aprovado", async () => {
    window.history.pushState({}, "", "?architectId=ana");
    render(
      <Wrapper>
        <PlansPage />
      </Wrapper>,
    );
    await screen.findByText("Evoluir IAM");

    expect(screen.getByText("Aprovado")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Concluir PDI" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/api/plans/pdi-ana/status") &&
            (init as RequestInit)?.method === "PATCH",
        ),
      ).toBe(true),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/plans/pdi-ana/status") &&
        (init as RequestInit)?.method === "PATCH",
    ) as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ status: "Completed" });
  });

  it("adicionar uma sugestão ao PDI abre um formulário — não cria com tipo/prazo fabricados", async () => {
    window.history.pushState({}, "", "?architectId=bruno");
    render(
      <Wrapper>
        <PlansPage />
      </Wrapper>,
    );

    const addButtons = await screen.findAllByRole("button", { name: /Adicionar ao PDI/ });
    await userEvent.click(addButtons[0]!);

    // O formulário abre — nada foi criado só com o clique.
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/api/plans/bruno/items") &&
          (init as RequestInit)?.method === "POST",
      ),
    ).toBe(false);

    const dialogSaveButton = screen.getByRole("button", { name: "Salvar ação" });
    expect((dialogSaveButton as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(
      screen.getByLabelText("Plano de ação"),
      "Curso de IAM e aplicação num projeto real.",
    );
    await userEvent.type(screen.getByLabelText("Prazo"), "2026-12-20");

    await userEvent.click(dialogSaveButton);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).includes("/api/plans/bruno/items") &&
            (init as RequestInit)?.method === "POST",
        ),
      ).toBe(true),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).includes("/api/plans/bruno/items") && (init as RequestInit)?.method === "POST",
    ) as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as {
      item: { actionType: string; actionPlan: string; targetDate: string };
    };
    expect(body.item.actionPlan).toBe("Curso de IAM e aplicação num projeto real.");
    expect(body.item.targetDate).toBe("2026-12-20");
    expect(body.item).not.toHaveProperty("progress");
  });

  /**
   * DOM-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — depois de
   * `Approved`, item não muda mais de escopo: campo de diagnóstico
   * (tipo de ação) vira texto, campo de execução (status) continua editável,
   * e não há botão de remover. `pdi-ana`, na fixture, já está `Approved`.
   */
  it("plano Approved: tipo de ação vira texto, status continua editável, sem botão de remover", async () => {
    window.history.pushState({}, "", "?architectId=ana");
    render(
      <Wrapper>
        <PlansPage />
      </Wrapper>,
    );
    await screen.findByText("Evoluir IAM");

    const card = (await screen.findByText("Evoluir IAM")).closest(".surface-card")!;
    // Só um select no card (Status, campo de execução) — Tipo de ação virou texto.
    expect(card.querySelectorAll("select")).toHaveLength(1);
    // "Remover GAP" não aparece — item já acordado não desaparece.
    expect(screen.queryByRole("button", { name: /Remover GAP/ })).toBeNull();
  });
});
