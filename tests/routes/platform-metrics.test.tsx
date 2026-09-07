import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `lideranca-nega-o-profissional`: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import type { SessionUser } from "@/lib/api";
import { defaultContainer } from "@/lib/gateways/container";
import { ObservabilityAddress } from "@/lib/platform-metrics";
import { Route as PlatformMetricsRoute } from "@/routes/platform-metrics";
import { fixtureAdminUser, fixtureMemberUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * A TELA DAS MÉTRICAS DA PLATAFORMA — a abertura controlada que o dono pediu
 * em 2026-09-08: "quero que essa tela seja aberta de forma controlada, com um
 * efeito elegante".
 *
 * O que se prova aqui é a ORDEM, que é onde mora a elegância: a tela desenha
 * a transição, bate na porta do Grafana e só entrega a aba quando a porta
 * responde. Se a porta recusa, a razão vira frase — em vez de uma aba nova
 * com um erro dentro, que era o comportamento anterior. Se não há serviço
 * atrás dela, é a tela de indisponibilidade da casa.
 *
 * É também o gêmeo de TELA que `alcance-por-rota` exige da rota restrita: o
 * `beforeLoad` é cego à sessão no SSR (a lição da onda 17), então a barreira
 * que sobra é a tela negar — e não bater na porta.
 */
const fetchMock = vi.fn();

const PlatformMetricsPage = PlatformMetricsRoute.options.component as () => ReactNode;

const GRAFANA = ObservabilityAddress.grafana;

/** A porta do Grafana respondendo o que o teste mandar. */
const porta = (status: number): FetchRoute =>
  function responder(href) {
    if (!href.includes("/grafana/")) return undefined;
    return status === 200 ? jsonResponse({}) : new Response(null, { status });
  };

function comMovimento(reduzido: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduzido && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })),
  );
}

/** Uma aba de mentira: sabe dizer se foi navegada, e para onde. */
function abaDeMentira() {
  const replace = vi.fn();
  const abrir = vi.fn().mockReturnValue({ closed: false, location: { replace } });
  vi.stubGlobal("open", abrir);
  return { abrir, replace };
}

function abrirTela(user: SessionUser, rotas: FetchRoute[]) {
  mockAppFetch(fetchMock, { user, routes: rotas });
  return renderWithApp(<PlatformMetricsPage />);
}

const bateuNaPorta = (): boolean =>
  fetchMock.mock.calls.some(([entrada]) =>
    String(entrada instanceof Request ? entrada.url : entrada).includes("/grafana/"),
  );

const fase = () => screen.getByTestId("platform-metrics-gate").getAttribute("data-phase");

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  comMovimento(false);
  defaultContainer.platformMetricsTab.release();
  defaultContainer.synapseSignals.drainPulses();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  defaultContainer.platformMetricsTab.release();
});

describe("/platform-metrics nega o profissional — a tela é a última barreira", () => {
  it("o member vê a negativa e a porta do Grafana nem é procurada", async () => {
    abrirTela(fixtureMemberUser, [porta(200)]);

    expect(
      await screen.findByText("As métricas da plataforma são de quem opera e de quem lidera."),
    ).toBeTruthy();
    expect(screen.queryByTestId("platform-metrics-gate")).toBeNull();
    expect(bateuNaPorta()).toBe(false);
  });
});

describe("a abertura é controlada: a aba só é entregue quando a porta responde", () => {
  it("com a aba reservada no clique do menu, a transição a leva ao painel e avisa onde ela está", async () => {
    const { abrir, replace } = abaDeMentira();
    defaultContainer.platformMetricsTab.reserve();
    expect(abrir).toHaveBeenCalledWith("about:blank", expect.any(String));
    abrir.mockClear();

    abrirTela(fixtureAdminUser, [porta(200)]);
    expect(await screen.findByText("Abrindo…")).toBeTruthy();

    expect(await screen.findByText("Métricas abertas em outra aba")).toBeTruthy();
    expect(fase()).toBe("opened");
    // A aba reservada é NAVEGADA; nenhuma aba nova é pedida fora do gesto.
    expect(replace).toHaveBeenCalledWith(GRAFANA);
    expect(abrir).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Abrir de novo" })).toBeTruthy();
  });

  it("a transição pede à rede um pulso azul — e nenhum com movimento reduzido", async () => {
    abaDeMentira();
    abrirTela(fixtureAdminUser, [porta(200)]);
    await screen.findByText("Métricas abertas em outra aba");
    expect(defaultContainer.synapseSignals.drainPulses()).toEqual(["primary"]);

    cleanup();
    comMovimento(true);
    abrirTela(fixtureAdminUser, [porta(200)]);
    // Sem animação, mas a abertura é a mesma: a preferência tira o movimento, nunca a função.
    expect(await screen.findByText("Métricas abertas em outra aba")).toBeTruthy();
    expect(defaultContainer.synapseSignals.drainPulses()).toEqual([]);
  });

  it("sem reserva (URL direta), a aba é pedida na hora; bloqueada, a tela oferece abrir de novo", async () => {
    const bloqueado = vi.fn().mockReturnValue(null);
    vi.stubGlobal("open", bloqueado);

    abrirTela(fixtureAdminUser, [porta(200)]);

    expect(await screen.findByText("O navegador não deixou a aba abrir")).toBeTruthy();
    expect(fase()).toBe("blocked");
    expect(bloqueado).toHaveBeenCalledWith(GRAFANA, expect.any(String));

    // O botão é o gesto que o navegador espera: aí a aba abre.
    bloqueado.mockReturnValue({ closed: false, location: { replace: vi.fn() } });
    fireEvent.click(screen.getByRole("button", { name: "Abrir de novo" }));
    await waitFor(() => expect(fase()).toBe("opened"));
  });
});

describe("a porta que recusa vira frase, não uma aba com erro dentro", () => {
  it("403 diz que a conta não alcança as métricas, e nenhuma aba é aberta", async () => {
    const { abrir } = abaDeMentira();

    abrirTela(fixtureAdminUser, [porta(403)]);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "A sua conta não alcança as métricas da plataforma.",
    );
    expect(fase()).toBe("refused");
    expect(abrir).not.toHaveBeenCalled();
  });

  it("401 manda entrar de novo — é a sessão que a porta não reconheceu", async () => {
    abaDeMentira();

    abrirTela(fixtureAdminUser, [porta(401)]);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "A porta das métricas não reconheceu a sua sessão.",
    );
  });
});

describe("sem serviço atrás da porta, é a tela de indisponibilidade da casa", () => {
  it("a queda da rede leva à mesma tela de todas as outras, e não a uma frase própria", async () => {
    abaDeMentira();
    // A porta nem responde: o `fetch` rejeita, como na queda do serviço.
    mockAppFetch(fetchMock, { user: fixtureAdminUser });
    const aplicacao = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((entrada: unknown, init: unknown) =>
      String(entrada).includes("/grafana/")
        ? Promise.reject(new TypeError("sem rede"))
        : aplicacao(entrada, init),
    );

    renderWithApp(<PlatformMetricsPage />);

    expect(await screen.findByTestId("service-outage")).toBeTruthy();
    expect(screen.queryByTestId("platform-metrics-gate")).toBeNull();
  });

  it("503 — a porta aberta sem Grafana atrás — também é indisponibilidade", async () => {
    abaDeMentira();
    abrirTela(fixtureAdminUser, [porta(503)]);

    expect(await screen.findByTestId("service-outage")).toBeTruthy();
  });
});
