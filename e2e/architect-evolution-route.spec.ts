import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { apiPath } from "../src/lib/api-path";
import { unwrap as json } from "./team-link";

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

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await api.post(apiPath("/auth/login"), {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  );
  // ONDA 37 (ADR-0084) — tempo de experiência e especialização saíram do
  // corpo de `POST /architects`: mandá-los seria escrever no vazio.
  const architect = await json<{ id: string }>(
    await api.post(apiPath("/architects"), {
      data: {
        name: "E2E Evolução Rota",
        role: "Pleno",
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
  // Este é o PRIMEIRO spec da rodada (ordem alfabética): o painel do admin
  // chega depois do fan-out inteiro do estado, com todo cache do backend
  // frio — medido em três rodadas de entrega (2026-09-02), sempre entre 5 e
  // 7 s, nunca na segunda vez. Mesma folga da asserção pós-reload abaixo,
  // pelo mesmo motivo: a tela não é lenta, a rodada é que nasce fria.
  await expect(page.getByText("Painel de Capacidades")).toBeVisible({
    timeout: 15000,
  });

  // Deep-link direto na URL da aba — era exatamente o caminho quebrado. É
  // um reload de página cheia (não navegação client-side): a SPA remonta do
  // zero e refaz auth+/api/v1/state antes de saber se o arquiteto existe, o
  // que pode passar dos 5s padrão do Playwright sob carga — timeout maior
  // só nesta primeira asserção pós-reload, não porque a rota é lenta.
  await page.goto(`/architects/${architectId}/evolution`);
  await expect(page.getByRole("heading", { name: /^Evolução —/ })).toBeVisible({ timeout: 15000 });
  // FE-360-005, recortado pela onda 21 (apagar-o-vazio) — a tela tem DUAS
  // subvisões (Resumo/Competências): "Capacidades" fundiu-se ao Resumo (era
  // o mesmo gráfico) e "Linha do tempo" saiu (a história mora na aba irmã
  // "Extrato"). "Comparativo início × fim" mora na aba Competências, não
  // aparece direto no Resumo (que é a aba padrão).
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
