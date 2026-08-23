import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import type { Capability, Competency } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * Pedido do usuário revisando o app rodando: numa capacidade já em 3
 * restritivas + 3 não restritivas (READY), quer poder trocar uma
 * competência de tipo escolhendo com qual competência existente do tipo
 * cheio ela troca de lugar — um PATCH comum sempre recusaria (o destino já
 * está no teto). Exercita o fluxo completo: abrir "Não Restritiva 1", ver
 * o seletor de troca por causa do limite restritivo, escolher "Restritiva 1"
 * e confirmar.
 */

const fetchMock = vi.fn();

const fullCapability: Capability = {
  id: "full",
  name: "Full Capability",
  short: "Full",
  active: true,
  curation: {
    activeCompetencyCount: 6,
    restrictiveCompetencyCount: 3,
    nonRestrictiveCompetencyCount: 3,
    status: "READY",
  },
};

const fullCompetencies: Competency[] = [1, 2, 3].flatMap((n) => [
  {
    id: `full-r${n}`,
    name: `Restritiva ${n}`,
    capabilityId: "full",
    requirementType: "RESTRICTIVE" as const,
    expected: {
      "arquiteto-de-solucoes-i": 3,
      "arquiteto-de-solucoes-ii": 4,
      "arquiteto-de-solucoes-iii": 5,
    },
    active: true,
  },
  {
    id: `full-n${n}`,
    name: `Não Restritiva ${n}`,
    capabilityId: "full",
    requirementType: "NON_RESTRICTIVE" as const,
    expected: {
      "arquiteto-de-solucoes-i": 3,
      "arquiteto-de-solucoes-ii": 4,
      "arquiteto-de-solucoes-iii": 5,
    },
    active: true,
  },
]);

const state: AppState = {
  ...fixtureState,
  capabilities: [...fixtureState.capabilities, fullCapability],
  competencies: [...fixtureState.competencies, ...fullCompetencies],
};

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

/** REVISAO-360-FRONTEND, Seção 40-42 — a matriz agora nasce recolhida; "Expandir tudo" reproduz o antigo padrão sempre-aberto que este teste pressupõe. */
const renderMatrix = async () => {
  render(
    <Wrapper>
      <MatrixPage />
    </Wrapper>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Expandir tudo" }));
};

describe("Matriz de Competências — trocar RESTRICTIVE ↔ NON_RESTRICTIVE quando cheio", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? "GET";
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
          new Response(JSON.stringify(state), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/competencies/full-n1/swap-requirement") && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              a: {
                ...fullCompetencies.find((c) => c.id === "full-n1"),
                requirementType: "RESTRICTIVE",
              },
              b: {
                ...fullCompetencies.find((c) => c.id === "full-r1"),
                requirementType: "NON_RESTRICTIVE",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra o seletor de troca quando o tipo alvo já está em 3/3, e troca ao confirmar", async () => {
    await renderMatrix();
    await screen.findByText("Full Capability");

    await userEvent.click(screen.getByLabelText("Editar Não Restritiva 1"));
    await screen.findByText("Editar competência");

    // RESTRICTIVE está cheia (3/3) — o seletor de troca aparece com as 3 restritivas.
    const swapSelect = screen.getByLabelText("Trocar com qual restritiva?") as HTMLSelectElement;
    const optionNames = Array.from(swapSelect.options).map((o) => o.textContent);
    expect(optionNames).toEqual(
      expect.arrayContaining(["Restritiva 1", "Restritiva 2", "Restritiva 3"]),
    );

    await userEvent.selectOptions(swapSelect, "full-r1");
    await userEvent.click(screen.getByRole("button", { name: "Trocar" }));

    const swapCall = await vi.waitFor(() =>
      fetchMock.mock.calls.find(([u]) => String(u).endsWith("/swap-requirement")),
    );
    expect(swapCall).toBeDefined();
    expect(JSON.parse(String((swapCall?.[1] as RequestInit)?.body))).toEqual({
      withCompetencyId: "full-r1",
    });

    // Depois da troca confirmada, esta competência já É restritiva — o
    // select do tipo reflete isso sem precisar de um segundo Salvar.
    await vi.waitFor(() => {
      const requirementSelect = screen.getByLabelText("Exigência") as HTMLSelectElement;
      expect(requirementSelect.value).toBe("RESTRICTIVE");
    });
  });
});
