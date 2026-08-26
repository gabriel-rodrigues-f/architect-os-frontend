import * as Sentry from "@sentry/browser";

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
