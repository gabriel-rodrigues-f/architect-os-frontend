import { test, expect, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";

/**
 * R10-BUG-001 — `architects.$architectId.evolution.tsx` é rota-filha de
 * `architects.$architectId.tsx` (convenção de arquivo do TanStack Router:
 * `foo.tsx` + `foo.bar.tsx` vira layout + filho). O layout original era a
 * própria tela "Visão geral" (sem `<Outlet/>`), então tanto o link da aba
 * quanto o deep-link para `/evolution` casavam a rota mas nunca desmontavam
 * o componente pai — a aba "Evolução" nunca aparecia, mesmo com a URL
 * correta. Corrigido convertendo `architects.$architectId.tsx` num layout
 * puro (`<Outlet/>`) e movendo "Visão geral" para
 * `architects.$architectId.index.tsx`. Este teste cobre as duas formas de
 * chegar na aba (deep-link direto e clique) pra não regredir.
 *
 * Massa de teste via API, prefixo `e2e-`, removida no afterAll direto no
 * Postgres — mesmo padrão de `golden-path.spec.ts`. Diferente de
 * `competency-matrix-responsive.spec.ts` (competência/capacidade têm
 * `DELETE` de verdade na API): arquiteto não tem — só desativa
 * (`PATCH .../active=false`) — então a limpeza de teste precisa ir direto
 * no banco, não por um endpoint que não existe.
 *
 * Requer:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — conta administradora já existente
 *   E2E_DATABASE_URL — opcional, default aponta pro Postgres de dev local
 */
const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"];
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"];
const DATABASE_URL =
  process.env["E2E_DATABASE_URL"] ?? "postgres://architect:architect@localhost:5433/architect_os";

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

const RUN_ID = Date.now().toString(36);
// AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-32 — `id` deixou de
// ser aceito na criação (gerado sempre pelo servidor); este valor serve só
// pra dar um endereço único ao arquiteto de teste, nunca vira o `id` real.
const ARCHITECT_SEED = `e2e-arch-evo-${RUN_ID}`;

let architectId: string;

async function json<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.url()} → ${response.status()}: ${await response.text()}`);
  }
  return response.json();
}

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await api.post("/api/auth/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }),
  );
  const architect = await json<{ id: string }>(
    await api.post("/api/architects", {
      data: {
        name: "E2E Evolução Rota",
        role: "Arquiteto de Soluções II",
        yearsAsArchitect: 3,
        specialization: "E2E",
        email: `${ARCHITECT_SEED}@architect-os.local`,
      },
    }),
  );
  architectId = architect.id;
  await api.dispose();
});

test.afterAll(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("DELETE FROM architects WHERE id = $1", [architectId]);
  } finally {
    await client.end();
  }
});

test("aba Evolução renderiza tanto por deep-link quanto por clique, sem cair na Visão geral", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#email").fill(ADMIN_EMAIL!);
  await page.locator("#password").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
  await expect(page.getByText("Painel de Capacidades de Arquitetura")).toBeVisible();

  // Deep-link direto na URL da aba — era exatamente o caminho quebrado. É
  // um reload de página cheia (não navegação client-side): a SPA remonta do
  // zero e refaz auth+/api/state antes de saber se o arquiteto existe, o
  // que pode passar dos 5s padrão do Playwright sob carga — timeout maior
  // só nesta primeira asserção pós-reload, não porque a rota é lenta.
  await page.goto(`/architects/${architectId}/evolution`);
  await expect(page.getByRole("heading", { name: /^Evolução —/ })).toBeVisible({ timeout: 15000 });
  // FE-360-005 — a tela virou 4 subvisões (Resumo/Capacidades/Competências/
  // Linha do tempo); "Comparativo início × fim" mora na aba Competências,
  // não aparece mais direto no Resumo (que é a aba padrão).
  await expect(page.getByRole("tab", { name: "Resumo" })).toBeVisible();
  await expect(page.getByText("Comparativo início × fim")).not.toBeVisible();
  await expect(page.getByText("Perfil por capacidade")).not.toBeVisible();

  await page.getByRole("tab", { name: "Competências" }).click();
  await expect(page.getByText("Comparativo início × fim")).toBeVisible();

  // Clique de volta pra "Visão geral" — troca de aba client-side.
  await page.getByRole("link", { name: "Visão geral" }).click();
  await expect(page).toHaveURL(new RegExp(`/architects/${architectId}$`));
  await expect(page.getByText("Perfil por capacidade")).toBeVisible();
  await expect(page.getByText("Comparativo início × fim")).not.toBeVisible();

  // E de novo pra "Evolução" por clique, não só deep-link.
  await page.getByRole("link", { name: "Evolução" }).click();
  await expect(page).toHaveURL(new RegExp(`/architects/${architectId}/evolution$`));
  await expect(page.getByRole("tab", { name: "Resumo" })).toBeVisible();
});
