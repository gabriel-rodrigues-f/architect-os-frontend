import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";
import { api, authApi } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
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

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster theme="light" position="bottom-right" duration={3000} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function SessionProbe() {
  const { user } = useAuth();
  return (
    <>
      <p>{user ? `LOGADO:${user.email}` : "DESLOGADO"}</p>
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
    // sonner guarda os toasts num store global fora da árvore React —
    // `cleanup()` desmonta o `<Toaster>`, mas não esvazia a fila; sem isto,
    // um toast do teste anterior reaparece no `<Toaster>` novo do próximo.
    toast.dismiss();
  });

  it("um 401 numa chamada autenticada zera user e mostra aviso de sessão expirada", async () => {
    render(
      <Wrapper>
        <SessionProbe />
      </Wrapper>,
    );

    expect(await screen.findByText(`LOGADO:${fixtureAdminUser.email}`)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Disparar chamada autenticada" }));

    await waitFor(() => expect(screen.getByText("DESLOGADO")).toBeTruthy());
    expect(await screen.findByText("Sua sessão expirou. Faça login novamente.")).toBeTruthy();
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

    await screen.findByText("DESLOGADO");
    expect(screen.queryByText("Sua sessão expirou. Faça login novamente.")).toBeNull();
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
    expect(screen.queryByText("Sua sessão expirou. Faça login novamente.")).toBeNull();
  });
});
