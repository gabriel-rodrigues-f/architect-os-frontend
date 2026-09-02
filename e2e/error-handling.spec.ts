import { test, expect, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { apiPath } from "../src/lib/api-path";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-36 (§33, achado 2) —
 * "specs de PDI/mentoria/erro" ausentes. Três cenários de erro reais que
 * `golden-path.spec.ts` não cobre: credencial errada, acesso fora de
 * escopo (nav esconde o link, mas a rota em si também precisa recusar
 * quem digita a URL direto) e recurso inexistente.
 *
 * Mesma convenção de `golden-path.spec.ts`: fixture via API, limpeza no
 * Postgres, `test.skip` sem credenciais de admin.
 */
const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"];
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"];
const DATABASE_URL =
  process.env["E2E_DATABASE_URL"] ?? "postgres://architect:architect@localhost:5433/architect_os";

const RUN_ID = Date.now().toString(36);
const MEMBER_EMAIL = `e2e-err-member-${RUN_ID}@architect-os.local`;
const PASSWORD = "senha-de-teste-e2e-123";

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

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

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await api.post(apiPath("/auth/login"), {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  );

  const created = await json<{ user: { id: string }; temporaryPassword: string }>(
    await api.post(apiPath("/auth/users"), {
      data: { name: "E2E Error Member", email: MEMBER_EMAIL, role: "member" },
    }),
  );
  const guest = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await guest.post(apiPath("/auth/login"), {
      data: { email: MEMBER_EMAIL, password: created.temporaryPassword },
    }),
  );
  const changed = await guest.post(apiPath("/auth/change-password"), {
    data: { currentPassword: created.temporaryPassword, newPassword: PASSWORD },
  });
  if (!changed.ok()) {
    throw new Error(`troca de senha de ${MEMBER_EMAIL} falhou: ${changed.status()}`);
  }
  await guest.dispose();
  await api.dispose();
});

test.afterAll(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("DELETE FROM users WHERE email = $1", [MEMBER_EMAIL]);
  } finally {
    await client.end();
  }
});

test("login com senha errada mostra erro e não entra no painel", async ({ page }) => {
  await page.goto("/");
  await page.locator("#email").fill(MEMBER_EMAIL);
  await page.locator("#password").fill("senha-completamente-errada");
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();

  // Continua na tela de login — nunca renderiza o painel com credencial errada.
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.getByRole("button", { name: /Entrar|Enviando/ })).toBeVisible();
  await expect(page.getByText("Minha Evolução")).toHaveCount(0);
});

test("member acessando /users direto pela URL vê o aviso de restrição, não o diretório", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#email").fill(MEMBER_EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
  await expect(page.getByText("Minha Evolução")).toBeVisible();

  // Nav não mostra o link (QW-01/QW-02), mas digitar a URL direto é o
  // caminho que realmente testa a autorização, não só a visibilidade do menu.
  await page.goto("/users");
  await expect(page.getByText("Diretório de contas é restrito a administradores.")).toBeVisible();
});

test("member acessando /calibration direto pela URL vê o aviso de restrição, não os avaliadores", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#email").fill(MEMBER_EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
  await expect(page.getByText("Minha Evolução")).toBeVisible();

  // QA da onda 17, achado bloqueante: no acesso direto o beforeLoad não roda
  // no cliente (SSR + hidratação) e a tela abria INTEIRA, com o dado do
  // gateway em memória. O twin de /users acima: a tela é a última barreira.
  // PRD-03: a leitura é de gestor E administrador — o texto da negativa
  // mudou junto com o alcance (`calibration.restricted`).
  await page.goto("/calibration");
  await expect(page.getByText("Calibração é restrita a gestores e administradores.")).toBeVisible();
  await expect(page.getByText("Marina Lopes")).toHaveCount(0);
  await expect(page.getByText("Média geral")).toHaveCount(0);
});

test("perfil de um arquiteto inexistente mostra 'não encontrado', não uma tela quebrada", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#email").fill(ADMIN_EMAIL!);
  await page.locator("#password").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
  // Espera o login terminar antes de navegar — sem isto, `goto` corre
  // contra o POST de login ainda em voo e aterrissa deslogado.
  await expect(page.getByText("Painel de Capacidades de Arquitetura")).toBeVisible();

  await page.goto(`/architects/e2e-nao-existe-${RUN_ID}`);
  await expect(page.getByText("Arquiteto não encontrado.")).toBeVisible();
});
