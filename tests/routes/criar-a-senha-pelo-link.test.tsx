import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
  type AnyRouter,
} from "@tanstack/react-router";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { PASSWORD_CHECKS } from "@/lib/password-safety";
import { createAppQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import { jsonResponse } from "../helpers/render-app";

/**
 * A PESSOA CRIA A PRÓPRIA SENHA pelo link do convite — do endereço do e-mail
 * até o login.
 *
 * Pedido do dono (2026-09-04): *"quero poder resetar a senha do usuário / uma
 * senha inicial precisa ser enviada a ele por e-mail"* — e, ao escolher o
 * desenho, ele corrigiu o próprio pedido: **"a senha não deve ser enviada por
 * e-mail"**. O e-mail leva um LINK, e é aqui que a senha nasce.
 *
 * Este arquivo sobe o ROTEADOR DE VERDADE — `routeTree` gerado, `__root` com o
 * `AuthGate` — porque metade do que precisa ser provado é justamente o portão:
 * `/set-password` é a primeira rota pública do Synapse, e montar a tela solta
 * pularia a única pergunta que importa antes de qualquer formulário — quem
 * chega pelo link NÃO TEM sessão, e mesmo assim tem de ver a tela.
 *
 * O servidor daqui é o contrato fechado: `POST /auth/set-password` responde
 * **204**; recusa com **401** `ACCESS_INVITATION_REFUSED` quando o link é
 * desconhecido, venceu, já foi usado ou foi substituído — e a frase do corpo
 * já vem escrita para a pessoa —; recusa com **400** nos mesmos códigos de
 * senha fraca da troca de senha. `POST /auth/access-recovery` responde
 * **sempre 202**.
 */

const fetchMock = vi.fn();

const TOKEN = "convite-de-mentira-do-teste";

/**
 * O que a pessoa digita nos dois campos. MONTADA em vez de escrita à mão: este
 * repositório é público, e a régua da casa é que nada com cara de credencial
 * vire literal — nem em teste, nem como exemplo. Ela atende às sete exigências
 * que uma tela sem sessão consegue medir.
 */
const ESCOLHIDA = ["Alameda", "# ", "azul", "9"].join("");
const OUTRA = ["Alameda", "# ", "verde", "8"].join("");

class RecusaDoServico {
  private constructor(
    readonly status: number,
    readonly corpo: Record<string, unknown>,
  ) {}

  static aceita(): RecusaDoServico | null {
    return null;
  }

  static linkRecusado(frase: string): RecusaDoServico {
    return new RecusaDoServico(401, { code: "ACCESS_INVITATION_REFUSED", message: frase });
  }

  static senhaFraca(requirement: string): RecusaDoServico {
    return new RecusaDoServico(400, {
      code: "WEAK_PASSWORD",
      message: "Senha recusada.",
      details: { requirement },
    });
  }
}

class ServidorDoConvite {
  /** O que a próxima criação de senha vai responder — `null` aceita com 204. */
  proximaRecusa: RecusaDoServico | null = RecusaDoServico.aceita();

  senhasCriadas: Array<{ token: string; newPassword: string }> = [];

  /** O que `GET /auth/invitations/:token` responde ao abrir a tela — `null` diz a quem é. */
  recusaAoAbrir: RecusaDoServico | null = null;

  emailDoConvite = "rafael.lima@empresa.com";

  convitesConsultados = 0;

  pedidosDeLink: Array<{ email: string }> = [];

  responder = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const href = input instanceof Request ? input.url : String(input);
    const metodo = (
      input instanceof Request ? input.method : (init?.method ?? "GET")
    ).toUpperCase();

    if (href.endsWith(apiPath("/auth/set-password")) && metodo === "POST") {
      this.senhasCriadas.push(
        JSON.parse(String(init?.body ?? "{}")) as { token: string; newPassword: string },
      );
      const recusa = this.proximaRecusa;
      if (recusa !== null) return Promise.resolve(jsonResponse(recusa.corpo, recusa.status));
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (href.includes(apiPath("/auth/invitations/")) && metodo === "GET") {
      this.convitesConsultados += 1;
      const recusa = this.recusaAoAbrir;
      if (recusa !== null) return Promise.resolve(jsonResponse(recusa.corpo, recusa.status));
      return Promise.resolve(
        jsonResponse({ data: { email: this.emailDoConvite, firstName: "Rafael" } }),
      );
    }

    if (href.endsWith(apiPath("/auth/access-recovery")) && metodo === "POST") {
      this.pedidosDeLink.push(JSON.parse(String(init?.body ?? "{}")) as { email: string });
      return Promise.resolve(
        jsonResponse({ message: { code: "auth.accessRecovery.requested" } }, 202),
      );
    }

    if (href.endsWith(apiPath("/auth/status"))) {
      return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
    }

    // Ninguém logado: é o estado de quem clica no link do e-mail.
    return Promise.resolve(
      jsonResponse({ code: "AUTHENTICATION_REQUIRED", message: "Autenticação necessária." }, 401),
    );
  };
}

let servidor: ServidorDoConvite;
let router: AnyRouter;

async function abrirOLink(busca: string): Promise<ReturnType<typeof userEvent.setup>> {
  const queryClient = createAppQueryClient();
  router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [`/set-password${busca}`] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}

async function preencher(
  usuario: ReturnType<typeof userEvent.setup>,
  escolhida: string,
  repeticao = escolhida,
): Promise<void> {
  await usuario.clear(screen.getByLabelText("Senha nova"));
  await usuario.type(screen.getByLabelText("Senha nova"), escolhida);
  await usuario.clear(screen.getByLabelText("Repita a senha nova"));
  await usuario.type(screen.getByLabelText("Repita a senha nova"), repeticao);
}

const salvar = (usuario: ReturnType<typeof userEvent.setup>) =>
  usuario.click(screen.getByRole("button", { name: "Definir senha" }));

beforeEach(() => {
  servidor = new ServidorDoConvite();
  fetchMock.mockReset();
  fetchMock.mockImplementation(servidor.responder);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // sonner guarda os toasts num store global fora da árvore React.
  toast.dismiss();
});

describe("o link do convite abre a criação de senha, sem sessão", () => {
  /**
   * A prova do portão. Até esta fatia o `AuthGate` embrulhava o `<Outlet />`
   * inteiro: quem não tem sessão via a tela de login e mais nada. Quem clica
   * no link do e-mail é exatamente quem não tem sessão.
   */
  it("quem chega pelo link vê a criação da senha, e NÃO a tela de entrar", async () => {
    await abrirOLink(`?token=${TOKEN}`);

    expect(await screen.findByText("Defina sua senha")).toBeTruthy();
    expect(screen.queryByLabelText("Senha")).toBeNull();
    expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("as exigências estão na tela ANTES de a pessoa errar", async () => {
    await abrirOLink(`?token=${TOKEN}`);
    await screen.findByText("Defina sua senha");

    expect(screen.getByText("A senha nova precisa:")).toBeTruthy();
    for (const item of [
      "ter 8 caracteres ou mais",
      "ter uma letra maiúscula",
      "ter uma letra minúscula",
      "ter um número",
      "ter um símbolo, como ! ? # ou @",
      "ter um espaço no meio, nunca no começo nem no fim",
      "não ter 1234 nem outra sequência óbvia",
      "não ter o seu e-mail dentro dela",
      "ser igual nos dois campos",
    ]) {
      expect(screen.getByText(item), item).toBeTruthy();
    }
  });

  /**
   * O token é opaco e não há sessão: o e-mail da pessoa não está nesta tela.
   * Marcar a exigência como atendida seria pôr um tique verde sobre uma senha
   * que pode ser o e-mail dela inteiro.
   */
  it("a tela pergunta a quem é o convite, saúda pelo primeiro nome e confere o e-mail na hora (bug do dono, 2026-09-05)", async () => {
    const usuario = await abrirOLink(`?token=${TOKEN}`);
    await screen.findByText("Defina sua senha");
    expect(
      await screen.findByText(
        "Olá, Rafael. Crie uma senha para concluir a ativação da sua conta no Synapse.",
      ),
    ).toBeTruthy();
    expect(servidor.convitesConsultados).toBe(1);

    await preencher(usuario, ESCOLHIDA);
    await waitFor(() =>
      expect(screen.getAllByText("já atendido").length).toBe(PASSWORD_CHECKS.length),
    );
    expect(screen.queryByText("confere ao salvar")).toBeNull();

    // A senha com o e-mail dentro fica APONTADA antes de qualquer envio.
    await preencher(usuario, ["Rafael.lima", "# ", "2026"].join(""));
    await waitFor(() => expect(screen.getByText("ainda falta")).toBeTruthy());
    expect(servidor.senhasCriadas).toEqual([]);
  });

  it("link recusado na chegada: sem formulário, direto para pedir outro", async () => {
    servidor.recusaAoAbrir = RecusaDoServico.linkRecusado("Este link de acesso venceu.");
    await abrirOLink(`?token=${TOKEN}`);

    expect(await screen.findByText("Este link não serve mais")).toBeTruthy();
    // A frase é NOSSA, nos dois idiomas — a do serviço só existe em pt-BR.
    expect(
      screen.getByText("Peça um link novo e abra sempre o mais recente que você recebeu."),
    ).toBeTruthy();
    expect(screen.queryByText("Este link de acesso venceu.")).toBeNull();
    expect(screen.queryByLabelText("Senha nova")).toBeNull();
    expect(screen.getByRole("button", { name: "Pedir um link novo" })).toBeTruthy();
  });

  it("a senha criada leva ao login com o aviso — e NÃO entra sozinha", async () => {
    const usuario = await abrirOLink(`?token=${TOKEN}`);
    await screen.findByText("Defina sua senha");

    await preencher(usuario, ESCOLHIDA);
    await salvar(usuario);

    expect(await screen.findByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Entrar|Enviando/ })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(await screen.findByText("Senha definida. Entre com ela para começar.")).toBeTruthy();
    expect(servidor.senhasCriadas).toEqual([{ token: TOKEN, newPassword: ESCOLHIDA }]);
  });

  /**
   * O BULLET DE CONFERÊNCIA (dono, 2026-09-08). Antes, o formulário saía com
   * as duas senhas diferentes e a pessoa só lia o aviso depois do envio.
   * Agora o botão não abre — e a exigência que ESTA tela não mede (o próprio
   * e-mail, enquanto o convite não diz a quem é) continua sem trancar nada.
   */
  it("as duas senhas diferentes trancam o botão, e nada sai da tela", async () => {
    const usuario = await abrirOLink(`?token=${TOKEN}`);
    await screen.findByText("Defina sua senha");

    await preencher(usuario, ESCOLHIDA, OUTRA);

    const botao = screen.getByRole("button", { name: "Definir senha" });
    await waitFor(() => expect(botao.hasAttribute("disabled")).toBe(true));
    // O motivo é legível: o botão aponta para a frase, que existe enquanto a
    // lista não fecha. Sem `title` — a catraca da casa não deixa nascer um.
    expect(botao.getAttribute("aria-describedby")).toBe("password-submit-blocked");
    expect(document.getElementById("password-submit-blocked")?.textContent).toBe(
      "Atenda a todos os itens da lista acima para continuar.",
    );
    expect(screen.getAllByText("ainda falta").length).toBe(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(servidor.senhasCriadas).toEqual([]);

    await usuario.clear(screen.getByLabelText("Repita a senha nova"));
    await usuario.type(screen.getByLabelText("Repita a senha nova"), ESCOLHIDA);

    await waitFor(() => expect(botao.hasAttribute("disabled")).toBe(false));
    expect(servidor.senhasCriadas).toEqual([]);
  });

  /** A senha vai para o serviço COMO FOI DIGITADA — nenhum campo apara nada. */
  it("a senha com espaço nas pontas é enviada inteira, sem aparar", async () => {
    const COM_ESPACOS = ` ${ESCOLHIDA} `;
    const usuario = await abrirOLink(`?token=${TOKEN}`);
    await screen.findByText("Defina sua senha");

    await preencher(usuario, COM_ESPACOS);
    await salvar(usuario);

    await waitFor(() =>
      expect(servidor.senhasCriadas).toEqual([{ token: TOKEN, newPassword: COM_ESPACOS }]),
    );
  });

  it("senha fraca volta apontada na lista, com a frase daquela exigência", async () => {
    const usuario = await abrirOLink(`?token=${TOKEN}`);
    await screen.findByText("Defina sua senha");
    servidor.proximaRecusa = RecusaDoServico.senhaFraca("symbol");

    await preencher(usuario, ESCOLHIDA);
    await salvar(usuario);

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "A senha nova precisa ter pelo menos um símbolo, como ! ? # ou @.",
      ),
    );
    // O formulário FICA: o link serve, quem precisa de conserto é a senha.
    expect(screen.getByLabelText("Senha nova")).toBeTruthy();
  });
});

describe("o link que não serve mais tem uma saída, e não é o formulário", () => {
  it("sem token, a tela explica o que houve e oferece pedir outro", async () => {
    await abrirOLink("");

    expect(await screen.findByText("Este link está incompleto")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pedir um link novo" })).toBeTruthy();
    expect(screen.queryByLabelText("Senha nova")).toBeNull();
  });

  it("token em branco é tratado como token nenhum", async () => {
    await abrirOLink("?token=");

    expect(await screen.findByText("Este link está incompleto")).toBeTruthy();
  });

  /**
   * Desconhecido, vencido, usado ou substituído chegam todos no mesmo código —
   * e a distinção entre os quatro não muda o próximo gesto da pessoa, que é
   * pedir outro link. A frase é NOSSA (dono, 2026-09-09): a do serviço só
   * existe em pt-BR e esta tela também existe em inglês.
   */
  it("link recusado mostra a frase da casa e tira o formulário da frente", async () => {
    const usuario = await abrirOLink(`?token=${TOKEN}`);
    await screen.findByText("Defina sua senha");
    servidor.proximaRecusa = RecusaDoServico.linkRecusado("Este convite já foi usado.");

    await preencher(usuario, ESCOLHIDA);
    await salvar(usuario);

    expect(await screen.findByText("Este link não serve mais")).toBeTruthy();
    expect(
      screen.getByText("Peça um link novo e abra sempre o mais recente que você recebeu."),
    ).toBeTruthy();
    expect(screen.queryByText("Este convite já foi usado.")).toBeNull();
    expect(screen.queryByLabelText("Senha nova")).toBeNull();
    expect(screen.getByRole("button", { name: "Pedir um link novo" })).toBeTruthy();
  });

  it("nenhuma dessas telas mostra detalhe técnico", async () => {
    const usuario = await abrirOLink(`?token=${TOKEN}`);
    await screen.findByText("Defina sua senha");
    servidor.proximaRecusa = RecusaDoServico.linkRecusado("Este convite venceu.");

    await preencher(usuario, ESCOLHIDA);
    await salvar(usuario);
    await screen.findByText("Este link não serve mais");

    expect(document.body.textContent ?? "").not.toMatch(
      /\b(?:GET|POST|PUT|PATCH|DELETE)\b|\/api\/|\bstatus\s*:?\s*[1-5]\d{2}\b/,
    );
  });

  it("dali a pessoa pede outro link sem sair da tela", async () => {
    const usuario = await abrirOLink("");
    await screen.findByText("Este link está incompleto");

    await usuario.click(screen.getByRole("button", { name: "Pedir um link novo" }));
    await usuario.type(await screen.findByLabelText("E-mail"), "quem.perdeu@company.com");
    await usuario.click(screen.getByRole("button", { name: "Receber o link" }));

    expect(await screen.findByText("Pedido registrado")).toBeTruthy();
    expect(servidor.pedidosDeLink).toEqual([{ email: "quem.perdeu@company.com" }]);
  });
});
