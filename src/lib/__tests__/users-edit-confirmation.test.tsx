import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as UsersRoute } from "@/routes/users";
import type { SessionUser } from "@/lib/api";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * REVISAO-360-FRONTEND-UI-UX-ENTERPRISE-SYNAPSE-2026-08-22.md, FE-360-009
 * (P1 UX/Security) — papel, vínculo e status não podem mais trocar de
 * valor num `onChange` inline sem confirmação. Cobre: a tabela mostra os
 * três campos como somente leitura, "Editar" abre um diálogo, mudanças
 * comuns salvam direto, e conceder Admin exige uma etapa extra de
 * confirmação antes de persistir.
 */

const OTHER_MEMBER: SessionUser = {
  id: "user-outro-membro",
  email: "membro@empresa.com",
  name: "Outro Membro",
  role: "member",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
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

const UsersPage = UsersRoute.options.component as () => ReactNode;

function mockBackend(users: SessionUser[]) {
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
    if (href.endsWith("/api/auth/users") && (!init || init.method === undefined)) {
      return Promise.resolve(
        new Response(JSON.stringify(users), { status: 200, headers: { "content-type": "application/json" } }),
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
    if (init?.method === "PATCH" && href.includes("/api/auth/users/")) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Promise.resolve(
        new Response(JSON.stringify({ ...OTHER_MEMBER, ...body }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

describe("Usuários — edição protegida (FE-360-009)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("papel/vínculo/status aparecem como somente leitura na tabela, com um botão Editar", async () => {
    mockBackend([fixtureAdminUser, OTHER_MEMBER]);
    render(
      <Wrapper>
        <UsersPage />
      </Wrapper>,
    );

    await screen.findByText("Outro Membro");
    const row = screen.getByText("Outro Membro").closest("tr")!;
    // Nenhum <select>/<button> de troca direta na linha — só o badge e "Editar".
    expect(within(row).queryByRole("combobox")).toBeNull();
    expect(within(row).getByRole("button", { name: "Editar Outro Membro" })).toBeTruthy();
  });

  it("mudança comum (vínculo) salva direto, sem etapa extra", async () => {
    mockBackend([fixtureAdminUser, OTHER_MEMBER]);
    render(
      <Wrapper>
        <UsersPage />
      </Wrapper>,
    );

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Vínculo com o time"), "ana");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    const isPatchCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).includes("/api/auth/users/") && init?.method === "PATCH";
    };
    await waitFor(() => expect(fetchMock.mock.calls.some(isPatchCall)).toBe(true));
    const call = fetchMock.mock.calls.find(isPatchCall) as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as Record<string, unknown>;
    expect(body).toEqual({ architectId: "ana" });
    expect(body["role"]).toBeUndefined();
  });

  it("conceder Admin exige confirmação extra antes de salvar — cancelar na confirmação não persiste nada", async () => {
    mockBackend([fixtureAdminUser, OTHER_MEMBER]);
    render(
      <Wrapper>
        <UsersPage />
      </Wrapper>,
    );

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Papel"), "admin");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    // Vira a etapa de confirmação — nada foi salvo ainda.
    await screen.findByText("Conceder acesso de Administrador");
    const isPatchCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).includes("/api/auth/users/") && init?.method === "PATCH";
    };
    expect(fetchMock.mock.calls.some(isPatchCall)).toBe(false);

    // "Voltar" retorna pro formulário sem persistir.
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await screen.findByRole("button", { name: "Salvar alterações" });
    expect(fetchMock.mock.calls.some(isPatchCall)).toBe(false);
  });

  it("confirmar a concessão de Admin persiste o papel novo", async () => {
    mockBackend([fixtureAdminUser, OTHER_MEMBER]);
    render(
      <Wrapper>
        <UsersPage />
      </Wrapper>,
    );

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Papel"), "admin");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    await screen.findByText("Conceder acesso de Administrador");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar concessão de Admin" }));

    const isPatchCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).includes("/api/auth/users/") && init?.method === "PATCH";
    };
    await waitFor(() => expect(fetchMock.mock.calls.some(isPatchCall)).toBe(true));
    const call = fetchMock.mock.calls.find(isPatchCall) as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as Record<string, unknown>;
    expect(body).toEqual({ role: "admin" });
  });
});
