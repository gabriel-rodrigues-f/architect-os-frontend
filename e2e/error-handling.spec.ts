import { test, expect } from "@playwright/test";
import { apiPath } from "../src/lib/api-path";
import {
  admitPersonToTeam,
  dischargePeople,
  PASSWORD,
  registerTeam,
  seniorityNamed,
  unlinkTeam,
  unwrap as json,
} from "./team-link";

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

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

let teamId: string;

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: API_URL });
  await json(
    await api.post(apiPath("/auth/login"), {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  );

  // ONDA 37 (ADR-0084) — não existe mais conta sem time: `teamId` é
  // obrigatório no cadastro. Sem régua de propósito: este spec só precisa da
  // pessoa capaz de logar, nunca materializa avaliação.
  teamId = await registerTeam(api, `err-${RUN_ID}`);
  await admitPersonToTeam({
    playwright,
    api,
    name: "E2E Error Member",
    email: MEMBER_EMAIL,
    role: "member",
    teamId,
    careerLevelId: await seniorityNamed(api, "Pleno"),
  });
  await api.dispose();
});

test.afterAll(async () => {
  await dischargePeople(DATABASE_URL, [MEMBER_EMAIL]);
  await unlinkTeam(DATABASE_URL, teamId);
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
  // ONDA 37 — a negativa mudou de dono junto com a tela: /users deixou de ser
  // "diretório de contas restrito a administradores" e virou o CADASTRO, que
  // o gestor e o tech lead do time também alcançam. Quem não lidera ninguém
  // lê de quem é o gesto, não que ele é do admin.
  await page.goto("/users");
  await expect(page.getByText("Cadastrar pessoas é da liderança.")).toBeVisible();
  await expect(
    page.getByText(
      "Quem cadastra é o administrador, o gestor do time ou o tech lead do time. Fale com quem lidera o seu.",
    ),
  ).toBeVisible();
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
  await expect(page.getByText("Painel de Capacidades")).toBeVisible();

  await page.goto(`/architects/e2e-nao-existe-${RUN_ID}`);
  await expect(page.getByText("Profissional não encontrado.")).toBeVisible();
});
