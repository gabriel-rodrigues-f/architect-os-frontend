import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { test, expect, type Page } from "@playwright/test";

import { apiPath } from "../src/lib/api-path";
import { declaredReachByRoute, discoverRoutePaths, type DeclaredReach } from "./route-inventory";

/**
 * Gate de entrega — navegação completa com captura por tela (onda13/
 * harness-ux). É o instrumento de OBSERVAÇÃO do agente QA-UX: loga com um
 * papel, visita TODAS as rotas de `src/routes/` e grava um PNG por rota em
 * `e2e/screenshots/<papel>/<tema>/` (gitignorado — artefato de execução).
 *
 * Duas redes aqui, deliberadamente separadas:
 *   1. Cobertura — a lista de rotas vem de `route-inventory.ts` (derivada
 *      do filesystem); rota nova sem entrada no mapa `VISITAS` FALHA o
 *      teste de cobertura. Ausência congelada, como a matriz de permissão
 *      do backend ensinou.
 *   2. Tela quebrada — error boundary ou 404 numa rota visitada falha o
 *      teste de navegação COM a lista completa no erro (a captura fica
 *      salva mesmo assim: tela quebrada é achado, e o PNG é a prova).
 *
 * Papel via E2E_NAV_ROLE (admin|manager|tech_lead|member, default admin) — o recorte
 * por papel na tela é exatamente o que o QA-UX compara. Tema claro sempre;
 * escuro opcional via E2E_NAV_DARK=1.
 *
 * Terceira rede (onda 33): rota que o papel NÃO alcança tem de NEGÁ-LO —
 * ou a guarda o devolve à home, ou a tela nega em vez de desenhar o
 * conteúdo. Desde a onda 31 a guarda `requireLeadershipReach` /
 * `requireCareerFileReach` redireciona o profissional em `/team`,
 * `/settings` e nas quatro rotas da própria ficha na navegação INTERNA
 * (provado em `tests/routes/route-guards.test.ts`); no acesso DIRETO por
 * URL — o que esta captura faz, com `page.goto` — o `beforeLoad` roda no
 * SSR cego à sessão (`route-guards.ts` devolve `null` sem `window`) e a
 * barreira é a tela, como o QA da onda 17 mediu e `DECISOES.md` registra.
 * Medido nesta fatia (2026-09-02): nenhuma das 11 rotas restritas
 * redireciona no acesso direto; todas negam na tela. Por isso a rede aceita
 * as DUAS formas de negativa e reprova a terceira: aterrissar na tela com o
 * conteúdo. Onda 33 (`profissional-sem-numeros`): `/cycles` entrou na
 * régua da liderança e as cinco telas de análise do time ganharam a guarda
 * `requireTeamAnalysisReach` — o profissional é REDIRECIONADO nelas na
 * navegação interna e, no acesso direto, recebe a negativa da tela; as
 * duas formas passam aqui, e a chave de cada negativa está no mapa abaixo. Quem alcança, ao contrário, tem de ficar na URL. A tabela de
 * quem alcança o quê é a do fixture de alcance por rota (`route-inventory.ts`
 * → `declaredReachByRoute`), nunca uma cópia aqui; o texto da negativa vem
 * do próprio `pt.json`, pela chave que cada tela usa.
 */
const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:4000";
const ROLE = process.env["E2E_NAV_ROLE"] ?? "admin";
const DARK = process.env["E2E_NAV_DARK"] === "1";

const CREDENTIALS: Record<string, { email?: string; password?: string }> = {
  admin: {
    email: process.env["E2E_ADMIN_EMAIL"],
    password: process.env["E2E_ADMIN_PASSWORD"],
  },
  manager: {
    email: process.env["E2E_MANAGER_EMAIL"],
    password: process.env["E2E_MANAGER_PASSWORD"],
  },
  tech_lead: {
    email: process.env["E2E_TECH_LEAD_EMAIL"],
    password: process.env["E2E_TECH_LEAD_PASSWORD"],
  },
  member: {
    email: process.env["E2E_MEMBER_EMAIL"],
    password: process.env["E2E_MEMBER_PASSWORD"],
  },
};

const EMAIL = CREDENTIALS[ROLE]?.email;
const PASSWORD = CREDENTIALS[ROLE]?.password;

/**
 * Papel × alcance declarado. As contas de `seed:access-profiles` têm
 * vínculo (o gestor rege dois times, o tech lead um), por isso os dois
 * alcançam `lead-com-vinculo`; o profissional visita a PRÓPRIA ficha
 * (`resolveArchitectId` prefere o `architectId` da sessão), que a guarda
 * `requireCareerFileReach` nega a ele.
 */
const TODOS = ["admin", "manager", "tech_lead", "member"] as const;
const LIDERANCA = ["admin", "manager", "tech_lead"] as const;
const PAPEIS_QUE_ALCANCAM: Record<DeclaredReach, readonly string[]> = {
  publica: TODOS,
  autenticado: TODOS,
  admin: ["admin"],
  "lead-com-vinculo": LIDERANCA,
  calibracao: ["admin", "manager"],
  lideranca: LIDERANCA,
  "analise-de-time": LIDERANCA,
  "ficha-de-carreira": LIDERANCA,
};

// A falta de credencial pula SÓ a navegação (mais abaixo, dentro do teste):
// a rede de cobertura rota↔visita não depende de backend nem de login e
// precisa valer em qualquer execução — pulá-la junto foi exatamente o furo
// que a prova do vermelho pegou na primeira rodada.
const SEM_CREDENCIAL = `Sem credencial para o papel "${ROLE}" (E2E_${ROLE.toUpperCase()}_EMAIL/_PASSWORD${
  ROLE === "admin"
    ? ""
    : " — o seed local só cria admin e member; gestor e tech lead exigem env explícita"
}).`;

const SCREENSHOTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "screenshots");

const TEXTOS_PT = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "locales", "pt.json"),
    "utf8",
  ),
) as Record<string, string>;

/**
 * A negativa que cada tela restrita desenha para quem não a alcança — a
 * chave de `pt.json` que o gêmeo de tela de cada rota afirma. Sem entrada
 * (`/competency-matrix`, negativa `somente-leitura` no fixture) a tela abre
 * em leitura e não há texto a cobrar.
 */
const NEGATIVA_NA_TELA: Readonly<Record<string, string>> = {
  "/architects/$architectId": "arch.careerFile.ownOutOfReach",
  "/architects/$architectId/evolution": "arch.careerFile.ownOutOfReach",
  "/architects/$architectId/roadmap": "arch.careerFile.ownOutOfReach",
  "/architects/$architectId/statement": "arch.careerFile.ownOutOfReach",
  "/calibration": "calibration.restricted",
  "/capability-map": "cap.teamAnalysisOnly",
  "/compare": "cap.teamAnalysisOnly",
  "/cycles": "cycle.leadershipOnly",
  "/gap-analysis": "cap.teamAnalysisOnly",
  "/progression": "cap.teamAnalysisOnly",
  "/settings": "ref.leadershipOnly",
  "/team": "team.leadershipOnly",
  "/team-rules": "teamRules.leadOnly",
  "/teams": "teams.restricted",
  "/training-needs": "cap.teamAnalysisOnly",
  // `users.adminOnly` é outra negativa da MESMA tela: a que o gestor e o tech
  // lead veem no lugar do diretório, porque admitem gente sem ver todas as
  // contas. Quem não alcança a rota — o profissional — recebe esta, desde que
  // `/users` passou a ser da liderança inteira (ADR-0084).
  "/users": "users.leadershipOnly",
};

/**
 * Mapa rota → como visitá-la. As chaves são EXATAMENTE os caminhos que
 * `discoverRoutePaths()` deriva de `src/routes/` — o teste de cobertura
 * abaixo falha se os dois conjuntos divergirem em qualquer direção
 * (rota nova sem visita, ou visita órfã de rota removida).
 */
type VisitContext = { architectId: string | null };
const VISITAS: Record<string, (ctx: VisitContext) => string | null> = {
  "/": () => "/",
  "/architects/$architectId": (ctx) => ctx.architectId && `/architects/${ctx.architectId}`,
  "/architects/$architectId/evolution": (ctx) =>
    ctx.architectId && `/architects/${ctx.architectId}/evolution`,
  "/architects/$architectId/roadmap": (ctx) =>
    ctx.architectId && `/architects/${ctx.architectId}/roadmap`,
  "/architects/$architectId/statement": (ctx) =>
    ctx.architectId && `/architects/${ctx.architectId}/statement`,
  "/assessments": () => "/assessments",
  "/calibration": () => "/calibration",
  "/capability-map": () => "/capability-map",
  "/compare": () => "/compare",
  "/competency-matrix": () => "/competency-matrix",
  "/cycles": () => "/cycles",
  "/development-plans": () => "/development-plans",
  "/gap-analysis": () => "/gap-analysis",
  "/learning-paths": () => "/learning-paths",
  "/mentoring": () => "/mentoring",
  "/notices": () => "/notices",
  "/progression": () => "/progression",
  "/settings": () => "/settings",
  "/team": () => "/team",
  "/team-rules": () => "/team-rules",
  "/teams": () => "/teams",
  "/training-needs": () => "/training-needs",
  "/users": () => "/users",
};

const slugDaRota = (rota: string): string =>
  rota === "/" ? "index" : rota.slice(1).replaceAll("/", "-").replaceAll("$", "");

test("toda rota de src/routes tem visita declarada (e nenhuma visita é órfã)", () => {
  const descobertas = discoverRoutePaths();
  const declaradas = Object.keys(VISITAS).sort();

  const semVisita = descobertas.filter((rota) => !(rota in VISITAS));
  const orfas = declaradas.filter((rota) => !descobertas.includes(rota));

  expect(
    semVisita,
    `Rota(s) nova(s) em src/routes/ sem entrada no mapa VISITAS de ${
      import.meta.url
    } — adicione a visita (e a rota entra na captura do QA-UX): ${semVisita.join(", ")}`,
  ).toEqual([]);
  expect(
    orfas,
    `Entrada(s) do mapa VISITAS sem arquivo correspondente em src/routes/ — remova: ${orfas.join(", ")}`,
  ).toEqual([]);
});

async function login(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#email").fill(EMAIL!);
  await page.locator("#password").fill(PASSWORD!);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
  await expect(page.locator("#email")).toHaveCount(0);
  await expect(page.locator("nav").first()).toBeVisible();
}

async function resolveArchitectId(
  playwright: typeof import("playwright-core"),
): Promise<string | null> {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  try {
    const logged = await api.post(apiPath("/auth/login"), {
      data: { email: EMAIL, password: PASSWORD },
    });
    if (!logged.ok()) {
      throw new Error(`login de ${EMAIL} na API falhou: ${logged.status()}`);
    }
    const me = await api.get(apiPath("/auth/me"));
    if (me.ok()) {
      const session = (await me.json()) as { data?: { architectId?: string | null } } & {
        architectId?: string | null;
      };
      const own = session.data?.architectId ?? session.architectId;
      if (own) return own;
    }
    const response = await api.get(apiPath("/architects"));
    if (!response.ok()) return null;
    const body: unknown = await response.json();
    const lista = (
      body !== null && typeof body === "object" && "data" in body
        ? (body as { data: unknown }).data
        : body
    ) as Array<{ id: string }>;
    return lista[0]?.id ?? null;
  } finally {
    await api.dispose();
  }
}

const TEMAS = ["light", ...(DARK ? ["dark"] : [])] as const;

for (const tema of TEMAS) {
  test.describe(`captura — ${ROLE}, tema ${tema}`, () => {
    test.use({
      viewport: { width: 1440, height: 900 },
      colorScheme: tema === "dark" ? "dark" : "light",
    });

    test(`visita todas as rotas e captura (${ROLE}, ${tema})`, async ({
      page,
      playwright,
    }, testInfo) => {
      test.skip(!EMAIL || !PASSWORD, SEM_CREDENCIAL);
      // 17 rotas numa sessão só — o timeout default de 30s não cobre.
      test.setTimeout(300_000);

      // `reducedMotion: "reduce"` congela também as animações dirigidas por
      // JS (recharts) — `animations: "disabled"` do screenshot só cobre CSS.
      // Sem isto, o PNG flagra o radar no MEIO da animação de entrada
      // (polígono colado ao centro) e o achado parece defeito de escala da
      // aplicação. Vai por `emulateMedia` porque o caminho por opção de
      // contexto (`test.use({ reducedMotion })`) NÃO emula o media query
      // nesta versão do Playwright (1.62.1) — verificado com sonda: opção de
      // contexto → matches false; emulateMedia → true.
      await page.emulateMedia({ reducedMotion: "reduce" });

      const architectId = await resolveArchitectId(playwright);
      const dir = join(SCREENSHOTS_DIR, ROLE, tema);
      mkdirSync(dir, { recursive: true });

      // O tema do app persiste em localStorage (`src/lib/theme.tsx`);
      // fixar aqui torna a captura determinística mesmo se o default
      // "system" mudar — o colorScheme acima cobre só o caso "system".
      await page.addInitScript((t) => window.localStorage.setItem("synapse:theme", t), tema);

      await login(page);

      const alcanceDeclarado = declaredReachByRoute();
      const quebradas: string[] = [];
      const semEstado: string[] = [];
      const foraDoAlcanceEsperado: string[] = [];
      const resumo: string[] = [];

      for (const rota of Object.keys(VISITAS).sort()) {
        const url = VISITAS[rota]!({ architectId });
        if (!url) {
          semEstado.push(rota);
          resumo.push(`${rota} → SEM ESTADO NO SEED (nenhum arquiteto visível para ${ROLE})`);
          continue;
        }

        await page.goto(url);
        // Dá tempo às queries e ao recharts sem acoplar a nenhuma tela:
        // networkidle quando der, senão segue com o que carregou.
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

        const erroDePagina = await page.getByText("Esta página não carregou").isVisible();
        const naoEncontrada = await page.getByText("Página não encontrada").isVisible();
        if (erroDePagina || naoEncontrada) {
          quebradas.push(`${rota} (${erroDePagina ? "error boundary" : "404"})`);
        }

        const destino = new URL(page.url()).pathname;
        const redirecionada = destino !== url.split("?")[0];
        resumo.push(`${rota} → ${destino}${redirecionada ? " (redirecionada)" : ""}`);

        const alcance = alcanceDeclarado[rota];
        if (alcance === undefined) {
          throw new Error(
            `${rota} não tem alcance declarado em tests/architecture/alcance-por-rota.fixture.json`,
          );
        }
        const alcanca = PAPEIS_QUE_ALCANCAM[alcance].includes(ROLE);
        if (alcanca && redirecionada) {
          foraDoAlcanceEsperado.push(
            `${rota} (alcance "${alcance}": deveria abrir, foi para ${destino})`,
          );
        } else if (!alcanca && destino !== "/") {
          const chave = NEGATIVA_NA_TELA[rota];
          const negativa = chave === undefined ? undefined : TEXTOS_PT[chave];
          if (chave !== undefined && negativa === undefined) {
            throw new Error(`chave ${chave} da negativa de ${rota} não existe em pt.json`);
          }
          const negou =
            negativa === undefined || (await page.getByText(negativa, { exact: true }).isVisible());
          if (!negou) {
            foraDoAlcanceEsperado.push(
              `${rota} (alcance "${alcance}": ficou em ${destino} sem a negativa "${negativa}")`,
            );
          }
        }

        await page.screenshot({
          path: join(dir, `${slugDaRota(rota)}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }

      testInfo.attach("navegacao-resumo", {
        body: resumo.join("\n"),
        contentType: "text/plain",
      });

      expect(
        semEstado,
        `Rota(s) sem estado no seed para o papel ${ROLE} — registre/complete o seed em vez de aceitar o buraco: ${semEstado.join(", ")}`,
      ).toEqual([]);
      expect(
        quebradas,
        `Tela(s) quebrada(s) durante a navegação como ${ROLE} — as capturas em e2e/screenshots/${ROLE}/${tema}/ são a prova: ${quebradas.join(", ")}`,
      ).toEqual([]);
      expect(
        foraDoAlcanceEsperado,
        `Rota(s) em que o papel ${ROLE} aterrissou fora do alcance declarado em tests/architecture/alcance-por-rota.fixture.json: ${foraDoAlcanceEsperado.join(", ")}`,
      ).toEqual([]);
    });
  });
}
