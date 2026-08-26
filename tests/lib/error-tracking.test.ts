import { describe, expect, it } from "vitest";

import { initErrorTrackingClient, Sentry as SentryClient } from "../error-tracking.client";

/**
 * R1-P05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, completa B-27) — a garantia
 * central é que rodar sem GlitchTip configurado (VITE_SENTRY_DSN vazio, o
 * default) nunca quebra o app nem o caminho de erro — captura vira no-op
 * silencioso, não uma dependência nova. Só o lado cliente é testável aqui
 * (`@sentry/node`, usado em error-tracking.server.ts, não roda em jsdom).
 */
describe("error-tracking.client — no-op seguro sem VITE_SENTRY_DSN configurado", () => {
  it("initErrorTrackingClient() não lança com DSN vazio (default)", () => {
    expect(() => initErrorTrackingClient()).not.toThrow();
  });

  it("chamar de novo é idempotente — não reinicializa nem lança", () => {
    initErrorTrackingClient();
    expect(() => initErrorTrackingClient()).not.toThrow();
  });

  it("captureException não lança mesmo sem DSN — nunca derruba quem a chama", () => {
    expect(() => SentryClient.captureException(new Error("erro de teste"))).not.toThrow();
  });
});
