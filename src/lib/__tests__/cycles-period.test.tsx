import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as CyclesRoute } from "@/routes/cycles";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * Ciclo não é texto livre: nasce de ano + semestre, e não dá para repetir um
 * par já existente. A fixture já tem "2026 H1" e "2026 H2" cadastrados.
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

const CyclesPage = CyclesRoute.options.component as () => ReactNode;

describe("Ciclos — identidade matemática (ano + semestre)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((url: string) => {
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

  it("sugere o próximo período livre ao abrir 'Novo ciclo' (2026 H1 e H2 já existem)", async () => {
    render(
      <Wrapper>
        <CyclesPage />
      </Wrapper>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Novo ciclo" }));

    expect(await screen.findByLabelText("Semestre")).toHaveProperty("value", "H1");
    expect(screen.getByRole("spinbutton")).toHaveProperty("value", "2027");
  });

  it("bloqueia salvar um período já usado e mostra o motivo", async () => {
    render(
      <Wrapper>
        <CyclesPage />
      </Wrapper>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Novo ciclo" }));

    const ano = await screen.findByRole("spinbutton");
    fireEvent.change(ano, { target: { value: "2026" } });
    // semestre já nasce em H1 — 2026 H1 é exatamente o ciclo que já existe.

    expect(await screen.findByText("Já existe um ciclo 2026 H1.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
  });

  it("em edição, o período aparece fixo — não é mais campo de texto livre", async () => {
    render(
      <Wrapper>
        <CyclesPage />
      </Wrapper>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Editar 2026 H1" }));

    await screen.findByRole("heading", { name: "Editar 2026 H1" });
    expect(document.getElementById("cycle-year")?.textContent).toBe("2026 H1");
    expect(screen.queryByLabelText("Semestre")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
