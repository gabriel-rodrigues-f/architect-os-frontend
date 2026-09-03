import { test, expect } from "@playwright/test";
import { apiPath } from "../src/lib/api-path";
import {
  admitPersonToTeam,
  dischargePeople,
  PASSWORD,
  registerTeamWithRules,
  seniorityNamed,
  unlinkTeam,
  unwrap as json,
} from "./team-link";

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
const MEMBER_EMAIL = `e2e-pdi-member-${RUN_ID}@architect-os.local`;
const LEAD_EMAIL = `e2e-pdi-lead-${RUN_ID}@architect-os.local`;
const ITEM_ID = `e2e-pdi-item-${RUN_ID}`;

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

let architectId: string;
let teamId: string;
let cycleId: string;
let competencyId: string;

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await api.post(apiPath("/auth/login"), {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  );

  // ONDA 37 (ADR-0084) — o time nasce primeiro; o lead e o dono do PDI
  // nascem nele, cada um com conta e profissional no mesmo ato.
  teamId = await registerTeamWithRules(api, `pdi-${RUN_ID}`);
  await admitPersonToTeam({
    playwright,
    api,
    name: "E2E PDI Lead",
    email: LEAD_EMAIL,
    role: "tech_lead",
    teamId,
  });
  const admittedMember = await admitPersonToTeam({
    playwright,
    api,
    name: "E2E PDI Lifecycle",
    email: MEMBER_EMAIL,
    role: "member",
    teamId,
    careerLevelId: await seniorityNamed(api, "Pleno"),
  });
  architectId = admittedMember.architectId;

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
  await dischargePeople(DATABASE_URL, [MEMBER_EMAIL, LEAD_EMAIL]);
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
