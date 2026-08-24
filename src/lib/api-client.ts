import type {
  Architect,
  Assessment,
  CareerLevelPolicy,
  Capability,
  Competency,
  DevelopmentCycle,
  DevelopmentPlan,
  Evidence,
  LearningPath,
  MentoringSession,
} from "./domain";
import { ApiError } from "./api-errors";
import { appStateSchema } from "./api-schemas";

/**
 * Snapshot devolvido por GET /api/state — espelha o AppState do backend.
 * B-24 (ADR-0011) — `careerLevels` saiu daqui, primeira coleção migrada
 * para seu endpoint por contexto (`careerGateway.careerLevels()`,
 * `lib/store.tsx` `useCareerLevelsByRank`).
 */
export interface AppState {
  capabilities: Capability[];
  competencies: Competency[];
  careerLevelPolicies: CareerLevelPolicy[];
  architects: Architect[];
  assessments: Assessment[];
  cycles: DevelopmentCycle[];
  plans: DevelopmentPlan[];
  learningPaths: LearningPath[];
  mentoringSessions: MentoringSession[];
  evidences: Evidence[];
  activeCycleId: string;
}

export const API_URL = (import.meta.env["VITE_API_URL"] ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);

/**
 * R2-TEC-21 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — nem todo 401 significa
 * "a sessão caiu". `INVALID_CURRENT_PASSWORD` (senha atual errada ao trocar
 * senha) e `INVALID_CREDENTIALS`/`ACCOUNT_DISABLED` (login) também são 401,
 * mas são erro de NEGÓCIO de uma requisição específica — antes desta
 * allowlist, qualquer um deles disparava `unauthorizedHandler` e deslogava
 * quem só errou a senha atual no próprio formulário de troca de senha,
 * dentro de uma sessão perfeitamente válida. Allowlist (não denylist) é
 * deliberado: só os códigos abaixo, todos emitidos por
 * `auth/plugin.ts#requireAuth`, de fato significam "o cookie de sessão não
 * autentica mais" — qualquer 401 de rota de negócio fica de fora por
 * padrão, mesmo que um código novo apareça no futuro. Lógica intocada por
 * OO-FE-01 — só mudou de arquivo.
 */
const SESSION_INVALIDATING_CODES = new Set([
  "AUTHENTICATION_REQUIRED",
  "SESSION_INVALID",
  "SESSION_REVOKED",
]);

/**
 * OO-FE-01 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, Anexo F.6) — a infra de
 * fetch que antes vivia solta em `api.ts` (função `request`/`requestBlob`,
 * `let unauthorizedHandler` de módulo, `API_URL` de módulo) agora é uma
 * classe: `baseUrl` é parâmetro de construtor (com default que lê
 * `VITE_API_URL` sozinho, então uma instância default ainda se constrói
 * sem argumento nenhum — `gateways/container.ts` é quem faz isso) e
 * `unauthorizedHandler` é campo de instância em vez de `let` de módulo.
 *
 * Honestidade sobre o que isto resolve e o que não resolve, porque é fácil
 * vender demais: isto é estado mutável ESCOPADO À INSTÂNCIA, não um DI sem
 * estado nem um `onUnauthorized(code)` passado no construtor (o texto do
 * backlog especula essa forma; não foi o que ficou mais simples aqui sem
 * mudar comportamento) — `setUnauthorizedHandler` continua reatribuindo um
 * campo depois do objeto já construído, chamado de dentro de um
 * `useEffect` (`auth.tsx`, register no mount / unregister no unmount),
 * exatamente como antes. O ganho real de OO-FE-01 é outro: o campo não é
 * mais um `let` de MÓDULO compartilhado por toda a aplicação e por todo
 * teste que importa `api.ts` — é um campo de UMA instância de `ApiClient`,
 * então um teste pode construir a sua própria instância isolada sem pisar
 * no singleton usado pelo app (nenhum teste faz isso ainda nesta leva —
 * `api.test.ts`/`api.integration.test.ts`/`auth-401-global.test.tsx`
 * continuam batendo no singleton padrão via `api.ts`/`gateways/container.ts`
 * — mas o ponto de extensão passou a existir).
 */
export class ApiClient {
  private unauthorizedHandler: (() => void) | null = null;

  constructor(private readonly baseUrl: string = API_URL) {}

  setUnauthorizedHandler(handler: (() => void) | null): void {
    this.unauthorizedHandler = handler;
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    // Sem corpo não vai content-type: o Fastify tenta parsear o JSON ausente e
    // responde 400 (FST_ERR_CTP_EMPTY_JSON_BODY), quebrando todo DELETE.
    const headers: Record<string, string> = {
      ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };

    // ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 24 — sessão vive num cookie
    // HttpOnly, não em localStorage/JS. `credentials: "include"` é o que faz o
    // browser anexar esse cookie em requisição cross-port (localhost:5175 →
    // localhost:4000 é cross-origin do ponto de vista do fetch, mesmo "same
    // site"); sem isto o cookie simplesmente não sai, mesmo já gravado.
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        details?: unknown;
        code?: string;
        correlationId?: string;
      } | null;
      if (response.status === 401 && body?.code && SESSION_INVALIDATING_CODES.has(body.code)) {
        this.unauthorizedHandler?.();
      }
      throw new ApiError(
        body?.message ?? `${init?.method ?? "GET"} ${path} falhou (${response.status})`,
        response.status,
        body?.details,
        body?.code,
        body?.correlationId,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /**
   * ORIENTACAO-DECIMA-RODADA, Seção 71 — o PDF chega como blob, não JSON;
   * `request()` não serve aqui. Devolve o filename já resolvido do
   * `Content-Disposition` (o backend decide o nome — Seção 55 — o cliente só
   * repassa pro download).
   */
  async requestBlob(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        message?: string;
        code?: string;
        correlationId?: string;
      } | null;
      throw new ApiError(
        errorBody?.message ?? `POST ${path} falhou (${response.status})`,
        response.status,
        undefined,
        errorBody?.code,
        errorBody?.correlationId,
      );
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    return { blob: await response.blob(), filename: match?.[1] ?? "relatorio.pdf" };
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }
  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }
  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  }
  del<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  /**
   * B-11 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-10) — único
   * ponto do app que valida a resposta em runtime (`appStateSchema`, gerado
   * à mão a partir de `AppState`/`domain.ts`) em vez de um cast puro. Falha
   * de validação joga um `ZodError`, que `useQuery` (`store.tsx`) já trata
   * como qualquer outro erro de rede — drift vira erro visível, não
   * `undefined` se propagando silenciosamente pela UI.
   *
   * R2-TEC-20 — `architect.role` no schema é `z.string()`, mais largo que
   * `RoleName` (`AppState`/`domain.ts`): validar de propósito não exclui um
   * nome de cargo desconhecido (criar um 4º nível de carreira, já
   * documentado como cenário esperado em ADR-0002, não pode derrubar o
   * app inteiro em `ConnectionError` por causa disto). O `as AppState`
   * aqui é a fronteira deliberada desse afrouxamento: o restante do app
   * continua tratando `role` como `RoleName` (os 3 nomes conhecidos são o
   * caso comum) — só deixou de ser uma garantia de RUNTIME.
   *
   * OO-FE-01/F.6 — fica na classe `ApiClient`, não em nenhum gateway por
   * contexto: `/api/state` é o agregador BFF que o strangler fig do R1-P04
   * está desmontando peça por peça, atravessa as 11 coleções do
   * `AppState`, e não pertence a um único contexto.
   */
  getState(): Promise<AppState> {
    return this.request<AppState>("/api/state").then(
      (data) => appStateSchema.parse(data) as AppState,
    );
  }
}
