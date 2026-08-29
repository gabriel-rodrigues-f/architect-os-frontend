import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiPath } from "../src/lib/api-path";

/**
 * R10-UX-001 (ORIENTACAO-DECIMA-RODADA-ENTERPRISE-SYNAPSE-2026-08-21.md,
 * Seção 6) — o modal "Editar competência" não pode gerar overflow horizontal
 * em nenhum viewport, mesmo com nome de competência muito longo. Cobre os
 * cinco viewports pedidos na Seção 6/94 e o caso explícito de nome >80
 * caracteres.
 *
 * Massa de teste via API, prefixo `e2e-`, removida no afterAll — mesmo
 * padrão de `golden-path.spec.ts`.
 *
 * Requer:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — conta administradora já existente
 */
const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"];
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"];

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

/** >80 caracteres — exigido pelo critério de aceite da Seção 6. */
const LONG_NAME =
  "Governança de Arquitetura Corporativa Multi-Cloud com Padrões de Observabilidade e Resiliência Distribuída";

let capabilityId: string;
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
  // AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-32 — `id` deixou de
  // ser aceito na criação (gerado sempre pelo servidor); captura o id real
  // devolvido em vez de assumir que o valor enviado sobrevive.
  const capability = await json<{ id: string }>(
    await api.post(apiPath("/capabilities"), {
      data: { name: "E2E Capacidade Responsiva", short: "E2ERESP" },
    }),
  );
  capabilityId = capability.id;
  // Fase 2 (backend ADR-0032): a competência global é só nome + capacidade —
  // requirementType/expected morreram no catálogo (400 a campo extra).
  const competency = await json<{ id: string }>(
    await api.post(apiPath("/competencies"), {
      data: { name: LONG_NAME, capabilityId },
    }),
  );
  competencyId = competency.id;
  await api.dispose();
});

test.afterAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await api.post(apiPath("/auth/login"), {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  );
  // Sem `force`: nenhuma resposta real foi registrada contra esta
  // competência descartável, então a exclusão de verdade é esperada.
  await api.delete(apiPath(`/competencies/${competencyId}`));
  await api.delete(apiPath(`/capabilities/${capabilityId}`));
  await api.dispose();
});

const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test(`modal Editar competência sem overflow horizontal em ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator("#email").fill(ADMIN_EMAIL!);
    await page.locator("#password").fill(ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
    await expect(page.getByText("Painel de Capacidades de Arquitetura")).toBeVisible();

    await page.goto("/competency-matrix");
    // O card da capacidade nasce recolhido — a busca força a expansão do
    // grupo (`isExpanded = ... || term.length > 0`), revelando a linha da
    // competência e seu botão "Editar" sem precisar de um segundo clique.
    await page.getByLabel("Buscar capacidade ou competência…").fill(LONG_NAME);
    await page.getByRole("button", { name: `Editar ${LONG_NAME}` }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Nenhum elemento do modal pode ultrapassar a largura do viewport — a
    // correção precisa responder à largura de verdade, não só esconder o
    // overflow com scroll horizontal (Seção 6: "isso esconderia um problema
    // de layout").
    const overflowsHorizontally = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      if (!dialogEl) return true;
      const rect = dialogEl.getBoundingClientRect();
      return rect.right > window.innerWidth + 1 || rect.left < -1;
    });
    expect(overflowsHorizontally).toBe(false);

    // Critério de aceite literal da Seção 6: nenhum select/botão/mensagem/
    // tooltip/dropdown DENTRO do modal pode ultrapassar o próprio
    // DialogContent — escopo é o modal, não a página de trás dele (a tabela
    // da matriz já rola horizontalmente por design, dentro do próprio
    // `overflow-x-auto`, e isso é um comportamento à parte, não o bug aqui).
    const childOverflowsDialog = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      if (!dialogEl) return true;
      const dialogRect = dialogEl.getBoundingClientRect();
      const children = dialogEl.querySelectorAll("select, button, input, [role='tooltip']");
      for (const child of children) {
        const rect = child.getBoundingClientRect();
        if (rect.right > dialogRect.right + 1 || rect.left < dialogRect.left - 1) return true;
      }
      return false;
    });
    expect(childOverflowsDialog).toBe(false);
  });
}
