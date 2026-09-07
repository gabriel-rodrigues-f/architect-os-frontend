import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { Route as UsersRoute } from "@/routes/users";
import { fixtureSupportUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * PR 6 (RBAC-09, RBAC-01) — ninguém muda o próprio papel nem o próprio
 * status; a tela desabilita o papel na própria conta e diz por quê. Quando
 * o serviço recusa (`OWN_ACCOUNT_AMENDMENT_FORBIDDEN`,
 * `ADMIN_ROLE_RESERVED_TO_ADMIN`), a frase dele aparece no aviso do diálogo,
 * crua — a mensagem é do backend.
 */
const fetchMock = vi.fn();
const UsersPage = UsersRoute.options.component as () => ReactNode;

const OUTRO_MEMBRO: SessionUser = {
  id: "user-outro-membro",
  email: "membro@empresa.com",
  name: "Outro Membro",
  role: "member",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const RECUSA_DO_SERVICO =
  "Você não altera o papel nem o status da própria conta. Peça a outro administrador.";

describe("Usuários — a própria conta", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureSupportUser,
      routes: [
        (href, init) => {
          if (href.endsWith(apiPath("/auth/users")) && (init?.method ?? "GET") === "GET") {
            return jsonResponse([fixtureSupportUser, OUTRO_MEMBRO]);
          }
          if (href.endsWith(apiPath(`/auth/users/${fixtureSupportUser.id}`))) {
            return jsonResponse(
              { code: "OWN_ACCOUNT_AMENDMENT_FORBIDDEN", message: RECUSA_DO_SERVICO },
              403,
            );
          }
          return undefined;
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o papel fica desabilitado na própria conta, com o motivo à mão", async () => {
    renderWithApp(<UsersPage />);
    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Suporte de teste" }));

    const dialog = within(await screen.findByRole("dialog"));
    expect((dialog.getByLabelText("Cargo") as HTMLSelectElement).disabled).toBe(true);
    await userEvent.hover(dialog.getByRole("button", { name: "O que é o campo Cargo" }));
    expect(
      (await screen.findAllByText("Ninguém altera o papel nem o status da própria conta.")).length,
    ).toBeGreaterThan(0);
  });

  it("na conta de outra pessoa o papel segue editável", async () => {
    renderWithApp(<UsersPage />);
    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));

    const dialog = within(await screen.findByRole("dialog"));
    expect((dialog.getByLabelText("Cargo") as HTMLSelectElement).disabled).toBe(false);
  });

  it("a recusa do serviço aparece no aviso do diálogo, com a frase dele", async () => {
    renderWithApp(<UsersPage />);
    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Suporte de teste" }));

    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Nome"), " Silva");
    await userEvent.click(dialog.getByRole("button", { name: "Salvar alterações" }));

    const alerta = await dialog.findByRole("alert");
    expect(alerta.textContent).toContain(RECUSA_DO_SERVICO);
  });
});
