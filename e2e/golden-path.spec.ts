import { test, expect } from "@playwright/test";
import {
  admitPersonToTeam,
  dischargePeople,
  PASSWORD,
  registerTeamWithRules,
  seniorityNamed,
  unlinkTeam,
  unwrap,
} from "./team-link";
import { apiPath } from "../src/lib/api-path";

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
 * ONDA 37 (backend ADR-0084) — o TIME nasce primeiro e as duas pessoas
 * nascem nele. Não há mais profissional criado à parte para depois receber
 * uma conta: `POST /auth/users` devolve `architectId` porque a conta e o
 * profissional são o mesmo cadastro.
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
const MEMBER_NAME = "E2E Golden Path";
const LEAD_NAME = "E2E Golden Lead";
const MEMBER_EMAIL = `e2e-member-${RUN_ID}@architect-os.local`;
const LEAD_EMAIL = `e2e-lead-${RUN_ID}@architect-os.local`;

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

let architectId: string;
let teamId: string;

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });

  // ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 24 — a sessão agora vive num
  // cookie HttpOnly; não há mais token para extrair do corpo. O
  // `APIRequestContext` do Playwright tem cookie jar própria (como um
  // browser de verdade) — o cookie que este login grava é reenviado
  // automaticamente nas chamadas seguintes deste mesmo `api`, sem precisar
  // montar nenhum header na mão.
  await unwrap(
    await api.post(apiPath("/auth/login"), {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  );

  teamId = await registerTeamWithRules(api, `gp-${RUN_ID}`);

  // SEC-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — cadastro
  // público (`/api/v1/auth/register`) só funciona na instância vazia; com o
  // admin já existindo, toda tentativa de registro público recusa com 403.
  // A única forma de entrar conta nova a partir daqui é o admin admitir a
  // pessoa no time, que devolve senha temporária e nasce com
  // mustChangePassword=true — mesma jornada real de alguém convidado. O
  // helper já troca a senha porque os testes de UI abaixo logam esperando o
  // painel, não uma tela de troca de senha obrigatória.
  await admitPersonToTeam({
    playwright,
    api,
    name: LEAD_NAME,
    email: LEAD_EMAIL,
    role: "tech_lead",
    teamId,
  });

  // Senioridade é exigida do profissional e proibida na liderança (ADR-0084).
  const admittedMember = await admitPersonToTeam({
    playwright,
    api,
    name: MEMBER_NAME,
    email: MEMBER_EMAIL,
    role: "member",
    teamId,
    careerLevelId: await seniorityNamed(api, "Pleno"),
  });
  architectId = admittedMember.architectId;

  await api.dispose();
});

test.afterAll(async () => {
  await dischargePeople(DATABASE_URL, [MEMBER_EMAIL, LEAD_EMAIL]);
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

  await expect(page.getByText("Painel de Capacidades")).toBeVisible();

  await page.getByRole("link", { name: "Matriz de Competências" }).click();
  await expect(page).toHaveURL(/\/competency-matrix/);

  await page.getByRole("link", { name: "Usuários" }).click();
  await expect(page).toHaveURL(/\/users/);
  await expect(page.getByText(MEMBER_NAME, { exact: true })).toBeVisible();
  await expect(page.getByText(LEAD_NAME, { exact: true })).toBeVisible();
});

test("Member — Minha Evolução, navegação restrita e a própria ficha negada", async ({ page }) => {
  await login(page, MEMBER_EMAIL, PASSWORD);

  await expect(page.getByText("Minha Evolução")).toBeVisible();
  await expect(page.getByText(MEMBER_NAME).first()).toBeVisible();

  // Nav admin-only não aparece pra quem não é admin (QW-01/QW-02).
  await expect(page.getByRole("link", { name: "Matriz de Competências" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);

  // Onda 31 (pedido do dono: o profissional não vê os próprios números): a
  // ficha de carreira dele é lida por quem o lidera. No acesso direto por
  // URL a guarda é cega à sessão (SSR) e quem nega é a TELA — sem os
  // "Próximos passos" que ela mostrava antes.
  await page.goto(`/architects/${architectId}`);
  await expect(
    page.getByText("A sua ficha de carreira é lida por quem lidera você."),
  ).toBeVisible();
  await expect(page.getByText("Próximos passos")).toHaveCount(0);
});

test("Lead — Pendências do Lead escopadas à própria liderança", async ({ page }) => {
  await login(page, LEAD_EMAIL, PASSWORD);

  await expect(page.getByText("Pendências do Lead")).toBeVisible();

  // DUAS pessoas, não uma: pelo cadastro unificado (ADR-0084) o próprio Tech
  // Lead nasce com profissional no time que lidera — a liderança aparece no
  // quadro e nas contagens de PESSOAS, só não nas leituras por senioridade
  // (ela não tem nível de carreira). Contar 1 aqui seria congelar o modelo
  // velho, em que a conta do lead não tinha profissional nenhum.
  const myPeopleCard = page.locator(".surface-card", { hasText: "Pessoas sob sua liderança" });
  await expect(myPeopleCard).toContainText("2");

  // Sem avaliação/evidência/PDI pendente ainda — estado "tudo em dia".
  await expect(page.getByText("Nada pendente no momento")).toBeVisible();

  await page.goto(`/architects/${architectId}`);
  await expect(page.getByText(MEMBER_NAME).first()).toBeVisible();
});
