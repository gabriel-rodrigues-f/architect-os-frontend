import { test, expect, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { apiPath } from "../src/lib/api-path";
import { linkLeadToArchitects, unlinkTeam } from "./team-link";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-36 (§33, achado 2) —
 * "5 testes... specs de PDI/mentoria/erro" ausentes. Este cobre o ciclo de
 * vida de um item de PDI pela UI: check-in e transição de status —, o que
 * `golden-path.spec.ts` (navegação/escopo por papel) não toca.
 *
 * Mesma convenção de `golden-path.spec.ts`: massa de teste via API (mais
 * rápido/estável que orquestrar pela UI de administração), limpeza direta
 * no Postgres ao final, `test.skip` sem credenciais de admin configuradas.
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
const ARCHITECT_SEED = `e2e-pdi-arch-${RUN_ID}`;
const LEAD_EMAIL = `e2e-pdi-lead-${RUN_ID}@architect-os.local`;
const ITEM_ID = `e2e-pdi-item-${RUN_ID}`;
const PASSWORD = "senha-de-teste-e2e-123";

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

let architectId: string;
let leadUserId: string;
let teamId: string;
let cycleId: string;
let competencyId: string;

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
        name: "E2E PDI Lifecycle",
        role: "Pleno",
        yearsAsArchitect: 2,
        specialization: "E2E",
        email: `${ARCHITECT_SEED}@architect-os.local`,
      },
    }),
  );
  architectId = architect.id;

  const created = await json<{ user: { id: string }; temporaryPassword: string }>(
    await api.post(apiPath("/auth/users"), {
      data: { name: "E2E PDI Lead", email: LEAD_EMAIL, role: "tech_lead" },
    }),
  );
  leadUserId = created.user.id;
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
    api,
    runId: `pdi-${RUN_ID}`,
    leadUserId,
    architectIds: [architectId],
  });

  const cycles = await json<Array<{ id: string; status: string }>>(
    await api.get(apiPath("/cycles")),
  );
  cycleId = cycles.find((c) => c.status === "Active")?.id ?? cycles[0]!.id;
  const competencies = await json<Array<{ id: string }>>(await api.get(apiPath("/competencies")));
  competencyId = competencies[0]!.id;

  const today = new Date().toISOString().slice(0, 10);
  const inThreeMonths = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await json(
    await api.post(apiPath(`/plans/${architectId}/items`), {
      data: {
        cycleId,
        item: {
          id: ITEM_ID,
          competencyId,
          currentLevel: 2,
          targetLevel: 4,
          objective: "E2E — fechar o gap de referência",
          actionType: "Practice",
          actionPlan: "Praticar em projeto real com revisão do Tech Lead",
          startDate: today,
          targetDate: inThreeMonths,
          owner: "E2E PDI Lifecycle",
          status: "Not Started",
        },
      },
    }),
  );

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

test("Tech Lead registra check-in e avança o status de um item de PDI", async ({ page }) => {
  await page.goto("/");
  await page.locator("#email").fill(LEAD_EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
  // Espera o login terminar antes de navegar — sem isto, `goto` corre
  // contra o POST de login ainda em voo e aterrissa deslogado.
  await expect(page.getByText("Pendências do Lead")).toBeVisible();

  await page.goto(`/development-plans?architectId=${architectId}`);
  await expect(page.getByText("E2E — fechar o gap de referência")).toBeVisible();

  // Check-in: campo de texto livre + "Registrar" — ver `pdi.checkin.*` em locales/pt.json.
  const checkinField = page.getByPlaceholder("Registrar um check-in sobre o andamento...");
  await checkinField.fill("E2E: sessão de pareamento concluída, primeiro rascunho pronto.");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(
    page.getByText("E2E: sessão de pareamento concluída, primeiro rascunho pronto."),
  ).toBeVisible();

  // Status: "Not Started" → "In Progress". O rótulo é um <p> visual, sem
  // `<label htmlFor>` (Field local a `development-plans.tsx`) — `getByLabel`
  // não enxerga essa associação; localiza pelo `<select>` filho direto do
  // mesmo wrapper cujo `<p>` filho direto é exatamente "Status".
  const statusSelect = page.locator("div:has(> p:text-is('Status')) > select");
  await statusSelect.selectOption("In Progress");
  await expect(statusSelect).toHaveValue("In Progress");

  // Recarrega — o check-in e o novo status têm que ter sido persistidos no
  // servidor, não só otimisticamente no estado local da aba.
  await page.reload();
  await expect(
    page.getByText("E2E: sessão de pareamento concluída, primeiro rascunho pronto."),
  ).toBeVisible();
  await expect(statusSelect).toHaveValue("In Progress");
});
