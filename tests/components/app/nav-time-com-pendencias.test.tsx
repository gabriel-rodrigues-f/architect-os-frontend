import { cleanup, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
    useRouter: () => ({ history: { push: () => {} } }),
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
import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import { ThemeProvider } from "@/lib/theme";
import { fixtureAssignedManagerUser, fixtureAssignedTechLeadUser } from "../../helpers/fixtures";
import {
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../../helpers/render-app";

/**
 * Decisão do dono (2026-09-06): o item de menu Time ganha um badge de
 * contagem quando há transferência A APROVAR por quem está logado. O que
 * a própria pessoa pediu não conta — pendência dela não é decisão dela.
 */
const fetchMock = vi.fn();

const pendentes = (paraMim: number, minhas: number): FetchRoute => {
  const chegando = Array.from({ length: paraMim }, (_, indice) => ({
    id: `chega-${indice}`,
    architectId: `p-${indice}`,
    fromTeamId: "time-dados",
    toTeamId: "time-plataforma",
    reason: "x",
    requestedByUserId: "gerente-de-dados",
    requestedAt: "2026-09-06T12:00:00.000Z",
    status: "pending",
    decidedByUserId: null,
    decidedAt: null,
    decisionNote: null,
    version: 1,
    architectName: `Pessoa ${indice}`,
    fromTeamName: "Time Dados",
    toTeamName: "Time Plataforma",
    requestedByName: "Gerente de Dados",
    decidedByName: null,
  }));
  const pedidas = Array.from({ length: minhas }, (_, indice) => ({
    ...chegando[0],
    id: `minha-${indice}`,
    fromTeamId: "time-plataforma",
    toTeamId: "time-dados",
    requestedByUserId: fixtureAssignedManagerUser.id,
  }));
  return (href, init) =>
    (init?.method ?? "GET").toUpperCase() === "GET" &&
    href.includes(apiPath("/team-transfer-requests"))
      ? jsonResponse([...chegando, ...pedidas])
      : undefined;
};

const consultasDaCaixa = () =>
  fetchMock.mock.calls.filter(([entrada]) =>
    String(entrada instanceof Request ? entrada.url : entrada).includes(
      apiPath("/team-transfer-requests"),
    ),
  );

const montar = (user: SessionUser, rota: FetchRoute) => {
  mockAppFetch(fetchMock, { user, routes: [rota] });
  renderWithApp(
    <ThemeProvider>
      <AppShell>
        <div>conteúdo</div>
      </AppShell>
    </ThemeProvider>,
  );
};

describe("menu — badge de transferências a aprovar no item Time", () => {
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

  it("o gerente do destino vê a contagem do que é a aprovar por ele — as que ele pediu não contam", async () => {
    montar(fixtureAssignedManagerUser, pendentes(2, 1));
    const badges = await screen.findAllByLabelText("2 transferências a aprovar");
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0]?.textContent).toBe("2");
  });

  it("sem nada a aprovar, o badge não existe", async () => {
    montar(fixtureAssignedManagerUser, pendentes(0, 2));
    await screen.findAllByText("Talentos do Time");
    await waitFor(() => expect(consultasDaCaixa().length).toBeGreaterThan(0));
    expect(screen.queryByLabelText(/a aprovar/)).toBeNull();
  });

  it("o tech lead nem consulta a caixa de transferências", async () => {
    montar(fixtureAssignedTechLeadUser, pendentes(3, 0));
    await screen.findAllByText("Talentos do Time");
    expect(consultasDaCaixa()).toEqual([]);
    expect(screen.queryByLabelText(/a aprovar/)).toBeNull();
  });
});
