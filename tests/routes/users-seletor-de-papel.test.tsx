import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { USER_ROLES, UserRoles } from "@/lib/gateways/auth.gateway";
import type { SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import pt from "@/locales/pt.json";
import { Route as UsersRoute } from "@/routes/users";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * `/users` é a ÚNICA tela onde alguém atribui papel. Ela escrevia a lista de
 * papéis à mão, duas vezes (criar e editar), e devolvia o valor do `<select>`
 * ao estado com `as UserRole` — o molde que engana o compilador. Com isso,
 * papel novo no vocabulário não aparecia em lugar nenhum e papel morto no
 * navegador entrava no estado calado: as duas metades do mesmo defeito.
 *
 * Esta rede prende as duas: a lista é DERIVADA do vocabulário (mesma ordem,
 * nenhum a mais, nenhum a menos, nos DOIS diálogos), e a passagem do texto do
 * navegador para o papel é ESTREITAMENTO de verdade, não molde.
 *
 * O rótulo é a palavra do dono, em PT-BR — ele diz "gestor", não "manager".
 */

const fetchMock = vi.fn();

const UsersPage = UsersRoute.options.component as () => ReactNode;

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

const ROTULOS_DE_NEGOCIO = pt as Record<string, string>;

const papeisEsperados = () =>
  USER_ROLES.map((papel) => [papel, ROTULOS_DE_NEGOCIO[`users.role.${papel}`]]);

function mockBackend() {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    routes: [
      (href, init) => {
        if (href.endsWith(apiPath("/auth/users")) && (!init || init.method === undefined)) {
          return jsonResponse([fixtureAdminUser, OTHER_MEMBER]);
        }
        return undefined;
      },
    ],
  });
}

const papeisOferecidosEm = (dialog: HTMLElement): (string | null)[][] =>
  [...within(dialog).getByLabelText("Papel").querySelectorAll("option")].map((opcao) => [
    opcao.getAttribute("value"),
    opcao.textContent,
  ]);

describe("Usuários — o seletor de papel é derivado do vocabulário", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o diálogo de criação oferece os quatro papéis, na ordem do vocabulário, com o rótulo do dono", async () => {
    mockBackend();
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    const dialog = await screen.findByRole("dialog");
    expect(papeisOferecidosEm(dialog)).toEqual(papeisEsperados());
  });

  it("o diálogo de edição oferece exatamente a mesma lista — uma tela, uma fonte", async () => {
    mockBackend();
    renderWithApp(<UsersPage />);

    await screen.findByText("Outro Membro");
    await userEvent.click(screen.getByRole("button", { name: "Editar Outro Membro" }));

    const dialog = await screen.findByRole("dialog");
    expect(papeisOferecidosEm(dialog)).toEqual(papeisEsperados());
  });

  it("o gestor está entre eles, escrito na palavra do dono", () => {
    expect(ROTULOS_DE_NEGOCIO["users.role.manager"]).toBe("Gestor");
  });
});

describe("Usuários — o texto do navegador vira papel por estreitamento, não por molde", () => {
  it("reconhece os quatro papéis do vocabulário", () => {
    for (const papel of USER_ROLES) expect(UserRoles.includes(papel), papel).toBe(true);
  });

  it("recusa o papel morto `lead` e qualquer texto que o navegador invente", () => {
    expect(UserRoles.includes("lead")).toBe(false);
    expect(UserRoles.includes("")).toBe(false);
    expect(UserRoles.includes("Gestor")).toBe(false);
  });
});

describe("Usuários — a prosa da tela conhece os quatro papéis", () => {
  const head = UsersRoute.options.head as undefined | (() => { meta?: Record<string, string>[] });

  const prosa = (): string =>
    (head?.().meta ?? [])
      .map((tag) => Object.values(tag).join(" "))
      .join(" ")
      .toLowerCase();

  it("nomeia o gestor — a tela que ATRIBUI papel não pode descrever só três", () => {
    const texto = prosa();
    for (const palavra of ["administrador", "gestor", "tech lead", "membro"]) {
      expect(texto, palavra).toContain(palavra);
    }
  });

  it("não descreve mais o papel morto", () => {
    expect(prosa()).not.toContain("(administrador, tech lead, membro)");
  });
});
