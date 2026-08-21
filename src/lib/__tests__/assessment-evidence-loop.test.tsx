import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import type { Evidence } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * EPIC I — Evidence Loop: evidência aceita para a competência aparece como
 * contexto na avaliação seguinte, sem alterar nota nenhuma sozinha. Ver
 * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md.
 */

const fetchMock = vi.fn();

const evidenciaAceita: Evidence = {
  id: "ev-aceita",
  architectId: "ana",
  title: "ADR-014 — Estratégia de retry",
  description: "",
  type: "ADR",
  competencyIds: ["cloud-k8s"],
  date: "2026-07-20",
  complexity: "High",
  status: "Accepted",
};

const evidenciaPendente: Evidence = {
  id: "ev-pendente",
  architectId: "ana",
  title: "Curso de Kubernetes avançado",
  description: "",
  type: "Course",
  competencyIds: ["cloud-k8s"],
  date: "2026-07-01",
  complexity: "Medium",
  status: "Pending",
};

const state: AppState = {
  ...fixtureState,
  evidences: [...fixtureState.evidences, evidenciaAceita, evidenciaPendente],
};

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
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

/**
 * O app real só monta a árvore autenticada depois do `AuthGate` (em
 * `__root.tsx`) resolver a sessão guardada no navegador. Este teste não passa
 * por ele, então precisa do mesmo corte — ver assessment-comments.test.tsx.
 */
function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

describe("Avaliações — evidência aceita aparece como contexto", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

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
  });

  it("mostra um selo na competência com evidência aceita", async () => {
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );
    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(within(linha).getByLabelText(/evidência aceita/i)).toBeTruthy();
  });

  it("ao abrir a competência, lista a evidência aceita — mas não a pendente", async () => {
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );
    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    await userEvent.click(within(linha).getByRole("button"));

    expect(await screen.findByText("Evidências aceitas")).toBeTruthy();
    expect(screen.getByText("ADR-014 — Estratégia de retry")).toBeTruthy();
    expect(screen.queryByText("Curso de Kubernetes avançado")).toBeNull();
  });

  it("competência sem evidência aceita não mostra selo nem a seção", async () => {
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );
    const linha = (await screen.findByText("Serverless")).closest("tr")!;
    expect(within(linha).queryByLabelText(/evidência aceita/i)).toBeNull();

    await userEvent.click(within(linha).getByRole("button"));
    expect(screen.queryByText("Evidências aceitas")).toBeNull();
  });
});
