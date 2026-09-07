import { describe, expect, it, vi } from "vitest";

import { MetricsTab, PlatformMetricsDoor, type TabOpener } from "@/lib/platform-metrics";

/**
 * A PORTA E A ABA das Métricas da Plataforma — as duas peças que fazem a
 * abertura ser controlada (dono, 2026-09-08), lidas sem tela nenhuma no meio.
 *
 * A porta é o que separa "abriu" de "abriu uma aba com um erro dentro": ela
 * traduz o status HTTP na única coisa que a tela precisa saber — pronto,
 * recusa COM razão, ou sem serviço atrás. A aba é o que faz o navegador
 * cooperar: ela nasce no gesto e é navegada depois, porque uma aba pedida
 * depois de um `await` é bloqueada como pop-up.
 */
const PORTA = "https://api.exemplo/grafana/";

const respondendo = (status: number) => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }));
  return { fetcher, porta: new PlatformMetricsDoor(PORTA, fetcher) };
};

describe("PlatformMetricsDoor — o que a porta respondeu, em três leituras", () => {
  it("bate no endereço da porta levando o cookie da sessão — sem credencial não há troca de passe", async () => {
    const { fetcher, porta } = respondendo(200);
    await porta.knock();
    expect(fetcher).toHaveBeenCalledWith(
      PORTA,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("200 e 302 são pronto: a porta serviu, ou encaminhou", async () => {
    for (const status of [200, 302]) {
      const { porta } = respondendo(status);
      expect((await porta.knock()).isReady, String(status)).toBe(true);
    }
  });

  it("401 e 403 são recusa, e cada uma nomeia a própria razão", async () => {
    expect((await respondendo(401).porta.knock()).refusal).toBe("unauthenticated");
    expect((await respondendo(403).porta.knock()).refusal).toBe("forbidden");
    expect((await respondendo(403).porta.knock()).isReady).toBe(false);
  });

  it("503 — a porta aberta sem Grafana atrás — é serviço fora do ar, não recusa", async () => {
    const resposta = await respondendo(503).porta.knock();
    expect(resposta.outage).toBe(true);
    expect(resposta.refusal).toBeNull();
  });

  it("o `fetch` que rejeita também é serviço fora do ar — sem status, sem frase inventada", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("sem rede"));
    const resposta = await new PlatformMetricsDoor(PORTA, fetcher).knock();
    expect(resposta.outage).toBe(true);
    expect(resposta.status).toBe(0);
  });
});

/** Um navegador de mentira: guarda o que foi pedido e devolve a aba que o teste mandar. */
class NavegadorDeMentira implements TabOpener {
  readonly pedidos: string[] = [];
  readonly navegadaPara: string[] = [];
  private permite = true;

  open(url?: string | URL): Window | null {
    this.pedidos.push(String(url));
    if (!this.permite) return null;
    return {
      closed: false,
      location: { replace: (destino: string) => this.navegadaPara.push(destino) },
    } as unknown as Window;
  }

  bloqueia(): void {
    this.permite = false;
  }
}

describe("MetricsTab — reservada no gesto, navegada depois", () => {
  it("a reserva abre uma aba em branco, e uma segunda reserva não abre outra", () => {
    const navegador = new NavegadorDeMentira();
    const aba = new MetricsTab(navegador);

    aba.reserve();
    aba.reserve();

    expect(navegador.pedidos).toEqual(["about:blank"]);
    expect(aba.isReserved).toBe(true);
  });

  it("com reserva, mostrar as métricas NAVEGA a aba — nenhuma aba nova é pedida", () => {
    const navegador = new NavegadorDeMentira();
    const aba = new MetricsTab(navegador);
    aba.reserve();

    expect(aba.show("https://grafana/")).toBe(true);
    expect(navegador.navegadaPara).toEqual(["https://grafana/"]);
    expect(navegador.pedidos).toEqual(["about:blank"]);
  });

  it("sem reserva, a aba é pedida na hora já no endereço final", () => {
    const navegador = new NavegadorDeMentira();

    expect(new MetricsTab(navegador).show("https://grafana/")).toBe(true);
    expect(navegador.pedidos).toEqual(["https://grafana/"]);
  });

  it("aba bloqueada pelo navegador é `false` — é o que a tela usa para oferecer 'Abrir de novo'", () => {
    const navegador = new NavegadorDeMentira();
    navegador.bloqueia();
    const aba = new MetricsTab(navegador);

    aba.reserve();

    expect(aba.isReserved).toBe(false);
    expect(aba.show("https://grafana/")).toBe(false);
  });

  it("aba fechada pela pessoa deixa de valer como reserva — a próxima abertura pede outra", () => {
    const navegador = new NavegadorDeMentira();
    const fechada = { closed: true, location: { replace: vi.fn() } } as unknown as Window;
    const aba = new MetricsTab({ open: () => fechada });
    aba.reserve();
    expect(aba.isReserved).toBe(false);

    expect(new MetricsTab(navegador).show("https://grafana/")).toBe(true);
  });

  it("soltar a aba esquece a reserva — a abertura seguinte começa do zero", () => {
    const navegador = new NavegadorDeMentira();
    const aba = new MetricsTab(navegador);
    aba.reserve();

    aba.release();

    expect(aba.isReserved).toBe(false);
    aba.show("https://grafana/");
    expect(navegador.pedidos).toEqual(["about:blank", "https://grafana/"]);
  });
});
