import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as SettingsRoute } from "@/routes/settings";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * ONDA 31, fatia `ociosidade-na-tela` — pedido literal do dono:
 *
 *   "eu quero que seja configurável pelo administrador em uma tela de
 *    configuração." · "o tempo mínimo sem acesso deve ser 5 minutos."
 *
 * A tela é a que já existe (`/settings`, seção "Operação"): o tempo máximo
 * sem atividade entra como irmão da cadência, do piso e do limiar, salvo pelo
 * mesmo `PUT /config/settings/{key}`. O piso de 5 é regra de DOMÍNIO do
 * backend; aqui ele é ECOADO (`min` do campo + validação client-side), para
 * que a tela não deixe o administrador digitar um valor que o servidor vai
 * recusar.
 */
const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

const RÓTULO = "Tempo máximo sem atividade (minutos)";

const settingRecord = (key: string, value: string | number) => ({
  key,
  value,
  valueType: typeof value === "number" ? "int" : "enum",
  scope: "operational",
  description: null,
  updatedAt: "2026-09-01T00:00:00Z",
  updatedBy: null,
});

const settingsGetRoute =
  (idleTimeout: number): FetchRoute =>
  (href, init) =>
    href.endsWith(apiPath("/config/settings")) && (init?.method ?? "GET") === "GET"
      ? jsonResponse({
          settings: [
            settingRecord("cycle.cadence", "SEMIANNUAL"),
            settingRecord("career.minimumQualifiedFloor", 3),
            settingRecord("training.collectiveInterventionThreshold", 3),
            settingRecord("session.idleTimeoutMinutes", idleTimeout),
          ],
        })
      : undefined;

const putRoute: FetchRoute = (href, init) =>
  href.includes(apiPath("/config/settings/")) && init?.method === "PUT"
    ? jsonResponse({
        key: decodeURIComponent(href.split(apiPath("/config/settings/"))[1]!),
        value: (JSON.parse(String(init.body)) as { value: string | number }).value,
      })
    : undefined;

const puts = () =>
  fetchMock.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === "PUT")
    .map((call) => String(call[0]));

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

describe("Operação — tempo máximo sem atividade (onda 31)", () => {
  it("o administrador vê o tempo servido, com o rótulo do dono", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, settingsGetRoute(7)] });
    renderWithApp(<SettingsPage />);

    const block = await operationalBlock();
    expect(within(block).getByText(RÓTULO)).toBeTruthy();
    await waitFor(() => {
      expect(within(block).getByText("7")).toBeTruthy();
    });
  });

  it("o campo ecoa o piso do backend: min=5, e 4 mostra o erro do piso e trava o salvar", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, settingsGetRoute(10)] });
    renderWithApp(<SettingsPage />);

    const block = await operationalBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const input = within(block).getByLabelText(RÓTULO) as HTMLInputElement;
    expect(input.min).toBe("5");

    await userEvent.clear(input);
    await userEvent.type(input, "4");

    const alert = within(block).getByRole("alert");
    expect(alert.textContent).toBe(
      "Informe um inteiro de pelo menos 5 minutos — é o tempo mínimo sem acesso.",
    );
    expect(
      (within(block).getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("salvar envia UM PUT em session.idleTimeoutMinutes — e só nele", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, putRoute, settingsGetRoute(10)] });
    renderWithApp(<SettingsPage />);

    const block = await operationalBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const input = within(block).getByLabelText(RÓTULO);
    await userEvent.clear(input);
    await userEvent.type(input, "5");
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(puts()).toHaveLength(1);
    });
    const [url] = puts();
    expect(url!.endsWith(apiPath("/config/settings/session.idleTimeoutMinutes"))).toBe(true);
    const put = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "PUT",
    )!;
    expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({ value: 5 });
  });
});
