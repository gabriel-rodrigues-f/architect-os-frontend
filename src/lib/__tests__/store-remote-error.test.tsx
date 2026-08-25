import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de team-deactivate.test.tsx: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => <a {...rest}>{children}</a>,
  };
});

import { Toaster } from "@/components/ui/sonner";
import { Route as TeamRoute } from "@/routes/team";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * EPIC L — Trustworthy mutations: uma escrita otimista que falha no servidor
 * não pode voltar em silêncio. Antes, `remote()` só dava `console.error` e
 * revalidava — a tela corrigia sozinha, mas ninguém via aviso nenhum de que
 * a ação não tinha ido para o banco. Ver AUDITORIA-TERCEIRA-RODADA-
 * RECONSTRUCAO-PRODUTO-SYNAPSE.md.
 *
 * R2-UX-08/OO-03 — este teste usava "Desativar" como veículo do PATCH
 * otimista, mas desativação deixou de ser isso: virou `POST
 * /api/architects/:id/deactivate`, sem otimismo nenhum (motivo obrigatório
 * + concorrência otimista — ver team-deactivate.test.tsx, que cobre o 409
 * desse fluxo novo, mostrado dentro do próprio diálogo). "Reativar"
 * continua sendo o PATCH otimista de sempre (`updateArchitect(id, { active:
 * true })`, sem diálogo, um clique só) — assume aqui o lugar de "Desativar"
 * como veículo desta cobertura.
 */

/** Ana Martins já nasce inativa nesta suíte, só para o botão "Reativar" existir de cara. */
const stateWithInactiveAna: AppState = {
  ...fixtureState,
  architects: fixtureState.architects.map((a) => (a.id === "ana" ? { ...a, active: false } : a)),
};

const fetchMock = vi.fn();

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthReady>
            <StoreProvider>{children}</StoreProvider>
            <Toaster theme="light" position="bottom-right" duration={3000} />
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

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("store.remote — erro do servidor não fica em silêncio", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

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
      if (href.endsWith("/api/auth/users")) {
        return Promise.resolve(
          new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
        );
      }
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(stateWithInactiveAna satisfies AppState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      // O servidor recusa a reativação — simula uma regra de negócio.
      if (init?.method === "PATCH" && href.includes("/api/architects/")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: "Conflict", message: "Não é possível reativar agora." }),
            { status: 409, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reativar que falha no servidor mostra a mensagem de erro e mantém a pessoa inativa", async () => {
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );
    const nome = stateWithInactiveAna.architects[0]!.name;

    // Ana já nasce inativa nesta suíte — espera o roster carregar (via quem
    // continua ativo) antes de mexer no filtro.
    await screen.findByText(stateWithInactiveAna.architects[1]!.name);

    // Status nasce filtrado só em "Ativos" — inclui "Inativos" pra achar
    // quem já está desativado e ver o botão "Reativar".
    await userEvent.click(screen.getByLabelText("Status"));
    await userEvent.click(await screen.findByRole("option", { name: "Inativos" }));
    await userEvent.keyboard("{Escape}");
    await screen.findByText(nome);

    await userEvent.click(screen.getByLabelText(`Reativar ${nome}`));

    expect(await screen.findByText("Não é possível reativar agora.")).toBeTruthy();

    // A revalidação devolve o estado real do servidor — a pessoa continua inativa
    // (o botão "Reativar" segue lá, não virou "Desativar").
    await waitFor(() => expect(screen.getByLabelText(`Reativar ${nome}`)).toBeTruthy());
  });
});
