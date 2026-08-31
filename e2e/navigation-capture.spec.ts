import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { test, expect, type Page } from "@playwright/test";

import { apiPath } from "../src/lib/api-path";
import { discoverRoutePaths } from "./route-inventory";

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
 * escuro opcional via E2E_NAV_DARK=1. Rota que o papel não alcança
 * não é falha: member vê aviso in-place em /users e /competency-matrix em leitura (SEM redirect — o QA provou que redirect não acontece); a captura mostra
 * onde o papel aterrissou, e o destino final fica registrado no anexo
 * `navegacao-resumo` do relatório.
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

      const quebradas: string[] = [];
      const semEstado: string[] = [];
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
        resumo.push(
          `${rota} → ${destino}${destino !== url.split("?")[0] ? " (redirecionada)" : ""}`,
        );

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
    });
  });
}
