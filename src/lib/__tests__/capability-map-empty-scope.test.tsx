import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesmo motivo de capability-map-risk.test.tsx: sem RouterProvider real, `<Link>` vira âncora comum. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to: _to, ...rest }: ComponentProps<"a"> & { to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as CapabilityRoute } from "@/routes/capability-map";
import type { AppState, SessionUser } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureState } from "./fixtures";

/**
 * R2-VIS-12 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — sem ninguém no escopo do
 * viewer, `assessedCount` é 0 para TODA capacidade, então antes cada
 * card/linha repetia "Dados insuficientes" — para um catálogo de 30
 * capacidades, 30 repetições da mesma frase. A tela agora reconhece que o
 * problema é um só (ninguém para avaliar aqui) e mostra uma mensagem única.
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

const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;

/** Lead sem nenhum arquiteto atribuído — `canActFor` nunca dá `true`, população vazia. */
const leadWithNoOne: SessionUser = {
  id: "test-lead-sem-ninguem",
  email: "lead-sem-ninguem@company.com",
  name: "Lead Sem Ninguém",
  role: "lead",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("Mapa de Capacidades — escopo vazio vira uma mensagem, não N repetições", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(leadWithNoOne), {
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
  });

  it("mostra a mensagem única de escopo vazio, nunca 'Dados insuficientes' repetido por capacidade", async () => {
    render(
      <Wrapper>
        <CapabilityPage />
      </Wrapper>,
    );

    expect(await screen.findByText("Nenhuma pessoa no seu escopo")).toBeTruthy();
    expect(screen.queryByText(/Dados insuficientes/)).toBeNull();
    expect(screen.queryByText("Cloud Architecture")).toBeNull();
  });
});
