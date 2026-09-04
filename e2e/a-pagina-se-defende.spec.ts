import { test, expect } from "@playwright/test";

/**
 * SEC-APP-006 NO FIO — o que a catraca de `tests/architecture` não alcança.
 *
 * A catraca de unidade executa a cadeia REGISTRADA de `src/start.ts` e a
 * entrada de `src/server.ts`, o que já mata a mutação que deixava tudo verde
 * com o servidor entregando zero cabeçalho. O que ela NÃO faz é falar HTTP: o
 * `vitest.config.ts` não carrega o plugin do TanStack Start, então os módulos
 * virtuais que o `createStartHandler` importa não existem lá, e subir o
 * servidor de verdade a cada rodada do gate custaria um `vite build`.
 *
 * Esta metade fecha isso do jeito honesto: um GET de verdade contra o app
 * rodando (o `webServer` do `playwright.config.ts` sobe o frontend sozinho) e
 * os cabeçalhos lidos da resposta que veio pela rede. Não pede backend nem
 * credencial — a página de entrada responde a qualquer visitante, que é
 * exatamente quem estes cabeçalhos protegem.
 *
 * Fora do `npm run gate` por decisão do repositório (o gate é typecheck + lint
 * + test + build; e2e roda no job `e2e` da CI e à mão). Quem mexer na cadeia de
 * middleware tem o vermelho de unidade primeiro; este aqui é a confirmação de
 * que o que o navegador recebe é o mesmo que a cadeia produziu.
 */

const CABECALHOS_ESPERADOS: ReadonlyArray<readonly [string, string]> = [
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=()"],
  ["cross-origin-opener-policy", "same-origin"],
];

test.describe("a origem que serve HTML se defende (SEC-APP-006)", () => {
  test("o GET da página traz cada cabeçalho pela rede", async ({ request }) => {
    const resposta = await request.get("/", { maxRedirects: 0 });
    const cabecalhos = resposta.headers();

    for (const [nome, valor] of CABECALHOS_ESPERADOS) {
      expect(cabecalhos[nome], `cabeçalho ${nome} na resposta de GET /`).toBe(valor);
    }

    const politica = cabecalhos["content-security-policy"] ?? "";
    expect(politica).toContain("default-src 'self'");
    // O que fecha o clickjacking de verdade; o `X-Frame-Options` acima é só
    // para o navegador antigo que ignora CSP.
    expect(politica).toContain("frame-ancestors 'none'");
    expect(politica).toContain("object-src 'none'");
    expect(politica).not.toContain("'unsafe-eval'");
  });

  test("a rota que não existe também sai assinada", async ({ request }) => {
    const resposta = await request.get("/rota-que-nao-existe-em-lugar-nenhum", {
      maxRedirects: 0,
    });
    const cabecalhos = resposta.headers();

    // Uma 404 é HTML servido por esta origem como qualquer outro: cabeçalho que
    // só existe no caminho feliz não é defesa.
    expect(cabecalhos["content-security-policy"]).toBeTruthy();
    expect(cabecalhos["x-frame-options"]).toBe("DENY");
  });

  test("HSTS aparece quando o proxy diz que o visitante chegou por https", async ({ request }) => {
    const semTls = await request.get("/", { maxRedirects: 0 });
    const atrasDoProxy = await request.get("/", {
      maxRedirects: 0,
      headers: { "x-forwarded-proto": "https" },
    });

    // Em http o navegador IGNORA o HSTS; declarar segurança onde ela não existe
    // é ruído que ninguém revisa. Atrás do Ingress o TLS termina antes de nós.
    expect(semTls.headers()["strict-transport-security"]).toBeUndefined();
    expect(atrasDoProxy.headers()["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });
});
