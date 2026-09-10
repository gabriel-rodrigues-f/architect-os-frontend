import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { Route as ScoringRulersRoute } from "@/routes/scoring-rulers";
import { fixtureAdminUser, fixtureUnassignedTechLeadUser } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
  hrefOf,
} from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * CFG-05 (SPEC-OO3-13, §3.2) — aba "Operação" de /settings: admin-only,
 * edição das 3 settings de `app_settings` → UM PUT por key ALTERADA em
 * /api/v1/config/settings/:key, aviso de que a cadência só afeta ciclos
 * futuros, invalidação da query das settings (+ /api/v1/state ao mudar a
 * cadência) e 400 INVALID_APP_SETTING do backend exibido no formulário
 * (role="alert").
 */

const fetchMock = vi.fn();
const ScoringRulersPage = ScoringRulersRoute.options.component as () => ReactNode;

const settingRecord = (key: string, value: string | number) => ({
  key,
  value,
  valueType: typeof value === "number" ? "int" : "enum",
  scope: "operational",
  description: null,
  updatedAt: "2026-08-26T00:00:00Z",
  updatedBy: null,
});

/** GET /api/v1/config/settings com valores dados (default: o seed SEMIANNUAL/3/3). */
const settingsGetRoute =
  (cadence: string = "SEMIANNUAL", threshold = 3): FetchRoute =>
  (href, init) =>
    href.endsWith(apiPath("/config/settings")) && (init?.method ?? "GET") === "GET"
      ? jsonResponse({
          settings: [
            settingRecord("cycle.cadence", cadence),
            settingRecord("training.collectiveInterventionThreshold", threshold),
          ],
        })
      : undefined;

const countGets = (suffix: string) =>
  fetchMock.mock.calls.filter((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return (
      hrefOf(url as string | URL | Request).endsWith(suffix) &&
      ((init as RequestInit | undefined)?.method ?? "GET") === "GET"
    );
  }).length;

const findPut = (suffix: string) =>
  fetchMock.mock.calls.find((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return hrefOf(url as string | URL | Request).endsWith(suffix) && init?.method === "PUT";
  });

/** O bloco das políticas dentro da seção "Operação". */
async function operationalBlock(): Promise<HTMLElement> {
  const title = await screen.findByText("Políticas operacionais");
  return title.closest("div.surface-inset") as HTMLElement;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Operação (CFG-05 admin UI)", () => {
  /**
   * Onda 31 — o member deixou de alcançar /settings (o dono tirou a Política
   * de Progressão do profissional); o não-admin que ainda a lê é o tech lead.
   */
  /**
   * Onda do GRUPO (dono, 2026-09-10): a seção virou ROTA, e quem não a
   * alcança não vê caixa vazia — ouve a recusa por escrito. É o conserto do
   * achado (C) do inventário de alcance de 2026-09-05.
   */
  it("não-admin recebe a recusa por escrito, e os parâmetros não são desenhados", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureUnassignedTechLeadUser,
      routes: [careerLevelsRoute, settingsGetRoute()],
    });
    renderWithApp(<ScoringRulersPage />);
    expect(await screen.findByText("Esta configuração é de quem opera o sistema.")).toBeTruthy();
    expect(screen.queryByText("Políticas operacionais")).toBeNull();
  });

  it("admin vê cadência e limiar efetivos e o aviso de ciclos futuros", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [careerLevelsRoute, settingsGetRoute("QUARTERLY", 2)],
    });
    renderWithApp(<ScoringRulersPage />);

    const block = await operationalBlock();
    expect(within(block).getByText("Cadência dos ciclos")).toBeTruthy();
    await waitFor(() => {
      expect(within(block).getByText("Trimestral")).toBeTruthy();
    });
    expect(within(block).getByText("2")).toBeTruthy();
    expect(
      within(block).getByText(
        "Mudar a cadência só afeta ciclos futuros — os existentes mantêm nome, datas e vínculos.",
      ),
    ).toBeTruthy();
  });

  it("inteiro < 1 mostra o erro client-side e desabilita salvar", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [careerLevelsRoute, settingsGetRoute()],
    });
    renderWithApp(<ScoringRulersPage />);

    const block = await operationalBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const thresholdInput = within(block).getByLabelText(
      "Mínimo de profissionais (intervenção coletiva)",
    );
    await userEvent.clear(thresholdInput);
    await userEvent.type(thresholdInput, "0");

    const alert = within(block).getByRole("alert");
    expect(alert.textContent).toBe("Informe inteiros maiores ou iguais a 1.");
    expect(
      (within(block).getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("salvar envia UM PUT por key alterada e, com cadência nova, invalida settings E as fatias de contexto", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.includes(apiPath("/config/settings/")) && init?.method === "PUT"
            ? jsonResponse({
                key: decodeURIComponent(href.split(apiPath("/config/settings/"))[1]!),
                value: (JSON.parse(String(init.body)) as { value: string | number }).value,
              })
            : undefined,
        settingsGetRoute(),
      ],
    });
    renderWithApp(<ScoringRulersPage />);

    const block = await operationalBlock();
    const settingsGetsBefore = countGets(apiPath("/config/settings"));
    const stateGetsBefore = countGets(apiPath("/cycles"));
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    await userEvent.selectOptions(within(block).getByLabelText("Cadência dos ciclos"), "QUARTERLY");
    const thresholdInput = within(block).getByLabelText(
      "Mínimo de profissionais (intervenção coletiva)",
    );
    await userEvent.clear(thresholdInput);
    await userEvent.type(thresholdInput, "2");
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const cadencePut = findPut(apiPath("/config/settings/cycle.cadence"));
      expect(cadencePut).toBeTruthy();
      expect(JSON.parse(String((cadencePut![1] as RequestInit).body))).toEqual({
        value: "QUARTERLY",
      });
      const thresholdPut = findPut(
        apiPath("/config/settings/training.collectiveInterventionThreshold"),
      );
      expect(thresholdPut).toBeTruthy();
      expect(JSON.parse(String((thresholdPut![1] as RequestInit).body))).toEqual({ value: 2 });
    });
    // Ociosidade não mudou — nenhum PUT dessa key.
    expect(findPut(apiPath("/config/settings/session.idleTimeoutMinutes"))).toBeUndefined();

    // Invalidação encadeada ao sucesso: a query das settings refaz o GET e,
    // porque a cadência mudou, as fatias de contexto também (a tela de
    // ciclos lê os ciclos vigentes da fatia `cycles`).
    await waitFor(() => {
      expect(countGets(apiPath("/config/settings"))).toBeGreaterThan(settingsGetsBefore);
      expect(countGets(apiPath("/cycles"))).toBeGreaterThan(stateGetsBefore);
    });
  });

  it("400 INVALID_APP_SETTING do backend aparece no formulário (role=alert)", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.includes(apiPath("/config/settings/")) && init?.method === "PUT"
            ? jsonResponse(
                {
                  code: "INVALID_APP_SETTING",
                  message:
                    '"training.collectiveInterventionThreshold" precisa ser >= 1 (recebido: 7).',
                },
                400,
              )
            : undefined,
        settingsGetRoute(),
      ],
    });
    renderWithApp(<ScoringRulersPage />);

    const block = await operationalBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));
    // Rascunho client-side válido — o 400 simulado é a autoridade do backend.
    const thresholdInput = within(block).getByLabelText(
      "Mínimo de profissionais (intervenção coletiva)",
    );
    await userEvent.clear(thresholdInput);
    await userEvent.type(thresholdInput, "7");
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    const alert = await within(block).findByRole("alert");
    expect(alert.textContent).toBe(
      '"training.collectiveInterventionThreshold" precisa ser >= 1 (recebido: 7).',
    );
  });
});
