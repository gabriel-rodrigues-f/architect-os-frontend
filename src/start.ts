import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { API_URL } from "./lib/api-client";
import { renderErrorPage } from "./lib/error-page";

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

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/*
 * SEC-APP-006 — A ORIGEM QUE SERVE HTML SE DEFENDE SOZINHA.
 *
 * Até aqui o pipeline do servidor era `errorMiddleware` + `csrfMiddleware`, e
 * mais nada: medido no build de produção (`node .output/server/index.mjs`), o
 * `GET /` devolvia só `content-type` e `date`. O `@fastify/helmet` do backend
 * protege as respostas da API — não a PÁGINA, que é servida por este processo.
 * Consequência: qualquer site punha a aplicação num iframe (clickjacking sobre
 * ações destrutivas), a primeira visita podia cair em http, e um XSS futuro
 * teria execução plena.
 *
 * A POLÍTICA FOI MEDIDA, NÃO COPIADA. O HTML servido pelo build e o CSS/JS de
 * `.output/public/assets` foram lidos antes de escrever cada diretiva:
 *
 *   - a folha de estilo do app e todos os módulos saem da própria origem;
 *   - `src/routes/__root.tsx` pede a folha do Google Fonts e, por ela, os
 *     arquivos `.woff2` do gstatic — daí `style-src`/`font-src`;
 *   - o CSS gerado não tem UM `url(` sequer: nenhuma imagem, nenhuma fonte
 *     embutida em `data:`. Por isso não há `img-src` frouxo aqui; `default-src
 *     'self'` cobre imagem, e o dia que entrar um `data:` a diretiva é
 *     ampliada de propósito, não por engano;
 *   - a aplicação não tem iframe, `eval`, worker nem `window.open`.
 *
 * As DUAS frestas são medidas e declaradas:
 *
 *   - `script-src 'unsafe-inline'`: o TanStack Start emite um `<script>` de
 *     hidratação embutido (`id="$tsr-stream-barrier"`) cujo conteúdo muda a
 *     cada resposta — hash não serve. O jeito certo é nonce, e o framework
 *     aceita um (`router.options.ssr.nonce`), mas isso mora em
 *     `src/router.tsx`/`__root.tsx`, que não são desta fatia. A catraca
 *     `a-pagina-se-defende` prende a decisão nos dois sentidos: enquanto não
 *     houver nonce, `'unsafe-inline'` é obrigatório; no dia que houver, o
 *     teste exige que ele saia.
 *   - `style-src 'unsafe-inline'`: medido no bundle — o `sonner` (o `<Toaster>`
 *     mora fora do portão de sessão) e o `react-remove-scroll` do Radix criam
 *     um elemento `<style>` em tempo de execução. Sem isto o aviso perde toda
 *     a aparência e o diálogo perde a trava de rolagem: seria entregar uma
 *     tela quebrada com cabeçalho bonito.
 *
 * `frame-ancestors 'none'` é o que fecha o clickjacking; `X-Frame-Options`
 * acompanha só para o navegador antigo que ignora CSP.
 */
const FOLHA_DE_ESTILO_DE_FONTE = "https://fonts.googleapis.com";
const ARQUIVO_DE_FONTE = "https://fonts.gstatic.com";

/** A origem de uma URL configurada — sem a chave, sem o caminho, e nunca o valor cru. */
function origemDe(configurado: unknown): string | undefined {
  if (typeof configurado !== "string" || configurado.trim() === "") return undefined;
  try {
    return new URL(configurado).origin;
  } catch {
    return undefined;
  }
}

/**
 * Para onde o NAVEGADOR tem permissão de falar.
 *
 * A base da API vem do MESMO `API_URL` que o cliente usa para falar com ela, e
 * não de uma segunda leitura de `VITE_API_URL` — foi assim que esta política
 * quase saiu quebrada. Medido em `vite dev`: sem variável no ambiente, o
 * cliente cai no padrão `localhost:4000` e a política, lendo a variável por
 * conta própria, tinha calculado `connect-src 'self'`; o navegador bloqueou o
 * login inteiro. Duas leituras da mesma configuração envelhecem separadas —
 * uma só não tem como divergir.
 *
 * Em produção `VITE_API_URL` é vazia (o Ingress serve API e página na mesma
 * origem, ver Dockerfile), a origem calculada é indefinida e sobra `'self'`:
 * o mais apertado possível. O DSN do rastreio de erro entra pela ORIGEM — a
 * chave que vive dentro dele não é escrita em lugar nenhum.
 */
function destinosDeDados(): readonly string[] {
  const daApi = origemDe(API_URL);
  const doRastreioDeErro = origemDe(import.meta.env["VITE_SENTRY_DSN"]);
  const destinos = ["'self'", daApi, doRastreioDeErro];
  return [...new Set(destinos.filter((destino) => destino !== undefined))];
}

export function politicaDeConteudo(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    `style-src 'self' 'unsafe-inline' ${FOLHA_DE_ESTILO_DE_FONTE}`,
    `font-src 'self' ${ARQUIVO_DE_FONTE}`,
    `connect-src ${destinosDeDados().join(" ")}`,
  ].join("; ");
}

/**
 * HSTS só sobre https, por decisão: em http o navegador IGNORA o cabeçalho, e
 * declarar segurança onde ela não existe é ruído que ninguém revisa. Atrás do
 * Ingress o TLS termina antes de nós e este processo vê http, então o
 * `x-forwarded-proto` do proxy é a única testemunha do que o navegador viu.
 * Se alguém forjar esse cabeçalho falando direto com o processo, o pior que
 * acontece é o navegador receber um HSTS por http — e ignorá-lo.
 */
function aRespostaViajaCifrada(request: Request): boolean {
  if (new URL(request.url).protocol === "https:") return true;
  const declaradoPeloProxy = request.headers.get("x-forwarded-proto") ?? "";
  return declaradoPeloProxy.split(",")[0]?.trim().toLowerCase() === "https";
}

export function cabecalhosDeSeguranca(request: Request): Readonly<Record<string, string>> {
  const cabecalhos: Record<string, string> = {
    "Content-Security-Policy": politicaDeConteudo(),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
  if (aRespostaViajaCifrada(request)) {
    cabecalhos["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return cabecalhos;
}

/**
 * Assina a resposta que vier de dentro — seja a página, seja a de erro. É uma
 * função à parte, e não o corpo do middleware, para que o teste possa fazer um
 * pedido e ler a resposta sem subir a pilha do framework inteira.
 */
export async function assinarRespostaComSeguranca<
  TResultado extends { readonly response: Response },
>(request: Request, seguir: () => Promise<TResultado> | TResultado): Promise<TResultado> {
  const resultado = await seguir();
  for (const [nome, valor] of Object.entries(cabecalhosDeSeguranca(request))) {
    resultado.response.headers.set(nome, valor);
  }
  return resultado;
}

export const securityHeadersMiddleware = createMiddleware().server(({ request, next }) =>
  assinarRespostaComSeguranca(request, next),
);

/*
 * O de segurança vem PRIMEIRO de propósito: sendo o mais externo, ele assina
 * também o que os de dentro devolvem sozinhos — a página de erro 500 do
 * `errorMiddleware` e o 403 do CSRF. Cabeçalho que só existe no caminho feliz
 * não é defesa.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware, csrfMiddleware],
}));
