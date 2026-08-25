/**
 * OO-FE-01 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, Anexo F.6) — extraído de
 * `api.ts` para seu próprio módulo só para quebrar um ciclo de import: o
 * novo `ApiClient` (`api-client.ts`) precisa lançar `ApiError`, e `api.ts`
 * (a fachada) importa a composição de gateways que por sua vez importa
 * `ApiClient` — se `ApiError` continuasse definida em `api.ts`,
 * `api-client.ts` teria que importar de volta de `api.ts`, fechando um
 * ciclo de valor em tempo de execução. Nenhuma mudança de comportamento:
 * mesma classe, mesmos campos, re-exportada por `api.ts` para que nenhum
 * import existente (`from "@/lib/api"` / `from "./api"`) precise mudar.
 *
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-16 (§26) — `code`
 * (estável por regra, ex. `PLAN_VERSION_CONFLICT`) e `correlationId` (id da
 * requisição, útil pra achar a linha certa no log do servidor ao investigar
 * um erro relatado) vêm do novo envelope `{code, message, details?,
 * correlationId}`. Aditivo: `.message`/`.status`/`.details` continuam
 * exatamente como antes — nenhum call site existente precisa mudar.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly code?: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
