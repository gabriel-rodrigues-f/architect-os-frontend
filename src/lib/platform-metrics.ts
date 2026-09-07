import { API_URL } from "./api-client";

/**
 * AS MÉTRICAS DA PLATAFORMA, do lado do navegador — o endereço, a porta e a
 * aba. Nada aqui desenha; quem desenha é o `PlatformMetricsGate`, e quem
 * decide QUEM alcança é a política (`readsPlatformMetrics`).
 *
 * Por que existe (dono, 2026-09-08): "quando clico para abrir Métricas da
 * Plataforma ele abre de qualquer jeito, sem elegância; quero que essa tela
 * seja aberta de forma controlada, com um efeito elegante" — e, no mesmo
 * pedido, o defeito de menu: com o item sendo um `<a target="_blank">` cru,
 * a rota não mudava e o menu ficava com DOIS itens acesos. As Métricas
 * viraram rota (`/platform-metrics`); o Grafana continua abrindo em outra
 * aba, mas por uma tela de transição que só o entrega quando a porta responde.
 */

/**
 * Onde o Grafana mora — e por que isto é uma variável, e não um caminho.
 *
 * Desde 2026-09-05 a porta de entrada é a PRÓPRIA API: `/grafana` nela
 * confere a sessão e injeta o passe em cada requisição (`GrafanaDoor`, no
 * backend) — sem senha do Grafana. O Grafana fica em inglês, o padrão dele.
 *
 * `VITE_GRAFANA_URL` continua existindo para uma topologia em que a porta
 * mora noutro endereço (um Ingress servindo `/grafana` na mesma origem);
 * vazia, vale a porta da API que o frontend já conhece.
 */
export class ObservabilityAddress {
  static get grafana(): string {
    const declarado: unknown = import.meta.env["VITE_GRAFANA_URL"];
    return typeof declarado === "string" && declarado.trim() !== ""
      ? declarado.trim()
      : `${API_URL}/grafana/`;
  }
}

/** Por que a porta recusou — a RAZÃO em palavra de negócio, não em número de status. */
export type MetricsRefusal = "unauthenticated" | "forbidden";

/**
 * O que a porta respondeu, nas três leituras que mudam a tela: ela abriu, ela
 * recusou (e por quê), ou não há serviço atrás dela.
 */
export class MetricsDoorAnswer {
  private constructor(
    readonly status: number,
    readonly refusal: MetricsRefusal | null,
    readonly outage: boolean,
  ) {}

  static ready(status: number): MetricsDoorAnswer {
    return new MetricsDoorAnswer(status, null, false);
  }

  static refused(status: number, refusal: MetricsRefusal): MetricsDoorAnswer {
    return new MetricsDoorAnswer(status, refusal, false);
  }

  static unavailable(status: number): MetricsDoorAnswer {
    return new MetricsDoorAnswer(status, null, true);
  }

  get isReady(): boolean {
    return this.refusal === null && !this.outage;
  }
}

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

/**
 * A PORTA DO GRAFANA — `GET {API}/grafana/`, que troca a sessão do Synapse
 * pelo cookie do Grafana. A tela bate nela ANTES de mandar alguém para lá:
 * é o que separa "abriu" de "abriu uma aba com uma tela de erro dentro".
 *
 * A leitura: 200 (a porta serviu) e 302 (a porta encaminhou) são pronto;
 * 401 e 403 são recusa COM razão — a única coisa que a tela precisa dizer —;
 * o resto, e o `fetch` que nem responde, é serviço fora do ar. O 503 é dele
 * de propósito: é o código que a porta usa quando não há Grafana atrás.
 */
export class PlatformMetricsDoor {
  private static readonly READY: ReadonlySet<number> = new Set([200, 302]);
  private static readonly REFUSAL_BY_STATUS: Readonly<Record<number, MetricsRefusal>> = {
    401: "unauthenticated",
    403: "forbidden",
  };
  /** O `fetch` rejeitou: não houve status nenhum. */
  private static readonly NO_ANSWER = 0;

  constructor(
    readonly address: string = ObservabilityAddress.grafana,
    private readonly fetcher: Fetcher = (input, init) => fetch(input, init),
  ) {}

  async knock(signal?: AbortSignal): Promise<MetricsDoorAnswer> {
    let response: Response;
    try {
      response = await this.fetcher(this.address, {
        credentials: "include",
        ...(signal ? { signal } : {}),
      });
    } catch {
      return MetricsDoorAnswer.unavailable(PlatformMetricsDoor.NO_ANSWER);
    }
    const refusal = PlatformMetricsDoor.REFUSAL_BY_STATUS[response.status];
    if (refusal) return MetricsDoorAnswer.refused(response.status, refusal);
    if (PlatformMetricsDoor.READY.has(response.status) || response.ok) {
      return MetricsDoorAnswer.ready(response.status);
    }
    return MetricsDoorAnswer.unavailable(response.status);
  }
}

/** Quem sabe abrir uma aba — o `window` do navegador, ou um dublê no teste. */
export interface TabOpener {
  open(url?: string | URL, target?: string, features?: string): Window | null;
}

/**
 * A ABA DAS MÉTRICAS — reservada no CLIQUE, navegada quando a porta responde.
 *
 * O navegador só deixa abrir aba durante o gesto da pessoa: uma aba pedida
 * depois de um `await` é bloqueada como pop-up. Por isso o clique no menu
 * reserva a aba em branco e guarda o punho dela, e a tela de transição só a
 * leva ao Grafana quando a porta responde. Quem chega por URL direta não tem
 * reserva: aí a aba nasce no botão "Abrir de novo", que é gesto outra vez.
 *
 * Uma por container (`FrontendContainer`), nunca por tela: quem reserva é o
 * menu e quem navega é a rota — se cada um tivesse a sua, a reserva do
 * clique morreria na troca de tela.
 */
export class MetricsTab {
  private static readonly BLANK = "about:blank";
  private static readonly TARGET = "synapse-platform-metrics";

  private handle: Window | null = null;

  constructor(private readonly opener?: TabOpener) {}

  /** O gesto: a aba em branco nasce aqui, no clique do menu. */
  reserve(): void {
    if (this.isReserved) return;
    this.handle = this.browser?.open(MetricsTab.BLANK, MetricsTab.TARGET) ?? null;
  }

  get isReserved(): boolean {
    return this.handle !== null && !this.handle.closed;
  }

  /**
   * Leva as métricas para a aba: navega a reservada ou, sem reserva, tenta
   * abrir uma na hora. Devolve se a aba ficou com as métricas — `false` é o
   * bloqueio de pop-up, e a tela oferece "Abrir de novo".
   */
  show(address: string): boolean {
    if (this.isReserved) {
      this.handle?.location.replace(address);
      return true;
    }
    this.handle = this.browser?.open(address, MetricsTab.TARGET) ?? null;
    return this.isReserved;
  }

  /** Esquece a aba — a próxima abertura começa do zero. */
  release(): void {
    this.handle = null;
  }

  /** O navegador só existe no cliente; no SSR não há aba nenhuma a reservar. */
  private get browser(): TabOpener | null {
    if (this.opener) return this.opener;
    return typeof window === "undefined" ? null : window;
  }
}
