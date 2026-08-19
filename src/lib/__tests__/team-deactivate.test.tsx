import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real (a árvore
 * de rotas inteira) para resolver `to="/architects/$architectId"`. A tela de
 * Time usa `<Link>` nos cards e na lista de inativos; como este teste não
 * monta o router da aplicação, troca por uma âncora comum — não é o que se
 * testa aqui, só precisa não quebrar o render.
 */
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

import { Route as TeamRoute } from "@/routes/team";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 18 — excluir um
 * arquiteto não pode mais apagar histórico em cascata. "Excluir" virou
 * "Desativar": a pessoa sai do roster ativo sem que nada seja apagado, e dá
 * para reativar.
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
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("Time — desativar preserva histórico", () => {
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
      if (init?.method === "PATCH" && href.includes("/api/architects/")) {
        const body = JSON.parse(String(init.body)) as { active: boolean };
        return Promise.resolve(
          new Response(JSON.stringify({ ...fixtureState.architects[0], ...body }), {
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
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("desativar tira do roster ativo e move para a lista de inativos, sem excluir nada", async () => {
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByLabelText("Desativar Ana Martins"));
    const dialogo = within(await screen.findByRole("dialog"));
    expect(dialogo.getByText(/nada é apagado/)).toBeTruthy();
    await userEvent.click(dialogo.getByRole("button", { name: "Desativar" }));

    // some do roster ativo (o link deixa de existir na grade principal)...
    await waitFor(() => expect(screen.queryByText("Ana Martins")).toBeTruthy());
    // ...e aparece na seção de inativos, com opção de reativar.
    expect(await screen.findByText("Arquitetos inativos")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reativar/ })).toBeTruthy();

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(JSON.parse(String((patches[0]?.[1] as RequestInit).body))).toEqual({ active: false });
  });

  it("reativar devolve a pessoa para o roster ativo", async () => {
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );
    await screen.findByText("Ana Martins");
    await userEvent.click(screen.getByLabelText("Desativar Ana Martins"));
    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.click(dialogo.getByRole("button", { name: "Desativar" }));
    await screen.findByText("Arquitetos inativos");

    await userEvent.click(screen.getByRole("button", { name: /Reativar/ }));

    await waitFor(() => expect(screen.queryByText("Arquitetos inativos")).toBeNull());
    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String((patches[1]?.[1] as RequestInit).body))).toEqual({ active: true });
  });
});
