import { describe, expect, it, vi } from "vitest";

import { MetricsTab, ObservabilityAddress, type TabOpener } from "@/lib/platform-metrics";

/**
 * A ABA das Métricas da Plataforma — a peça que faz a abertura ser controlada
 * (dono, 2026-09-08), lida sem tela nenhuma no meio.
 *
 * A aba é o que faz o navegador cooperar: ela nasce no gesto e é navegada
 * depois, porque uma aba pedida depois de um `await` é bloqueada como pop-up.
 *
 * A PORTA saiu daqui em 2026-09-08 (regressão "tela branca"): pré-conferir a
 * porta por `fetch` era impossível de fazer certo — ela responde 302 para
 * outra origem e o navegador transforma isso em rejeição de CORS, que é
 * indistinguível de queda de serviço. Quem confere a sessão é a porta, dentro
 * da aba; quem confere o alcance é a política, na mesma origem.
 */
describe("ObservabilityAddress — o endereço da porta", () => {
  it("é o `/grafana/` da própria API quando nada é declarado", () => {
    expect(ObservabilityAddress.grafana.endsWith("/grafana/")).toBe(true);
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
