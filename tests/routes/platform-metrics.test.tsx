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
import { mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * A TELA DAS MÉTRICAS DA PLATAFORMA — a abertura controlada que o dono pediu
 * em 2026-09-08: "quero que essa tela seja aberta de forma controlada, com um
 * efeito elegante".
 *
 * REGRESSÃO DO MESMO DIA — "não consigo mais visualizar o grafana, tela
 * branca": a tela batia na porta (`GET {API}/grafana/`) por `fetch` ANTES de
 * navegar a aba. A porta responde 302 para OUTRA ORIGEM
 * (`grafana.localhost`), o `fetch` segue o redirecionamento, esbarra em CORS
 * e REJEITA — e uma rejeição de CORS é indistinguível de queda de serviço.
 * Resultado: a tela lia "serviço fora do ar", nunca navegava a aba reservada,
 * e ela ficava em `about:blank`. Branca.
 *
 * A régua que sobrou: NENHUMA decisão desta tela pode depender de ler uma
 * resposta cross-origin. Quem confere a sessão é a porta (401/403 e
 * redirecionamento), dentro da aba; quem confere o ALCANCE é a política, que
 * já veio no `/auth/me` da mesma origem e é o que a rota lê antes de desenhar.
 */
const fetchMock = vi.fn();

const PlatformMetricsPage = PlatformMetricsRoute.options.component as () => ReactNode;

const GRAFANA = ObservabilityAddress.grafana;

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

function abrirTela(user: SessionUser, rotas: FetchRoute[] = []) {
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
  it("o member vê a negativa e nenhuma aba é aberta", async () => {
    const { abrir } = abaDeMentira();
    abrirTela(fixtureMemberUser);

    expect(
      await screen.findByText("As métricas da plataforma são de quem opera e de quem lidera."),
    ).toBeTruthy();
    expect(screen.queryByTestId("platform-metrics-gate")).toBeNull();
    expect(abrir).not.toHaveBeenCalled();
  });
});

describe("a aba vai direto à porta — nenhuma resposta cross-origin no caminho", () => {
  it("com a aba reservada no clique do menu, a transição a leva à porta e avisa onde ela está", async () => {
    const { abrir, replace } = abaDeMentira();
    defaultContainer.platformMetricsTab.reserve();
    expect(abrir).toHaveBeenCalledWith("about:blank", expect.any(String));
    abrir.mockClear();

    abrirTela(fixtureAdminUser);

    expect(await screen.findByText("Métricas abertas em outra aba")).toBeTruthy();
    expect(fase()).toBe("opened");
    // A aba reservada é NAVEGADA; nenhuma aba nova é pedida fora do gesto.
    expect(replace).toHaveBeenCalledWith(GRAFANA);
    expect(abrir).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Abrir de novo" })).toBeTruthy();
  });

  /**
   * O TESTE DA REGRESSÃO. Antes, este `fetch` rejeitado (é o que o navegador
   * faz com o 302 para outra origem) parava tudo: a tela lia queda de serviço
   * e a aba ficava branca. Agora ninguém pergunta nada à porta pelo `fetch`.
   */
  it("mesmo com a porta rejeitando o `fetch` por CORS, a aba É navegada — e a tela não inventa queda", async () => {
    const { replace } = abaDeMentira();
    defaultContainer.platformMetricsTab.reserve();
    mockAppFetch(fetchMock, { user: fixtureAdminUser });
    const aplicacao = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((entrada: unknown, init: unknown) =>
      String(entrada).includes("/grafana/")
        ? Promise.reject(new TypeError("Failed to fetch"))
        : aplicacao(entrada, init),
    );

    renderWithApp(<PlatformMetricsPage />);

    expect(await screen.findByText("Métricas abertas em outra aba")).toBeTruthy();
    expect(replace).toHaveBeenCalledWith(GRAFANA);
    expect(screen.queryByTestId("service-outage")).toBeNull();
  });

  it("a tela não pergunta nada à porta: quem confere a sessão é a própria porta, na aba", async () => {
    abaDeMentira();
    abrirTela(fixtureAdminUser);

    await screen.findByText("Métricas abertas em outra aba");
    expect(bateuNaPorta()).toBe(false);
  });

  it("a transição pede à rede um pulso azul — e nenhum com movimento reduzido", async () => {
    abaDeMentira();
    abrirTela(fixtureAdminUser);
    await screen.findByText("Métricas abertas em outra aba");
    expect(defaultContainer.synapseSignals.drainPulses()).toEqual(["primary"]);

    cleanup();
    defaultContainer.platformMetricsTab.release();
    comMovimento(true);
    abrirTela(fixtureAdminUser);
    // Sem animação, mas a abertura é a mesma: a preferência tira o movimento, nunca a função.
    expect(await screen.findByText("Métricas abertas em outra aba")).toBeTruthy();
    expect(defaultContainer.synapseSignals.drainPulses()).toEqual([]);
  });

  it("sem reserva (URL direta), a aba é pedida na hora; bloqueada, a tela oferece abrir de novo", async () => {
    const bloqueado = vi.fn().mockReturnValue(null);
    vi.stubGlobal("open", bloqueado);

    abrirTela(fixtureAdminUser);

    expect(await screen.findByText("O navegador não deixou a aba abrir")).toBeTruthy();
    expect(fase()).toBe("blocked");
    expect(bloqueado).toHaveBeenCalledWith(GRAFANA, expect.any(String));

    // O botão é o gesto que o navegador espera: aí a aba abre.
    bloqueado.mockReturnValue({ closed: false, location: { replace: vi.fn() } });
    fireEvent.click(screen.getByRole("button", { name: "Abrir de novo" }));
    await waitFor(() => expect(fase()).toBe("opened"));
  });
});
