import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import { Route as UsersRoute } from "@/routes/users";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * ONDA 37, consequência declarada 4 do pedido do dono: *"Desativar vira um
 * ato só (conta + profissional), no menu Usuários, já que Time perde o
 * botão."* O backend faz as duas metades na MESMA transação (ADR-0084:
 * `DeactivateArchitect` revoga as contas da pessoa junto com o ledger de
 * desativação) — antes, desativar o profissional deixava a conta de pé,
 * alguém fora do quadro e dentro da aplicação, com sessão válida.
 *
 * O que esta tela precisa provar: a ação existe SÓ para quem tem
 * profissional (conta administrativa sem `architectId` não tem o que
 * desativar), e o comando sai com motivo e com a VERSÃO do profissional — a
 * trava otimista que o serviço exige. A tela de contas não monta o `/state`,
 * então a versão vem de uma leitura do próprio profissional; se ela não
 * chegou, o confirmar não acende.
 */

const fetchMock = vi.fn();

const UsersPage = UsersRoute.options.component as () => ReactNode;

const ana = fixtureState.architects[0];
if (!ana) throw new Error("fixture sem Ana");

const contaDaAna: SessionUser = {
  id: "conta-ana",
  email: "ana@company.com",
  name: "Ana Martins",
  role: "member",
  architectId: ana.id,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const rotaDeContas: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/auth/users")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([fixtureAdminUser, contaDaAna])
    : undefined;

const rotaDoProfissional: FetchRoute = (href, init) =>
  href.endsWith(apiPath(`/architects/${ana.id}`)) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({ ...ana, version: 7 })
    : undefined;

const rotaDeDesativacao: FetchRoute = (href, init) =>
  init?.method === "POST" && href.endsWith(apiPath(`/architects/${ana.id}/deactivate`))
    ? jsonResponse({ ...ana, active: false, version: 8 })
    : undefined;

function renderUsers() {
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    state: fixtureState,
    routes: [rotaDeDesativacao, rotaDoProfissional, rotaDeContas],
  });
  return renderWithApp(<UsersPage />);
}

describe("Usuários — desativar é um ato só", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a conta sem profissional não oferece desativar — não há quem tirar do quadro", async () => {
    renderUsers();
    await screen.findByText("Ana Martins");
    expect(screen.queryByRole("button", { name: "Desativar Admin de teste" })).toBeNull();
    expect(screen.getByRole("button", { name: "Desativar Ana Martins" })).toBeTruthy();
  });

  it("desativar sai com o motivo e com a versão do profissional", async () => {
    renderUsers();
    await screen.findByText("Ana Martins");
    await userEvent.click(screen.getByRole("button", { name: "Desativar Ana Martins" }));

    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.type(dialogo.getByLabelText("Motivo da desativação"), "Saiu da organização");
    await userEvent.click(dialogo.getByRole("button", { name: "Desativar" }));

    const chamadas = fetchMock.mock.calls.filter(
      ([entrada, init]) =>
        (init as RequestInit | undefined)?.method === "POST" &&
        String(entrada).endsWith(apiPath(`/architects/${ana.id}/deactivate`)),
    );
    expect(chamadas).toHaveLength(1);
    expect(JSON.parse(String((chamadas[0]?.[1] as RequestInit).body))).toEqual({
      reason: "Saiu da organização",
      expectedVersion: 7,
    });
  });
});
