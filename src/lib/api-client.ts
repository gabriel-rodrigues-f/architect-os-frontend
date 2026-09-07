import type {
  Architect,
  Assessment,
  Capability,
  Competency,
  DevelopmentCycle,
  DevelopmentPlan,
  Evidence,
  LearningPath,
  MentoringSession,
  TeamLevelRule,
} from "./domain";
import { ApiError } from "./api-errors";
import { ApiFailureReading } from "./api-failure-reading";
import { apiPath, isApiUrl } from "./api-path";

export interface AppState {
  capabilities: Capability[];
  competencies: Competency[];
  teamLevelRules: TeamLevelRule[];
  architects: Architect[];
  assessments: Assessment[];
  cycles: DevelopmentCycle[];
  plans: DevelopmentPlan[];
  learningPaths: LearningPath[];
  mentoringSessions: MentoringSession[];
  evidences: Evidence[];
  activeCycleId: string;
}

const rawApiUrl: unknown = import.meta.env["VITE_API_URL"];

export const API_URL = (
  typeof rawApiUrl === "string" ? rawApiUrl : "http://localhost:4000"
).replace(/\/$/, "");

const NETWORK_UNAVAILABLE_STATUS = ApiFailureReading.SEM_RESPOSTA_STATUS;

export const NETWORK_UNAVAILABLE_CODE = "NETWORK_UNAVAILABLE";

export type ApiFailureInterceptor = (error: ApiError) => void;

/**
 * O RESULTADO de uma requisição, como o cliente o viu: método, recurso e
 * status (0 quando o `fetch` rejeitou). É o que a rede de sinapses recebe para
 * decidir o tom do pulso (`SynapseOutcomeRule`) — o cliente é o funil de TODAS
 * as escritas, então é o único ponto de anúncio.
 */
export interface ApiOutcome {
  readonly method: string;
  readonly resource: string;
  readonly status: number;
}

export type ApiOutcomeInterceptor = (outcome: ApiOutcome) => void;

/**
 * Os cabeçalhos que UMA requisição leva além dos seus — decididos pelo
 * recurso, requisição a requisição ([FA-07]: o passe de suporte só vai nas
 * requisições sobre a pessoa do passe, nunca em toda requisição da aba).
 */
export type HeaderProvider = (resource: string) => Record<string, string>;

export interface ApiErrorBody {
  message?: string;
  details?: unknown;
  code?: string;
  correlationId?: string;
}

const responseMessageCodes = new WeakMap<object, string>();

export function networkUnavailableError(cause: unknown): ApiError {
  return new ApiError(
    ApiFailureReading.of(NETWORK_UNAVAILABLE_STATUS).sentence,
    NETWORK_UNAVAILABLE_STATUS,
    undefined,
    NETWORK_UNAVAILABLE_CODE,
    undefined,
    { cause },
  );
}

/**
 * Quando o serviço manda frase, a frase é dele; quando não manda, a frase vem
 * da SITUAÇÃO (`ApiFailureReading`) — nunca de verbo, caminho e status
 * remontados. Por isso não existe mais parâmetro `fallbackMessage`: quem
 * chamava tinha de inventar a frase, e dez chamadas inventaram a técnica.
 */
export function apiFailureOf(body: ApiErrorBody | null, status: number): ApiError {
  return new ApiError(
    body?.message ?? ApiFailureReading.of(status).sentence,
    status,
    body?.details,
    body?.code,
    body?.correlationId,
  );
}

export function messageCodeOf(result: unknown): string | undefined {
  return typeof result === "object" && result !== null
    ? responseMessageCodes.get(result)
    : undefined;
}

export function asSuccessEnvelope(
  body: unknown,
): { data: unknown; message?: { code?: string } } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "data")) return null;
  if (Object.keys(record).some((key) => key !== "data" && key !== "message")) return null;
  return record as { data: unknown; message?: { code?: string } };
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string = API_URL,
    private readonly interceptFailure: ApiFailureInterceptor = () => {},
    private readonly headersFor: HeaderProvider = () => ({}),
    private readonly observeOutcome: ApiOutcomeInterceptor = () => {},
  ) {}

  urlOf(resource: string): string {
    return `${this.baseUrl}${apiPath(resource)}`;
  }

  private intercepted(error: ApiError): ApiError {
    this.interceptFailure(error);
    return error;
  }

  private async send(resource: string, init: RequestInit): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    try {
      const response = await fetch(this.urlOf(resource), init);
      this.observeOutcome({ method, resource, status: response.status });
      return response;
    } catch (cause) {
      this.observeOutcome({ method, resource, status: NETWORK_UNAVAILABLE_STATUS });
      throw this.intercepted(networkUnavailableError(cause));
    }
  }

  private async failureOf(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    return this.intercepted(apiFailureOf(body, response.status));
  }

  async request<T>(resource: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
      ...this.headersFor(resource),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };

    const url = this.urlOf(resource);
    const response = await this.send(resource, {
      ...init,
      headers,
      credentials: "include",
    });

    if (!response.ok) throw await this.failureOf(response);

    if (response.status === 204) return undefined as T;
    const body: unknown = await response.json();
    if (!isApiUrl(url)) return body as T;
    const envelope = asSuccessEnvelope(body);
    if (!envelope) return body as T;
    const code = envelope.message?.code;
    if (code !== undefined && typeof envelope.data === "object" && envelope.data !== null) {
      responseMessageCodes.set(envelope.data, code);
    }
    return envelope.data as T;
  }

  async requestBlob(resource: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
    const response = await this.send(resource, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await this.failureOf(response);
    const disposition = response.headers.get("content-disposition") ?? "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    return { blob: await response.blob(), filename: match?.[1] ?? "relatorio.pdf" };
  }

  post<T>(resource: string, body: unknown): Promise<T> {
    return this.request<T>(resource, { method: "POST", body: JSON.stringify(body) });
  }
  patch<T>(resource: string, body: unknown): Promise<T> {
    return this.request<T>(resource, { method: "PATCH", body: JSON.stringify(body) });
  }
  put<T>(resource: string, body: unknown): Promise<T> {
    return this.request<T>(resource, { method: "PUT", body: JSON.stringify(body) });
  }
  del<T>(resource: string): Promise<T> {
    return this.request<T>(resource, { method: "DELETE" });
  }
}
