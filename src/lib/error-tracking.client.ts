import * as Sentry from "@sentry/browser";

/**
 * R1-P05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, completa B-27) — captura de
 * erro do lado NAVEGADOR (render/loader do router, `__root.tsx`
 * `ErrorComponent`). Par de `error-tracking.server.ts`, que cobre o SSR do
 * mesmo app — os dois lados do frontend, nenhum dos dois é a API.
 *
 * `VITE_SENTRY_DSN` vazio (default) deixa `init` inerte: `captureException`
 * vira no-op seguro. `init` só roda no cliente de verdade — quem chama
 * (`__root.tsx`) já guarda com `typeof window !== "undefined"`, mas o `once`
 * aqui protege contra montagem dupla do `RootComponent` (SSR + hidratação
 * não chamam este módulo, só o client real).
 */
let initialized = false;

export function initErrorTrackingClient(): void {
  if (initialized) return;
  initialized = true;
  Sentry.init({
    dsn: import.meta.env["VITE_SENTRY_DSN"] || undefined,
    environment: import.meta.env["VITE_SENTRY_ENVIRONMENT"] || "development",
  });
}

export { Sentry };
