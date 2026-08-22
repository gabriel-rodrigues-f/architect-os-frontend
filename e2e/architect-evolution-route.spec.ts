import { test, expect, type APIRequestContext } from "@playwright/test";

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
 * Massa de teste via API, prefixo `e2e-`, removida no afterAll — mesmo
 * padrão de `golden-path.spec.ts` / `competency-matrix-responsive.spec.ts`.
 *
 * Requer:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — conta administradora já existente
 */
const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"];
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"];

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

const RUN_ID = Date.now().toString(36);
const ARCHITECT_ID = `e2e-arch-evo-${RUN_ID}`;

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
  await json(
    await api.post("/api/architects", {
      data: {
        id: ARCHITECT_ID,
        name: "E2E Evolução Rota",
        role: "Arquiteto de Soluções II",
        yearsAsArchitect: 3,
        specialization: "E2E",
        email: `${ARCHITECT_ID}@architect-os.local`,
      },
    }),
  );
  await api.dispose();
});

test.afterAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await api.post("/api/auth/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }),
  );
  await api.delete(`/api/architects/${ARCHITECT_ID}`);
  await api.dispose();
});

test("aba Evolução renderiza tanto por deep-link quanto por clique, sem cair na Visão geral", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#email").fill(ADMIN_EMAIL!);
  await page.locator("#password").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
  await expect(page.getByText("Painel de Capacidades de Arquitetura")).toBeVisible();

  // Deep-link direto na URL da aba — era exatamente o caminho quebrado.
  await page.goto(`/architects/${ARCHITECT_ID}/evolution`);
  await expect(page.getByRole("heading", { name: /^Evolução —/ })).toBeVisible();
  await expect(page.getByText("Comparativo início × fim")).toBeVisible();
  await expect(page.getByText("Perfil por capacidade")).not.toBeVisible();

  // Clique de volta pra "Visão geral" — troca de aba client-side.
  await page.getByRole("link", { name: "Visão geral" }).click();
  await expect(page).toHaveURL(new RegExp(`/architects/${ARCHITECT_ID}$`));
  await expect(page.getByText("Perfil por capacidade")).toBeVisible();
  await expect(page.getByText("Comparativo início × fim")).not.toBeVisible();

  // E de novo pra "Evolução" por clique, não só deep-link.
  await page.getByRole("link", { name: "Evolução" }).click();
  await expect(page).toHaveURL(new RegExp(`/architects/${ARCHITECT_ID}/evolution$`));
  await expect(page.getByText("Comparativo início × fim")).toBeVisible();
});
