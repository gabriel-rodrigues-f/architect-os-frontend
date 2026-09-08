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
import {
  PASSWORD_CHECKS,
  PASSWORD_REQUIREMENTS,
  type PasswordRequirement,
} from "@/lib/password-safety";
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
const SENHA_NOVA = "Vento# Sul7";

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
      "ter um espaço no meio, nunca no começo nem no fim",
      "não ter 1234 nem outra sequência óbvia",
      "não ter o seu e-mail dentro dela",
      "ser igual nos dois campos",
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
    expect(pendentesEmBranco.length).toBe(PASSWORD_CHECKS.length);

    await usuario.type(screen.getByLabelText("Senha nova"), SENHA_NOVA);

    // As oito exigências fecham; a conferência das duas caixas continua
    // vermelha, porque a segunda caixa ainda está em branco.
    await waitFor(() =>
      expect(screen.getAllByText("já atendido").length).toBe(PASSWORD_REQUIREMENTS.length),
    );
    expect(screen.getAllByText("ainda falta").length).toBe(1);

    await usuario.type(screen.getByLabelText("Repita a senha nova"), SENHA_NOVA);

    await waitFor(() => expect(screen.queryByText("ainda falta")).toBeNull());
    expect(screen.getAllByText("já atendido").length).toBe(PASSWORD_CHECKS.length);
    expect(servidor.trocasPedidas).toEqual([]);
  });

  /**
   * O BULLET DE CONFERÊNCIA (dono, 2026-09-08): *"deve haver um bullet
   * validando senha nova e repita a senha nova. hoje isso não existe."* Ele
   * acende SÓ com as duas iguais, e enquanto ele está vermelho o botão não
   * abre — o formulário saía cedo demais e só descobria a diferença depois.
   */
  it("o bullet da conferência acende só com as duas iguais, e é ele que abre o botão", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");
    const botao = screen.getByRole("button", { name: "Trocar a senha" });

    await usuario.type(screen.getByLabelText("Senha temporária"), SENHA_TEMPORARIA);
    await usuario.type(screen.getByLabelText("Senha nova"), SENHA_NOVA);
    await usuario.type(screen.getByLabelText("Repita a senha nova"), "Outra# Coisa9");

    await waitFor(() => expect(screen.getAllByText("ainda falta").length).toBe(1));
    expect(botao.hasAttribute("disabled")).toBe(true);
    // O motivo é legível: o botão aponta para a frase, que existe enquanto a
    // lista não fecha. Sem `title` — a catraca da casa não deixa nascer um.
    expect(botao.getAttribute("aria-describedby")).toBe("password-submit-blocked");
    expect(document.getElementById("password-submit-blocked")?.textContent).toBe(
      "Atenda a todos os itens da lista acima para continuar.",
    );

    await usuario.clear(screen.getByLabelText("Repita a senha nova"));
    await usuario.type(screen.getByLabelText("Repita a senha nova"), SENHA_NOVA);

    await waitFor(() => expect(botao.hasAttribute("disabled")).toBe(false));
    expect(screen.queryByText("ainda falta")).toBeNull();
    expect(botao.getAttribute("aria-describedby")).toBeNull();
    expect(document.getElementById("password-submit-blocked")).toBeNull();
    expect(servidor.trocasPedidas).toEqual([]);
  });

  /**
   * Acessibilidade: o estado de cada item é LEGÍVEL, não só colorido — quem
   * ouve a tela recebe "já atendido" ou "ainda falta" ao lado do texto, e a
   * lista tem `aria-live` discreto para anunciar o item que acabou de fechar.
   */
  it("cada item da lista diz o estado por extenso, e a lista avisa quem ouve", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    const lista = screen.getByText("A senha nova precisa:").parentElement?.querySelector("ul");
    expect(lista?.getAttribute("aria-live")).toBe("polite");

    await usuario.type(screen.getByLabelText("Senha nova"), SENHA_NOVA);
    await waitFor(() => expect(screen.getAllByText("já atendido").length).toBeGreaterThan(0));
    expect(screen.getAllByText("ainda falta").length).toBe(1);
  });

  /**
   * O botão trancado não pode ter trancado o TECLADO junto: quem preenche
   * tudo e aperta Enter continua trocando a senha sem tirar a mão dali.
   */
  it("com a lista fechada, o Enter continua enviando o formulário", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    servidor.proximaRecusa = RecusaDaTroca.aceita();
    await preencherTroca(usuario, SENHA_NOVA);
    await usuario.type(screen.getByLabelText("Repita a senha nova"), "{Enter}");

    await waitFor(() =>
      expect(servidor.trocasPedidas).toEqual([
        { currentPassword: SENHA_TEMPORARIA, newPassword: SENHA_NOVA },
      ]),
    );
  });

  /**
   * A senha com espaço vai para o serviço COMO FOI DIGITADA. Aparar seria
   * mudar a senha da pessoa sem avisar — e, com o espaço no meio virando
   * exigência, aparar as pontas ainda quebraria quem escolhesse pôr uma.
   */
  it("a senha com espaço é enviada sem aparar nada", async () => {
    const COM_ESPACOS = " Vento# Sul7 ";
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    servidor.proximaRecusa = RecusaDaTroca.aceita();
    await preencherTroca(usuario, COM_ESPACOS);
    await usuario.click(screen.getByRole("button", { name: "Trocar a senha" }));

    await waitFor(() =>
      expect(servidor.trocasPedidas).toEqual([
        { currentPassword: SENHA_TEMPORARIA, newPassword: COM_ESPACOS },
      ]),
    );
  });

  /**
   * As oito exigências do contrato, uma a uma: o backend recusa apontando
   * `details.requirement` e a pessoa lê a frase daquela exigência — nunca um
   * "senha inválida" que não diz o que fazer.
   *
   * A senha é redigitada a cada volta de propósito. A exigência apontada pelo
   * serviço tranca o botão (é um item vermelho), e digitar na senha a apaga:
   * sem isso, a recusa de um texto antigo trancaria a tela por dentro.
   */
  it("cada uma das oito recusas do backend aparece apontada para a pessoa", async () => {
    const FRASES: Readonly<Record<PasswordRequirement, string>> = {
      "minimum-length": "A senha nova precisa ter 8 caracteres ou mais.",
      "uppercase-letter": "A senha nova precisa ter pelo menos uma letra maiúscula.",
      "lowercase-letter": "A senha nova precisa ter pelo menos uma letra minúscula.",
      digit: "A senha nova precisa ter pelo menos um número.",
      symbol: "A senha nova precisa ter pelo menos um símbolo, como ! ? # ou @.",
      "inner-space":
        "A senha nova precisa ter um espaço no meio dela — nunca no começo nem no fim.",
      "obvious-sequence": "A senha nova não pode ter 1234 nem outra sequência óbvia.",
      "own-email": "A senha nova não pode ter o seu e-mail dentro dela.",
    };

    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    for (const exigencia of PASSWORD_REQUIREMENTS) {
      await preencherTroca(usuario, SENHA_NOVA);
      servidor.proximaRecusa = RecusaDaTroca.senhaFraca(exigencia);
      await usuario.click(screen.getByRole("button", { name: "Trocar a senha" }));

      await waitFor(() =>
        expect(screen.getByRole("alert").textContent, exigencia).toBe(FRASES[exigencia]),
      );
      expect(screen.getByText("Troque a sua senha para começar")).toBeTruthy();
      // A exigência apontada volta a faltar na lista, mesmo estando de pé aqui.
      expect(screen.getAllByText("ainda falta").length, exigencia).toBe(1);
    }
    // Oito voltas, cada uma redigitando os três campos com digitação real:
    // ~380 teclas. Passa dos 5 s padrão quando a máquina está carregada, e
    // a exigência do espaço no meio (2026-09-08) acrescentou mais uma volta.
  }, 30_000);

  it("senha atual errada diz o que houve, sem nenhum detalhe técnico", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    servidor.proximaRecusa = RecusaDaTroca.senhaAtualErrada();
    await preencherTroca(usuario, SENHA_NOVA, "chute-errado");
    await usuario.click(screen.getByRole("button", { name: "Trocar a senha" }));

    const aviso = await screen.findByRole("alert");
    await waitFor(() =>
      expect(aviso.textContent).toBe("A senha temporária não confere. Confira e tente de novo."),
    );
    expect(aviso.textContent).not.toMatch(/\b(?:POST|GET)\b|\/api\/|\b[1-5]\d{2}\b/);
  });

  /**
   * Antes de 2026-09-08 o formulário SAÍA e a diferença virava um aviso
   * vermelho depois do envio. Agora ela nem chega a sair: o botão está
   * trancado, e a lista já disse por quê.
   */
  it("as duas senhas novas diferentes não chegam nem a sair da tela", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    await usuario.type(screen.getByLabelText("Senha temporária"), SENHA_TEMPORARIA);
    await usuario.type(screen.getByLabelText("Senha nova"), SENHA_NOVA);
    await usuario.type(screen.getByLabelText("Repita a senha nova"), "Outra# Coisa9");

    const botao = screen.getByRole("button", { name: "Trocar a senha" });
    await waitFor(() => expect(botao.hasAttribute("disabled")).toBe(true));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(servidor.trocasPedidas).toEqual([]);
  });

  it("depois de trocar, a sessão termina e a pessoa volta pela tela de login (dono, 2026-09-06)", async () => {
    await subirASpa();
    const usuario = await entrar();
    await screen.findByText("Troque a sua senha para começar");

    servidor.proximaRecusa = RecusaDaTroca.aceita();
    await preencherTroca(usuario, SENHA_NOVA);
    await usuario.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(await screen.findByLabelText("E-mail")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByText("Troque a sua senha para começar")).toBeNull();
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
    await usuario.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(await screen.findByLabelText("E-mail")).toBeTruthy();
    expect(screen.queryByText("Troque a sua senha para começar")).toBeNull();
  });
});
