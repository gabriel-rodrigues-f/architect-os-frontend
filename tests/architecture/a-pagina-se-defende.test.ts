import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { API_URL } from "@/lib/api-client";
import {
  assinarRespostaComSeguranca,
  politicaDeConteudo,
  securityHeadersMiddleware,
  startInstance,
} from "@/start";

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

function fonteDe(arquivo: string): string {
  return readFileSync(join(RAIZ, arquivo), "utf8");
}

/**
 * Um pedido de página, como o navegador faz, e a resposta que o servidor
 * devolve — passando pela mesma função que o middleware registrado usa.
 */
async function respostaDaPagina(
  url = "https://synapse.exemplo/",
  cabecalhosDoPedido: Record<string, string> = {},
): Promise<Response> {
  const pedido = new Request(url, { headers: cabecalhosDoPedido });
  const { response } = await assinarRespostaComSeguranca(pedido, () => ({
    response: new Response('<!doctype html><html lang="pt"><body></body></html>', {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  }));
  return response;
}

/** As fontes de uma diretiva da política, por nome. */
function diretiva(nome: string): readonly string[] {
  const encontrada = politicaDeConteudo()
    .split(";")
    .map((parte) => parte.trim())
    .find((parte) => parte === nome || parte.startsWith(`${nome} `));
  if (encontrada === undefined) return [];
  return encontrada.split(/\s+/).slice(1);
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
    expect(resposta.headers.get("Content-Security-Policy")).toBe(politicaDeConteudo());
  });

  it("ninguém põe o Synapse dentro de um iframe", async () => {
    const resposta = await respostaDaPagina();

    expect(diretiva("frame-ancestors")).toEqual(["'none'"]);
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

    expect(aberta.headers.get("Content-Security-Policy")).toBe(politicaDeConteudo());
    expect(aberta.headers.get("X-Frame-Options")).toBe("DENY");
    expect(aberta.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("o middleware é o PRIMEIRO do pipeline, então assina até a página de erro", async () => {
    const { requestMiddleware } = await startInstance.getOptions();

    // Sendo o mais externo, ele alcança o que os de dentro devolvem sozinhos:
    // a página de erro 500 e a recusa 403 do CSRF.
    expect(requestMiddleware?.[0]).toBe(securityHeadersMiddleware);
  });
});

describe("a política libera exatamente o que a página carrega", () => {
  it("o miolo é fechado: tudo da própria origem, e nenhum curinga", () => {
    expect(diretiva("default-src")).toEqual(["'self'"]);
    expect(diretiva("base-uri")).toEqual(["'self'"]);
    expect(diretiva("object-src")).toEqual(["'none'"]);
    expect(diretiva("form-action")).toEqual(["'self'"]);
    expect(politicaDeConteudo()).not.toContain("*");
  });

  it("toda origem externa que a casca carrega está liberada — e na diretiva certa", () => {
    const politica = politicaDeConteudo();

    for (const origem of origensExternasDaCasca()) {
      expect(politica).toContain(origem);
    }
    // A casca pede a folha do Google Fonts, e a folha busca o arquivo no gstatic.
    expect(diretiva("style-src")).toContain("https://fonts.googleapis.com");
    expect(diretiva("font-src")).toContain("https://fonts.gstatic.com");
  });

  it("o destino de dados é a origem para onde o cliente realmente fala", () => {
    const destinos = diretiva("connect-src");

    expect(destinos).toContain("'self'");
    if (API_URL !== "") {
      // Duas leituras da mesma configuração envelhecem separadas: a política
      // pergunta ao mesmo `API_URL` do cliente, e não à variável de ambiente.
      expect(destinos).toContain(new URL(API_URL).origin);
    }
  });

  it("enquanto o SSR não assinar o script embutido, a política precisa aceitá-lo", () => {
    // O TanStack Start emite um `<script>` de hidratação embutido cujo conteúdo
    // muda a cada resposta — hash não serve. O jeito certo é nonce, e o
    // framework aceita um em `router.options.ssr.nonce`. Enquanto
    // `src/router.tsx` não der esse nonce, tirar `'unsafe-inline'` daqui deixa
    // a tela em branco; no dia que der, esta linha exige que ele saia.
    const oSsrAssinaOScript = /\bnonce\b/.test(fonteDe(join("src", "router.tsx")));

    expect(diretiva("script-src").includes("'unsafe-inline'")).toBe(!oSsrAssinaOScript);
  });
});
