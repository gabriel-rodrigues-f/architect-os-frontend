import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureMemberUser } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
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
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

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
  (cadence: string = "SEMIANNUAL", floor = 3, threshold = 3): FetchRoute =>
  (href, init) =>
    href.endsWith(apiPath("/config/settings")) && (init?.method ?? "GET") === "GET"
      ? jsonResponse({
          settings: [
            settingRecord("cycle.cadence", cadence),
            settingRecord("career.minimumQualifiedFloor", floor),
            settingRecord("training.collectiveInterventionThreshold", threshold),
          ],
        })
      : undefined;

const countGets = (suffix: string) =>
  fetchMock.mock.calls.filter((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return (
      String(url).endsWith(suffix) && ((init as RequestInit | undefined)?.method ?? "GET") === "GET"
    );
  }).length;

const findPut = (suffix: string) =>
  fetchMock.mock.calls.find((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return String(url).endsWith(suffix) && init?.method === "PUT";
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
  it("não-admin não vê a seção", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      routes: [careerLevelsRoute, settingsGetRoute()],
    });
    renderWithApp(<SettingsPage />);
    expect(await screen.findByText("Referência do modelo")).toBeTruthy();
    expect(screen.queryByText("Políticas operacionais")).toBeNull();
  });

  it("admin vê cadência, piso e limiar efetivos e o aviso de ciclos futuros", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, settingsGetRoute("QUARTERLY", 4, 2)] });
    renderWithApp(<SettingsPage />);

    const block = await operationalBlock();
    expect(within(block).getByText("Cadência dos ciclos")).toBeTruthy();
    await waitFor(() => {
      expect(within(block).getByText("Trimestral")).toBeTruthy();
    });
    expect(within(block).getByText("4")).toBeTruthy();
    expect(within(block).getByText("2")).toBeTruthy();
    expect(
      within(block).getByText(
        "Mudar a cadência só afeta ciclos futuros — os existentes mantêm nome, datas e vínculos.",
      ),
    ).toBeTruthy();
  });

  it("inteiro < 1 mostra o erro client-side e desabilita salvar", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, settingsGetRoute()] });
    renderWithApp(<SettingsPage />);

    const block = await operationalBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const floorInput = within(block).getByLabelText("Piso de capacidades qualificadas");
    await userEvent.clear(floorInput);
    await userEvent.type(floorInput, "0");

    const alert = within(block).getByRole("alert");
    expect(alert.textContent).toBe("Informe inteiros maiores ou iguais a 1.");
    expect(
      (within(block).getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("salvar envia UM PUT por key alterada e, com cadência nova, invalida settings E /api/v1/state", async () => {
    mockAppFetch(fetchMock, {
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
    renderWithApp(<SettingsPage />);

    const block = await operationalBlock();
    const settingsGetsBefore = countGets(apiPath("/config/settings"));
    const stateGetsBefore = countGets(apiPath("/state"));
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    await userEvent.selectOptions(within(block).getByLabelText("Cadência dos ciclos"), "QUARTERLY");
    const thresholdInput = within(block).getByLabelText("Mínimo de pessoas (intervenção coletiva)");
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
    // Piso não mudou — nenhum PUT dessa key.
    expect(findPut(apiPath("/config/settings/career.minimumQualifiedFloor"))).toBeUndefined();

    // Invalidação encadeada ao sucesso: a query das settings refaz o GET e,
    // porque a cadência mudou, o snapshot de /api/v1/state também (a tela de
    // ciclos lê os ciclos vigentes de lá).
    await waitFor(() => {
      expect(countGets(apiPath("/config/settings"))).toBeGreaterThan(settingsGetsBefore);
      expect(countGets(apiPath("/state"))).toBeGreaterThan(stateGetsBefore);
    });
  });

  it("400 INVALID_APP_SETTING do backend aparece no formulário (role=alert)", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.includes(apiPath("/config/settings/")) && init?.method === "PUT"
            ? jsonResponse(
                {
                  code: "INVALID_APP_SETTING",
                  message: '"career.minimumQualifiedFloor" precisa ser >= 1 (recebido: 7).',
                },
                400,
              )
            : undefined,
        settingsGetRoute(),
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await operationalBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));
    // Rascunho client-side válido — o 400 simulado é a autoridade do backend.
    const floorInput = within(block).getByLabelText("Piso de capacidades qualificadas");
    await userEvent.clear(floorInput);
    await userEvent.type(floorInput, "7");
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    const alert = await within(block).findByRole("alert");
    expect(alert.textContent).toBe(
      '"career.minimumQualifiedFloor" precisa ser >= 1 (recebido: 7).',
    );
  });

  it("piso efetivo do servidor rege a Política de Progressão (min e validação da linha)", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, settingsGetRoute("SEMIANNUAL", 4, 3)] });
    renderWithApp(<SettingsPage />);

    // Espera o piso 4 carregar antes de abrir a edição da linha.
    const block = await operationalBlock();
    await waitFor(() => {
      expect(within(block).getByText("4")).toBeTruthy();
    });

    // O h1 da página tem o mesmo texto — o card da política é o heading nível 2.
    const policyTitle = await screen.findByRole("heading", {
      name: "Política de Progressão",
      level: 2,
    });
    const section = policyTitle.closest("section") as HTMLElement;
    const editButtons = within(section).getAllByRole("button", { name: "Editar" });
    await userEvent.click(editButtons[0]!);

    const input = section.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.min).toBe("4");
    await userEvent.clear(input);
    await userEvent.type(input, "3"); // abaixo do piso efetivo 4 — antes o literal 3 deixaria salvar
    const saveButton = within(input.closest("tr") as HTMLElement).getByRole("button", {
      name: "Salvar",
    }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });
});
