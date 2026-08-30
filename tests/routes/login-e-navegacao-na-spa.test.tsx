import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
  type AnyRouter,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { createAppQueryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import { fixtureCareerLevels, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import { jsonResponse } from "../helpers/render-app";

/**
 * REDE 2 — o caminho real do usuário, que o harness inteiro mascarava.
 *
 * O achado que explica por que nenhuma rede automática pegou os dois únicos
 * bloqueantes da história do projeto, colado sem reescrita:
 *
 *   "os testes de tela sempre mockam /auth/me e nunca exercitam o caminho de
 *   LOGIN; o Playwright faz page.goto() por rota, ou seja, reload completo →
 *   /auth/me → memberships presentes. O harness mascara exatamente este
 *   caminho."
 *
 * Aqui não há reload e não há sessão pronta. A SPA sobe com `/auth/me`
 * respondendo 401, a tela de login aparece, o login acontece na MESMA
 * instância, e a navegação seguinte tem de usar a sessão que o login abriu.
 *
 * O que pina é a assimetria de contrato que causou o defeito da onda 18:
 * `POST /auth/login` devolve a CONTA autenticada, sem `memberships`;
 * `GET /auth/me` devolve a SESSÃO, com eles. Quem entra pela tela de login e
 * não reconcilia fica com uma sessão sem vínculo — e o tech lead perde
 * `/team-rules`, a tela que ele rege, sem erro nenhum na tela.
 *
 * Este arquivo é o único do repositório que renderiza o roteador de verdade
 * (`routeTree` gerado, `__root` com o `AuthGate`) em vez de montar o
 * componente da rota direto. É de propósito: o `AuthGate` e o `AuthProvider`
 * são o objeto sob teste, e montar a página direto é justamente o que os
 * pula.
 */

const fetchMock = vi.fn();

/** O que `POST /auth/login` devolve: a conta, SEM `memberships`. */
const contaAutenticada: SessionUser = {
  id: "test-lead-do-time",
  email: "techlead@synapse.local",
  name: "Lead do time",
  role: "lead",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

/** O que `GET /auth/me` devolve depois do login: a SESSÃO, com o vínculo. */
const sessaoDoLead: SessionUser = {
  ...contaAutenticada,
  memberships: [{ teamId: fixtureTeamId, role: "tech_lead" }],
};

const REGUA = {
  id: "regra-plataforma-i",
  teamId: fixtureTeamId,
  careerLevelId: "arquiteto-de-solucoes-i",
  minimumQualifiedCapabilities: 3,
  capabilityIds: ["cloud"],
  competencies: [{ competencyId: "cloud-k8s", requirementType: "RESTRICTIVE", requiredLevel: 4 }],
};

class ServidorDaSessao {
  private autenticado = false;

  responder = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const href = input instanceof Request ? input.url : String(input);
    const metodo = (
      input instanceof Request ? input.method : (init?.method ?? "GET")
    ).toUpperCase();

    if (href.endsWith(apiPath("/auth/status")))
      return this.envelope(jsonResponse({ hasUsers: true }));

    if (href.endsWith(apiPath("/auth/login")) && metodo === "POST") {
      this.autenticado = true;
      return this.envelope(jsonResponse({ user: contaAutenticada }));
    }

    if (href.endsWith(apiPath("/auth/me"))) {
      return this.autenticado
        ? this.envelope(jsonResponse(sessaoDoLead))
        : Promise.resolve(
            jsonResponse(
              {
                code: "AUTHENTICATION_REQUIRED",
                message: "Autenticação necessária.",
                correlationId: "teste",
              },
              401,
            ),
          );
    }

    if (href.endsWith(apiPath("/teams")))
      return this.envelope(
        jsonResponse([{ id: fixtureTeamId, name: "Time Plataforma", active: true }]),
      );
    if (href.endsWith(apiPath("/career-levels")))
      return this.envelope(jsonResponse(fixtureCareerLevels));
    if (href.includes("/rules/")) return this.envelope(jsonResponse(REGUA));
    if (href.endsWith(apiPath("/state"))) return this.envelope(jsonResponse(fixtureState));

    return this.envelope(jsonResponse({}));
  };

  /** O backend envelopa toda 2xx de `/api/v1/*` em `{ data }` (RF-05). */
  private async envelope(response: Response): Promise<Response> {
    const corpo = (await response.json()) as unknown;
    return jsonResponse({ data: corpo }, response.status);
  }
}

let servidor: ServidorDaSessao;
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

beforeEach(() => {
  servidor = new ServidorDaSessao();
  fetchMock.mockReset();
  fetchMock.mockImplementation(servidor.responder);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("login e navegação DENTRO da SPA — sem reload, que é como o usuário entra", () => {
  it("sem sessão a SPA mostra a tela de login, não o painel", async () => {
    await subirASpa();

    expect(await screen.findByLabelText("E-mail")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("o tech lead que entra pelo login alcança a régua do time que rege, sem recarregar a página", async () => {
    await subirASpa();

    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText("E-mail"), "techlead@synapse.local");
    await usuario.type(screen.getByLabelText("Senha"), "synapse-local-dev");
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(screen.queryByLabelText("E-mail")).toBeNull());

    await router.navigate({ to: "/team-rules" });

    expect(await screen.findByText("Time Plataforma")).toBeTruthy();
    expect(
      screen.queryByText("Configurar a régua do time é restrito a quem lidera o time."),
    ).toBeNull();
    expect(router.state.location.pathname).toBe("/team-rules");
  });

  /**
   * O sintoma da onda 18, ao pé da letra: "a tela /team-rules SUMIA para o
   * tech lead recém-logado". Sumia do MENU — `filterNavGroups` pergunta
   * `canConfigureAnyTeamRules` ao usuário do contexto de auth, e o usuário
   * que veio só do login não tem `memberships`. Nenhum erro aparece; o
   * destino simplesmente deixa de existir para quem o rege.
   */
  it("o destino que o tech lead rege aparece no menu logo depois do login", async () => {
    await subirASpa();

    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText("E-mail"), "techlead@synapse.local");
    await usuario.type(screen.getByLabelText("Senha"), "synapse-local-dev");
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(screen.queryByLabelText("E-mail")).toBeNull());
    expect(await screen.findByRole("link", { name: "Régua do Time" })).toBeTruthy();
  });
});
