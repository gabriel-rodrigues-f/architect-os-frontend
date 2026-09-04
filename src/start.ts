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
 * O QUE ESTA FATIA FECHA E O QUE ELA NÃO FECHA — sem arredondar:
 *
 *   - clickjacking: FECHADO (`frame-ancestors 'none'` + `X-Frame-Options`);
 *   - sniffing de tipo: FECHADO (`nosniff`);
 *   - transporte: FECHADO sobre https (HSTS);
 *   - travessia de janela por popup: FECHADO (`Cross-Origin-Opener-Policy`);
 *   - XSS: PARCIAL, e é a fresta que sobra. `script-src 'unsafe-inline'`
 *     continua aceito, então um `<script>` injetado ainda executa. O que a
 *     política tira dele é o subrecurso (`default-src 'self'` cobre imagem,
 *     `form-action 'self'` cobre formulário) e a moldura; o que ela NÃO tira é
 *     a execução nem a exfiltração por navegação de topo, porque a diretiva
 *     que fecharia isso (`navigate-to`) não existe em navegador nenhum.
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
 *     teste exige que ele saia — e, para que esse dia não mate nada calado, a
 *     mesma catraca exige que o HTML que ESTE processo serve não dependa de
 *     script embutido (nonce não autoriza manipulador `onclick`: isso pediria
 *     `'unsafe-hashes'`). Foi por isso que o botão da página de erro virou
 *     link em `src/lib/error-page.ts`.
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
 * A origem é a máquina de QUEM ABRE a página, não um servidor nosso.
 *
 * `localhost` numa política servida a um visitante não aponta para o nosso
 * servidor: aponta para o computador dele. Liberar isso é alargar a política
 * para a máquina da vítima e ainda anunciar a topologia de desenvolvimento a
 * qualquer um que leia o cabeçalho.
 */
function ehDaMaquinaDeQuemAbre(origem: string): boolean {
  const { hostname } = new URL(origem);
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
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
 *
 * O PORÉM MEDIDO NO BUILD: `import.meta.env` vira um literal congelado na hora
 * do `vite build`, e um build sem `--build-arg VITE_API_URL` não tem a chave —
 * `API_URL` cai no padrão `http://localhost:4000` e a política publicava, para
 * todo visitante, uma origem `http:` na máquina dele. O Dockerfile fornece a
 * chave, então em produção de verdade isso não acontece; degradação silenciosa,
 * porém, é a que ninguém vê. Num build de produção o loopback sai da política.
 *
 * E o motivo NÃO é que apontar para `localhost:4000` seja engano: em
 * desenvolvimento é o uso deliberado, é o padrão do `.env.example` e é o que
 * faz o `vite dev` conversar com a API local. O que não se sustenta é PUBLICAR
 * esse endereço para um visitante — servido a ele, `localhost` é a máquina
 * dele, e a política estaria liberando um destino que nunca foi nosso. Por
 * isso o corte vale só no build de produção: um build que saiu sem a variável
 * falha ALTO (a chamada é bloqueada, e alguém conserta a variável) em vez de
 * publicar uma política frouxa que parece certa. Quem roda o build SSR contra
 * a API local sente isso na hora — está no README, na seção de rodar.
 */
function destinosDeDados(buildDeProducao: boolean): readonly string[] {
  const daApi = origemDe(API_URL);
  const doRastreioDeErro = origemDe(import.meta.env["VITE_SENTRY_DSN"]);
  const destinos = ["'self'", daApi, doRastreioDeErro].filter((destino) => destino !== undefined);
  const publicaveis = buildDeProducao
    ? destinos.filter((destino) => destino === "'self'" || !ehDaMaquinaDeQuemAbre(destino))
    : destinos;
  return [...new Set(publicaveis)];
}

export function politicaDeConteudo({
  buildDeProducao = import.meta.env.PROD,
  paginaNaMaquinaDeQuemAbre = false,
}: {
  readonly buildDeProducao?: boolean;
  /**
   * A PRÓPRIA PÁGINA está sendo servida de `localhost`?
   *
   * Afina a regra de cima em vez de afrouxá-la. O corte existe porque publicar
   * `http://localhost:4000` para um visitante remoto libera um destino que
   * nunca foi nosso — na máquina DELE. Mas quando a página também vem de
   * `localhost`, o par é coerente: é a mesma máquina, e é exatamente a
   * topologia que o dono escolheu em 2026-09-04 — `docker compose up` publica a
   * API em `localhost:4000` e `npm run start` serve a página, já compilada como
   * PRODUÇÃO, em `localhost:3000`.
   *
   * Sem esta distinção o build de produção rodando na máquina de quem
   * desenvolve calculava `connect-src 'self'` e o navegador bloqueava TODA
   * chamada à API — a tela subia e dizia "Serviço indisponível", com a API de
   * pé do lado. Medido assim, na primeira subida da topologia nova.
   */
  readonly paginaNaMaquinaDeQuemAbre?: boolean;
} = {}): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    `style-src 'self' 'unsafe-inline' ${FOLHA_DE_ESTILO_DE_FONTE}`,
    `font-src 'self' ${ARQUIVO_DE_FONTE}`,
    `connect-src ${destinosDeDados(buildDeProducao && !paginaNaMaquinaDeQuemAbre).join(" ")}`,
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

/**
 * `Cross-Origin-Opener-Policy` entra porque esta página CARREGA SESSÃO: sem
 * ela, uma janela aberta por terceiro continua com referência à nossa (
 * `window.opener`) e pode navegá-la ou medi-la de fora. O backend já ganha o
 * cabeçalho pelo `@fastify/helmet`; a página não tinha. Custo medido: zero —
 * a aplicação não abre popup (`window.open` não existe em `src/`), e os links
 * externos já saem com `rel="noopener noreferrer"`.
 */
export function cabecalhosDeSeguranca(request: Request): Readonly<Record<string, string>> {
  const cabecalhos: Record<string, string> = {
    "Content-Security-Policy": politicaDeConteudo({
      paginaNaMaquinaDeQuemAbre: ehDaMaquinaDeQuemAbre(origemDe(request.url) ?? ""),
    }),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (aRespostaViajaCifrada(request)) {
    cabecalhos["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return cabecalhos;
}

/**
 * Assina a resposta que vier de dentro — seja a página, seja a de erro.
 *
 * Isto já foi uma função exportada à parte "para o teste poder ler a resposta
 * sem subir a pilha do framework". Era o furo: a catraca media a auxiliar, e
 * trocar o corpo deste middleware por `({ next }) => next()` deixava a suíte
 * inteira verde com o servidor entregando ZERO cabeçalho. A auxiliar morreu e
 * o teste passou a executar a CADEIA REGISTRADA (`startInstance.getOptions()`)
 * — não há mais atalho que uma mutação daqui não faça vermelho.
 */
export const securityHeadersMiddleware = createMiddleware().server(async ({ request, next }) => {
  const resultado = await next();
  for (const [nome, valor] of Object.entries(cabecalhosDeSeguranca(request))) {
    resultado.response.headers.set(nome, valor);
  }
  return resultado;
});

/*
 * O de segurança vem PRIMEIRO de propósito: sendo o mais externo, ele assina
 * também o que os de dentro devolvem sozinhos — a página de erro 500 do
 * `errorMiddleware` e o 403 do CSRF. Cabeçalho que só existe no caminho feliz
 * não é defesa.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware, csrfMiddleware],
}));
