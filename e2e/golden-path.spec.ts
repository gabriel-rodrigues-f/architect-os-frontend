import { test, expect, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { apiPath } from "../src/lib/api-path";
import { linkLeadToArchitects, unlinkTeam } from "./team-link";

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
// AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-32 — `id` deixou de
// ser aceito na criação (gerado sempre pelo servidor); este valor serve só
// pra dar um endereço único ao arquiteto de teste, nunca vira o `id` real.
const ARCHITECT_SEED = `e2e-arch-${RUN_ID}`;
const MEMBER_EMAIL = `e2e-member-${RUN_ID}@architect-os.local`;
const LEAD_EMAIL = `e2e-lead-${RUN_ID}@architect-os.local`;
const PASSWORD = "senha-de-teste-e2e-123";

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

let architectId: string;
let memberUserId: string;
let leadUserId: string;
let teamId: string;

async function json<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.url()} → ${response.status()}: ${await response.text()}`);
  }
  const body: unknown = await response.json();
  if (body !== null && typeof body === "object" && !Array.isArray(body) && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/**
 * Admin cria a conta (nasce com senha temporária e mustChangePassword=true),
 * e a própria conta troca pra `PASSWORD` numa sessão isolada — reusar `api`
 * (sessão do admin) pro login trocaria a sessão no meio da fixture, já que
 * login também grava cookie (Seção 24).
 */
async function createAndActivateUser(
  playwright: typeof import("playwright-core"),
  api: APIRequestContext,
  input: { name: string; email: string; role: "member" | "tech_lead"; architectId?: string },
): Promise<string> {
  const created = await json<{ user: { id: string }; temporaryPassword: string }>(
    await api.post(apiPath("/auth/users"), { data: input }),
  );

  const guest = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await guest.post(apiPath("/auth/login"), {
      data: { email: input.email, password: created.temporaryPassword },
    }),
  );
  const changed = await guest.post(apiPath("/auth/change-password"), {
    data: { currentPassword: created.temporaryPassword, newPassword: PASSWORD },
  });
  if (!changed.ok()) {
    throw new Error(`troca de senha de ${input.email} falhou: ${changed.status()}`);
  }
  await guest.dispose();

  return created.user.id;
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
    await api.post(apiPath("/auth/login"), {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  );

  const architect = await json<{ id: string }>(
    await api.post(apiPath("/architects"), {
      data: {
        name: "E2E Golden Path",
        role: "Arquiteto de Soluções II",
        yearsAsArchitect: 3,
        specialization: "E2E",
        email: `${ARCHITECT_SEED}@architect-os.local`,
      },
    }),
  );
  architectId = architect.id;

  // SEC-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — cadastro
  // público (`/api/v1/auth/register`) só funciona na instância vazia; com o
  // admin já existindo, toda tentativa de registro público recusa com 403.
  // A única forma de entrar conta nova a partir daqui é o admin criar
  // (`POST /api/v1/auth/users`), que devolve senha temporária e nasce com
  // mustChangePassword=true — mesma jornada real de alguém convidado.
  // Resolve isso já na fixture (troca pra `PASSWORD`) porque os testes de
  // UI abaixo logam direto esperando o dashboard, não uma tela de troca de
  // senha obrigatória.
  memberUserId = await createAndActivateUser(playwright, api, {
    name: "E2E Member",
    email: MEMBER_EMAIL,
    role: "member",
    architectId,
  });

  leadUserId = await createAndActivateUser(playwright, api, {
    name: "E2E Lead",
    email: LEAD_EMAIL,
    role: "tech_lead",
  });

  teamId = await linkLeadToArchitects({
    databaseUrl: DATABASE_URL,
    runId: `gp-${RUN_ID}`,
    leadUserId,
    architectIds: [architectId],
  });

  await api.dispose();
});

test.afterAll(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("DELETE FROM architects WHERE id = $1", [architectId]);
    await client.query("DELETE FROM users WHERE email IN ($1, $2)", [MEMBER_EMAIL, LEAD_EMAIL]);
  } finally {
    await client.end();
  }
  await unlinkTeam(DATABASE_URL, teamId);
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

  await page.goto(`/architects/${architectId}`);
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

  await page.goto(`/architects/${architectId}`);
  await expect(page.getByText("E2E Golden Path")).toBeVisible();
});
