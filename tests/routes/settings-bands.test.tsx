import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureUnassignedTechLeadUser } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * CFG-02 (SPEC-OO3-13, §3.2) — aba "Réguas e limiares" de /settings:
 * admin-only, edição dos cortes → PUT /api/v1/config/bands/:scale com payload
 * contíguo, invalidação da query de bands ao sucesso e 400 do backend
 * exibido no formulário (role="alert").
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

/** GET /api/v1/config/bands vazio (a UI completa com o default do seed). */
const emptyBandsGetRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/bands")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({})
    : undefined;

const countBandsGets = () =>
  fetchMock.mock.calls.filter((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return String(url).endsWith(apiPath("/config/bands")) && (init?.method ?? "GET") === "GET";
  }).length;

/** O bloco da escala GAP_SEVERITY dentro da seção "Réguas e limiares". */
async function gapScaleBlock(): Promise<HTMLElement> {
  const title = await screen.findByText("Severidade de gap");
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

describe("Réguas e limiares (CFG-02 admin UI)", () => {
  /**
   * Onda 31 — o member deixou de alcançar /settings (o dono tirou a Política
   * de Progressão do profissional); o não-admin que ainda a lê é o tech lead.
   */
  it("não-admin não vê a seção", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureUnassignedTechLeadUser,
      routes: [careerLevelsRoute, emptyBandsGetRoute],
    });
    renderWithApp(<SettingsPage />);
    // A tela montou (o glossário read-only aparece)...
    expect(await screen.findByText("Referência do modelo")).toBeTruthy();
    // ...mas a seção de réguas não existe para quem não é admin.
    expect(screen.queryByText("Réguas e limiares")).toBeNull();
  });

  it("editar um corte envia o PUT com o payload contíguo e invalida a query de bands", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/config/bands/GAP_SEVERITY")) && init?.method === "PUT"
            ? jsonResponse(JSON.parse(String(init.body)).bands)
            : undefined,
        emptyBandsGetRoute,
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await gapScaleBlock();
    const getsBefore = countBandsGets();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const cut = within(block).getByLabelText("Corte superior da faixa high");
    await userEvent.clear(cut);
    await userEvent.type(cut, "2.5");
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find((call) => {
        const [url, init] = call as [string, RequestInit | undefined];
        return (
          String(url).endsWith(apiPath("/config/bands/GAP_SEVERITY")) && init?.method === "PUT"
        );
      });
      expect(put).toBeTruthy();
      const body = JSON.parse(String((put![1] as RequestInit).body)) as {
        bands: { key: string; minValue: number | null; maxValue: number | null }[];
      };
      const high = body.bands.find((b) => b.key === "high")!;
      const critical = body.bands.find((b) => b.key === "critical")!;
      expect(high.maxValue).toBe(2.5);
      expect(critical.minValue).toBe(2.5);
    });

    // Invalidação ao sucesso: a query ativa de bands refaz o GET.
    await waitFor(() => {
      expect(countBandsGets()).toBeGreaterThan(getsBefore);
    });
  });

  it("400 INVALID_SCORING_BANDS do backend aparece no formulário (role=alert)", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/config/bands/GAP_SEVERITY")) && init?.method === "PUT"
            ? jsonResponse(
                { code: "INVALID_SCORING_BANDS", message: "A régua GAP_SEVERITY tem furo." },
                400,
              )
            : undefined,
        emptyBandsGetRoute,
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await gapScaleBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    const alert = await within(block).findByRole("alert");
    expect(alert.textContent).toBe("A régua GAP_SEVERITY tem furo.");
  });

  it("preview: o valor de exemplo é classificado pelo RASCUNHO (corte novo muda o chip)", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, emptyBandsGetRoute] });
    renderWithApp(<SettingsPage />);

    const block = await gapScaleBlock();
    // Seed: gap 2 cai na faixa "high" → o chip do preview repete "Prioridade
    // alta" (que também aparece como rótulo da faixa na tabela) e "Crítico"
    // aparece SÓ uma vez (o rótulo da faixa na tabela).
    expect(within(block).getAllByText("Prioridade alta")).toHaveLength(2);
    expect(within(block).getAllByText("Crítico")).toHaveLength(1);

    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));
    // Rascunho recalibrado: cortes 1 → 1.5 → 2 (crítico passa a começar em 2),
    // mantendo a sequência estritamente crescente — gap 2 vira "Crítico".
    const cutRecommended = within(block).getByLabelText("Corte superior da faixa recommended");
    await userEvent.clear(cutRecommended);
    await userEvent.type(cutRecommended, "1.5");
    const cutHigh = within(block).getByLabelText("Corte superior da faixa high");
    await userEvent.clear(cutHigh);
    await userEvent.type(cutHigh, "2");

    await waitFor(() => {
      expect(within(block).getAllByText("Crítico").length).toBeGreaterThan(1);
    });
  });
});
