import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureCareerLevels, fixtureState } from "./fixtures";

/**
 * R2-UX-12 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — "Nova capacidade" troca os
 * dois inputs soltos no cabeçalho (nome + sigla + "Adicionar") por um único
 * botão que abre modal, mesmo padrão já usado por "Nova competência"
 * (CompetencyCreateDialog).
 *
 * ORIENTACAO-BLOCO-2-UX-POR-TELA — o modal parou de coletar "Sigla": pedido
 * direto da dona do produto para nunca mais digitar a sigla manualmente. O
 * backend gera `short` automaticamente a partir de `name` (com resolução de
 * colisão) quando o campo não vem no corpo — o mock de `POST
 * /api/capabilities` abaixo simula exatamente isso, devolvendo um `short`
 * mesmo quando o corpo da requisição não manda nenhum.
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

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

describe("Matriz de Competências — criação de capacidade via modal", () => {
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
      if (href.endsWith("/api/career-levels")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureCareerLevels), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/capabilities") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { name: string; short?: string };
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "cap-nova",
              ...body,
              // Simula a geração automática do backend: o corpo não manda
              // `short`, mas a resposta sempre traz um (gerado a partir de
              // `name`, com resolução de colisão do lado do servidor).
              short: body.short ?? "Nova",
              curation: {
                activeCompetencyCount: 0,
                restrictiveCompetencyCount: 0,
                nonRestrictiveCompetencyCount: 0,
                status: "REQUIRES_CURATION",
              },
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState), {
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

  it("botão 'Nova capacidade' abre modal só com Nome — sem campo Sigla, sem inputs soltos no cabeçalho", async () => {
    render(
      <Wrapper>
        <MatrixPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Nova capacidade" }));

    expect(screen.getByRole("heading", { name: "Nova capacidade" })).toBeTruthy();
    expect(screen.getByLabelText("Nome")).toBeTruthy();
    expect(screen.queryByLabelText("Sigla")).toBeNull();
  });

  it("criar só com Nome envia o POST SEM `short` no corpo e fecha o modal", async () => {
    render(
      <Wrapper>
        <MatrixPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Nova capacidade" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Governança de Dados");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/api/capabilities") && (init as RequestInit)?.method === "POST",
        ),
      ).toBe(true),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/capabilities") && (init as RequestInit)?.method === "POST",
    ) as [string, RequestInit];
    const sentBody = JSON.parse(String(call[1].body)) as Record<string, unknown>;
    expect(sentBody).toMatchObject({ name: "Governança de Dados", active: true });
    // ORIENTACAO-BLOCO-2-UX-POR-TELA — nunca mandar `short`: é o backend
    // que gera automaticamente a partir de `name`, com resolução de
    // colisão, exatamente porque o admin não digita mais esse campo.
    expect(sentBody).not.toHaveProperty("short");

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Nova capacidade" })).toBeNull(),
    );
  });
});
