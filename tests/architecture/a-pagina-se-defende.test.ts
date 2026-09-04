import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { flattenMiddlewares } from "@tanstack/react-start";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api-client";
import { renderErrorPage } from "@/lib/error-page";
import { politicaDeConteudo, startInstance } from "@/start";

/**
 * A PÁGINA QUE SERVE HTML SE DEFENDE — a catraca do SEC-APP-006.
 *
 * Medido em 2026-09-03 contra o build de produção (`node
 * .output/server/index.mjs`): `GET /` devolvia `content-type` e `date`, e mais
 * nada. Sem `frame-ancestors` nem `X-Frame-Options`, qualquer site punha o
 * Synapse num iframe e ficava com as ações destrutivas à mão; sem HSTS, a
 * primeira visita podia cair em http; sem CSP, um XSS futuro teria execução
 * plena. O `@fastify/helmet` do backend não alcança isto: ele assina as
 * respostas da API, e a PÁGINA sai deste processo.
 *
 * Por que uma catraca e não só o conserto: cabeçalho de resposta é o tipo de
 * coisa que some numa migração de servidor sem ninguém ver — a tela continua
 * desenhando igual, e a defesa simplesmente deixou de existir. Nada na tela
 * denuncia a falta.
 *
 * ONDE A PRIMEIRA VERSÃO DESTA CATRACA ERA DECORATIVA — e como ficou:
 *
 *   A revisão adversarial mediu e provou: trocar o corpo do middleware por
 *   `({ next }) => next()` deixava os 9 testes VERDES com o servidor entregando
 *   zero cabeçalho. O motivo é que os testes chamavam uma função auxiliar, e do
 *   middleware de verdade só conferiam identidade de referência. A auxiliar
 *   morreu. Agora todo pedido daqui atravessa a CADEIA REGISTRADA — os mesmos
 *   objetos de `startInstance.getOptions()`, achatados pelo `flattenMiddlewares`
 *   do próprio framework e executados na mesma ordem, com o mesmo contrato de
 *   `next()`. Uma mutação no middleware faz esta suíte vermelha.
 *
 * ATÉ ONDE ESTA PROVA VAI, DITO SEM ARREDONDAR: ela cobre a CADEIA, não o
 * soquete. O `vitest.config.ts` não carrega o plugin do TanStack Start (por
 * decisão anterior a esta fatia), então os módulos virtuais
 * `#tanstack-router-entry`/`#tanstack-start-entry` que o `createStartHandler`
 * importa não existem aqui: subir o servidor de verdade dentro do gate exigiria
 * um `vite build` a cada rodada. O que falta é o transporte HTTP, e ele está
 * coberto fora do gate, sobre o app rodando: `e2e/a-pagina-se-defende.spec.ts`
 * faz um GET real e lê os cabeçalhos do fio.
 *
 * A régua tem duas metades, e a segunda é tão importante quanto a primeira:
 *
 *   1. A PRESENÇA E O VALOR de cada cabeçalho numa resposta de verdade.
 *   2. Que a política libera EXATAMENTE o que a aplicação carrega. CSP que
 *      quebra a tela é revertida na segunda-feira, e uma política revertida
 *      não defende ninguém; por isso as origens externas são conferidas
 *      contra a casca (`src/routes/__root.tsx`) e o destino de dados contra o
 *      mesmo `API_URL` que o cliente usa — se a casca passar a carregar de
 *      outro lugar, este teste fica vermelho ANTES de a tela quebrar.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A entrada de SSR que `src/server.ts` embrulha, no lugar da de verdade. */
const entradaDeSsr = vi.hoisted(() => ({
  responder: undefined as ((request: Request) => Promise<Response> | Response) | undefined,
}));

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: (request: Request) => {
      if (!entradaDeSsr.responder) throw new Error("nenhuma resposta de SSR combinada no teste");
      return entradaDeSsr.responder(request);
    },
  },
}));

vi.mock("@/lib/error-tracking.server", () => ({
  initErrorTrackingServer: () => {},
  Sentry: { captureException: () => {} },
}));

beforeEach(() => {
  // O `errorMiddleware` e o `catch` de `src/server.ts` registram o erro; sem
  // isto a saída da suíte vira uma pilha de rastreios de erro provocados.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function fonteDe(arquivo: string): string {
  return readFileSync(join(RAIZ, arquivo), "utf8");
}

/** O texto sem comentário: a palavra citada numa explicação não é código. */
function semComentario(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

type ContextoDaCadeia = {
  request: Request;
  pathname: string;
  handlerType: "router" | "serverFn";
  context: Record<string, unknown>;
  response: Response | undefined;
};

type MiddlewareDoServidor = (
  ctx: ContextoDaCadeia & {
    next: (parcial?: Partial<ContextoDaCadeia>) => Promise<ContextoDaCadeia>;
  },
) => Promise<ContextoDaCadeia | Response> | ContextoDaCadeia | Response;

type MiddlewareRegistrado = { readonly options: { readonly server?: unknown } };

/**
 * O achatador do próprio framework, só re-tipado.
 *
 * O tipo publicado de `flattenMiddlewares` é genérico a ponto de inferir
 * `never[]` para a lista congelada de `requestMiddleware`; a FUNÇÃO é a mesma
 * que o `createStartHandler` chama, e é dela que este teste depende. Escrever a
 * ordem à mão aqui seria fazer o teste concordar consigo mesmo.
 */
const achatarCadeia = flattenMiddlewares as unknown as (
  middlewares: readonly MiddlewareRegistrado[],
) => readonly MiddlewareRegistrado[];

/**
 * Executa a cadeia REGISTRADA em `src/start.ts`, na ordem registrada.
 *
 * Não é uma cópia da lista: é `startInstance.getOptions().requestMiddleware`
 * passando pelo `flattenMiddlewares` do framework, e cada `options.server`
 * recebe o mesmo contrato que `createStartHandler` lhe dá — `request`,
 * `pathname`, `handlerType`, `context` e um `next` que devolve o contexto com a
 * resposta de dentro. Middleware que devolve `Response` crua (é o que o
 * `errorMiddleware` e o do CSRF fazem) vale como resposta, igual lá.
 */
async function executarPipelineDoServidor(pedido: {
  readonly request: Request;
  readonly handlerType?: "router" | "serverFn";
  readonly handler?: () => Promise<Response> | Response;
}): Promise<Response> {
  const { requestMiddleware } = await startInstance.getOptions();
  const registrados = (requestMiddleware ?? []) as readonly MiddlewareRegistrado[];
  const daCadeia = achatarCadeia(registrados).map(
    (middleware) => middleware.options.server as MiddlewareDoServidor,
  );
  const handler =
    pedido.handler ??
    (() =>
      new Response('<!doctype html><html lang="pt"><body></body></html>', {
        headers: { "content-type": "text/html; charset=utf-8" },
      }));

  const ctx: ContextoDaCadeia = {
    request: pedido.request,
    pathname: new URL(pedido.request.url).pathname,
    handlerType: pedido.handlerType ?? "router",
    context: {},
    response: undefined,
  };

  let indice = -1;
  const next = async (parcial?: Partial<ContextoDaCadeia>): Promise<ContextoDaCadeia> => {
    if (parcial) Object.assign(ctx, parcial);
    indice += 1;
    const middleware = daCadeia[indice];
    if (!middleware) {
      ctx.response = await handler();
      return ctx;
    }
    const resultado = await middleware({ ...ctx, next });
    if (resultado instanceof Response) ctx.response = resultado;
    else if (resultado.response !== undefined) ctx.response = resultado.response;
    return ctx;
  };

  await next();
  if (!ctx.response) throw new Error("a cadeia não produziu resposta");
  return ctx.response;
}

/** Um pedido de página, como o navegador faz, atravessando o pipeline inteiro. */
function respostaDaPagina(
  url = "https://synapse.exemplo/",
  cabecalhosDoPedido: Record<string, string> = {},
): Promise<Response> {
  return executarPipelineDoServidor({
    request: new Request(url, { headers: cabecalhosDoPedido }),
  });
}

/** A política COMO O NAVEGADOR A RECEBE — lida do cabeçalho, não da função. */
async function politicaServida(): Promise<string> {
  const politica = (await respostaDaPagina()).headers.get("Content-Security-Policy");
  if (politica === null) throw new Error("a resposta saiu sem Content-Security-Policy");
  return politica;
}

/** As fontes de uma diretiva, por nome. */
function diretivaDe(politica: string, nome: string): readonly string[] {
  const encontrada = politica
    .split(";")
    .map((parte) => parte.trim())
    .find((parte) => parte === nome || parte.startsWith(`${nome} `));
  if (encontrada === undefined) return [];
  return encontrada.split(/\s+/).slice(1);
}

async function diretivaServida(nome: string): Promise<readonly string[]> {
  return diretivaDe(await politicaServida(), nome);
}

/** A origem aponta para a máquina de quem abre a página, não para um servidor nosso. */
function ehDaMaquinaDeQuemAbre(origem: string): boolean {
  try {
    const { hostname } = new URL(origem);
    return (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

/** As origens externas que a casca manda o navegador carregar. */
function origensExternasDaCasca(): readonly string[] {
  const casca = fonteDe(join("src", "routes", "__root.tsx"));
  const achadas = casca.match(/https:\/\/[^"'\s)]+/g) ?? [];
  return [...new Set(achadas.map((endereco) => new URL(endereco).origin))];
}

describe("a origem que serve HTML manda cabeçalho de segurança (SEC-APP-006)", () => {
  it("a resposta da página traz cada cabeçalho, com o valor", async () => {
    const resposta = await respostaDaPagina();

    expect(resposta.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(resposta.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(resposta.headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(resposta.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    // A página carrega sessão: quem abrir uma janela nossa não fica com a mão nela.
    expect(resposta.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    // O valor conferido contra o LITERAL, e não contra a função que o produziu:
    // comparar o cabeçalho com `politicaDeConteudo()` passaria até com `default-src *`.
    const politica = resposta.headers.get("Content-Security-Policy") ?? "";
    expect(politica).toContain("default-src 'self'");
    expect(politica).toContain("frame-ancestors 'none'");
    expect(politica).toContain("object-src 'none'");
  });

  it("ninguém põe o Synapse dentro de um iframe", async () => {
    const resposta = await respostaDaPagina();

    expect(diretivaDe(await politicaServida(), "frame-ancestors")).toEqual(["'none'"]);
    // O navegador que ainda não lê `frame-ancestors` lê este:
    expect(resposta.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("HSTS só quando a resposta viaja cifrada — em http o navegador o ignoraria", async () => {
    const cifrada = await respostaDaPagina("https://synapse.exemplo/");
    const aberta = await respostaDaPagina("http://localhost:3000/");
    const atrasDoProxy = await respostaDaPagina("http://localhost:3000/", {
      "x-forwarded-proto": "https",
    });

    expect(cifrada.headers.get("Strict-Transport-Security")).not.toBeNull();
    expect(aberta.headers.get("Strict-Transport-Security")).toBeNull();
    // Atrás do Ingress o TLS termina antes de nós: quem viu o https foi o proxy.
    expect(atrasDoProxy.headers.get("Strict-Transport-Security")).not.toBeNull();
  });

  it("os outros cabeçalhos valem também para a resposta que sai por http", async () => {
    const aberta = await respostaDaPagina("http://localhost:3000/");

    expect(aberta.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(aberta.headers.get("X-Frame-Options")).toBe("DENY");
    expect(aberta.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

/**
 * O middleware é o mais externo por decisão, e a decisão só vale se ele
 * alcançar o que os de dentro devolvem SOZINHOS. Isto aqui não confere posição
 * numa lista: faz o de dentro devolver sozinho e lê o cabeçalho do que saiu.
 */
describe("o mais externo assina até o que os de dentro devolvem sozinhos", () => {
  it("a página de erro 500, que o middleware de erro constrói, sai assinada", async () => {
    const resposta = await executarPipelineDoServidor({
      request: new Request("https://synapse.exemplo/"),
      handler: () => {
        throw new Error("o SSR caiu");
      },
    });

    expect(resposta.status).toBe(500);
    expect(resposta.headers.get("content-type")).toContain("text/html");
    expect(resposta.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(resposta.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("a recusa 403 do CSRF, que nem chega ao handler, sai assinada", async () => {
    const resposta = await executarPipelineDoServidor({
      request: new Request("https://synapse.exemplo/_serverFn/qualquer", {
        method: "POST",
        headers: { "Sec-Fetch-Site": "cross-site" },
      }),
      handlerType: "serverFn",
      handler: () => {
        throw new Error("o CSRF deixou passar um pedido cross-site");
      },
    });

    expect(resposta.status).toBe(403);
    expect(resposta.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(resposta.headers.get("X-Frame-Options")).toBe("DENY");
  });
});

/**
 * `src/server.ts` é a entrada do processo, e ela tem caminhos que NÃO passam
 * pelo pipeline: a normalização catastrófica descarta a resposta do handler
 * (levando os cabeçalhos junto), o `catch` externo está fora do start handler
 * inteiro, e o 308 do `getNormalizedURL` é emitido antes do pipeline. Aqui a
 * entrada de verdade é exercitada com o SSR trocado — é o arquivo de produção
 * rodando, não uma imitação dele.
 */
describe("a entrada do processo assina o que o pipeline não alcança", () => {
  async function respostaDaEntrada(
    responder: (request: Request) => Promise<Response> | Response,
    url = "https://synapse.exemplo/",
  ): Promise<Response> {
    entradaDeSsr.responder = responder;
    const entrada = (await import("@/server")).default;
    return entrada.fetch(new Request(url), undefined, undefined);
  }

  it("a página de erro do catch externo — fora do pipeline por construção — sai assinada", async () => {
    const resposta = await respostaDaEntrada(() => {
      throw new Error("a entrada de SSR nem carregou");
    });

    expect(resposta.status).toBe(500);
    expect(resposta.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(resposta.headers.get("X-Frame-Options")).toBe("DENY");
    expect(resposta.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("a página de erro que substitui o 500 engolido pelo h3 sai assinada", async () => {
    const resposta = await respostaDaEntrada(
      () =>
        new Response(JSON.stringify({ unhandled: true, message: "HTTPError" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );

    expect(resposta.status).toBe(500);
    expect(await resposta.text()).toContain("Esta página não carregou");
    expect(resposta.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(resposta.headers.get("X-Frame-Options")).toBe("DENY");
  });

  /**
   * `Response.redirect()` — que é como o `getNormalizedURL` do framework emite o
   * 308 — devolve cabeçalho IMUTÁVEL por especificação. A primeira versão desta
   * assinatura só fazia `headers.set`, e o `TypeError: immutable` caía no
   * `catch` externo: o redirecionamento virava página de erro 500. Medido no
   * build de produção antes do conserto. Por isso o teste usa
   * `Response.redirect` e não um `new Response(...)` de cabeçalho mole — com o
   * mole ele passava e o servidor de verdade quebrava.
   */
  it("o redirecionamento imutável do framework sai assinado E continua redirecionando", async () => {
    const resposta = await respostaDaEntrada(() =>
      Response.redirect("https://synapse.exemplo/x", 308),
    );

    expect(resposta.status).toBe(308);
    expect(resposta.headers.get("location")).toBe("https://synapse.exemplo/x");
    expect(resposta.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(resposta.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("a política libera exatamente o que a página carrega", () => {
  it("o miolo é fechado: tudo da própria origem, e nenhum curinga", async () => {
    const politica = await politicaServida();

    expect(diretivaDe(politica, "default-src")).toEqual(["'self'"]);
    expect(diretivaDe(politica, "base-uri")).toEqual(["'self'"]);
    expect(diretivaDe(politica, "object-src")).toEqual(["'none'"]);
    expect(diretivaDe(politica, "form-action")).toEqual(["'self'"]);
    expect(politica).not.toContain("*");
  });

  it("nenhuma fonte frouxa entra por diretiva nenhuma depois", async () => {
    const politica = await politicaServida();

    // `'unsafe-eval'` devolve a execução de string que `object-src`/`default-src`
    // tiraram; `data:` em script transforma qualquer injeção de atributo em
    // execução; `http:` desfaz o transporte que o HSTS acabou de exigir.
    expect(politica).not.toContain("'unsafe-eval'");
    for (const fonte of diretivaDe(politica, "script-src")) {
      expect(["'self'", "'unsafe-inline'"].includes(fonte) || fonte.startsWith("https://")).toBe(
        true,
      );
    }
    for (const destino of diretivaDe(politica, "connect-src")) {
      expect(
        destino === "'self'" || !destino.startsWith("http://") || ehDaMaquinaDeQuemAbre(destino),
      ).toBe(true);
    }
  });

  it("toda origem externa que a casca carrega está liberada — e na diretiva certa", async () => {
    const politica = await politicaServida();

    for (const origem of origensExternasDaCasca()) {
      expect(politica).toContain(origem);
    }
    // A casca pede a folha do Google Fonts, e a folha busca o arquivo no gstatic.
    expect(diretivaDe(politica, "style-src")).toContain("https://fonts.googleapis.com");
    expect(diretivaDe(politica, "font-src")).toContain("https://fonts.gstatic.com");
  });

  it("o destino de dados é a origem para onde o cliente realmente fala", async () => {
    const destinos = await diretivaServida("connect-src");

    expect(destinos).toContain("'self'");
    if (API_URL !== "" && !ehDaMaquinaDeQuemAbre(API_URL)) {
      // Duas leituras da mesma configuração envelhecem separadas: a política
      // pergunta ao mesmo `API_URL` do cliente, e não à variável de ambiente.
      expect(destinos).toContain(new URL(API_URL).origin);
    }
  });

  /**
   * Medido no build de 03/09: o Vite congela `import.meta.env` num literal, e um
   * build sem `--build-arg VITE_API_URL` não tem a chave — `API_URL` caía no
   * padrão de desenvolvimento e a política PUBLICADA dizia
   * `connect-src 'self' http://localhost:4000`, anunciando a topologia de
   * desenvolvimento e alargando a permissão para a máquina de quem abre. Saía
   * verde: o teste antigo EXIGIA esse destino sempre que a variável faltasse.
   */
  it("um build de produção não publica a topologia de desenvolvimento", () => {
    const emProducao = diretivaDe(politicaDeConteudo({ buildDeProducao: true }), "connect-src");

    expect(emProducao.some(ehDaMaquinaDeQuemAbre)).toBe(false);
    expect(emProducao).toContain("'self'");
  });

  it("em desenvolvimento a política continua deixando o cliente falar com a API local", () => {
    if (!ehDaMaquinaDeQuemAbre(API_URL)) return;
    const emDesenvolvimento = diretivaDe(
      politicaDeConteudo({ buildDeProducao: false }),
      "connect-src",
    );

    // Apertar isto aqui deixaria o login sem rede em `vite dev` — CSP que quebra
    // a tela é revertida na segunda-feira, e política revertida não defende.
    expect(emDesenvolvimento).toContain(new URL(API_URL).origin);
  });

  it("enquanto o SSR não assinar o script embutido, a política precisa aceitá-lo", async () => {
    // O TanStack Start emite um `<script>` de hidratação embutido cujo conteúdo
    // muda a cada resposta — hash não serve. O jeito certo é nonce, e o
    // framework aceita um em `router.options.ssr.nonce`. Enquanto
    // `src/router.tsx` não der esse nonce, tirar `'unsafe-inline'` daqui deixa
    // a tela em branco; no dia que der, esta linha exige que ele saia.
    //
    // A leitura ignora comentário de propósito: a palavra "nonce" escrita numa
    // explicação não assina script nenhum, e viraria a catraca com a suíte
    // vermelha por um motivo que ninguém entenderia.
    const oSsrAssinaOScript = /\bnonce\s*:/.test(semComentario(fonteDe(join("src", "router.tsx"))));

    expect((await diretivaServida("script-src")).includes("'unsafe-inline'")).toBe(
      !oSsrAssinaOScript,
    );
  });

  /**
   * O dia do aperto não pode matar nada calado. `nonce` autoriza `<script>` com
   * o atributo, e NÃO autoriza manipulador embutido (`onclick`) — isso pediria
   * `'unsafe-hashes'`. A página de erro tinha um, e ninguém a cobria: o botão
   * "Tentar novamente" morreria sem barulho no dia em que `'unsafe-inline'`
   * saísse do `script-src`. Virou link.
   */
  it("o HTML que este processo serve não depende de script embutido", () => {
    const pagina = renderErrorPage();

    expect(pagina).not.toContain("<script");
    expect(pagina).not.toMatch(/\son[a-z]+\s*=/i);
    // E continua oferecendo a saída: recarregar sem script é um link para a própria URL.
    expect(pagina).toContain("Tentar novamente");
  });
});
