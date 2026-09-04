import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
  type AnyRouter,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { createAppQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import { jsonResponse } from "../helpers/render-app";

/**
 * PEDIR O ACESSO DE VOLTA a partir da tela de entrar — o "esqueci minha
 * senha".
 *
 * A regra que este arquivo existe para segurar está no CONTRATO, com todas as
 * letras: `POST /auth/access-recovery` responde **sempre 202**, inclusive
 * quando o e-mail não existe, **de propósito** — a resposta não pode revelar
 * quem tem conta aqui. A tela precisa honrar isso, e é fácil desonrar sem
 * querer: basta alguém achar que "e-mail não encontrado" é uma gentileza.
 *
 * Por isso o teste central não confere um texto: confere que os DOIS casos
 * desenham a MESMA coisa, caractere a caractere. Um ramo novo que distinga a
 * conta que existe da que não existe fica vermelho aqui, qualquer que seja a
 * frase que ele escolha.
 */

const fetchMock = vi.fn();

const EMAIL_DE_QUEM_TEM_CONTA = "ana@company.com";
const EMAIL_DE_NINGUEM = "nao-existe-por-aqui@company.com";

class ServidorDaRecuperacao {
  pedidos: Array<{ email: string }> = [];

  responder = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const href = input instanceof Request ? input.url : String(input);
    const metodo = (
      input instanceof Request ? input.method : (init?.method ?? "GET")
    ).toUpperCase();

    if (href.endsWith(apiPath("/auth/access-recovery")) && metodo === "POST") {
      this.pedidos.push(JSON.parse(String(init?.body ?? "{}")) as { email: string });
      // O 202 é o MESMO para conta que existe e para conta que não existe.
      return Promise.resolve(
        jsonResponse({ message: { code: "auth.accessRecovery.requested" } }, 202),
      );
    }

    if (href.endsWith(apiPath("/auth/status"))) {
      return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
    }

    return Promise.resolve(
      jsonResponse({ code: "AUTHENTICATION_REQUIRED", message: "Autenticação necessária." }, 401),
    );
  };
}

let servidor: ServidorDaRecuperacao;
let router: AnyRouter;

async function abrirOLogin(): Promise<ReturnType<typeof userEvent.setup>> {
  const queryClient = createAppQueryClient();
  router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}

/** O texto do cartão depois do pedido — é ele que não pode variar. */
async function pedirOAcessoDeVolta(email: string): Promise<string> {
  const usuario = await abrirOLogin();
  await usuario.click(await screen.findByRole("button", { name: "Esqueci minha senha" }));
  await usuario.type(await screen.findByLabelText("E-mail"), email);
  await usuario.click(screen.getByRole("button", { name: "Receber o link" }));
  await screen.findByText("Pedido registrado");
  return document.body.textContent ?? "";
}

beforeEach(() => {
  servidor = new ServidorDaRecuperacao();
  fetchMock.mockReset();
  fetchMock.mockImplementation(servidor.responder);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("quem não consegue entrar pede o acesso de volta pela própria tela de entrar", () => {
  it("a saída está na tela de entrar, sem precisar de outro endereço", async () => {
    await abrirOLogin();

    expect(await screen.findByRole("button", { name: "Esqueci minha senha" })).toBeTruthy();
  });

  it("o pedido é um campo de e-mail e um botão", async () => {
    const usuario = await abrirOLogin();
    await usuario.click(await screen.findByRole("button", { name: "Esqueci minha senha" }));

    expect(await screen.findByText("Recuperar o seu acesso")).toBeTruthy();
    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Receber o link" })).toBeTruthy();
  });

  it("o e-mail digitado é o que chega ao serviço, sem o espaço colado em volta", async () => {
    const usuario = await abrirOLogin();
    await usuario.click(await screen.findByRole("button", { name: "Esqueci minha senha" }));
    await usuario.type(await screen.findByLabelText("E-mail"), `  ${EMAIL_DE_QUEM_TEM_CONTA}  `);
    await usuario.click(screen.getByRole("button", { name: "Receber o link" }));

    await screen.findByText("Pedido registrado");
    expect(servidor.pedidos).toEqual([{ email: EMAIL_DE_QUEM_TEM_CONTA }]);
  });

  it("quem desistiu volta para entrar", async () => {
    const usuario = await abrirOLogin();
    await usuario.click(await screen.findByRole("button", { name: "Esqueci minha senha" }));
    await screen.findByText("Recuperar o seu acesso");

    await usuario.click(screen.getByRole("button", { name: "Voltar para entrar" }));

    expect(await screen.findByRole("button", { name: /Entrar|Enviando/ })).toBeTruthy();
  });
});

describe("a confirmação não revela se a conta existe", () => {
  /**
   * O CORAÇÃO desta fatia. Não é sobre a frase escolhida: é sobre não haver
   * duas frases. Quem chutar endereços na tela de login não pode sair dali
   * sabendo mais do que entrou.
   */
  it("conta que existe e conta que não existe desenham exatamente a mesma tela", async () => {
    const comConta = await pedirOAcessoDeVolta(EMAIL_DE_QUEM_TEM_CONTA);
    cleanup();
    const semConta = await pedirOAcessoDeVolta(EMAIL_DE_NINGUEM);

    expect(semConta).toBe(comConta);
  });

  it("a confirmação diz o que a pessoa precisa saber para agir: o link, e por quanto tempo vale", async () => {
    const texto = await pedirOAcessoDeVolta(EMAIL_DE_QUEM_TEM_CONTA);

    expect(texto).toContain(
      "Se houver uma conta com esse e-mail, você recebe em instantes um link para criar a sua senha. Ele vale por 1 hora.",
    );
  });

  /**
   * O dono corrigiu o próprio pedido em cima desta frase: *"a senha não deve
   * ser enviada por e-mail"*. O que viaja é um LINK, e a tela não pode
   * sugerir outra coisa.
   */
  it("nenhuma tela do pedido sugere que uma senha foi enviada", async () => {
    const texto = await pedirOAcessoDeVolta(EMAIL_DE_QUEM_TEM_CONTA);

    expect(texto).not.toMatch(
      /senha[^.]{0,80}\b(?:enviad|envia|mandad|manda|receber[áa])\w*\b[^.]{0,80}e-?mail/i,
    );
    expect(texto).not.toMatch(
      /e-?mail[^.]{0,80}\b(?:enviad|envia|mandad|manda)\w*\b[^.]{0,60}senha/i,
    );
  });

  it("nem diz que não encontrou ninguém — não existe esse ramo", async () => {
    const texto = await pedirOAcessoDeVolta(EMAIL_DE_NINGUEM);

    expect(texto.toLowerCase()).not.toContain("não encontrado");
    expect(texto.toLowerCase()).not.toContain("não existe");
    expect(texto.toLowerCase()).not.toContain("não localizamos");
  });
});
