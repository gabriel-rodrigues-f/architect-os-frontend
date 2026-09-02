import { chromium, type FullConfig } from "@playwright/test";

/**
 * Aquecimento do vite antes do primeiro spec. O `webServer` só espera a
 * URL responder — o SSR de `/` compilado —, mas o bundle do NAVEGADOR é
 * transformado sob demanda no primeiro carregamento, e o painel depois do
 * login pede outra leva de módulos. Medido na rodada de entrega
 * (2026-09-02): o primeiro spec da rodada gastava ~25 s no `goto("/")` e
 * estourava os 30 s de teste em `architect-evolution-route.spec.ts` — duas
 * rodadas seguidas, sempre o primeiro, nunca o segundo com a mesma
 * asserção. Pagar o custo aqui, uma vez, tira do primeiro spec um vermelho
 * que não é dele. Sem credencial de admin aquece só a tela de login.
 */
export default async function warmUp(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const email = process.env["E2E_ADMIN_EMAIL"];
  const password = process.env["E2E_ADMIN_PASSWORD"];

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ locale: "pt-BR" });
    await page.goto(baseURL);
    await page.locator("#email").waitFor({ state: "visible", timeout: 120_000 });
    if (!email || !password) return;
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
    await page.locator("nav").first().waitFor({ state: "visible", timeout: 120_000 });
    await page
      .getByText("Painel de Capacidades")
      .waitFor({ state: "visible", timeout: 60_000 })
      .catch(() => undefined);
  } finally {
    await browser.close();
  }
}
