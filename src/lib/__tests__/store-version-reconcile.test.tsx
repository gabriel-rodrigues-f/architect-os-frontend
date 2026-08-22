import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider, useStore } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * B-09 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-10, "409
 * espúrios") — `updatePlanItem` era otimista e carregava `expectedVersion`
 * (concorrência otimista), mas nunca reconciliava a resposta do servidor no
 * sucesso: o `version` do cache ficava travado no palpite otimista (este
 * PATCH nunca o incrementa sozinho), e a PRÓXIMA edição mandava um
 * `expectedVersion` já defasado — um 409 sem nenhum conflito real, só duas
 * edições sequenciais da mesma pessoa.
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

/** Dispara `updatePlanItem` diretamente no store, sem depender da UI de `development-plans.tsx`. */
function UpdatePlanItemProbe() {
  const store = useStore();
  return (
    <button
      type="button"
      onClick={() => store.updatePlanItem("pdi-ana", "pdi-ana-0", { actionPlan: "atualizado" })}
    >
      Atualizar item
    </button>
  );
}

describe("store.updatePlanItem — reconcilia version no sucesso (evita 409 espúrio)", () => {
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
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState satisfies AppState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (init?.method === "PATCH" && href.includes("/api/plans/pdi-ana/items/pdi-ana-0")) {
        const body = JSON.parse(String(init.body)) as { expectedVersion: number };
        const plan = fixtureState.plans.find((p) => p.id === "pdi-ana")!;
        // Simula o servidor: aceita a versão pedida e devolve o plano com o
        // item já incrementado — exatamente como a API real faz.
        const updatedPlan = {
          ...plan,
          items: plan.items.map((i) =>
            i.id === "pdi-ana-0" ? { ...i, version: body.expectedVersion + 1 } : i,
          ),
        };
        return Promise.resolve(
          new Response(JSON.stringify(updatedPlan), {
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

  it("a segunda edição manda o expectedVersion reconciliado da primeira, não o palpite otimista original", async () => {
    render(
      <Wrapper>
        <UpdatePlanItemProbe />
      </Wrapper>,
    );
    const button = await screen.findByRole("button", { name: "Atualizar item" });

    await userEvent.click(button);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([, init]) =>
            (init as RequestInit | undefined)?.method === "PATCH" &&
            String((init as RequestInit).body).includes("expectedVersion"),
        ),
      ).toHaveLength(1),
    );

    await userEvent.click(button);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
        ),
      ).toHaveLength(2),
    );

    const patchCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
    );
    const firstBody = JSON.parse(String((patchCalls[0]![1] as RequestInit).body));
    const secondBody = JSON.parse(String((patchCalls[1]![1] as RequestInit).body));

    expect(firstBody.expectedVersion).toBe(1);
    // Sem a reconciliação, isto também seria 1 (o cache nunca soube que o
    // servidor já tinha avançado para 2) — o bug exato que o 409 espúrio produzia.
    expect(secondBody.expectedVersion).toBe(2);
  });
});
