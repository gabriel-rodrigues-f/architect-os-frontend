import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, authApi } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SessionEndMemory } from "@/lib/session-end-reason";
import { fixtureAdminUser } from "../helpers/fixtures";
import { apiPath } from "@/lib/api-path";

/**
 * B-33 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12 — "sem
 * tratamento global de 401") — sessão caindo NO MEIO do uso precisa levar
 * de volta ao login (`__root.tsx`'s `AuthGate` já troca para `LoginScreen`
 * assim que `user` vira `null` — isso não muda aqui). O que faltava era
 * `auth.tsx` sequer ficar sabendo que um 401 aconteceu fora do fluxo de
 * login/`/me`. Este teste monta só `AuthProvider` (não o app inteiro) e
 * confirma que uma chamada autenticada que volta 401 zera `user` e avisa —
 * sem depender de `AuthGate`/`LoginScreen`, que são renderização já coberta
 * por comportamento pré-existente.
 */

const fetchMock = vi.fn();

/**
 * PR 9 ([FA-02]): o encerramento por 401 saiu de dentro de um updater de
 * `setState` — que o StrictMode reexecuta — e o aviso deixou de ser um toast
 * em português fixo: a razão vai para a tela de login pelo `SessionEndReason`.
 * O `QueryClient` é injetável para o teste contar quantas vezes a sessão foi
 * fechada.
 */
function Wrapper({
  children,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }),
}: {
  children: ReactNode;
  queryClient?: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function SessionProbe() {
  const { user, bootstrap } = useAuth();
  return (
    <>
      <p>{user ? `LOGADO:${user.email}` : `DESLOGADO:${bootstrap.endReason?.kind ?? "-"}`}</p>
      <button type="button" onClick={() => void api.setActiveCycle("2026-h2").catch(() => {})}>
        Disparar chamada autenticada
      </button>
      <button
        type="button"
        onClick={() => void authApi.changePassword("errada", "nova-senha-1").catch(() => {})}
      >
        Trocar senha com senha atual errada
      </button>
    </>
  );
}

describe("auth — 401 fora do login/me zera a sessão e avisa (B-33)", () => {
  let meResponse: Response;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    meResponse = new Response(JSON.stringify(fixtureAdminUser), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/me"))) return Promise.resolve(meResponse.clone());
      if (href.endsWith(apiPath("/settings/active-cycle"))) {
        return Promise.resolve(
          new Response(JSON.stringify({ code: "SESSION_INVALID", message: "Sessão inválida." }), {
            status: 401,
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
    window.sessionStorage.clear();
  });

  it("um 401 numa chamada autenticada zera user com a razão 'expirada' e a guarda na aba", async () => {
    render(
      <Wrapper>
        <SessionProbe />
      </Wrapper>,
    );

    expect(await screen.findByText(`LOGADO:${fixtureAdminUser.email}`)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Disparar chamada autenticada" }));

    await waitFor(() => expect(screen.getByText("DESLOGADO:expired")).toBeTruthy());
    expect(window.sessionStorage.getItem(SessionEndMemory.STORAGE_KEY)).toBe("expired");
  });

  it("o encerramento roda UMA vez, fora do updater de estado — mesmo sob StrictMode", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const clear = vi.spyOn(queryClient, "clear");
    render(
      <StrictMode>
        <Wrapper queryClient={queryClient}>
          <SessionProbe />
        </Wrapper>
      </StrictMode>,
    );

    expect(await screen.findByText(`LOGADO:${fixtureAdminUser.email}`)).toBeTruthy();
    clear.mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Disparar chamada autenticada" }));

    await waitFor(() => expect(screen.getByText("DESLOGADO:expired")).toBeTruthy());
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("o 401 do /api/v1/auth/me inicial (sem sessão nenhuma) não dispara o aviso de sessão expirada", async () => {
    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Unauthorized", message: "Sem sessão." }), {
            status: 401,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    render(
      <Wrapper>
        <SessionProbe />
      </Wrapper>,
    );

    await screen.findByText("DESLOGADO:-");
    expect(window.sessionStorage.getItem(SessionEndMemory.STORAGE_KEY)).toBeNull();
  });

  /**
   * R2-TEC-21 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — antes da allowlist de
   * `api.ts`, este 401 (erro de NEGÓCIO da própria troca de senha, sessão
   * continua válida) disparava o mesmo `unauthorizedHandler` do teste
   * acima só por ser um 401, deslogando quem só errou a senha atual.
   */
  it("errar a senha atual na troca de senha (401 INVALID_CURRENT_PASSWORD) não desloga", async () => {
    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/me"))) return Promise.resolve(meResponse.clone());
      if (href.endsWith(apiPath("/auth/change-password"))) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ code: "INVALID_CURRENT_PASSWORD", message: "Senha atual incorreta" }),
            { status: 401, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    render(
      <Wrapper>
        <SessionProbe />
      </Wrapper>,
    );

    expect(await screen.findByText(`LOGADO:${fixtureAdminUser.email}`)).toBeTruthy();

    await userEvent.click(
      screen.getByRole("button", { name: "Trocar senha com senha atual errada" }),
    );

    // Sem `waitFor` de sucesso possível aqui (nada muda quando o handler
    // corretamente NÃO dispara) — dá tempo real para o fetch mockado
    // resolver e qualquer disparo indevido do handler se manifestar antes
    // de afirmar que a sessão continua de pé.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByText(`LOGADO:${fixtureAdminUser.email}`)).toBeTruthy();
    expect(window.sessionStorage.getItem(SessionEndMemory.STORAGE_KEY)).toBeNull();
  });
});
