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
import { apiPath, isApiUrl } from "./api-path";
import { appStateSchema } from "./api-schemas";

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

const SESSION_INVALIDATING_CODES = new Set([
  "AUTHENTICATION_REQUIRED",
  "SESSION_INVALID",
  "SESSION_REVOKED",
]);

const responseMessageCodes = new WeakMap<object, string>();

export function messageCodeOf(result: unknown): string | undefined {
  return typeof result === "object" && result !== null
    ? responseMessageCodes.get(result)
    : undefined;
}

function asSuccessEnvelope(body: unknown): { data: unknown; message?: { code?: string } } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "data")) return null;
  if (Object.keys(record).some((key) => key !== "data" && key !== "message")) return null;
  return record as { data: unknown; message?: { code?: string } };
}

export class ApiClient {
  private unauthorizedHandler: (() => void) | null = null;

  constructor(private readonly baseUrl: string = API_URL) {}

  setUnauthorizedHandler(handler: (() => void) | null): void {
    this.unauthorizedHandler = handler;
  }

  urlOf(resource: string): string {
    return `${this.baseUrl}${apiPath(resource)}`;
  }

  async request<T>(resource: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };

    const url = this.urlOf(resource);
    const response = await fetch(url, {
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
        body?.message ??
          `${init?.method ?? "GET"} ${apiPath(resource)} falhou (${response.status})`,
        response.status,
        body?.details,
        body?.code,
        body?.correlationId,
      );
    }

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
    const response = await fetch(this.urlOf(resource), {
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
        errorBody?.message ?? `POST ${apiPath(resource)} falhou (${response.status})`,
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

  getState(): Promise<AppState> {
    return this.request<AppState>("/state").then((data) => appStateSchema.parse(data) as AppState);
  }
}
