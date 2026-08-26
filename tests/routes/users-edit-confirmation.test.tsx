import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Route as UsersRoute } from "@/routes/users";
import type { SessionUser } from "@/lib/api";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * REVISAO-360-FRONTEND-UI-UX-ENTERPRISE-SYNAPSE-2026-08-22.md, FE-360-009
 * (P1 UX/Security) — papel e status não podem mais trocar de valor num
 * `onChange` inline sem confirmação. Cobre: a tabela mostra os dois campos
 * como somente leitura, "Editar" abre um diálogo, mudanças comuns salvam
 * direto, e conceder Admin exige uma etapa extra de confirmação antes de
 * persistir.
 *
 * "Vínculo com o time" saiu da tela (pedido do usuário: só existe um Tech
 * Lead no time hoje, o campo não distinguia nada) — o exemplo de "mudança
 * comum, sem confirmação" agora usa Status em vez dele.
 */

const OTHER_MEMBER: SessionUser = {
  id: "user-outro-membro",
  email: "membro@empresa.com",
  name: "Outro Membro",
  role: "member",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const UsersPage = UsersRoute.options.component as () => ReactNode;

/**
 * `conflictEmail`, se informado, faz o PATCH responder 409
 * EMAIL_ALREADY_REGISTERED quando o corpo tenta gravar esse e-mail
 * específico — mesmo shape de erro que `PATCH /api/auth/users/:id` usa de
 * verdade no backend (`code`/`message`/`correlationId`).
 */
function mockBackend(users: SessionUser[], conflictEmail?: string) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    routes: [
      (href, init) => {
        if (href.endsWith("/api/auth/users") && (!init || init.method === undefined)) {
          return jsonResponse(users);
        }
        if (init?.method === "PATCH" && href.includes("/api/auth/users/")) {
          const body = JSON.parse(String(init.body)) as Record<string, unknown>;
          if (conflictEmail && body["email"] === conflictEmail) {
            return jsonResponse(
              {
                code: "EMAIL_ALREADY_REGISTERED",
                message: "E-mail já cadastrado",
                correlationId: "test-correlation-id",
              },
              409,
            );
          }
          return jsonResponse({ ...OTHER_MEMBER, ...body });
        }
        return undefined;
      },
    ],
  });
}

describe("Usuários — edição protegida (FE-360-009)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("papel/status aparecem como somente leitura na tabela, com um botão Editar", async () => {
    mockBackend([fixtureAdminUser, OTHER_MEMBER]);
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    const row = screen.getByText("Outro Membro").closest("tr")!;
    // Nenhum <select>/<button> de troca direta na linha — só o badge e "Editar".
    expect(within(row).queryByRole("combobox")).toBeNull();
    expect(within(row).getByRole("button", { name: "Editar Outro Membro" })).toBeTruthy();
  });

  it("mudança comum (status) salva direto, sem etapa extra", async () => {
    mockBackend([fixtureAdminUser, OTHER_MEMBER]);
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Status"), "disabled");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    const isPatchCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).includes("/api/auth/users/") && init?.method === "PATCH";
    };
    await waitFor(() => expect(fetchMock.mock.calls.some(isPatchCall)).toBe(true));
    const call = fetchMock.mock.calls.find(isPatchCall) as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as Record<string, unknown>;
    expect(body).toEqual({ status: "disabled" });
    expect(body["role"]).toBeUndefined();
  });

  it("conceder Admin exige confirmação extra antes de salvar — cancelar na confirmação não persiste nada", async () => {
    mockBackend([fixtureAdminUser, OTHER_MEMBER]);
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Papel"), "admin");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    // Vira a etapa de confirmação — nada foi salvo ainda.
    await screen.findByText("Conceder acesso de Administrador");
    const isPatchCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).includes("/api/auth/users/") && init?.method === "PATCH";
    };
    expect(fetchMock.mock.calls.some(isPatchCall)).toBe(false);

    // "Voltar" retorna pro formulário sem persistir.
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await screen.findByRole("button", { name: "Salvar alterações" });
    expect(fetchMock.mock.calls.some(isPatchCall)).toBe(false);
  });

  it("confirmar a concessão de Admin persiste o papel novo", async () => {
    mockBackend([fixtureAdminUser, OTHER_MEMBER]);
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Papel"), "admin");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    await screen.findByText("Conceder acesso de Administrador");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar concessão de Admin" }));

    const isPatchCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).includes("/api/auth/users/") && init?.method === "PATCH";
    };
    await waitFor(() => expect(fetchMock.mock.calls.some(isPatchCall)).toBe(true));
    const call = fetchMock.mock.calls.find(isPatchCall) as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as Record<string, unknown>;
    expect(body).toEqual({ role: "admin" });
  });

  /**
   * Cobertura nova pro pedido do PO ("editar nome e e-mail dos usuários") —
   * backend já aceita `name`/`email` opcionais no PATCH (commit ca19b27 no
   * repo backend). Segue o mesmo padrão dos testes acima: fetch mockado,
   * diálogo renderizado através da rota real.
   */
  it("editar nome e e-mail salva só os campos alterados", async () => {
    mockBackend([fixtureAdminUser, OTHER_MEMBER]);
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));

    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByLabelText("Nome");
    const emailInput = within(dialog).getByLabelText("E-mail");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Outro Membro Editado");
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "outro.editado@empresa.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    const isPatchCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).includes("/api/auth/users/") && init?.method === "PATCH";
    };
    await waitFor(() => expect(fetchMock.mock.calls.some(isPatchCall)).toBe(true));
    const call = fetchMock.mock.calls.find(isPatchCall) as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as Record<string, unknown>;
    expect(body).toEqual({ name: "Outro Membro Editado", email: "outro.editado@empresa.com" });
    expect(body["role"]).toBeUndefined();
    expect(body["status"]).toBeUndefined();

    // Diálogo fecha só depois do sucesso.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("colisão de e-mail (409 EMAIL_ALREADY_REGISTERED) mostra erro no diálogo e não fecha", async () => {
    const conflictEmail = "ja.cadastrado@empresa.com";
    mockBackend([fixtureAdminUser, OTHER_MEMBER], conflictEmail);
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));

    const dialog = await screen.findByRole("dialog");
    const emailInput = within(dialog).getByLabelText("E-mail");
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, conflictEmail);
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));

    // Erro do backend aparece no próprio diálogo — mesmo padrão que
    // `CreateUserDialog` já usa pra erro de e-mail duplicado.
    await screen.findByText("E-mail já cadastrado");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Salvar alterações" }),
    ).toBeTruthy();
  });
});
