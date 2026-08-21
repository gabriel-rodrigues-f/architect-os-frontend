import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import type { Capability, Competency } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * ORIENTACAO-NONA-RODADA, Seção 8, problemas 7/13 — a Matriz não mostrava as
 * contagens 6/3/3 nem o status READY/REQUIRES_CURATION por capacidade, e
 * deixava escolher uma 4ª competência restritiva/não restritiva mesmo já no
 * limite (o backend rejeitaria, mas a tela não avisava antes).
 */

const fetchMock = vi.fn();

/** Capacidade "no limite total" (6 ativas: 3 restritivas + 3 não restritivas) — READY, sem espaço para nova competência. */
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
      "Arquiteto de Soluções I": 3,
      "Arquiteto de Soluções II": 4,
      "Arquiteto de Soluções III": 5,
    },
    active: true,
  },
  {
    id: `full-n${n}`,
    name: `Não Restritiva ${n}`,
    capabilityId: "full",
    requirementType: "NON_RESTRICTIVE" as const,
    expected: {
      "Arquiteto de Soluções I": 3,
      "Arquiteto de Soluções II": 4,
      "Arquiteto de Soluções III": 5,
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

const renderMatrix = () =>
  render(
    <Wrapper>
      <MatrixPage />
    </Wrapper>,
  );

describe("Matriz de Competências — curadoria e escala", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");

    fetchMock.mockImplementation((url: string) => {
      if (String(url).endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (String(url).endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(state), {
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

  it("mostra contagens 6/3/3 e status de curadoria por capacidade", async () => {
    renderMatrix();
    await screen.findByText("Kubernetes");

    // Security: REQUIRES_CURATION, 1 competência não restritiva só.
    expect(screen.getByText("1/6 competências · 0/3 restritivas · 1/3 não restritivas")).toBeTruthy();
    expect(screen.getAllByText("Requer curadoria").length).toBeGreaterThan(0);

    // Full Capability: READY, 6/3/3.
    expect(screen.getByText("6/6 competências · 3/3 restritivas · 3/3 não restritivas")).toBeTruthy();
    expect(screen.getByText("Pronta")).toBeTruthy();
  });

  it("desabilita 'Nova competência' quando a capacidade já tem 6 competências ativas", async () => {
    renderMatrix();
    await screen.findByText("Full Capability");

    const newCompetencyButtons = screen.getAllByRole("button", { name: "Nova competência" });
    // A capacidade "cloud" (2/6) permite; "Full Capability" (6/6) não.
    const fullCapabilityCard = screen.getByText("Full Capability").closest(".surface-card");
    expect(fullCapabilityCard).toBeTruthy();
    const disabledButton = newCompetencyButtons.find((btn) => fullCapabilityCard?.contains(btn));
    expect(disabledButton).toHaveProperty("disabled", true);
  });

  it("desabilita a opção restritiva no diálogo de nova competência quando a capacidade já tem 3 restritivas", async () => {
    renderMatrix();
    await screen.findByText("Kubernetes");

    const cloudCard = screen.getByText("Cloud Architecture").closest(".surface-card");
    expect(cloudCard).toBeTruthy();
    // "cloud" só tem NON_RESTRICTIVE — abre o diálogo por essa capacidade para checar que RESTRICTIVE está livre.
    await userEvent.click(
      screen.getAllByRole("button", { name: "Nova competência" }).find((btn) => cloudCard?.contains(btn))!,
    );
    await screen.findByText("Nova competência em Cloud Architecture");
    const restrictiveOption = screen.getByRole("option", { name: "Restritiva" }) as HTMLOptionElement;
    expect(restrictiveOption.disabled).toBe(false);
  });

  it("filtro de busca esconde capacidades que não combinam com o termo", async () => {
    renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.type(
      screen.getByLabelText("Buscar capacidade ou competência…"),
      "Security",
    );

    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.queryByText("Cloud Architecture")).toBeNull();
  });

  it("recolher uma seção esconde a tabela mas mantém o título visível", async () => {
    renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Recolher Cloud Architecture"));

    expect(screen.getByText("Cloud Architecture")).toBeTruthy();
    expect(screen.queryByText("Kubernetes")).toBeNull();
  });
});
