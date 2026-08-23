import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";

/**
 * E2E de jornada (R-015, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md,
 * Seção 34) — cobre as 3 personas (Admin/Lead/Member) contra o app rodando
 * de verdade, não uma montagem isolada de componente.
 *
 * Pressupõe o BACKEND já no ar (`docker compose up -d` na raiz do repo do
 * backend, ou os testes se auto-`skip` sem `E2E_ADMIN_EMAIL`/
 * `E2E_ADMIN_PASSWORD` — ver cada spec): subir Postgres/Redis/backend a
 * cada rodada seria mais lento e mais frágil que reusar o ambiente de dev
 * que já existe, e o backend é um repositório separado deste.
 *
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-36 (§33, achado 2) —
 * "5 testes, exige stack no ar... sem webServer no config... em CI sem
 * setup, roda zero". O `webServer` abaixo resolve a METADE que é só deste
 * repositório: o FRONTEND sobe sozinho (`reuseExistingServer` continua
 * aproveitando um `npm run start` manual já ativo em dev, sem conflito de
 * porta). O backend continua fora do escopo deste arquivo — ver
 * `.github/workflows/ci.yml` para como o job `e2e` fecha essa outra
 * metade em CI.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  webServer: {
    command: "npm run dev -- --port 8080 --strictPort",
    url: BASE_URL,
    reuseExistingServer: !process.env["CI"],
    timeout: 60_000,
    env: {
      VITE_API_URL: process.env["E2E_API_URL"] ?? "http://localhost:4000",
    },
  },
  use: {
    baseURL: BASE_URL,
    // O app detecta idioma por `navigator.languages` no primeiro acesso — sem
    // isto o Chromium do Playwright abre em inglês (locale default do SO) e
    // os textos dos testes, escritos em pt-BR, nunca casam.
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
