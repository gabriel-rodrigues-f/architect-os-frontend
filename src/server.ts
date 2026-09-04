import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { cabecalhosDeSeguranca } from "./start";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * A ASSINATURA DE SEGURANÇA TAMBÉM AQUI, E NÃO SÓ NO MIDDLEWARE (SEC-APP-006).
 *
 * O `securityHeadersMiddleware` de `src/start.ts` é o primeiro do pipeline e
 * assina tudo que passa por ele. Só que TRÊS respostas deste mesmo processo
 * nunca chegam lá:
 *
 *   - a que `normalizeCatastrophicSsrResponse` CONSTRÓI (ela descarta a
 *     resposta do handler, e com ela os cabeçalhos recém-postos);
 *   - a do `catch` externo, que está fora do start handler inteiro;
 *   - o 308 do `getNormalizedURL`, emitido pelo framework ANTES do pipeline
 *     (medido: `curl --path-as-is 'http://.../\/x'` saía sem um cabeçalho).
 *
 * Duas delas servem HTML. Assinar no ponto mais externo — aqui, onde toda
 * resposta deste processo passa — é o que faz a garantia valer para as três, e
 * é o que sobrevive a uma migração de servidor que largue o middleware pelo
 * caminho. `set` (não `append`) torna a dupla assinatura idempotente.
 *
 * O CAMINHO DE RECONSTRUÇÃO NÃO É PRECAUÇÃO, É CONSERTO DE BUG MEDIDO. A
 * primeira versão só fazia `headers.set` e derrubou o redirecionamento: quem
 * nasce de `Response.redirect()` tem os cabeçalhos IMUTÁVEIS pela especificação,
 * `set` lança `TypeError: immutable`, o `catch` de baixo transformava o 308 numa
 * página de erro 500 — medido em `node .output/server/index.mjs`, `curl
 * --path-as-is 'http://127.0.0.1:3198//x'`. Congelado é só o cabeçalho, não a
 * resposta: reconstruir com o mesmo corpo e o mesmo status assina sem mentir. O
 * `TypeError` é o único erro que esse `set` produz com nome de cabeçalho válido
 * (e os nomes aqui são constantes nossas); qualquer outro sobe.
 */
function assinada(request: Request, response: Response): Response {
  const seguranca = Object.entries(cabecalhosDeSeguranca(request));
  try {
    for (const [nome, valor] of seguranca) response.headers.set(nome, valor);
    return response;
  } catch (erro) {
    if (!(erro instanceof TypeError)) throw erro;
    const cabecalhos = new Headers(response.headers);
    for (const [nome, valor] of seguranca) cabecalhos.set(nome, valor);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: cabecalhos,
    });
  }
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return assinada(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return assinada(
        request,
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
