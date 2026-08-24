import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

/**
 * R1-P05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, completa B-27) — `start.ts`
 * também entra no grafo de import do build CLIENTE (o plugin de proteção de
 * import do TanStack Start recusa o build se um arquivo `*.server.*` — como
 * `error-tracking.server.ts` — for alcançável estaticamente daqui). O
 * `.server()` deste middleware só roda no servidor de qualquer forma, então
 * o import dinâmico dentro dele resolve os dois problemas ao mesmo tempo:
 * nunca entra no bundle do cliente, e só carrega `@sentry/node` quando a
 * rota de erro de fato precisa dele.
 */
let errorTrackingInit: Promise<typeof import("./lib/error-tracking.server")> | null = null;

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    errorTrackingInit ??= import("./lib/error-tracking.server").then((mod) => {
      mod.initErrorTrackingServer();
      return mod;
    });
    const { Sentry } = await errorTrackingInit;
    Sentry.captureException(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
