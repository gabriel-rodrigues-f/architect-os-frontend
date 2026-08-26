import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real (a árvore
 * de rotas inteira) para resolver `to="/architects/$architectId"`. A tela de
 * Time usa `<Link>` nos cards e na lista de inativos; como este teste não
 * monta o router da aplicação, troca por uma âncora comum — não é o que se
 * testa aqui, só precisa não quebrar o render.
 */
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

import { Route as TeamRoute } from "@/routes/team";
import { type AppState } from "../api";
import { fixtureAdminUser, fixtureState } from "./fixtures";
import { renderWithApp } from "./render-app";

/**
 * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 18 — excluir um
 * arquiteto não pode mais apagar histórico em cascata. "Excluir" virou
 * "Desativar": a pessoa sai do roster ativo sem que nada seja apagado, e dá
 * para reativar.
 *
 * R2-UX-08/OO-03 (R3-005, bug relatado ao vivo pela dona do produto, com
 * print) — desativação migrou de `PATCH /api/architects/:id` com `{ active:
 * false }` para um comando dedicado (`POST .../deactivate`) que exige
 * motivo e `expectedVersion` (concorrência otimista); o PATCH antigo agora
 * é recusado com 400 ("Desativação exige motivo — use POST
 * /api/architects/:id/deactivate"). Este arquivo cobria só o PATCH antigo —
 * reescrito para cobrir o diálogo com motivo, a chamada nova e o 409 de
 * versão desatualizada. "Reativar" não mudou: continua o mesmo PATCH
 * `{ active: true }` de sempre, um clique só, sem diálogo.
 */

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const TeamPage = TeamRoute.options.component as () => ReactNode;

/** Resposta padrão do `POST .../deactivate`: devolve o arquiteto atualizado. */
function mockDeactivateSuccess(fetch: typeof fetchMock) {
  fetch.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.endsWith("/api/auth/me")) {
      return Promise.resolve(
        new Response(JSON.stringify(fixtureAdminUser), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (href.endsWith("/api/auth/users")) {
      return Promise.resolve(
        new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
      );
    }
    if (init?.method === "POST" && href.endsWith("/api/architects/ana/deactivate")) {
      const body = JSON.parse(String(init.body)) as { reason: string; expectedVersion: number };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...fixtureState.architects[0],
            active: false,
            version: body.expectedVersion + 1,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    }
    if (init?.method === "PATCH" && href.includes("/api/architects/")) {
      const body = JSON.parse(String(init.body)) as { active: boolean };
      return Promise.resolve(
        new Response(JSON.stringify({ ...fixtureState.architects[0], ...body }), {
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
}

describe("Time — desativar preserva histórico", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockDeactivateSuccess(fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * REVISAO-360-FRONTEND — filtro de Status virou composição por caixinha
   * (`MultiSelectFilter`), não mais um `<select>` de valor único: marcar
   * "Inativos" ADICIONA à seleção (que já tinha "Ativos" marcado por
   * padrão), em vez de trocar de valor.
   */
  const includeInactiveInStatusFilter = async () => {
    await userEvent.click(screen.getByLabelText("Status"));
    await userEvent.click(await screen.findByRole("option", { name: "Inativos" }));
    await userEvent.keyboard("{Escape}");
  };

  /**
   * OO3-11c — "exige motivo" e "409 mostra o erro dentro do diálogo sem
   * fechar" viraram invariantes unitários de `CommandWithReasonDialog`
   * (`command-with-reason-dialog.test.tsx`); aqui ficam só os invariantes
   * de integração tela↔store↔API.
   */
  it("desativar chama o comando dedicado com motivo e versão, tira do roster ativo sem excluir nada", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByLabelText("Desativar Ana Martins"));
    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.type(dialogo.getByLabelText("Motivo da desativação"), "Saiu do time");
    await userEvent.click(dialogo.getByRole("button", { name: "Desativar" }));

    // some do roster ativo — o filtro de Status padrão é só "Ativos"...
    await waitFor(() => expect(screen.queryByText("Ana Martins")).toBeNull());
    // ...mas continua acessível incluindo "Inativos" na seleção, com opção de reativar.
    await includeInactiveInStatusFilter();
    expect(await screen.findByText("Ana Martins")).toBeTruthy();
    expect(screen.getByLabelText("Reativar Ana Martins")).toBeTruthy();

    const deactivateCalls = fetchMock.mock.calls.filter(
      ([u, init]) =>
        init?.method === "POST" && String(u).endsWith("/api/architects/ana/deactivate"),
    );
    expect(deactivateCalls).toHaveLength(1);
    expect(JSON.parse(String((deactivateCalls[0]?.[1] as RequestInit).body))).toEqual({
      reason: "Saiu do time",
      expectedVersion: 1,
    });

    // nunca mais o PATCH antigo — o backend recusa com 400 hoje.
    const patchesToArchitect = fetchMock.mock.calls.filter(
      ([u, init]) => init?.method === "PATCH" && String(u).includes("/api/architects/"),
    );
    expect(patchesToArchitect).toHaveLength(0);
  });

  it("reativar devolve a pessoa para o roster ativo", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");
    await userEvent.click(screen.getByLabelText("Desativar Ana Martins"));
    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.type(dialogo.getByLabelText("Motivo da desativação"), "Saiu do time");
    await userEvent.click(dialogo.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(screen.queryByText("Ana Martins")).toBeNull());

    await includeInactiveInStatusFilter();
    await userEvent.click(await screen.findByLabelText("Reativar Ana Martins"));

    // reativada: já não tem mais o botão "Reativar" — "Ativos" já estava
    // marcado o tempo todo, então ela continua visível na mesma lista.
    await waitFor(() => expect(screen.queryByLabelText("Reativar Ana Martins")).toBeNull());
    expect(screen.getByText("Ana Martins")).toBeTruthy();

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(JSON.parse(String((patches[0]?.[1] as RequestInit).body))).toEqual({ active: true });
  });
});
