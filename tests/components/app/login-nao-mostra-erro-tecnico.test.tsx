import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/app/LoginScreen";
import { apiPath } from "@/lib/api-path";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { jsonResponse } from "../../helpers/render-app";

/**
 * O CASO DO DONO (2026-09-03), com a captura que ele mandou junto: a tela de
 * login mostrando, em vermelho, dentro do formulário:
 *
 *     POST /api/v1/auth/login falhou (404)
 *
 * A ordem foi literal: *"o usuário final não pode ver erros técnicos em
 * nenhuma, absolutamente nenhuma parte da aplicação."*
 *
 * A resposta que produz isso é a mais crua possível — 404 SEM CORPO, que é o
 * que um proxy mal apontado devolve. Sem corpo não há `message` do serviço, e
 * o `api-client.ts` montava a frase com verbo, caminho e status.
 *
 * ONDA "O ERRO NÃO CONTA NADA" (dono, 2026-09-09): *"os erros do frontend
 * precisam ser o mais genéricos possível. No login, por exemplo, precisamos
 * mostrar 'Não é possível acessar a aplicação agora. Entre em contato com um
 * administrador.'"* A porta parou de escolher a frase por FAIXA DE STATUS e
 * passou a escolher por CÓDIGO: credencial recusada, conta desabilitada,
 * balde cheio, convite recusado e senha fraca continuam falando; todo o resto
 * — inclusive um 404 sem corpo — recebe a frase do dono.
 *
 * O buraco que este arquivo não olhava, e que a auditoria de 2026-09-09
 * nomeou: os dois casos aqui usavam 404 SEM CORPO. Quando o BACKEND responde
 * com corpo, a `message` dele vencia a política e ia inteira para a tela —
 * o eco de método e URL do `setNotFoundHandler` e a frase que anuncia o banco
 * de dados fora do ar. É o segundo `describe`.
 */

const fetchMock = vi.fn();

const PEDACOS_TECNICOS = ["POST", "/api/v1", "404", "falhou"];

/** A frase do dono, palavra por palavra, nos dois idiomas da casa. */
const FRASE_DO_DONO =
  "Não é possível acessar a aplicação agora. Entre em contato com um administrador.";
const OWNER_SENTENCE = "The application is unavailable right now. Please contact an administrator.";

/** O que o backend REALMENTE escreve — e que não pode sobreviver na tela. */
const ECO_DA_ROTA = "Rota POST /api/v1/auth/login não existe";
const FRASE_DO_BANCO = "Banco de dados temporariamente indisponível. Tente novamente em instantes.";

const CREDENCIAL_RECUSADA_PT = "E-mail ou senha inválidos.";
const CREDENCIAL_RECUSADA_EN = "Incorrect email or password.";

function LoginWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** O serviço da porta: só o `POST /auth/login` muda de caso para caso. */
function servicoQueResponde(aoEntrar: () => Response) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.endsWith(apiPath("/auth/status"))) {
      return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
    }
    if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
      return Promise.resolve(aoEntrar());
    }
    return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
  });
}

async function tentarEntrar(rotulos: { email: string; senha: string; entrar: string | RegExp }) {
  render(
    <LoginWrapper>
      <LoginScreen />
    </LoginWrapper>,
  );
  fireEvent.change(await screen.findByLabelText(rotulos.email), {
    target: { value: "ana@company.com" },
  });
  fireEvent.change(screen.getByLabelText(rotulos.senha), { target: { value: "qualquer-uma" } });
  fireEvent.click(screen.getByRole("button", { name: rotulos.entrar }));
  return screen.findByRole("alert");
}

const emPortugues = () => tentarEntrar({ email: "E-mail", senha: "Senha", entrar: "Entrar" });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.setItem("synapse:locale", "pt");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Login — 404 sem corpo vira a frase do dono, nunca a linha técnica", () => {
  beforeEach(() => {
    // A resposta da captura: 404, sem corpo nenhum para ler.
    servicoQueResponde(() => new Response(null, { status: 404 }));
  });

  it("desenha a frase do dono — a porta não conta o que aconteceu do lado de cá", async () => {
    const alerta = await emPortugues();

    expect(alerta.textContent).toBe(FRASE_DO_DONO);
  });

  it("não sobra NADA da linha técnica da captura: sem POST, sem /api/v1, sem 404, sem 'falhou'", async () => {
    await emPortugues();

    const telaInteira = document.body.textContent ?? "";
    for (const pedaco of PEDACOS_TECNICOS) {
      expect(telaInteira, `a tela de login ainda mostra "${pedaco}"`).not.toContain(pedaco);
    }
  });
});

/**
 * O QUE O SERVIÇO ESCREVE NÃO É TEXTO DE TELA. Os dois casos que ninguém
 * olhava, porque o teste antigo só usava 404 SEM CORPO:
 *
 *   404 COM CORPO — `HttpErrorBoundary.setNotFoundHandler` devolve
 *   `Rota ${método} ${url} não existe`: a entrada da própria pessoa refletida
 *   no corpo da resposta, e o mapa da API impresso na tela de quem não entrou.
 *
 *   503 COM CORPO — `DatabaseUnavailableError` devolve "Banco de dados
 *   temporariamente indisponível…". Anuncia, a quem nem tem conta, que existe
 *   um banco atrás e que ele está fora AGORA.
 *
 * Com esta frase, o que ELA faz agora? Nada — mas passa a saber como somos por
 * dentro. Então a porta cala: as duas recebem a frase do dono.
 */
describe("Login — a frase que o SERVIÇO escreve num 404 ou num 503 não chega à tela", () => {
  it("404 COM corpo do backend: o eco do método e da URL morre na fronteira", async () => {
    servicoQueResponde(() => jsonResponse({ code: "ROUTE_NOT_FOUND", message: ECO_DA_ROTA }, 404));

    const alerta = await emPortugues();

    expect(alerta.textContent).toBe(FRASE_DO_DONO);
    expect(document.body.textContent ?? "").not.toContain("não existe");
    for (const pedaco of PEDACOS_TECNICOS) {
      expect(document.body.textContent ?? "").not.toContain(pedaco);
    }
  });

  it("503 COM corpo do backend: a tela não anuncia que o banco de dados caiu", async () => {
    servicoQueResponde(() =>
      jsonResponse({ code: "DATABASE_UNAVAILABLE", message: FRASE_DO_BANCO }, 503),
    );

    const alerta = await emPortugues();

    expect(alerta.textContent).toBe(FRASE_DO_DONO);
    const telaInteira = document.body.textContent ?? "";
    expect(telaInteira).not.toContain("Banco de dados");
    expect(telaInteira).not.toContain("indisponível");
  });

  it("a frase do dono não muda com o status: 404, 500 e 503 dizem a mesma coisa", async () => {
    for (const status of [404, 500, 503]) {
      servicoQueResponde(() =>
        jsonResponse({ code: "SEJA_QUAL_FOR", message: "detalhe da casa" }, status),
      );
      const alerta = await emPortugues();
      expect(alerta.textContent, `status ${String(status)} contou algo a mais`).toBe(FRASE_DO_DONO);
      cleanup();
    }
  });
});

/**
 * O IRMÃO DA REGRA, e a razão de ela não ser "a porta fica muda": quando o
 * serviço RECUSA A CREDENCIAL, a pessoa tem o que fazer — conferir o e-mail e
 * a senha. Essa frase muda o próximo gesto dela, então ela continua na tela.
 *
 * A frase é NOSSA, escolhida pelo `code`, e existe nos dois idiomas: a do
 * backend só existe em pt-BR e mostraria português a quem escolheu inglês.
 */
describe("Login — credencial recusada continua falando, em pt e en", () => {
  beforeEach(() => {
    servicoQueResponde(() =>
      jsonResponse({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos." }, 401),
    );
  });

  it("401 INVALID_CREDENTIALS diz, em português, o que a pessoa tem a corrigir", async () => {
    const alerta = await emPortugues();

    expect(alerta.textContent).toBe(CREDENCIAL_RECUSADA_PT);
    expect(alerta.textContent).not.toBe(FRASE_DO_DONO);
  });

  it("a mesma recusa fala INGLÊS para quem escolheu inglês", async () => {
    window.localStorage.setItem("synapse:locale", "en");

    const alerta = await tentarEntrar({
      email: "Email",
      senha: "Password",
      entrar: /Sign in|Enter/,
    });

    expect(alerta.textContent).toBe(CREDENCIAL_RECUSADA_EN);
  });

  it("em inglês, o que a porta cala também é inglês", async () => {
    window.localStorage.setItem("synapse:locale", "en");
    servicoQueResponde(() =>
      jsonResponse({ code: "DATABASE_UNAVAILABLE", message: FRASE_DO_BANCO }, 503),
    );

    const alerta = await tentarEntrar({
      email: "Email",
      senha: "Password",
      entrar: /Sign in|Enter/,
    });

    expect(alerta.textContent).toBe(OWNER_SENTENCE);
  });
});
