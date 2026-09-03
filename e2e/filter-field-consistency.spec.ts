import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";

import { apiPath } from "../src/lib/api-path";

/**
 * Régua da família de seletores/campos de filtro (onda15/seletores-
 * unificados) — defeito visto pelo dono usando a aplicação: em /team o
 * rótulo "Pessoas" saía menor que os demais (12px vs 14px) e com menos
 * respiro (22px vs 26px), desnivelando as colunas do grid; em /assessments
 * o combobox de pessoa (36px) e o de capacidades (38px) tinham alturas e
 * regras de largura distintas. Causa raiz: cada seletor carregava rótulo/
 * altura/respiro próprios em vez de compartilhar um campo único.
 *
 * Este spec MEDE computed styles no DOM real e congela a régua:
 *   - todo rótulo de campo de filtro: 14px;
 *   - todo trigger da família: 36px de altura (h-9);
 *   - respiro rótulo→campo: 26px (rótulo de 20px + 6px de margem);
 *   - em /assessments, os dois seletores do cabeçalho com a MESMA largura.
 *
 * Asserções soft de propósito: uma rodada vermelha lista TODOS os desvios
 * com os números medidos, não só o primeiro.
 */
const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"];
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"];
const DATABASE_URL =
  process.env["E2E_DATABASE_URL"] ?? "postgres://architect:architect@localhost:5433/architect_os";

const RUN_ID = Date.now().toString(36);
const ARCHITECT_EMAIL = `e2e-regua-${RUN_ID}@architect-os.local`;

const LABEL_FONT_PX = "14px";
const TRIGGER_HEIGHT_PX = 36;
const LABEL_TO_FIELD_GAP_PX = 26;

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não configurados.");

let architectId: string;

test.beforeAll(async ({ playwright }) => {
  const api: APIRequestContext = await playwright.request.newContext({ baseURL: API_URL });
  const logged = await api.post(apiPath("/auth/login"), {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!logged.ok()) throw new Error(`login admin falhou: ${logged.status()}`);

  // ONDA 37 (ADR-0084) — `POST /architects` é a porta LEGADA do profissional
  // sozinho, e é o bastante aqui: esta régua só precisa de UMA linha em
  // /team para os filtros existirem, não de uma conta. Tempo de experiência
  // e especialização saíram do corpo — mandá-los seria escrever no vazio.
  const created = await api.post(apiPath("/architects"), {
    data: { name: "E2E Régua de Filtros", role: "Pleno", email: ARCHITECT_EMAIL },
  });
  if (!created.ok()) throw new Error(`criação de arquiteto falhou: ${created.status()}`);
  const body = (await created.json()) as { data?: { id: string } } & { id?: string };
  architectId = body.data?.id ?? body.id ?? "";
  await api.dispose();
});

test.afterAll(async () => {
  if (!architectId) return;
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("DELETE FROM architects WHERE id = $1", [architectId]);
  } finally {
    await client.end();
  }
});

async function login(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#email").fill(ADMIN_EMAIL!);
  await page.locator("#password").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /Entrar|Enviando/ }).click();
  await expect(page.getByText("Painel de Capacidades")).toBeVisible();
}

interface TriggerMeasure {
  name: string;
  height: number;
  width: number;
  top: number;
  label: { text: string; fontSize: string; top: number } | null;
}

/**
 * A família se declara no papel ARIA: todo trigger é `aria-haspopup=
 * "listbox"` ou `role="combobox"`. Duas variantes compactas deliberadas
 * ficam de fora de propósito: o tamanho de página da paginação
 * (`data-view-page-size`, h-8/text-xs) e o seletor de ciclo da barra
 * superior (`cycle`, h-8 com rótulo inline à esquerda) — são controles de
 * shell/paginação, não campos de filtro de tela.
 */
async function measureTriggers(page: Page): Promise<TriggerMeasure[]> {
  return page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        'button[aria-haspopup="listbox"], button[role="combobox"]',
      ),
    ).filter((botao) => botao.id !== "data-view-page-size" && botao.id !== "cycle");
    return buttons.map((botao) => {
      const rect = botao.getBoundingClientRect();
      const labelEl = botao.id
        ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(botao.id)}"]`)
        : null;
      return {
        name: botao.getAttribute("aria-label") ?? labelEl?.textContent ?? botao.id ?? "(sem nome)",
        height: rect.height,
        width: rect.width,
        top: rect.top,
        label: labelEl
          ? {
              text: labelEl.textContent ?? "",
              fontSize: getComputedStyle(labelEl).fontSize,
              top: labelEl.getBoundingClientRect().top,
            }
          : null,
      };
    });
  });
}

function assertRuler(measures: TriggerMeasure[]): void {
  for (const medida of measures) {
    expect
      .soft(medida.height, `altura do trigger "${medida.name}" (medido ${medida.height}px)`)
      .toBe(TRIGGER_HEIGHT_PX);
    if (medida.label) {
      expect
        .soft(
          medida.label.fontSize,
          `fonte do rótulo "${medida.label.text}" (medido ${medida.label.fontSize})`,
        )
        .toBe(LABEL_FONT_PX);
      const gap = medida.top - medida.label.top;
      expect
        .soft(gap, `respiro rótulo→campo de "${medida.label.text}" (medido ${gap}px)`)
        .toBe(LABEL_TO_FIELD_GAP_PX);
    }
  }
}

test("/team — rótulos 14px, respiro 26px e triggers de 36px em toda a barra de filtros", async ({
  page,
}) => {
  await login(page);
  await page.goto("/team");
  await expect(page.locator('label[for="architect-name-combobox"]')).toBeVisible();

  const measures = await measureTriggers(page);
  const labeled = measures.filter((medida) => medida.label).map((medida) => medida.label!.text);
  // ONDA 37 — "Especialização" saiu da lista de propósito: o dono removeu o
  // campo do cadastro (*"não estou vendo valor"*), e com o campo morto o
  // filtro que o lia não tem mais o que filtrar. Exigi-lo aqui seria a
  // régua congelando um campo que a aplicação não tem.
  for (const expected of ["Pessoas", "Status", "Nível de carreira", "Capacidade", "Ordenar por"]) {
    expect.soft(labeled, `campo com rótulo "${expected}" presente em /team`).toContain(expected);
  }
  assertRuler(measures);
});

test("/assessments — os dois seletores do cabeçalho com 36px e a MESMA largura", async ({
  page,
}) => {
  await login(page);
  await page.goto("/assessments");
  await expect(page.getByRole("combobox", { name: "Profissional" })).toBeVisible();

  const measures = await measureTriggers(page);
  const person = measures.find((medida) => medida.name === "Profissional");
  const capabilities = measures.find((medida) => medida.name === "Capacidades");
  expect(person, "combobox de pessoa presente em /assessments").toBeTruthy();
  expect(capabilities, "seletor de capacidades presente em /assessments").toBeTruthy();

  assertRuler(measures);
  expect
    .soft(
      capabilities!.width,
      `largura: pessoa ${person!.width}px vs capacidades ${capabilities!.width}px`,
    )
    .toBe(person!.width);
});
