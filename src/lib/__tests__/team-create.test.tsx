import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real; a tela de
 * Time usa `<Link>` nos cards. Troca por âncora comum — não é o que se testa.
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
 * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seções 16, 17 e 26/27 — nada
 * no cadastro pode fabricar dado: e-mail inventado do nome, domínio herdado
 * da ordem da lista, "1 ano" fantasma, ou Medium/Medium no 9-Box sem
 * calibração real. Falta um campo, o cadastro não salva.
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

describe("Time — cadastro sem dado fabricado", () => {
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
      if (init?.method === "POST" && href.endsWith("/api/architects")) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Promise.resolve(
          new Response(JSON.stringify({ ...body, active: true }), {
            status: 201,
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

  it("mantém 'Salvar' desabilitado até nome, e-mail, os dois domínios e um tempo válido estarem preenchidos", async () => {
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar arquiteto" }));
    const salvar = screen.getByRole("button", { name: "Salvar" });
    expect((salvar as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Nome"), "Nova Pessoa");
    expect((salvar as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("E-mail"), "nova.pessoa@company.com");
    expect((salvar as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Tempo como arquiteto (anos)"), "2");
    expect((salvar as HTMLButtonElement).disabled).toBe(true);

    await userEvent.selectOptions(screen.getByLabelText("Domínio forte"), "cloud");
    expect((salvar as HTMLButtonElement).disabled).toBe(true);

    await userEvent.selectOptions(screen.getByLabelText("Domínio a desenvolver"), "security");
    expect((salvar as HTMLButtonElement).disabled).toBe(false);
  });

  it("salva só com o que a pessoa digitou — sem e-mail, domínio ou 9-Box fabricados", async () => {
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar arquiteto" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Nova Pessoa");
    await userEvent.type(screen.getByLabelText("E-mail"), "nova.pessoa@company.com");
    await userEvent.type(screen.getByLabelText("Tempo como arquiteto (anos)"), "2");
    await userEvent.selectOptions(screen.getByLabelText("Domínio forte"), "cloud");
    await userEvent.selectOptions(screen.getByLabelText("Domínio a desenvolver"), "security");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const isCreateCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).endsWith("/api/architects") && init?.method === "POST";
    };

    await waitFor(() => expect(fetchMock.mock.calls.some(isCreateCall)).toBe(true));
    const call = fetchMock.mock.calls.find(isCreateCall) as [string, RequestInit];
    const init = call[1];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(body["email"]).toBe("nova.pessoa@company.com");
    expect(body["strongDomain"]).toBe("cloud");
    expect(body["gapDomain"]).toBe("security");
    expect(body["yearsAsArchitect"]).toBe(2);
    expect(body["performance"]).toBeNull();
    expect(body["potential"]).toBeNull();
  });
});
