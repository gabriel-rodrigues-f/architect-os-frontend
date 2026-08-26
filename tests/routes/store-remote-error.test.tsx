import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de team-deactivate.test.tsx: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => <a {...rest}>{children}</a>,
  };
});

import { Toaster } from "@/components/ui/sonner";
import { Route as TeamRoute } from "@/routes/team";
import { type AppState } from "@/lib/api";
import { fixtureState } from "../helpers/fixtures";
import {
  emptyAuthUsersRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";

/**
 * EPIC L — Trustworthy mutations: uma escrita otimista que falha no servidor
 * não pode voltar em silêncio. Antes, `remote()` só dava `console.error` e
 * revalidava — a tela corrigia sozinha, mas ninguém via aviso nenhum de que
 * a ação não tinha ido para o banco. Ver AUDITORIA-TERCEIRA-RODADA-
 * RECONSTRUCAO-PRODUTO-SYNAPSE.md.
 *
 * R2-UX-08/OO-03 — este teste usava "Desativar" como veículo do PATCH
 * otimista, mas desativação deixou de ser isso: virou `POST
 * /api/architects/:id/deactivate`, sem otimismo nenhum (motivo obrigatório
 * + concorrência otimista — ver team-deactivate.test.tsx, que cobre o 409
 * desse fluxo novo, mostrado dentro do próprio diálogo). "Reativar"
 * continua sendo o PATCH otimista de sempre (`updateArchitect(id, { active:
 * true })`, sem diálogo, um clique só) — assume aqui o lugar de "Desativar"
 * como veículo desta cobertura.
 */

/** Ana Martins já nasce inativa nesta suíte, só para o botão "Reativar" existir de cara. */
const stateWithInactiveAna: AppState = {
  ...fixtureState,
  architects: fixtureState.architects.map((a) => (a.id === "ana" ? { ...a, active: false } : a)),
};

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("store.remote — erro do servidor não fica em silêncio", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      state: stateWithInactiveAna,
      routes: [
        emptyAuthUsersRoute,
        // O servidor recusa a reativação — simula uma regra de negócio.
        (href, init) =>
          init?.method === "PATCH" && href.includes("/api/architects/")
            ? jsonResponse({ error: "Conflict", message: "Não é possível reativar agora." }, 409)
            : undefined,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reativar que falha no servidor mostra a mensagem de erro e mantém a pessoa inativa", async () => {
    renderWithApp(
      <>
        <TeamPage />
        <Toaster theme="light" position="bottom-right" duration={3000} />
      </>,
    );
    const nome = stateWithInactiveAna.architects[0]!.name;

    // Ana já nasce inativa nesta suíte — espera o roster carregar (via quem
    // continua ativo) antes de mexer no filtro.
    await screen.findByText(stateWithInactiveAna.architects[1]!.name);

    // Status nasce filtrado só em "Ativos" — inclui "Inativos" pra achar
    // quem já está desativado e ver o botão "Reativar".
    await userEvent.click(screen.getByLabelText("Status"));
    await userEvent.click(await screen.findByRole("option", { name: "Inativos" }));
    await userEvent.keyboard("{Escape}");
    await screen.findByText(nome);

    await userEvent.click(screen.getByLabelText(`Reativar ${nome}`));

    expect(await screen.findByText("Não é possível reativar agora.")).toBeTruthy();

    // A revalidação devolve o estado real do servidor — a pessoa continua inativa
    // (o botão "Reativar" segue lá, não virou "Desativar").
    await waitFor(() => expect(screen.getByLabelText(`Reativar ${nome}`)).toBeTruthy());
  });
});
