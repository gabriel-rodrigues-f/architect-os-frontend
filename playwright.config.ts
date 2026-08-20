import { defineConfig, devices } from "@playwright/test";

/**
 * E2E de jornada (R-015, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md,
 * Seção 34) — cobre as 3 personas (Admin/Lead/Member) contra o app rodando
 * de verdade, não uma montagem isolada de componente.
 *
 * Pressupõe a stack já no ar (backend via `docker compose up -d` na raiz do
 * repo, frontend via `npm run start` aqui) — sem `webServer` automático:
 * subir Postgres/Redis/backend a cada rodada de teste seria mais lento e
 * mais frágil que reusar o ambiente de desenvolvimento que já existe.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    // O app detecta idioma por `navigator.languages` no primeiro acesso — sem
    // isto o Chromium do Playwright abre em inglês (locale default do SO) e
    // os textos dos testes, escritos em pt-BR, nunca casam.
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
