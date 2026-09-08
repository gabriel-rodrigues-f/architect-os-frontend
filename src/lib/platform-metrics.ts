import { API_URL } from "./api-client";

/**
 * AS MÉTRICAS DA PLATAFORMA, do lado do navegador — o endereço e a aba. Nada
 * aqui desenha; quem desenha é o `PlatformMetricsGate`, e quem decide QUEM
 * alcança é a política (`readsPlatformMetrics`), lida do `/auth/me`.
 *
 * Por que existe (dono, 2026-09-08): "quando clico para abrir Métricas da
 * Plataforma ele abre de qualquer jeito, sem elegância; quero que essa tela
 * seja aberta de forma controlada, com um efeito elegante" — e, no mesmo
 * pedido, o defeito de menu: com o item sendo um `<a target="_blank">` cru,
 * a rota não mudava e o menu ficava com DOIS itens acesos. As Métricas
 * viraram rota (`/platform-metrics`); o Grafana continua abrindo em outra
 * aba, mas por uma tela de transição.
 *
 * A PORTA NÃO SE PRÉ-CONFERE (regressão do mesmo dia: "não consigo mais
 * visualizar o grafana, tela branca"). Havia aqui uma `PlatformMetricsDoor`
 * que dava um `fetch` em `{API}/grafana/` antes de navegar a aba. A porta
 * responde 302 para OUTRA ORIGEM (`grafana.localhost`), o navegador segue o
 * redirecionamento, esbarra em CORS e REJEITA o `fetch` — e uma rejeição de
 * CORS é indistinguível de queda de serviço. A tela lia "serviço fora do ar"
 * e nunca navegava a aba reservada, que ficava em `about:blank`. Branca.
 *
 * A régua que ficou: nenhuma decisão desta tela pode depender de LER uma
 * resposta cross-origin. A aba vai direto à porta — é ela que confere a
 * sessão, recusa com 401/403 e redireciona, dentro da própria aba.
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

/** Quem sabe abrir uma aba — o `window` do navegador, ou um dublê no teste. */
export interface TabOpener {
  open(url?: string | URL, target?: string, features?: string): Window | null;
}

/**
 * A ABA DAS MÉTRICAS — reservada no CLIQUE, navegada pela tela de transição.
 *
 * O navegador só deixa abrir aba durante o gesto da pessoa: uma aba pedida
 * depois de um `await` é bloqueada como pop-up. Por isso o clique no menu
 * reserva a aba em branco e guarda o punho dela, e a tela de transição a
 * leva à porta do Grafana. Quem chega por URL direta não tem
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
