import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { filterNavGroups, NAV_GROUPS } from "@/components/app/AppShell";
import { apiPath } from "@/lib/api-path";
import { AuthProvider, useAuth } from "@/lib/auth";
import { createAppQueryClient } from "@/lib/query-client";
import { requireLeadReach } from "@/lib/route-guards";
import { fixtureTeamLeadUser } from "../helpers/fixtures";

/**
 * Fase C, achado A1 do QA adversarial — `POST /auth/login` devolve o usuário
 * SEM `memberships` (só `GET /auth/me` os carrega; `auth.controller.ts` monta
 * o campo apenas naquela rota). Quem chega pela tela de login fica com a
 * sessão do payload de login no contexto E no cache, e nada refaz `/auth/me`
 * na mesma instância da SPA. Resultado: o tech lead que acabou de entrar não
 * tem vínculo nenhum para a política olhar — a régua do time, que existe
 * para ele, some da navegação e a guarda de rota o manda para `/` até ele
 * apertar F5.
 *
 * Os testes de tela nunca exercitam o caminho de LOGIN (mockam `/auth/me`) e
 * o Playwright entra por `page.goto()`, com reload completo — os dois
 * harnesses mascaram exatamente este caminho. Daí este arquivo montar o
 * `AuthProvider` de verdade, com `/auth/me` respondendo 401 ANTES do login e
 * 200 depois, que é o estado real de quem está na tela de login.
 */

const fetchMock = vi.fn();

/**
 * O payload real de `POST /auth/login`: a mesma conta, sem a chave
 * `memberships` — `JSON.stringify` descarta `undefined`, como o backend
 * descarta o campo que só `/auth/me` monta.
 */
const payloadDeLogin = JSON.stringify({
  user: { ...fixtureTeamLeadUser, memberships: undefined },
});

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function SessionProbe() {
  const { user, login } = useAuth();
  const destinos = filterNavGroups(NAV_GROUPS, user ?? undefined).flatMap((grupo) =>
    grupo.items.map((item) => item.to),
  );
  const vinculos = (user?.memberships ?? []).map((membership) => membership.teamId);
  return (
    <>
      <p>{user ? `SESSAO:${user.email}` : "SEM SESSAO"}</p>
      <p>{`VINCULOS:${vinculos.join(",") || "NENHUM"}`}</p>
      <p>{`DESTINOS:${destinos.join(",")}`}</p>
      <button
        type="button"
        onClick={() => void login(fixtureTeamLeadUser.email, "synapse-local-dev")}
      >
        Entrar
      </button>
    </>
  );
}

const entrarPelaTelaDeLogin = async () => {
  render(
    <Wrapper>
      <SessionProbe />
    </Wrapper>,
  );
  await screen.findByText("SEM SESSAO");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await waitFor(() => expect(screen.getByText(`SESSAO:${fixtureTeamLeadUser.email}`)).toBeTruthy());
};

describe("auth — a sessão de quem acabou de logar carrega os vínculos do time (A1)", () => {
  beforeEach(() => {
    queryClient = createAppQueryClient();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    let autenticado = false;

    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/login"))) {
        autenticado = true;
        return Promise.resolve(
          new Response(payloadDeLogin, {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith(apiPath("/auth/me"))) {
        if (!autenticado) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: "Unauthorized", message: "Sem sessão." }), {
              status: 401,
              headers: { "content-type": "application/json" },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify(fixtureTeamLeadUser), {
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

  it("o tech lead que entra pela tela de login enxerga a Régua do Time sem recarregar a página", async () => {
    await entrarPelaTelaDeLogin();

    expect(screen.getByText("VINCULOS:time-plataforma")).toBeTruthy();
    expect(screen.getByText(/^DESTINOS:/).textContent).toContain("/team-rules");
  });

  it("a guarda de rota não expulsa de /team-rules o lead que acabou de logar", async () => {
    await entrarPelaTelaDeLogin();

    await expect(requireLeadReach({ context: { queryClient } })).resolves.toBeUndefined();
  });
});
