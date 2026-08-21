import { test, expect, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";

/**
 * E2E de jornada — Admin/Lead/Member (R-015, AUDITORIA-QUINTA-RODADA-360-
 * SYNAPSE-2026-08-19.md, Seção 34). Roda contra o app de verdade (stack já
 * no ar — ver `playwright.config.ts`), não uma montagem isolada.
 *
 * Massa de teste é criada via API (mesmo padrão da suíte de integração do
 * backend: mais rápido e menos frágil que orquestrar cadastro/vínculo pela
 * UI de administração, que já tem cobertura própria em `src/lib/__tests__`)
 * e removida direto no Postgres ao final — prefixo `e2e-` deixa a limpeza
 * inequívoca. Ver o incidente de trilhas de teste nunca removidas
 * (`api.integration.test.ts`, afterAll) que motivou essa disciplina.
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

const RUN_ID = Date.now().toString(36);
const ARCHITECT_ID = `e2e-arch-${RUN_ID}`;
const MEMBER_EMAIL = `e2e-member-${RUN_ID}@architect-os.local`;
const LEAD_EMAIL = `e2e-lead-${RUN_ID}@architect-os.local`;
const PASSWORD = "senha-de-teste-e2e-123";

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

let memberUserId: string;
let leadUserId: string;

async function json<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.url()} → ${response.status()}: ${await response.text()}`);
  }
  return response.json();
}

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });

  // ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 24 — a sessão agora vive num
  // cookie HttpOnly; não há mais token para extrair do corpo. O
  // `APIRequestContext` do Playwright tem cookie jar própria (como um
  // browser de verdade) — o cookie que este login grava é reenviado
  // automaticamente nas chamadas seguintes deste mesmo `api`, sem precisar
  // montar nenhum header na mão.
  await json(
    await api.post("/api/auth/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }),
  );

  await json(
    await api.post("/api/architects", {
      data: {
        id: ARCHITECT_ID,
        name: "E2E Golden Path",
        role: "Arquiteto de Soluções II",
        yearsAsArchitect: 3,
        specialization: "E2E",
        email: `${ARCHITECT_ID}@architect-os.local`,
      },
    }),
  );

  // Registro TAMBÉM grava sessão no cookie (Seção 24) — se reusasse o `api`
  // do admin, cada registro trocaria de sessão no meio da fixture. Contexto
  // isolado só para os cadastros: cookie jar própria, não interfere na
  // sessão admin usada nos PATCHes abaixo.
  const guest = await playwright.request.newContext({ baseURL: API_URL });

  const memberRegister = await json<{ user: { id: string } }>(
    await guest.post("/api/auth/register", {
      data: { name: "E2E Member", email: MEMBER_EMAIL, password: PASSWORD },
    }),
  );
  memberUserId = memberRegister.user.id;
  await json(
    await api.patch(`/api/auth/users/${memberUserId}`, {
      data: { architectId: ARCHITECT_ID },
    }),
  );

  const leadRegister = await json<{ user: { id: string } }>(
    await guest.post("/api/auth/register", {
      data: { name: "E2E Lead", email: LEAD_EMAIL, password: PASSWORD },
    }),
  );
  await guest.dispose();
  leadUserId = leadRegister.user.id;
  await json(
    await api.patch(`/api/auth/users/${leadUserId}`, {
      data: { role: "lead" },
    }),
  );
  await json(
    await api.patch(`/api/architects/${ARCHITECT_ID}`, {
      data: { leadUserId },
    }),
  );

  await api.dispose();
});

test.afterAll(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("DELETE FROM architects WHERE id = $1", [ARCHITECT_ID]);
    await client.query("DELETE FROM users WHERE email IN ($1, $2)", [MEMBER_EMAIL, LEAD_EMAIL]);
  } finally {
    await client.end();
  }
});

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
}

test("Admin — painel executivo, navegação restrita e diretório de usuários", async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);

  await expect(page.getByText("Painel de Capacidades de Arquitetura")).toBeVisible();

  await page.getByRole("link", { name: "Matriz de Competências" }).click();
  await expect(page).toHaveURL(/\/competency-matrix/);

  await page.getByRole("link", { name: "Usuários" }).click();
  await expect(page).toHaveURL(/\/users/);
  await expect(page.getByText("E2E Member")).toBeVisible();
  await expect(page.getByText("E2E Lead")).toBeVisible();
});

test("Member — Minha Evolução, navegação restrita e workspace próprio", async ({ page }) => {
  await login(page, MEMBER_EMAIL, PASSWORD);

  await expect(page.getByText("Minha Evolução")).toBeVisible();
  await expect(page.getByText(/E2E Member/)).toBeVisible();

  // Nav admin-only não aparece pra quem não é admin (QW-01/QW-02).
  await expect(page.getByRole("link", { name: "Matriz de Competências" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);

  await page.goto(`/architects/${ARCHITECT_ID}`);
  await expect(page.getByText("Próximos passos")).toBeVisible();
  await expect(page.getByText("Nada pendente no momento.")).toBeVisible();
});

test("Lead — Pendências do Lead escopadas à própria liderança", async ({ page }) => {
  await login(page, LEAD_EMAIL, PASSWORD);

  await expect(page.getByText("Pendências do Lead")).toBeVisible();

  const myPeopleCard = page.locator(".surface-card", { hasText: "Pessoas sob sua liderança" });
  await expect(myPeopleCard).toContainText("1");

  // Sem avaliação/evidência/PDI pendente ainda — estado "tudo em dia".
  await expect(page.getByText("Nada pendente no momento")).toBeVisible();

  await page.goto(`/architects/${ARCHITECT_ID}`);
  await expect(page.getByText("E2E Golden Path")).toBeVisible();
});
