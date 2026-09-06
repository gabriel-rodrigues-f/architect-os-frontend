import { NETWORK_UNAVAILABLE_CODE } from "./api-client";
import { ApiError } from "./api-errors";

/**
 * QUANDO o serviço está fora do ar (dono, 2026-09-06: "desligando o backend
 * propositalmente, todas as telas têm a mensagem… somente Usuários abre o
 * menu completo e mostra um erro discreto. Padronize."). Uma leitura só:
 * sem resposta da rede, ou a porta respondendo que não há serviço atrás.
 */
export class ServiceOutage {
  // 503 fica de fora: é o código que a própria aplicação usa para "IA indisponível" e para a porta do Grafana fechada.
  static readonly GATEWAY_STATUSES: ReadonlySet<number> = new Set([502, 504]);

  static isOutage(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;
    return (
      error.code === NETWORK_UNAVAILABLE_CODE || ServiceOutage.GATEWAY_STATUSES.has(error.status)
    );
  }
}
