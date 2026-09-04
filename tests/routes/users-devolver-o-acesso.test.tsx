import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import type { SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { Route as UsersRoute } from "@/routes/users";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * DEVOLVER O ACESSO de alguém, na tela de Usuários.
 *
 * Pedido do dono (2026-09-04): *"quero poder resetar a senha do usuário"* —
 * com a correção que ele mesmo fez em seguida: **"a senha não deve ser
 * enviada por e-mail"**. Então o que a liderança dispara é um convite por
 * LINK, e ninguém nesta tela chega a ver uma senha.
 *
 * Duas metades, e a segunda é a que costuma faltar: o ato existe, e ele só
 * aparece para quem o serviço deixaria fazer. Um 403 `ACCESS_RESTORE_FORBIDDEN`
 * não pode ser a primeira vez que a pessoa descobre que não podia — a régua da
 * `UiAuthorizationPolicy` espelha a do serviço, como o resto desta tela já faz.
 */

const fetchMock = vi.fn();

const UsersPage = UsersRoute.options.component as () => ReactNode;

const ANA: SessionUser = { ...fixtureMemberUser, id: "conta-ana", name: "Ana Martins" };
const CONTA_DESATIVADA: SessionUser = {
  ...fixtureMemberUser,
  id: "conta-desativada",
  name: "Bruno Desativado",
  status: "disabled",
};

const contas: SessionUser[] = [fixtureAdminUser, ANA, CONTA_DESATIVADA];

const rotaDeContas: FetchRoute = (href) =>
  href.endsWith(apiPath("/auth/users")) ? jsonResponse(contas) : undefined;

/** A recuperação que a liderança dispara: 202, sem corpo de dado. */
class ServidorDaDevolucao {
  devolucoesPedidas: string[] = [];

  recusa: { status: number; corpo: Record<string, unknown> } | null = null;

  rota: FetchRoute = (href, init) => {
    const casamento = /\/auth\/users\/([^/]+)\/access-recovery$/.exec(href);
    if (!casamento || (init?.method ?? "GET").toUpperCase() !== "POST") return undefined;
    this.devolucoesPedidas.push(casamento[1] ?? "");
    if (this.recusa !== null) return jsonResponse(this.recusa.corpo, this.recusa.status);
    return jsonResponse({ message: { code: "auth.accessRecovery.sent" } }, 202);
  };
}

let servidor: ServidorDaDevolucao;

function renderAs(user: SessionUser) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
    routes: [servidor.rota, rotaDeContas],
  });
  // O aviso de sucesso mora no `<Toaster>` do `__root`; sem ele montado aqui,
  // o resultado do ato não teria onde aparecer nesta montagem isolada.
  return renderWithApp(
    <>
      <UsersPage />
      <Toaster theme="light" position="bottom-right" duration={3000} />
    </>,
  );
}

const botaoDe = (nome: string) => screen.getByRole("button", { name: `Devolver o acesso ${nome}` });

beforeEach(() => {
  servidor = new ServidorDaDevolucao();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.dismiss();
});

describe("o ato existe, e ele pede confirmação antes de sair da tela", () => {
  it("a linha de outra pessoa ativa oferece devolver o acesso", async () => {
    renderAs(fixtureAdminUser);
    expect(await screen.findByText("Ana Martins")).toBeTruthy();

    expect(botaoDe("Ana Martins")).toBeTruthy();
  });

  /**
   * O e-mail sai para a pessoa: é efeito fora da tela, e efeito fora da tela
   * se confirma antes.
   */
  it("nada é disparado enquanto a confirmação não é dada", async () => {
    const usuario = userEvent.setup();
    renderAs(fixtureAdminUser);
    await screen.findByText("Ana Martins");

    await usuario.click(botaoDe("Ana Martins"));

    expect(await screen.findByText("Devolver o acesso a Ana Martins?")).toBeTruthy();
    expect(servidor.devolucoesPedidas).toEqual([]);
  });

  it("a confirmação conta o que vai acontecer: um link, com prazo, e a senha escolhida por ela", async () => {
    const usuario = userEvent.setup();
    renderAs(fixtureAdminUser);
    await screen.findByText("Ana Martins");

    await usuario.click(botaoDe("Ana Martins"));

    expect(
      await screen.findByText(
        "Ana Martins recebe por e-mail um link para criar uma senha nova. O link vale por 1 hora, e a senha quem escolhe é Ana Martins — ela não passa por você nem por esta tela.",
      ),
    ).toBeTruthy();
  });

  it("confirmado, o pedido sai para a pessoa da linha e o resultado é dito na tela", async () => {
    const usuario = userEvent.setup();
    renderAs(fixtureAdminUser);
    await screen.findByText("Ana Martins");

    await usuario.click(botaoDe("Ana Martins"));
    await usuario.click(await screen.findByRole("button", { name: "Devolver o acesso" }));

    await waitFor(() => expect(servidor.devolucoesPedidas).toEqual([ANA.id]));
    expect(
      await screen.findByText(
        "Enviamos a Ana Martins o link para criar a senha. Ele vale por 1 hora.",
      ),
    ).toBeTruthy();
  });

  it("quem desistiu no diálogo não dispara nada", async () => {
    const usuario = userEvent.setup();
    renderAs(fixtureAdminUser);
    await screen.findByText("Ana Martins");

    await usuario.click(botaoDe("Ana Martins"));
    await usuario.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(servidor.devolucoesPedidas).toEqual([]);
  });

  /**
   * A régua da tela espelha a do serviço, mas espelho não é o serviço. Se uma
   * recusa escapar, ela é dita DENTRO do diálogo, com a frase do serviço — e
   * não como um erro solto depois que a tela já fechou.
   */
  it("uma recusa que escape do espelho é dita ali mesmo, sem jargão", async () => {
    const usuario = userEvent.setup();
    servidor.recusa = {
      status: 403,
      corpo: {
        code: "ACCESS_RESTORE_FORBIDDEN",
        message: "Você não pode devolver o acesso desta conta.",
      },
    };
    renderAs(fixtureAdminUser);
    await screen.findByText("Ana Martins");

    await usuario.click(botaoDe("Ana Martins"));
    await usuario.click(await screen.findByRole("button", { name: "Devolver o acesso" }));

    const aviso = await screen.findByRole("alert");
    await waitFor(() =>
      expect(aviso.textContent).toBe("Você não pode devolver o acesso desta conta."),
    );
    expect(aviso.textContent).not.toMatch(/\b(?:GET|POST)\b|\/api\/|ACCESS_RESTORE_FORBIDDEN/);
  });
});

describe("o botão só aparece para quem pode — o 403 não é a forma de descobrir", () => {
  /**
   * A própria conta não precisa de convite: quem está logado já entrou. Quem
   * esqueceu a senha pede pela tela de entrar; quem quer trocá-la, pela troca
   * de senha.
   */
  it("ninguém devolve o acesso à própria conta", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Ana Martins");

    expect(
      screen.queryByRole("button", {
        name: `Devolver o acesso ${fixtureAdminUser.name}`,
      }),
    ).toBeNull();
  });

  /** Conta desativada não tem acesso a devolver: o caminho dela é reativar. */
  it("conta desativada não recebe a oferta", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Bruno Desativado");

    expect(screen.queryByRole("button", { name: "Devolver o acesso Bruno Desativado" })).toBeNull();
  });

  /**
   * O gestor alcança a tela (ele admite gente), mas o DIRETÓRIO de contas é
   * administrativo — e devolver acesso é da mesma família.
   */
  it("quem não administra não vê o ato — nem as contas", async () => {
    renderAs(fixtureAssignedManagerUser);

    expect(
      await screen.findByText("Diretório de contas é restrito a administradores."),
    ).toBeTruthy();
    expect(screen.queryByText("Ana Martins")).toBeNull();
    expect(screen.queryByRole("button", { name: /Devolver o acesso/ })).toBeNull();
  });
});
