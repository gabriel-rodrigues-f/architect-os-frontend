import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Route as UsersRoute } from "@/routes/users";
import type { SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * QA-04 (onda 5) — a falha de gravação da tela de Usuários era o único erro de
 * submissão do app renderizado como parágrafo comum. Todos os outros (26 pontos
 * em settings, ciclos, PDI, matriz, avaliações) usam `role="alert"`.
 *
 * A diferença não é cosmética: sem região viva, quem usa leitor de tela aciona
 * "Salvar", nada é anunciado, o diálogo continua aberto e a única pista de que
 * falhou é um texto vermelho fora do ponto de foco — a pessoa fica esperando
 * uma confirmação que nunca vem (WCAG 4.1.3).
 */

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

const fetchMock = vi.fn();

const UsersPage = UsersRoute.options.component as () => ReactNode;

/** Backend que responde 500 em qualquer escrita de conta. */
function mockBackendQueFalha() {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    routes: [
      (href, init) => {
        if (href.endsWith(apiPath("/auth/users")) && (!init || init.method === undefined)) {
          return jsonResponse([fixtureAdminUser, OUTRO_MEMBRO]);
        }
        if (href.includes(apiPath("/auth/users")) && init?.method !== undefined) {
          return jsonResponse({ code: "INTERNAL", message: "Falha ao gravar a conta" }, 500);
        }
        return undefined;
      },
    ],
  });
}

describe("Usuários — falha de gravação é anunciada (QA-04)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("editar: o erro de salvar entra numa região viva", async () => {
    mockBackendQueFalha();
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));

    const dialogo = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialogo).getByLabelText("Status"), "disabled");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta.textContent).toBe("Falha ao gravar a conta");
  });

  it("criar: o erro de criação entra numa região viva", async () => {
    mockBackendQueFalha();
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    const dialogo = await screen.findByRole("dialog");
    await userEvent.type(within(dialogo).getByLabelText("Nome"), "Nova Pessoa");
    await userEvent.type(within(dialogo).getByLabelText("E-mail"), "nova@empresa.com");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Criar conta" }));

    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta.textContent).toBe("Falha ao gravar a conta");
  });
});
