import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regressão do bug de 2026-09-08: o backend (PR 4) migrou `admin → support`
 * no banco do dono, o `/auth/me` passou a chegar com `role: "support"`, e a
 * aplicação não abria — `USER_ROLES` tinha quatro valores, `scope.ts`
 * perguntava `role === "admin"` querendo dizer "opera o sistema" e o Painel
 * indexava um `Record<UserRole, …>` que não tinha `support`.
 *
 * A prova é a MENOR possível: a casca monta com a sessão do suporte e com a
 * da diretoria, e o menu de quem opera o sistema está lá.
 */
const fetchMock = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { AppShell } from "@/components/app/AppShell";
import type { SessionUser } from "@/lib/api";
import { ThemeProvider } from "@/lib/theme";
import { fixtureAdminUser, fixtureSupportUser } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

describe("a sessão de SUPPORT abre a aplicação (regressão 2026-09-08)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderShellAs = (user: SessionUser) => {
    mockAppFetch(fetchMock, { user });
    return renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo da tela</div>
        </AppShell>
      </ThemeProvider>,
    );
  };

  it("com `/auth/me` devolvendo `support`, a casca monta e mostra a Administração", async () => {
    renderShellAs(fixtureSupportUser);
    await screen.findByRole("button", { name: "Administração" });
    expect(screen.getByText("conteúdo da tela")).toBeTruthy();
    expect(screen.getByText("Catálogo de Competências")).toBeTruthy();
    expect(screen.getByText("Métricas da Plataforma")).toBeTruthy();
    expect(screen.queryByText("Avaliação de Desempenho")).toBeNull();
  });

  it("com `/auth/me` devolvendo `admin` (diretoria), a casca monta com Administração e Gestão", async () => {
    renderShellAs(fixtureAdminUser);
    await screen.findByRole("button", { name: "Administração" });
    expect(screen.getByText("conteúdo da tela")).toBeTruthy();
    expect(screen.getByText("Catálogo de Competências")).toBeTruthy();
    expect(screen.getByText("Avaliação de Desempenho")).toBeTruthy();
  });
});
