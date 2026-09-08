import { cleanup, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as TeamRoute } from "@/routes/team";
import { Route as UsersRoute } from "@/routes/users";
import { fixtureAdminUser } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

const fetchMock = vi.fn();
const TeamPage = TeamRoute.options.component as () => ReactNode;
const UsersPage = UsersRoute.options.component as () => ReactNode;

/**
 * Dono (2026-09-06): "desligando o backend, todas as telas têm a mensagem
 * tradicional; só Usuários mostra um erro discreto. Padronize. Quero ver o
 * dinossauro no lugar dessa mensagem; assim que o backend voltar, o usuário
 * deve ser avisado e poderá escolher voltar."
 */
describe("serviço fora do ar — uma tela só, com a corrida, e o aviso de volta", () => {
  let servicoNoAr = false;

  beforeEach(() => {
    servicoNoAr = false;
    window.localStorage.setItem("synapse:locale", "pt");
    // O jogo escolhe as palavras pelo navegador; o teste fala português.
    vi.stubGlobal("navigator", { ...window.navigator, languages: ["pt-BR"] });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [
        (href) =>
          href.endsWith(apiPath("/auth/status")) && !servicoNoAr
            ? new Response("sem serviço", { status: 502 })
            : undefined,
        (href) =>
          href.endsWith(apiPath("/auth/users"))
            ? new Response("sem serviço", { status: 502 })
            : undefined,
        (href) =>
          href.endsWith(apiPath("/professionals"))
            ? new Response("sem serviço", { status: 502 })
            : undefined,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Usuários sem serviço mostra a MESMA tela das outras: título, corrida e Recarregar — nada de aviso discreto", async () => {
    renderWithApp(<UsersPage />);
    expect(await screen.findByTestId("service-outage")).toBeTruthy();
    expect(screen.getByText("Não foi possível acessar o serviço")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Corrida de carreira/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeTruthy();
    expect(screen.queryByText("Não foi possível carregar as contas.")).toBeNull();
  });

  it("Time sem serviço: a corrida no lugar do aviso tradicional", async () => {
    renderWithApp(<TeamPage />);
    expect(await screen.findByTestId("service-outage")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Corrida de carreira/ })).toBeTruthy();
    expect(screen.queryByText(/contate o suporte/)).toBeNull();
  });

  it("quando o serviço volta, a pessoa é avisada e ganha o botão de voltar para a aplicação", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByTestId("service-outage");
    expect(
      screen.queryByText("O serviço voltou. Quando quiser, volte para a aplicação."),
    ).toBeNull();
    servicoNoAr = true;
    await waitFor(
      () => expect(screen.getByRole("button", { name: "Voltar para a aplicação" })).toBeTruthy(),
      { timeout: 8000 },
    );
    expect(
      screen.getByText("O serviço voltou. Quando quiser, volte para a aplicação."),
    ).toBeTruthy();
  }, 10000);
});
