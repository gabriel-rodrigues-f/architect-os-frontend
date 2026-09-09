import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WelcomeNoticeToast } from "@/components/app/WelcomeNoticeToast";
import { apiPath } from "@/lib/api-path";
import { WelcomeGreeting } from "@/lib/greeting/welcome-greeting";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureSupportUser,
} from "../../helpers/fixtures";
import {
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../../helpers/render-app";

const fetchMock = vi.fn();

/**
 * A SAUDAÇÃO VIROU UM AVISO (dono, 2026-09-08).
 *
 * Literal dele: "a notificação de primeiro acesso do dia é realmente uma
 * notificação; depois que ela fecha não consigo vê-la na lista. Vamos mudar a
 * dinâmica: em vez de todos os dias, mostrar somente no primeiro acesso da
 * pessoa na plataforma. Modifique a mensagem para condizer: 'Seja bem-vindo(a)
 * ao Synapse!'. Essa notificação deve ser visível depois, como qualquer outra,
 * ao clicar no sininho."
 *
 * O que estes testes prendem é a INVERSÃO: quem decide se há saudação é a
 * CAIXA DE AVISOS do servidor, não mais uma marca de dia no navegador. E o
 * fechar deixou de apagar: nenhum `POST /notices/:id/read` sai daqui.
 */
const AVISO_DE_BOAS_VINDAS = {
  id: "aviso-boas-vindas",
  eventType: WelcomeGreeting.EVENT_TYPE,
  wording: {},
  link: "/notices",
  occurredAt: new Date().toISOString(),
  readAt: null,
  professionalId: null,
  teamId: null,
};

const leituras: string[] = [];

const caixaCom = (...notices: unknown[]): FetchRoute => {
  return (href, init) => {
    const metodo = (init?.method ?? "GET").toUpperCase();
    if (metodo === "POST" && href.includes(apiPath("/notices"))) {
      leituras.push(href);
      return new Response(null, { status: 204 });
    }
    if (href.includes(apiPath("/notices"))) {
      return jsonResponse({ notices, unreadCount: notices.length });
    }
    return undefined;
  };
};

describe("a saudação do primeiro acesso", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    leituras.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("com o aviso por ler, mostra a frase do dono e chama pelo primeiro nome", async () => {
    mockAppFetch(fetchMock, {
      user: { ...fixtureAssignedManagerUser, name: "Gabriela Souza" },
      routes: [caixaCom(AVISO_DE_BOAS_VINDAS)],
    });

    renderWithApp(<WelcomeNoticeToast />);

    const saudacao = await screen.findByTestId("welcome-notice");
    expect(saudacao.textContent).toContain("Seja bem-vindo(a) ao Synapse!");
    expect(saudacao.textContent).toContain("Olá, Gabriela!");
    expect(saudacao.textContent).toContain("Acompanhe o desenvolvimento do seu time");
  });

  /**
   * O DEFEITO QUE O DONO DESCREVEU: antes, fechar era apagar — a saudação não
   * existia em lugar nenhum depois disso. Agora ela é um aviso por ler, e
   * quem a marca como lida é a pessoa, no sininho.
   */
  it("fechar no x não marca o aviso como lido — ele continua na caixa", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      routes: [caixaCom(AVISO_DE_BOAS_VINDAS)],
    });
    renderWithApp(<WelcomeNoticeToast />);
    await screen.findByTestId("welcome-notice");

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.queryByTestId("welcome-notice")).toBeNull();
    expect(leituras).toEqual([]);
  });

  it("some sozinha em 3 segundos, como o dono pediu em 2026-09-06", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      routes: [caixaCom(AVISO_DE_BOAS_VINDAS)],
    });
    renderWithApp(<WelcomeNoticeToast />);
    await screen.findByTestId("welcome-notice");

    await act(async () => {
      vi.advanceTimersByTime(WelcomeGreeting.VISIBLE_MS + 50);
    });

    expect(screen.queryByTestId("welcome-notice")).toBeNull();
  });

  it("sem o aviso na caixa, não há saudação — o dia deixou de bastar", async () => {
    mockAppFetch(fetchMock, { user: fixtureMemberUser, routes: [caixaCom()] });

    renderWithApp(<WelcomeNoticeToast />);
    await new Promise((pronto) => setTimeout(pronto, 30));

    expect(screen.queryByTestId("welcome-notice")).toBeNull();
  });

  it("neste navegador ela pisca uma vez só — e nem chega a pedir a caixa de novo", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      routes: [caixaCom(AVISO_DE_BOAS_VINDAS)],
    });
    renderWithApp(<WelcomeNoticeToast />);
    await screen.findByTestId("welcome-notice");
    cleanup();

    const pedidosAntes = fetchMock.mock.calls.filter(([entrada]) =>
      String(entrada).includes(apiPath("/notices")),
    ).length;
    renderWithApp(<WelcomeNoticeToast />);
    await new Promise((pronto) => setTimeout(pronto, 30));

    expect(screen.queryByTestId("welcome-notice")).toBeNull();
    expect(
      fetchMock.mock.calls.filter(([entrada]) => String(entrada).includes(apiPath("/notices")))
        .length,
    ).toBe(pedidosAntes);
    expect(WelcomeGreeting.isDueFor(fixtureMemberUser)).toBe(false);
  });

  /**
   * PR 5 (adendo do dono, 2026-09-08, item 2) — a mensagem de quem mantém o
   * sistema em ordem é a do SUPPORT; o administrador, que lê a organização,
   * recebe a dela. A frase de boas-vindas é a mesma para todos.
   */
  it("a linha de apoio continua sendo a do papel de quem entrou", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureSupportUser,
      routes: [caixaCom(AVISO_DE_BOAS_VINDAS)],
    });
    renderWithApp(<WelcomeNoticeToast />);
    expect((await screen.findByTestId("welcome-notice")).textContent).toContain(
      "Mantenha o sistema em ordem",
    );

    cleanup();
    window.localStorage.removeItem(WelcomeGreeting.STORAGE_KEY);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [caixaCom(AVISO_DE_BOAS_VINDAS)],
    });
    renderWithApp(<WelcomeNoticeToast />);
    expect((await screen.findByTestId("welcome-notice")).textContent).toContain(
      "visão inteira da organização",
    );
  });
});
