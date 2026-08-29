import { test, expect, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { apiPath } from "../src/lib/api-path";
import { linkLeadToArchitects, unlinkTeam } from "./team-link";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-36 (§33, achado 2) —
 * spec de mentoria pela UI: registrar uma sessão de ponta a ponta (form →
 * submissão → linha do tempo), o que nenhuma suíte E2E existente cobria.
 * Mesma convenção de `golden-path.spec.ts` (fixture via API, limpeza no
 * Postgres, `test.skip` sem credenciais de admin).
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
const ARCHITECT_SEED = `e2e-ment-arch-${RUN_ID}`;
const ARCHITECT_NAME = "E2E Mentoring Mentee";
const LEAD_EMAIL = `e2e-ment-lead-${RUN_ID}@architect-os.local`;
const PASSWORD = "senha-de-teste-e2e-123";
const TOPIC = `E2E revisão de arquitetura ${RUN_ID}`;

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

let architectId: string;
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

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await api.post(apiPath("/auth/login"), {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  );

  const architect = await json<{ id: string }>(
    await api.post(apiPath("/architects"), {
      data: {
        name: ARCHITECT_NAME,
        role: "Arquiteto de Soluções I",
        yearsAsArchitect: 1,
        specialization: "E2E",
        email: `${ARCHITECT_SEED}@architect-os.local`,
      },
    }),
  );
  architectId = architect.id;

  const created = await json<{ user: { id: string }; temporaryPassword: string }>(
    await api.post(apiPath("/auth/users"), {
      data: { name: "E2E Mentoring Lead", email: LEAD_EMAIL, role: "lead" },
    }),
  );
  const guest = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await guest.post(apiPath("/auth/login"), {
      data: { email: LEAD_EMAIL, password: created.temporaryPassword },
    }),
  );
  const changed = await guest.post(apiPath("/auth/change-password"), {
    data: { currentPassword: created.temporaryPassword, newPassword: PASSWORD },
  });
  if (!changed.ok()) {
    throw new Error(`troca de senha de ${LEAD_EMAIL} falhou: ${changed.status()}`);
  }
  await guest.dispose();

  teamId = await linkLeadToArchitects({
    databaseUrl: DATABASE_URL,
    runId: `ment-${RUN_ID}`,
    leadUserId: created.user.id,
    architectIds: [architectId],
  });

  await api.dispose();
});

test.afterAll(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("DELETE FROM architects WHERE id = $1", [architectId]);
    await client.query("DELETE FROM users WHERE email = $1", [LEAD_EMAIL]);
  } finally {
    await client.end();
  }
  await unlinkTeam(DATABASE_URL, teamId);
});

test("Tech Lead registra uma sessão de mentoria e ela aparece na linha do tempo", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#email").fill(LEAD_EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
  // Espera o login terminar antes de navegar — sem isto, `goto` corre
  // contra o POST de login ainda em voo e aterrissa deslogado.
  await expect(page.getByText("Pendências do Lead")).toBeVisible();

  await page.goto("/mentoring");
  await page.getByRole("button", { name: "Registrar sessão" }).click();

  // `exact: true` — "Tema"/"Notas"/"Decisões"/"Ações" também têm um botão de
  // ajuda com `aria-label="O que é o campo {nome}"`, que CONTÉM o nome do
  // campo; sem isto `getByLabel` casa os dois (e mais campos, por
  // sobreposição de texto) e vira "strict mode violation".
  const dialog = page.getByRole("dialog", { name: "Nova sessão de mentoria" });
  // "Mentorado" deixou de ser <select> nativo: é o ArchitectSelectCombobox
  // (botão role="combobox" + popover cmdk) — abre e escolhe a opção pelo
  // nome, como uma pessoa faria.
  await dialog.getByRole("combobox", { name: "Mentorado", exact: true }).click();
  await page.getByRole("option", { name: ARCHITECT_NAME }).click();
  await dialog.getByLabel("Tema", { exact: true }).fill(TOPIC);
  await dialog
    .getByLabel("Notas", { exact: true })
    .fill("E2E: discutimos os trade-offs de particionamento.");
  await dialog.getByLabel("Decisões", { exact: true }).fill("E2E: seguir com sharding por tenant.");
  await dialog
    .getByLabel("Ações", { exact: true })
    .fill("E2E: prototipar a migração até a próxima sessão.");
  await dialog.getByLabel("Duração (min)", { exact: true }).fill("45");
  await dialog.getByRole("button", { name: "Salvar sessão" }).click();

  await expect(page.getByText(`Sessão com ${ARCHITECT_NAME} registrada`)).toBeVisible();
  await expect(page.getByText(TOPIC)).toBeVisible();

  // Recarrega — a sessão tem que vir do servidor, não só do estado otimista da aba.
  await page.reload();
  await expect(page.getByText(TOPIC)).toBeVisible();
});
