import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";

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
 * Gate de entrega — fluxos de escrita pela UI (onda13/harness-ux).
 * Complementa a navegação de `navigation-capture.spec.ts` preenchendo
 * formulários de verdade e afirmando o resultado NA TELA (e após reload,
 * quando o dado precisa ter chegado ao servidor).
 *
 * Dos 5 fluxos principais, DOIS já têm spec própria nesta pasta e não são
 * duplicados aqui: registrar sessão de mentoria (`mentoring.spec.ts`) e
 * check-in/transição de item de PDI (`pdi-lifecycle.spec.ts`). Este spec
 * cobre os outros dois — avaliação (member avalia e envia; lead pontua e
 * conclui) e criação de item de PDI a partir de um gap — mais a configuração
 * administrativa de vocabulário. (Havia um terceiro, o registro de evidência,
 * que morreu com a evidência: dono, 2026-09-08, regra 17.)
 *
 * Os testes deste arquivo são UMA jornada em sequência (workers=1 no
 * config): a avaliação concluída no 2º teste é o que gera o gap que o 3º
 * transforma em item de PDI. Mesma disciplina dos outros specs: massa via
 * API (padrão de `golden-path.spec.ts`), limpeza direta no Postgres com
 * prefixo `e2e-`, `test.skip` sem credenciais de admin.
 */
const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"];
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"];
const DATABASE_URL =
  process.env["E2E_DATABASE_URL"] ?? "postgres://architect:architect@localhost:5433/architect_os";

const RUN_ID = Date.now().toString(36);
const PROFESSIONAL_NAME = "E2E Fluxos de Escrita";
const LEAD_NAME = "E2E Fluxos Lead";
const MEMBER_EMAIL = `e2e-flux-member-${RUN_ID}@architect-os.local`;
const LEAD_EMAIL = `e2e-flux-lead-${RUN_ID}@architect-os.local`;
const VOCAB_CODE = `E2E_HARNESS_${RUN_ID.toUpperCase()}`;
const ACTION_PLAN = `E2E plano de ação ${RUN_ID} — praticar com revisão do Tech Lead`;

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

let professionalId: string;
let assessmentId: string;
let capabilityIds: string[];
let teamId: string;

async function sessionOf(
  playwright: typeof import("playwright-core"),
  email: string,
  password: string,
): Promise<APIRequestContext> {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  await json(await api.post(apiPath("/auth/login"), { data: { email, password } }));
  return api;
}

async function login(page: Page, email: string, password: string, marker: RegExp | string) {
  await page.goto("/");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /Entrar|Entrando|Enviando/ }).click();
  await expect(page.getByText(marker).first()).toBeVisible();
}

const statusBar = (page: Page) => page.locator("div.surface-inset", { hasText: "Situação" });

interface StateAssessmentItem {
  competencyId: string;
  version: number;
}

async function assessmentItems(api: APIRequestContext): Promise<StateAssessmentItem[]> {
  const assessments = await json<Array<{ id: string; items: StateAssessmentItem[] }>>(
    await api.get(apiPath("/assessments")),
  );
  const found = assessments.find((assessment) => assessment.id === assessmentId);
  if (!found) throw new Error(`avaliação ${assessmentId} não veio em /assessments`);
  return found.items;
}

/**
 * O `expectedVersion` do PATCH de item é a versão do ITEM
 * (`Assessment.patchItem` → `item.applyPatch(patch, expectedVersion)`),
 * não a da avaliação — errar isso rende ASSESSMENT_VERSION_CONFLICT.
 */
async function scoreItems(api: APIRequestContext, data: Record<string, number>): Promise<void> {
  for (const item of await assessmentItems(api)) {
    await json(
      await api.patch(apiPath(`/assessments/${assessmentId}/items/${item.competencyId}`), {
        data: { ...data, expectedVersion: item.version },
      }),
    );
  }
}

test.beforeAll(async ({ playwright }) => {
  const api = await sessionOf(playwright, ADMIN_EMAIL!, ADMIN_PASSWORD!);

  // ONDA 37 (ADR-0084) — o time nasce primeiro e as duas pessoas nascem
  // nele: a conta e o profissional do member são o MESMO cadastro, e é dele
  // que sai o `professionalId` que esta jornada inteira usa.
  teamId = await registerTeamWithRules(api, `flux-${RUN_ID}`);
  await admitPersonToTeam({
    playwright,
    api,
    name: LEAD_NAME,
    email: LEAD_EMAIL,
    role: "tech_lead",
    teamId,
  });
  const admittedMember = await admitPersonToTeam({
    playwright,
    api,
    name: PROFESSIONAL_NAME,
    email: MEMBER_EMAIL,
    role: "member",
    teamId,
    careerLevelId: await seniorityNamed(api, "Pleno"),
  });
  professionalId = admittedMember.professionalId;

  const cycles = await json<Array<{ id: string; status: string }>>(
    await api.get(apiPath("/cycles")),
  );
  const cycleId = cycles.find((cycle) => cycle.status === "Active")?.id ?? cycles[0]!.id;

  const assessment = await json<{ id: string }>(
    await api.post(apiPath("/assessments"), { data: { professionalId, cycleId } }),
  );
  assessmentId = assessment.id;

  // A avaliação NASCE SEM ITENS: eles materializam quando o PRÓPRIO
  // profissional propõe capacidades ao portfólio do ciclo (mínimo 3 para
  // enviar — PORTFOLIO_BELOW_MINIMUM). As 3 primeiras do catálogo, porque
  // a primeira é a que a tela de avaliação seleciona por padrão — é nela
  // que o teste 1 vai mexer. Preencher as dezenas de autoavaliações linha
  // a linha pela UI não acrescenta cobertura: o teste 1 muda UMA nota pela
  // UI (o gesto real) e o resto nasce preenchido via API.
  const member = await sessionOf(playwright, MEMBER_EMAIL, PASSWORD);
  const capabilities = await json<Array<{ id: string }>>(
    await member.get(apiPath("/capabilities")),
  );
  capabilityIds = capabilities.slice(0, 3).map((capability) => capability.id);
  for (const capabilityId of capabilityIds) {
    await json(
      await member.post(apiPath(`/assessments/${assessmentId}/capabilities`), {
        data: { capabilityId },
      }),
    );
  }

  await scoreItems(member, { self: 2 });
  await member.dispose();
  await api.dispose();
});

test.afterAll(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    // O ledger de evolução referencia professionals com RESTRICT de propósito
    // (migração ledger-professional-restrict) — concluir a avaliação no teste 2
    // grava degraus lá, e a limpeza precisa removê-los primeiro, na mão.
    await client.query(
      "DELETE FROM professional_competency_level_events WHERE professional_id = $1",
      [professionalId],
    );
    await client.query("DELETE FROM professional_competency_state WHERE professional_id = $1", [
      professionalId,
    ]);
    await client.query(
      `DELETE FROM professional_state_snapshot_items
        WHERE snapshot_id IN (SELECT id FROM professional_state_snapshots WHERE professional_id = $1)`,
      [professionalId],
    );
    await client.query("DELETE FROM professional_state_snapshots WHERE professional_id = $1", [
      professionalId,
    ]);
    await client.query(
      "DELETE FROM domain_vocabularies WHERE vocabulary = 'ACTION_TYPE' AND code = $1",
      [VOCAB_CODE],
    );
  } finally {
    await client.end();
  }
  await dischargePeople(DATABASE_URL, [MEMBER_EMAIL, LEAD_EMAIL]);
  await unlinkTeam(DATABASE_URL, teamId);
});

test("Member avalia uma competência pela UI e envia a avaliação para revisão", async ({ page }) => {
  await login(page, MEMBER_EMAIL, PASSWORD, "Minha Evolução");

  await page.goto(`/assessments?professionalId=${professionalId}`);
  await expect(statusBar(page)).toContainText("Rascunho");

  const autoavaliacao = page.getByLabel(/^Autoavaliação — /).first();
  const persisted = page.waitForResponse(
    (response) => response.url().includes(`/assessments/${assessmentId}/items/`) && response.ok(),
  );
  await autoavaliacao.selectOption("3");
  await persisted;
  await expect(autoavaliacao).toHaveValue("3");

  await page.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect(statusBar(page)).toContainText("Em revisão");

  await page.reload();
  await expect(statusBar(page)).toContainText("Em revisão");
});

test("Tech Lead pontua pela UI e conclui a avaliação", async ({ page, playwright }) => {
  // Concluir exige as capacidades do portfólio CONFIRMADAS pelo Tech Lead
  // (PORTFOLIO_CONFIRMED_BELOW_MINIMUM). As demais linhas nascem pontuadas
  // via API pela mesma razão do teste anterior; `final: 1` de propósito —
  // é o que abre gap contra o alvo do cargo e alimenta o fluxo de PDI
  // logo abaixo.
  const lead = await sessionOf(playwright, LEAD_EMAIL, PASSWORD);
  for (const capabilityId of capabilityIds) {
    await json(
      await lead.post(
        apiPath(`/assessments/${assessmentId}/capabilities/${capabilityId}/confirm`),
        {
          data: {},
        },
      ),
    );
  }
  await scoreItems(lead, { leader: 2, final: 1 });
  await lead.dispose();

  await login(page, LEAD_EMAIL, PASSWORD, "Ações da Liderança");

  await page.goto(`/assessments?professionalId=${professionalId}`);
  await expect(statusBar(page)).toContainText("Em revisão");

  const notaLead = page.getByLabel(/^Nota do Tech Lead — /).first();
  const leaderPersisted = page.waitForResponse(
    (response) => response.url().includes(`/assessments/${assessmentId}/items/`) && response.ok(),
  );
  await notaLead.selectOption("3");
  await leaderPersisted;
  const notaFinal = page.getByLabel(/^Nota final — /).first();
  const finalPersisted = page.waitForResponse(
    (response) => response.url().includes(`/assessments/${assessmentId}/items/`) && response.ok(),
  );
  await notaFinal.selectOption("2");
  await finalPersisted;

  await page.getByRole("button", { name: "Concluir avaliação" }).click();
  const confirmacao = page.getByRole("dialog");
  await expect(confirmacao).toContainText("Concluir a avaliação de");
  await confirmacao.getByRole("button", { name: "Confirmar e concluir" }).click();
  await expect(statusBar(page)).toContainText("Concluída");

  await page.reload();
  await expect(statusBar(page)).toContainText("Concluída");
});

test("Member cria uma ação de PDI a partir do maior gap", async ({ page }) => {
  await login(page, MEMBER_EMAIL, PASSWORD, "Minha Evolução");

  await page.goto(`/development-plans?professionalId=${professionalId}`);

  const sugestoes = page.locator("section, div").filter({ hasText: "Maiores distâncias" });
  const adicionar = page.getByRole("button", { name: "Adicionar ao PDI" }).first();
  await expect(
    adicionar,
    "Nenhum gap sugerido — a avaliação concluída no teste anterior (final=1) deveria ficar abaixo do alvo do cargo em ao menos uma competência.",
  ).toBeVisible();
  await expect(sugestoes.first()).toBeVisible();
  await adicionar.click();

  const dialog = page.getByRole("dialog");
  await dialog.locator("#new-item-action-type").selectOption({ index: 0 });
  await dialog.locator("#new-item-action-plan").fill(ACTION_PLAN);
  const targetDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await dialog.locator("#new-item-target-date").fill(targetDate);
  await dialog.locator("#new-item-dedication").fill("4");
  await dialog.getByRole("button", { name: "Salvar ação" }).click();

  await expect(page.getByText(ACTION_PLAN)).toBeVisible();

  await page.reload();
  await expect(page.getByText(ACTION_PLAN)).toBeVisible();
});

test("Admin adiciona um código ao vocabulário de tipos de ação do PDI", async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!, "Painel de Capacidades");

  // Onda do GRUPO (dono, 2026-09-10): os vocabulários ganharam rota própria.
  await page.goto("/vocabularies");
  await expect(page.getByRole("heading", { level: 1, name: "Vocabulários" })).toBeVisible();

  const bloco = page
    .locator("div.surface-inset")
    .filter({ has: page.getByText("Tipos de ação do PDI", { exact: true }) });
  await bloco.getByRole("button", { name: "Novo código" }).click();
  await bloco.locator("#vocab-new-code-ACTION_TYPE").fill(VOCAB_CODE);
  await bloco.locator("#vocab-new-labelkey-ACTION_TYPE").fill(`actionType.e2e${RUN_ID}`);
  await bloco.getByRole("button", { name: "Adicionar", exact: true }).click();

  await expect(page.getByText(`Código “${VOCAB_CODE}” adicionado.`)).toBeVisible();
  await expect(bloco.getByText(VOCAB_CODE, { exact: false }).first()).toBeVisible();

  await page.reload();
  await expect(
    page
      .locator("div.surface-inset")
      .filter({ has: page.getByText("Tipos de ação do PDI", { exact: true }) })
      .getByText(VOCAB_CODE)
      .first(),
  ).toBeVisible();
});
