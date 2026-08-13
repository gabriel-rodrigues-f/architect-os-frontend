import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoleProfilesCard } from "@/routes/team";
import { setAuthToken, type AppState } from "../api";
import { StoreProvider } from "../store";
import { fixtureState } from "./fixtures";

/**
 * "Perfis de Competência por Cargo" resume os níveis esperados do domínio
 * escolhido no seletor. O resumo precisa acompanhar a troca de domínio — antes
 * ele somava todas as competências da base e ficava congelado.
 */

const fetchMock = vi.fn();

/** Fixture com um domínio populado e outro vazio. */
const state: AppState = {
  ...fixtureState,
  categories: [...fixtureState.categories, { id: "vazio", name: "Domínio Vazio", short: "Vazio" }],
};

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>{children}</StoreProvider>
    </QueryClientProvider>
  );
}

describe("Perfis de Competência por Cargo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("mostra a média do domínio selecionado", async () => {
    render(
      <Wrapper>
        <RoleProfilesCard />
      </Wrapper>,
    );
    await screen.findByText("Perfis de Competência por Cargo");

    // Cloud tem Kubernetes e Serverless: Nível I espera 3 nos dois → média 3.0
    expect(screen.getByText(/nível esperado médio 3\.0/)).toBeTruthy();
  });

  it("zera o resumo ao escolher um domínio sem competências", async () => {
    render(
      <Wrapper>
        <RoleProfilesCard />
      </Wrapper>,
    );
    await screen.findByText("Perfis de Competência por Cargo");

    await userEvent.selectOptions(screen.getByLabelText("Domínio"), "vazio");

    expect(screen.queryByText(/nível esperado médio/)).toBeNull();
    expect(screen.getAllByText(/sem competências neste domínio/).length).toBe(3);
  });

  it("usa 'Nível I/II/III' nos cabeçalhos, sem sigla em inglês", async () => {
    render(
      <Wrapper>
        <RoleProfilesCard />
      </Wrapper>,
    );
    await screen.findByText("Perfis de Competência por Cargo");

    expect(screen.getByRole("columnheader", { name: "Nível I" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Nível II" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Nível III" })).toBeTruthy();
    expect(screen.queryByText(/^AS I{1,3}$/)).toBeNull();
  });
});
