import * as Sentry from "@sentry/node";

/**
 * R1-P05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, completa B-27) — captura de
 * erro do lado SERVIDOR do próprio frontend (SSR do TanStack Start,
 * `start.ts`), não da API. Mesmo DSN/GlitchTip do backend Fastify, SDK Node
 * porque este código roda em Node, nunca no navegador — `error-tracking.
 * client.ts` é o par para o lado do navegador.
 *
 * `VITE_SENTRY_DSN` vazio (default) deixa `init` inerte: `captureException`
 * vira no-op seguro, sem `if` condicional espalhado pelo resto do código.
 */
export function initErrorTrackingServer(): void {
  Sentry.init({
    dsn: import.meta.env["VITE_SENTRY_DSN"] || undefined,
    environment: import.meta.env["VITE_SENTRY_ENVIRONMENT"] || "development",
  });
}

export { Sentry };
