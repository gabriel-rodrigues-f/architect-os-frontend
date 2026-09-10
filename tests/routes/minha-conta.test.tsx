import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as AccountRoute } from "@/routes/account";
import { ThemeProvider } from "@/lib/theme";
import { fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * MINHA CONTA — o item 7 da proposta de governança, na ordem aprovada pelo
 * dono (2026-09-09): segunda da fila, depois da Auditoria.
 *
 * As três abas, e o que cada uma prova aqui:
 *
 *  - **Perfil é SÓ LEITURA.** Conflito 4 da avaliação, decidido pelo dono com
 *    estas palavras: *"correto, ninguém age sobre si"*. A matriz dá "alterar
 *    nome, e-mail e cargo de conta" só ao Administrador, e o adendo 6 fecha:
 *    nem o Administrador altera a própria conta. "Cargo" na conta é o PAPEL DE
 *    ACESSO — um campo editável ali é a pessoa promovendo a si mesma. O e-mail
 *    é a identidade de login. Então a aba mostra os três em leitura e leva a
 *    quem administra; a catraca é a AUSÊNCIA de todo campo e de toda escrita.
 *
 *  - **Segurança troca a própria senha**, pelo caminho que JÁ EXISTE no
 *    servidor (`POST /auth/change-password`, com `currentPassword` e
 *    `newPassword`). É o ganho central da fatia: a rota está no ar desde a
 *    regra do primeiro acesso (dono, 2026-09-03) e o único uso dela era a tela
 *    que segura a porta — quem já trocou a senha uma vez não tinha como trocar
 *    de novo dentro do produto.
 *
 *  - **Preferências** recebe o que já funcionava no menu da engrenagem do
 *    cabeçalho: tema e idioma. Nada nasce aqui; o que muda é o endereço.
 *
 * O que a fatia NÃO faz, e por quê, está no relatório: sessões ativas (o
 * servidor guarda só os acessos MORTOS) e preferência de notificação (não há
 * objeto para configurar).
 */

const fetchMock = vi.fn();

const AccountPage = AccountRoute.options.component as () => ReactNode;

/** A senha do teste nunca é uma senha de verdade, e nunca é conferida por texto. */
const SENHA_NOVA = "Trocada 2026!x";

const montaSessao = (routes: FetchRoute[] = []) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user: fixtureMemberUser, state: fixtureState, routes });
};

/** A aba Preferências lê o tema, que é do provedor da casca — como nos testes do `AppShell`. */
const montaTela = () =>
  renderWithApp(
    <ThemeProvider>
      <AccountPage />
    </ThemeProvider>,
  );

const trocasDeSenha = () =>
  (fetchMock.mock.calls as [string | URL | Request, RequestInit | undefined][])
    .map(([input, init]) => ({
      href: String(input),
      method: (init?.method ?? "GET").toUpperCase(),
      body: typeof init?.body === "string" ? init.body : undefined,
    }))
    .filter((call) => call.href.includes(apiPath("/auth/change-password")));

const abreAba = async (nome: RegExp) =>
  userEvent.click(await screen.findByRole("tab", { name: nome }));

const preenchePasso = async (rotulo: string, valor: string) => {
  const campo = await screen.findByLabelText(rotulo);
  await userEvent.clear(campo);
  await userEvent.type(campo, valor);
};

describe("Minha Conta — Perfil é só leitura", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra nome, e-mail e cargo da conta de quem está logado", async () => {
    montaSessao();
    montaTela();
    expect(await screen.findByText(fixtureMemberUser.name)).toBeTruthy();
    expect(screen.getByText(fixtureMemberUser.email)).toBeTruthy();
    expect(screen.getByText("Profissional")).toBeTruthy();
  });

  it("não oferece NENHUM campo editável — ninguém age sobre si", async () => {
    montaSessao();
    montaTela();
    const perfil = await screen.findByRole("tabpanel", { name: /perfil/i });
    expect(perfil.querySelectorAll("input, select, textarea")).toHaveLength(0);
  });

  it("diz a quem pedir correção, em vez de deixar a pessoa sem saída", async () => {
    montaSessao();
    montaTela();
    const perfil = await screen.findByRole("tabpanel", { name: /perfil/i });
    expect(perfil.textContent).toMatch(/administra/i);
  });
});

describe("Minha Conta — Segurança troca a própria senha", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("avisa ANTES de trocar que a senha nova encerra as sessões abertas", async () => {
    montaSessao();
    montaTela();
    await abreAba(/segurança/i);
    const seguranca = await screen.findByRole("tabpanel", { name: /segurança/i });
    expect(seguranca.textContent).toMatch(/sess(ão|ões)/i);
  });

  it("manda a senha atual e a nova para o caminho que já existe no servidor", async () => {
    const trocaAceita: FetchRoute = (href, init) =>
      href.includes(apiPath("/auth/change-password")) &&
      (init?.method ?? "GET").toUpperCase() === "POST"
        ? new Response(null, { status: 204 })
        : undefined;
    montaSessao([trocaAceita]);
    montaTela();
    await abreAba(/segurança/i);

    await preenchePasso("Senha atual", "A senha 1 de antes!");
    await preenchePasso("Senha nova", SENHA_NOVA);
    await preenchePasso("Repita a senha nova", SENHA_NOVA);
    await userEvent.click(await screen.findByRole("button", { name: /trocar a senha/i }));

    await waitFor(() => expect(trocasDeSenha()).toHaveLength(1));
    const [troca] = trocasDeSenha();
    expect(troca?.method).toBe("POST");
    expect(JSON.parse(troca?.body ?? "{}")).toEqual({
      currentPassword: "A senha 1 de antes!",
      newPassword: SENHA_NOVA,
    });
  });

  it("a recusa não conta nada sobre a senha atual, nem repete o que foi digitado", async () => {
    const trocaRecusada: FetchRoute = (href, init) =>
      href.includes(apiPath("/auth/change-password")) &&
      (init?.method ?? "GET").toUpperCase() === "POST"
        ? jsonResponse({ code: "INVALID_CURRENT_PASSWORD", message: "Senha atual incorreta" }, 401)
        : undefined;
    montaSessao([trocaRecusada]);
    montaTela();
    await abreAba(/segurança/i);

    await preenchePasso("Senha atual", "A senha 1 de antes!");
    await preenchePasso("Senha nova", SENHA_NOVA);
    await preenchePasso("Repita a senha nova", SENHA_NOVA);
    await userEvent.click(await screen.findByRole("button", { name: /trocar a senha/i }));

    const aviso = await screen.findByRole("alert");
    expect(aviso.textContent).toBeTruthy();
    expect(aviso.textContent).not.toContain(SENHA_NOVA);
    expect(aviso.textContent).not.toContain("A senha 1 de antes!");
  });
});

describe("Minha Conta — Preferências recebe o que a engrenagem tinha", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("tem tema e idioma, que já funcionavam no cabeçalho", async () => {
    montaSessao();
    montaTela();
    await abreAba(/preferências/i);
    const preferencias = await screen.findByRole("tabpanel", { name: /preferências/i });
    expect(preferencias.textContent).toMatch(/tema/i);
    expect(preferencias.querySelector("#locale")).toBeTruthy();
  });

  it("as três escolhas de tema continuam à mão", async () => {
    montaSessao();
    montaTela();
    await abreAba(/preferências/i);
    for (const escolha of [/claro/i, /escuro/i, /sistema/i]) {
      expect(await screen.findByRole("button", { name: escolha })).toBeTruthy();
    }
  });
});
