/**
 * Captura uma tela de cada rota do app e salva em `docs/screenshots/`.
 *
 * Alimenta a documentação funcional (`docs/FUNCIONAL.md`) — quando uma tela
 * muda de forma visível, rode `npm run screenshots` de novo antes de revisar
 * a doc, em vez de editar a imagem à mão.
 *
 * Credenciais vêm de variável de ambiente, nunca de literal no arquivo: este
 * script é versionado, uma senha aqui dentro vazaria para todo clone do repo.
 *
 *   SCREENSHOT_EMAIL=... SCREENSHOT_PASSWORD=... npm run screenshots
 *
 * Requer o backend (`docker compose up`, na pasta `backend/`) e o frontend
 * (`npm run dev`) já rodando — o script só dirige um navegador contra eles.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../docs/screenshots");
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:8080";
const EMAIL = process.env.SCREENSHOT_EMAIL;
const PASSWORD = process.env.SCREENSHOT_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error(
    "Defina SCREENSHOT_EMAIL e SCREENSHOT_PASSWORD no ambiente antes de rodar este script.",
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

/**
 * Uma entrada por tela — arquivo de saída e rota, na mesma ordem em que
 * aparecem na barra lateral (`AppShell.tsx`, `NAV_GROUPS`). "Capacidades" é
 * um item só no menu, mas quatro abas internas (`CapabilitiesTabs`) — cada
 * aba entra aqui como sua própria captura, porque cada uma mostra dado
 * diferente. `talent-matrix` (Matriz de Talentos / 9-Box) não existe mais
 * como rota — removida do produto depois da última atualização desta lista.
 */
const SCREENS = [
  { file: "01-painel", path: "/" },
  { file: "02-time", path: "/team" },
  { file: "03-capacidades-cobertura", path: "/capability-map" },
  { file: "04-capacidades-prioridades", path: "/gap-analysis" },
  { file: "05-capacidades-progressao", path: "/progression" },
  { file: "06-capacidades-prioridades-coletivas", path: "/training-needs" },
  { file: "07-avaliacoes", path: "/assessments" },
  { file: "08-planos-de-desenvolvimento", path: "/development-plans" },
  { file: "09-trilhas-de-aprendizagem", path: "/learning-paths" },
  { file: "10-mentoria", path: "/mentoring" },
  { file: "11-matriz-de-competencias", path: "/competency-matrix" },
  { file: "12-ciclos-de-desenvolvimento", path: "/cycles" },
  { file: "13-usuarios", path: "/users" },
  { file: "16-referencia-do-modelo", path: "/settings" },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  locale: "pt-BR",
});
// O Chromium do Playwright detecta en-US por padrão. O app cai no idioma do
// navegador só na primeira visita; fixando aqui, toda captura sai no
// português que é o padrão real do produto, não um inglês acidental.
await context.addInitScript(() => {
  window.localStorage.setItem("architect-os:locale", "pt");
});
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

console.log(`Abrindo ${BASE_URL} …`);
await page.goto(BASE_URL, { waitUntil: "networkidle" });

console.log("Tela de login …");
await page.screenshot({ path: `${OUT_DIR}/00-login.png` });

await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD);
await page.locator('button[type="submit"]').first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(500);

for (const screen of SCREENS) {
  console.log(`${screen.file} …`);
  await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT_DIR}/${screen.file}.png`, fullPage: true });
}

// Detalhe de arquiteto: precisa de um id real, então navega e clica em vez de
// montar a URL — é a única rota do menu que não é um caminho fixo. Duas
// capturas: a aba "Visão geral" (destino do clique) e a aba "Evolução"
// (`ProfileTabs`, ao lado) — a segunda só existe a partir da Rodada 10.
console.log("14-detalhe-do-arquiteto-visao-geral …");
await page.goto(`${BASE_URL}/team`, { waitUntil: "networkidle" });
const firstArchitect = page.locator('a[href^="/architects/"]').first();
if (await firstArchitect.isVisible({ timeout: 3000 }).catch(() => false)) {
  await firstArchitect.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${OUT_DIR}/14-detalhe-do-arquiteto-visao-geral.png`,
    fullPage: true,
  });

  console.log("15-detalhe-do-arquiteto-evolucao …");
  await page.getByRole("link", { name: "Evolução" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `${OUT_DIR}/15-detalhe-do-arquiteto-evolucao.png`,
    fullPage: true,
  });
} else {
  console.log("  (sem arquitetos cadastrados — pulei estas capturas)");
}

// REVISAO-360-FRONTEND, Seção 15 — o drawer mobile (hambúrguer no
// cabeçalho, abaixo do breakpoint `lg`) é uma superfície nova, não uma rota:
// contexto e sessão à parte, só pra esta captura, num viewport de celular.
console.log("17-navegacao-mobile …");
const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "pt-BR",
});
await mobileContext.addInitScript(() => {
  window.localStorage.setItem("architect-os:locale", "pt");
});
const mobilePage = await mobileContext.newPage();
await mobilePage.goto(BASE_URL, { waitUntil: "networkidle" });
await mobilePage.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
await mobilePage.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD);
await mobilePage.locator('button[type="submit"]').first().click();
await mobilePage.waitForLoadState("networkidle");
await mobilePage.waitForTimeout(500);
await mobilePage.getByRole("button", { name: /menu/i }).click();
await mobilePage.waitForTimeout(400);
await mobilePage.screenshot({ path: `${OUT_DIR}/17-navegacao-mobile.png` });
await mobileContext.close();

await context.close();
await browser.close();

if (consoleErrors.length > 0) {
  console.log("\nErros de console durante a captura:");
  for (const err of consoleErrors.slice(0, 20)) console.log(`  - ${err}`);
} else {
  console.log("\nNenhum erro de console.");
}

console.log(`\nCapturas salvas em ${OUT_DIR}`);
