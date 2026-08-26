import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as CyclesRoute } from "@/routes/cycles";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * CFG-05 / B9 — guard rail da cadência configurável: com
 * `cycle.cadence = QUARTERLY` a tela de ciclos passa a oferecer Q1..Q4 com
 * ids e datas de trimestre. O comportamento SEMIANNUAL (default) continua
 * coberto byte a byte por `cycles-period.test.tsx` — nenhuma asserção de lá
 * mudou.
 */

const fetchMock = vi.fn();
const CyclesPage = CyclesRoute.options.component as () => ReactNode;

const settingRecord = (key: string, value: string | number) => ({
  key,
  value,
  valueType: typeof value === "number" ? "int" : "enum",
  scope: "operational",
  description: null,
  updatedAt: "2026-08-26T00:00:00Z",
  updatedBy: null,
});

const quarterlySettingsRoute: FetchRoute = (href, init) =>
  href.endsWith("/api/config/settings") && (init?.method ?? "GET") === "GET"
    ? jsonResponse({
        settings: [
          settingRecord("cycle.cadence", "QUARTERLY"),
          settingRecord("career.minimumQualifiedFloor", 3),
          settingRecord("training.collectiveInterventionThreshold", 3),
        ],
      })
    : undefined;

describe("Ciclos — cadência QUARTERLY (CFG-05/B9)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [quarterlySettingsRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("'Novo ciclo' oferece Q1..Q4 e sugere o primeiro trimestre livre com as datas certas", async () => {
    renderWithApp(<CyclesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo ciclo" }));

    // A fixture tem 2026-h1/2026-h2 (ids semestrais) — nenhum id trimestral
    // usado, então o primeiro livre é 2026 Q1. Ciclos existentes seguem
    // intactos: cadência só afeta ciclos futuros.
    const select = await screen.findByLabelText("Trimestre");
    expect(select).toHaveProperty("value", "Q1");
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual(
      ["Q1", "Q2", "Q3", "Q4"],
    );
    expect(screen.getByRole("spinbutton")).toHaveProperty("value", "2026");
    expect(screen.getByLabelText("Início")).toHaveProperty("value", "2026-01-01");
    expect(screen.getByLabelText("Fim")).toHaveProperty("value", "2026-03-31");
  });

  it("trocar o trimestre recalcula as datas do período", async () => {
    renderWithApp(<CyclesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo ciclo" }));

    await userEvent.selectOptions(await screen.findByLabelText("Trimestre"), "Q3");
    expect(screen.getByLabelText("Início")).toHaveProperty("value", "2026-07-01");
    expect(screen.getByLabelText("Fim")).toHaveProperty("value", "2026-09-30");
  });

  it("salvar cria o ciclo com id e nome trimestrais", async () => {
    renderWithApp(<CyclesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo ciclo" }));
    await userEvent.selectOptions(await screen.findByLabelText("Trimestre"), "Q2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const post = fetchMock.mock.calls.find((call) => {
      const [url, init] = call as [string, RequestInit | undefined];
      return String(url).endsWith("/api/cycles") && init?.method === "POST";
    });
    expect(post).toBeTruthy();
    expect(JSON.parse(String((post![1] as RequestInit).body))).toMatchObject({
      id: "2026-q2",
      name: "2026 Q2",
      start: "2026-04-01",
      end: "2026-06-30",
      status: "Planned",
    });
  });
});
