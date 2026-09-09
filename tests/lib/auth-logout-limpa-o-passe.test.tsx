import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, supportAccess } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { AuthProvider, useAuth } from "@/lib/auth";
import { fixtureSupportUser } from "../helpers/fixtures";

/**
 * PR 6 ([FA-07]) — o passe de suporte morria só com a aba: sobrevivia ao
 * logout e à sessão derrubada. Fechar a sessão, por qualquer porta, apaga o
 * passe — o próximo a entrar nesta aba declara o motivo dele.
 */
const fetchMock = vi.fn();

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function SessionProbe() {
  const { user, logout } = useAuth();
  return (
    <>
      <p>{user ? `LOGADO:${user.email}` : "DESLOGADO"}</p>
      <button type="button" onClick={() => void logout()}>
        Sair
      </button>
      <button type="button" onClick={() => void api.setActiveCycle("2026-h2").catch(() => {})}>
        Disparar chamada autenticada
      </button>
    </>
  );
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("auth — fechar a sessão apaga o passe de suporte", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    supportAccess.clear();
    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/me"))) return Promise.resolve(json(fixtureSupportUser));
      if (href.endsWith(apiPath("/auth/logout"))) return Promise.resolve(json(null, 204));
      if (href.endsWith(apiPath("/settings/active-cycle"))) {
        return Promise.resolve(json({ code: "SESSION_INVALID", message: "Sessão inválida." }, 401));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    supportAccess.clear();
  });

  it("logout limpa o passe", async () => {
    render(<SessionProbe />, { wrapper: Wrapper });
    await screen.findByText(`LOGADO:${fixtureSupportUser.email}`);
    supportAccess.grant("ana", "chamado 4821, conferir cadastro");
    expect(supportAccess.grantedFor("ana")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    await screen.findByText("DESLOGADO");
    expect(supportAccess.grantedFor("ana")).toBeNull();
  });

  it("sessão derrubada pelo serviço (401) também limpa o passe", async () => {
    render(<SessionProbe />, { wrapper: Wrapper });
    await screen.findByText(`LOGADO:${fixtureSupportUser.email}`);
    supportAccess.grant("ana", "chamado 4821, conferir cadastro");

    await userEvent.click(screen.getByRole("button", { name: "Disparar chamada autenticada" }));

    await waitFor(() => expect(screen.getByText("DESLOGADO")).toBeTruthy());
    expect(supportAccess.grantedFor("ana")).toBeNull();
  });
});
