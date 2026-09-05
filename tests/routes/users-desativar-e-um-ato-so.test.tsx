import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import type { Architect } from "@/lib/domain";
import { Route as UsersRoute } from "@/routes/users";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * ONDA 37, consequência declarada 4 do pedido do dono: *"Desativar vira um
 * ato só (conta + profissional), no menu Usuários, já que Time perde o
 * botão."* O backend faz as duas metades na MESMA transação (ADR-0084).
 *
 * 2026-09-05, pedido do dono, literal: *"se status = desativado, o botão não
 * pode ser 'editar', tem que ser 'reativar' com tela de confirmação. somente
 * então, o botão torna-se 'editar'. (…) um botão que pode ser 'ativar' /
 * 'desativar', de acordo com o status do usuário, e um botão 'editar' que só
 * fica ativo quando o usuário está ativo, e escuro e não clicável quando o
 * usuário está inativo."*
 *
 * O que esta tela prova: o botão de status segue o status; com profissional,
 * desativar sai com motivo e VERSÃO, e ativar é o mesmo ato de volta pela
 * rota de reativação (também com a versão); sem profissional, só a conta
 * muda de status, por confirmação; e Editar fica desabilitado enquanto a
 * conta está inativa.
 */

const fetchMock = vi.fn();

const UsersPage = UsersRoute.options.component as () => ReactNode;

const [primeira] = fixtureState.architects;
if (!primeira) throw new Error("fixture sem Ana");
const ana: Architect = primeira;

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

const gestorSemProfissional: SessionUser = {
  id: "conta-gestor",
  email: "gestor@company.com",
  name: "Gestor Sem Quadro",
  role: "manager",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const rotaDeContas =
  (contas: SessionUser[]): FetchRoute =>
  (href, init) =>
    href.endsWith(apiPath("/auth/users")) && (init?.method ?? "GET") === "GET"
      ? jsonResponse(contas)
      : undefined;

const rotaDoProfissional =
  (profissional: typeof ana): FetchRoute =>
  (href, init) =>
    href.endsWith(apiPath(`/architects/${ana.id}`)) && (init?.method ?? "GET") === "GET"
      ? jsonResponse({ ...profissional, version: 7 })
      : undefined;

const rotaDeDesativacao: FetchRoute = (href, init) =>
  init?.method === "POST" && href.endsWith(apiPath(`/architects/${ana.id}/deactivate`))
    ? jsonResponse({ ...ana, active: false, version: 8 })
    : undefined;

const rotaDeReativacao: FetchRoute = (href, init) =>
  init?.method === "POST" && href.endsWith(apiPath(`/architects/${ana.id}/reactivate`))
    ? jsonResponse({ ...ana, active: true, version: 8 })
    : undefined;

const rotaDeStatusDaConta: FetchRoute = (href, init) =>
  init?.method === "PATCH" && href.includes(apiPath("/auth/users/"))
    ? jsonResponse({
        ...gestorSemProfissional,
        ...(JSON.parse(String(init.body)) as Record<string, unknown>),
      })
    : undefined;

function renderUsers(contas: SessionUser[], profissional = ana) {
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    state: fixtureState,
    routes: [
      rotaDeDesativacao,
      rotaDeReativacao,
      rotaDeStatusDaConta,
      rotaDoProfissional(profissional),
      rotaDeContas(contas),
    ],
  });
  return renderWithApp(<UsersPage />);
}

const chamadas = (metodo: string, sufixo: string) =>
  fetchMock.mock.calls.filter(
    ([entrada, init]) =>
      (init as RequestInit | undefined)?.method === metodo && String(entrada).endsWith(sufixo),
  );

describe("Usuários — desativar é um ato só, e ativar é o mesmo ato de volta", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o botão de status segue o status: Desativar na conta ativa, Ativar na desabilitada — e nunca na própria conta", async () => {
    renderUsers([fixtureAdminUser, contaDaAna, { ...gestorSemProfissional, status: "disabled" }]);
    await screen.findByText("Ana Martins");

    expect(screen.getByRole("button", { name: "Desativar Ana Martins" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ativar Gestor Sem Quadro" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Desativar Admin de teste" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ativar Admin de teste" })).toBeNull();
  });

  it("conta desabilitada: Editar fica desabilitado até ser reativada", async () => {
    renderUsers([fixtureAdminUser, { ...contaDaAna, status: "disabled" }], {
      ...ana,
      active: false,
    });
    await screen.findByText("Ana Martins");

    expect(
      (screen.getByRole("button", { name: "Editar Ana Martins" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Editar Admin de teste" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("desativar sai com o motivo e com a versão do profissional", async () => {
    renderUsers([fixtureAdminUser, contaDaAna]);
    await screen.findByText("Ana Martins");
    await userEvent.click(screen.getByRole("button", { name: "Desativar Ana Martins" }));

    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.type(dialogo.getByLabelText("Motivo da desativação"), "Saiu da organização");
    await userEvent.click(dialogo.getByRole("button", { name: "Desativar" }));

    const posts = chamadas("POST", apiPath(`/architects/${ana.id}/deactivate`));
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String((posts[0]?.[1] as RequestInit).body))).toEqual({
      reason: "Saiu da organização",
      expectedVersion: 7,
    });
  });

  it("ativar a pessoa confirma e sai pela rota de reativação, com a versão do profissional", async () => {
    renderUsers([fixtureAdminUser, { ...contaDaAna, status: "disabled" }], {
      ...ana,
      active: false,
    });
    await screen.findByText("Ana Martins");
    await userEvent.click(screen.getByRole("button", { name: "Ativar Ana Martins" }));

    const dialogo = within(await screen.findByRole("dialog"));
    expect(dialogo.getByText("Ativar Ana Martins?")).toBeTruthy();
    await userEvent.click(dialogo.getByRole("button", { name: "Ativar" }));

    const posts = chamadas("POST", apiPath(`/architects/${ana.id}/reactivate`));
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String((posts[0]?.[1] as RequestInit).body))).toEqual({
      expectedVersion: 7,
    });
    expect(chamadas("PATCH", "").length).toBe(0);
  });

  it("conta sem profissional: desativar e ativar mudam só o status da conta, por confirmação", async () => {
    renderUsers([fixtureAdminUser, gestorSemProfissional]);
    await screen.findByText("Gestor Sem Quadro");
    await userEvent.click(screen.getByRole("button", { name: "Desativar Gestor Sem Quadro" }));

    const dialogo = within(await screen.findByRole("dialog"));
    expect(dialogo.queryByLabelText("Motivo da desativação")).toBeNull();
    await userEvent.click(dialogo.getByRole("button", { name: "Desativar" }));

    const patches = chamadas("PATCH", apiPath(`/auth/users/${gestorSemProfissional.id}`));
    expect(patches).toHaveLength(1);
    expect(JSON.parse(String((patches[0]?.[1] as RequestInit).body))).toEqual({
      status: "disabled",
    });
    expect(chamadas("POST", "/deactivate")).toHaveLength(0);
  });
});
