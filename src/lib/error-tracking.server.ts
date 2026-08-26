import * as Sentry from "@sentry/node";

export function initErrorTrackingServer(): void {
  Sentry.init({
    dsn: import.meta.env["VITE_SENTRY_DSN"] || undefined,
    environment: import.meta.env["VITE_SENTRY_ENVIRONMENT"] || "development",
  });
}

export { Sentry };
