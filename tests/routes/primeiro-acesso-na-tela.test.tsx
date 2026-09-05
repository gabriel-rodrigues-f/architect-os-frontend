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

import type { SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { PASSWORD_REQUIREMENTS, type PasswordRequirement } from "@/lib/password-safety";
import { createAppQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import { fixtureCareerLevels, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import { configurationRoute, contextsOf, jsonResponse } from "../helpers/render-app";

/**
 * O primeiro acesso, do login até a aplicação abrir.
 *
 * Regra do dono (2026-09-03), literal: *"ao realizar o primeiro acesso, o
 * usuário (regra universal) precisa ter que alterar sua senha. a senha precisa
 * ser segura. mínimo 8 caracteres sendo eles no mínimo: 1 maiúscula, 1 número,
 * 1 minúscula, 1 símbolo, não pode conter 1234 e nem o próprio e-mail."*
 *
 * Este arquivo sobe o roteador de verdade — `routeTree` gerado, `__root` com o
 * `AuthGate` — porque o objeto sob teste É o portão. Montar a tela direto
 * pularia justamente o que precisa ser provado: que a aplicação inteira fica
 * do outro lado enquanto a marca está de pé.
 *
 * O servidor daqui é o contrato medido do backend: a marca vem em
 * `POST /auth/login` e em `GET /auth/me`; toda outra rota responde **403
 * PASSWORD_CHANGE_REQUIRED** enquanto ela está de pé; `/auth/me`,
 * `/auth/change-password` e `/auth/logout` seguem liberadas; senha nova fraca
 * responde ANTES de senha atual errada.
 */

const fetchMock = vi.fn();

const EMAIL = "recem.admitida@synapse.local";
const SENHA_TEMPORARIA = "temporaria-do-convite";
const SENHA_NOVA = "Vento#Sul7";

const contaAdmitida: SessionUser = {
  id: "test-recem-admitida",
  email: EMAIL,
  name: "Recém admitida",
  role: "member",
  architectId: null,
  status: "active",
  mustChangePassword: true,
  createdAt: "2026-01-01T00:00:00Z",
};

/** A recusa que o backend devolve, nos dois códigos do contrato. */
class RecusaDaTroca {
  private constructor(
    readonly status: number,
    readonly corpo: Record<string, unknown>,
  ) {}

  static aceita(): RecusaDaTroca | null {
    return null;
  }

  static senhaFraca(requirement: PasswordRequirement): RecusaDaTroca {
    return new RecusaDaTroca(400, {
      code: "WEAK_PASSWORD",
      message: "Senha recusada.",
      details: { requirement },
    });
  }

  static senhaAtualErrada(): RecusaDaTroca {
    return new RecusaDaTroca(401, {
      code: "INVALID_CURRENT_PASSWORD",
      message: "Senha atual incorreta.",
    });
  }
}

class ServidorDoPrimeiroAcesso {
  private autenticado = false;

  /** A marca de pé: o backend a derruba quando a troca acontece. */
  marcaDePe = true;

  /**
   * Se `/auth/me` CONTA a marca. Desligar isto é o caso da rede de segurança:
   * a sessão parece livre, mas as rotas seguem recusando por senha pendente.
   */
  marcaVisivelNoMe = true;

  /** O que a próxima troca vai responder — `null` aceita e devolve 204. */
  proximaRecusa: RecusaDaTroca | null = RecusaDaTroca.aceita();

  trocasPedidas: Array<{ currentPassword: string; newPassword: string }> = [];

  responder = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const href = input instanceof Request ? input.url : String(input);
    const metodo = (
      input instanceof Request ? input.method : (init?.method ?? "GET")
    ).toUpperCase();

    if (href.endsWith(apiPath("/auth/status")))
      return this.envelope(jsonResponse({ hasUsers: true }));

    if (href.endsWith(apiPath("/auth/login")) && metodo === "POST") {
      this.autenticado = true;
      return this.envelope(jsonResponse({ user: this.conta() }));
    }

    if (href.endsWith(apiPath("/auth/logout")) && metodo === "POST") {
      this.autenticado = false;
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (href.endsWith(apiPath("/auth/change-password")) && metodo === "POST") {
      return this.responderTroca(init);
    }

    if (href.endsWith(apiPath("/auth/me"))) {
      return this.autenticado
        ? this.envelope(jsonResponse(this.conta()))
        : Promise.resolve(this.semSessao());
    }

    // A marca de pé fecha TODO o resto — é o que o backend já faz hoje.
    if (this.marcaDePe) return Promise.resolve(this.senhaPendente());

    if (href.endsWith(apiPath("/teams")))
      return this.envelope(
        jsonResponse([{ id: fixtureTeamId, name: "Time Plataforma", active: true }]),
      );
    if (href.endsWith(apiPath("/career-levels")))
      return this.envelope(jsonResponse(fixtureCareerLevels));
    const fatia = contextsOf(fixtureState)(href, { method: metodo });
    if (fatia) return this.envelope(fatia);

    const configuracao = configurationRoute(href, { method: metodo });
    if (configuracao) return this.envelope(configuracao);

    return this.envelope(jsonResponse({}));
  };

  private conta(): SessionUser {
    return {
      ...contaAdmitida,
      mustChangePassword: this.marcaDePe && this.marcaVisivelNoMe,
      memberships: [],
    };
  }

  private responderTroca(init?: RequestInit): Promise<Response> {
    this.trocasPedidas.push(
      JSON.parse(String(init?.body ?? "{}")) as { currentPassword: string; newPassword: string },
    );
    const recusa = this.proximaRecusa;
    if (recusa !== null) {
      return Promise.resolve(jsonResponse(recusa.corpo, recusa.status));
    }
    this.marcaDePe = false;
    return Promise.resolve(new Response(null, { status: 204 }));
  }

  private semSessao(): Response {
    return jsonResponse(
      { code: "AUTHENTICATION_REQUIRED", message: "Autenticação necessária." },
      401,
    );
  }

  private senhaPendente(): Response {
    return jsonResponse(
      {
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Troque a sua senha para continuar.",
      },
      403,
    );
  }

  /** O backend envelopa toda 2xx de `/api/v1/*` em `{ data }` (RF-05). */
  private async envelope(response: Response): Promise<Response> {
    const corpo = (await response.json()) as unknown;
    return jsonResponse({ data: corpo }, response.status);
  }
}

let servidor: ServidorDoPrimeiroAcesso;
let router: AnyRouter;

async function subirASpa(): Promise<void> {
  const queryClient = createAppQueryClient();
  router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

async function entrar(): Promise<ReturnType<typeof userEvent.setup>> {
  const usuario = userEvent.setup();
  await usuario.type(await screen.findByLabelText("E-mail"), EMAIL);
  await usuario.type(screen.getByLabelText("Senha"), SENHA_TEMPORARIA);
  await usuario.click(screen.getByRole("button", { name: "Entrar" }));
  return usuario;
}

async function preencherTroca(
  usuario: ReturnType<typeof userEvent.setup>,
  senhaNova: string,
  senhaAtual = SENHA_TEMPORARIA,
): Promise<void> {
  await usuario.clear(screen.getByLabelText("Senha temporária"));
  await usuario.type(screen.getByLabelText("Senha temporária"), senhaAtual);
  await usuario.clear(screen.getByLabelText("Senha nova"));
  await usuario.type(screen.getByLabelText("Senha nova"), senhaNova);
  await usuario.clear(screen.getByLabelText("Repita a senha nova"));
  await usuario.type(screen.getByLabelText("Repita a senha nova"), senhaNova);
}

beforeEach(() => {
  servidor = new ServidorDoPrimeiroAcesso();
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

describe("o primeiro acesso segura a porta até a senha ser trocada", () => {
  it("quem entra com a marca de pé cai na troca de senha, não na aplicação", async () => {
    await subirASpa();
    await entrar();

    expect(await screen.findByText("Troque a sua senha para começar")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("não há para onde navegar antes de trocar — nem forçando a rota", async () => {
    await subirASpa();
    await entrar();
    await screen.findByText("Troque a sua senha para começar");

    await router.navigate({ to: "/team-rules" }).catch(() => undefined);

    expect(screen.getByText("Troque a sua senha para começar")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByText("Time Plataforma")).toBeNull();
  });

  it("as exigências estão na tela ANTES de a pessoa errar", async () => {
    await subirASpa();
    await entrar();
    await screen.findByText("Troque a sua senha para começar");

    expect(screen.getByText("A senha nova precisa:")).toBeTruthy();
    for (const item of [
      "ter 8 caracteres ou mais",
      "ter uma letra maiúscula",
      "ter uma letra minúscula",
      "ter um número",
      "ter um símbolo, como ! ? # ou @",
      "não ter 1234 nem outra sequência óbvia",
      "não ter o seu e-mail dentro dela",
    ]) {
      expect(screen.getByText(item), item).toBeTruthy();
    }
  });

  /** A lista se marca enquanto a pessoa digita, sem nenhum envio pelo caminho. */
  it("a lista mostra o que já está de pé enquanto a pessoa digita", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    const pendentesEmBranco = screen.getAllByText("ainda falta");
    expect(pendentesEmBranco.length).toBe(PASSWORD_REQUIREMENTS.length);

    await usuario.type(screen.getByLabelText("Senha nova"), SENHA_NOVA);

    await waitFor(() => expect(screen.queryByText("ainda falta")).toBeNull());
    expect(screen.getAllByText("já atendido").length).toBe(PASSWORD_REQUIREMENTS.length);
    expect(servidor.trocasPedidas).toEqual([]);
  });

  /**
   * As sete exigências do contrato, uma a uma: o backend recusa apontando
   * `details.requirement` e a pessoa lê a frase daquela exigência — nunca um
   * "senha inválida" que não diz o que fazer.
   */
  it("cada uma das sete recusas do backend aparece apontada para a pessoa", async () => {
    const FRASES: Readonly<Record<PasswordRequirement, string>> = {
      "minimum-length": "A senha nova precisa ter 8 caracteres ou mais.",
      "uppercase-letter": "A senha nova precisa ter pelo menos uma letra maiúscula.",
      "lowercase-letter": "A senha nova precisa ter pelo menos uma letra minúscula.",
      digit: "A senha nova precisa ter pelo menos um número.",
      symbol: "A senha nova precisa ter pelo menos um símbolo, como ! ? # ou @.",
      "obvious-sequence": "A senha nova não pode ter 1234 nem outra sequência óbvia.",
      "own-email": "A senha nova não pode ter o seu e-mail dentro dela.",
    };

    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");
    await preencherTroca(usuario, SENHA_NOVA);

    for (const exigencia of PASSWORD_REQUIREMENTS) {
      servidor.proximaRecusa = RecusaDaTroca.senhaFraca(exigencia);
      await usuario.click(screen.getByRole("button", { name: "Trocar a senha e entrar" }));

      await waitFor(() =>
        expect(screen.getByRole("alert").textContent, exigencia).toBe(FRASES[exigencia]),
      );
      expect(screen.getByText("Troque a sua senha para começar")).toBeTruthy();
    }
  });

  it("senha atual errada diz o que houve, sem nenhum detalhe técnico", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    servidor.proximaRecusa = RecusaDaTroca.senhaAtualErrada();
    await preencherTroca(usuario, SENHA_NOVA, "chute-errado");
    await usuario.click(screen.getByRole("button", { name: "Trocar a senha e entrar" }));

    const aviso = await screen.findByRole("alert");
    await waitFor(() =>
      expect(aviso.textContent).toBe("A senha temporária não confere. Confira e tente de novo."),
    );
    expect(aviso.textContent).not.toMatch(/\b(?:POST|GET)\b|\/api\/|\b[1-5]\d{2}\b/);
  });

  it("as duas senhas novas diferentes não chegam nem a sair da tela", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    await usuario.type(screen.getByLabelText("Senha temporária"), SENHA_TEMPORARIA);
    await usuario.type(screen.getByLabelText("Senha nova"), SENHA_NOVA);
    await usuario.type(screen.getByLabelText("Repita a senha nova"), "Outra#Coisa9");
    await usuario.click(screen.getByRole("button", { name: "Trocar a senha e entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "As duas senhas novas estão diferentes. Digite a mesma nos dois campos.",
    );
    expect(servidor.trocasPedidas).toEqual([]);
  });

  it("depois de trocar, a marca some e a aplicação abre — sem entrar de novo", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    servidor.proximaRecusa = RecusaDaTroca.aceita();
    await preencherTroca(usuario, SENHA_NOVA);
    await usuario.click(screen.getByRole("button", { name: "Trocar a senha e entrar" }));

    expect(await screen.findByRole("navigation")).toBeTruthy();
    expect(screen.queryByText("Troque a sua senha para começar")).toBeNull();
    expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(servidor.trocasPedidas).toEqual([
      { currentPassword: SENHA_TEMPORARIA, newPassword: SENHA_NOVA },
    ]);
  });

  /**
   * `POST /auth/logout` é uma das três rotas liberadas durante o primeiro
   * acesso. Sem esta saída a tela deixaria de ser porta e viraria armadilha
   * para quem não quer trocar a senha agora.
   */
  it("quem não quiser trocar agora consegue sair", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    await usuario.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByLabelText("E-mail")).toBeTruthy();
    expect(screen.queryByText("Troque a sua senha para começar")).toBeNull();
  });

  it("quem NÃO tem a marca não vê nada disso", async () => {
    servidor.marcaDePe = false;
    await subirASpa();
    await entrar();

    expect(await screen.findByRole("navigation")).toBeTruthy();
    expect(screen.queryByText("Troque a sua senha para começar")).toBeNull();
    expect(screen.queryByText("A senha nova precisa:")).toBeNull();
  });

  /**
   * A REDE DE SEGURANÇA. Aqui `/auth/me` não conta a marca — a sessão parece
   * livre — e a recusa por senha pendente chega de uma rota qualquer. Sem a
   * rede, a pessoa lia "você não tem permissão para fazer isso", que ela tem,
   * e que ela não teria como resolver de lugar nenhum.
   */
  it("uma rota que ainda recusa por senha pendente leva à troca, não a um erro", async () => {
    servidor.marcaVisivelNoMe = false;
    await subirASpa();
    await entrar();

    expect(await screen.findByText("Troque a sua senha para começar")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(
      screen.queryByText(
        "Você não tem permissão para fazer isso. Peça acesso a quem administra o sistema.",
      ),
    ).toBeNull();
  });

  it("e dali a troca funciona igual — a pessoa sai do buraco pela própria tela", async () => {
    servidor.marcaVisivelNoMe = false;
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    servidor.proximaRecusa = RecusaDaTroca.aceita();
    await preencherTroca(usuario, SENHA_NOVA);
    await usuario.click(screen.getByRole("button", { name: "Trocar a senha e entrar" }));

    expect(await screen.findByRole("navigation")).toBeTruthy();
    expect(screen.queryByText("Troque a sua senha para começar")).toBeNull();
  });
});
