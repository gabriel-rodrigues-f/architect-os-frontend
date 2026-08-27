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
 * CFG-04 (SPEC-OO3-13, §3.2) — aba "Catálogo" de /settings: admin-only,
 * edição dos três limites → PUT /api/v1/config/curation-policy com o payload
 * inteiro, validação client-side (soma que não fecha desabilita salvar),
 * invalidação da query da política E do snapshot de /api/v1/state ao sucesso
 * (o admin precisa VER os badges de curadoria recalculados) e 400
 * INVALID_CATALOG_CURATION_POLICY do backend exibido no formulário
 * (role="alert").
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

/** GET /api/v1/config/curation-policy com o seed 6/3+3. */
const curationPolicyGetRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/curation-policy")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({ maxActiveCompetencies: 6, requiredRestrictive: 3, requiredNonRestrictive: 3 })
    : undefined;

const countGets = (suffix: string) =>
  fetchMock.mock.calls.filter((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return (
      String(url).endsWith(suffix) && ((init as RequestInit | undefined)?.method ?? "GET") === "GET"
    );
  }).length;

/** O bloco da política dentro da seção "Catálogo". */
async function policyBlock(): Promise<HTMLElement> {
  const title = await screen.findByText("Composição por capacidade");
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

describe("Catálogo (CFG-04 admin UI)", () => {
  it("não-admin não vê a seção", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      routes: [careerLevelsRoute, curationPolicyGetRoute],
    });
    renderWithApp(<SettingsPage />);
    expect(await screen.findByText("Referência do modelo")).toBeTruthy();
    expect(screen.queryByText("Composição por capacidade")).toBeNull();
  });

  it("admin vê os três limites efetivos e o aviso de impacto", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, curationPolicyGetRoute] });
    renderWithApp(<SettingsPage />);

    const block = await policyBlock();
    expect(within(block).getByText("Máximo de competências ativas")).toBeTruthy();
    expect(within(block).getByText("Restritivas exigidas")).toBeTruthy();
    expect(within(block).getByText("Não restritivas exigidas")).toBeTruthy();
    expect(
      within(block).getByText(
        "Alterar a política recalcula a curadoria (Pronta/Requer curadoria) de todas as capacidades imediatamente.",
      ),
    ).toBeTruthy();
    await waitFor(() => {
      expect(within(block).getByText("6")).toBeTruthy();
    });
  });

  it("soma que não fecha mostra o erro client-side e desabilita salvar", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, curationPolicyGetRoute] });
    renderWithApp(<SettingsPage />);

    const block = await policyBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const max = within(block).getByLabelText("Máximo de competências ativas");
    await userEvent.clear(max);
    await userEvent.type(max, "8");

    const alert = within(block).getByRole("alert");
    expect(alert.textContent).toBe(
      "Restritivas + não restritivas precisa ser exatamente o máximo de competências ativas.",
    );
    expect(
      (within(block).getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("salvar envia o PUT com a política inteira e invalida a query da política E o /api/v1/state", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/config/curation-policy")) && init?.method === "PUT"
            ? jsonResponse(JSON.parse(String(init.body)) as Record<string, number>)
            : undefined,
        curationPolicyGetRoute,
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await policyBlock();
    const policyGetsBefore = countGets(apiPath("/config/curation-policy"));
    const stateGetsBefore = countGets(apiPath("/state"));
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    for (const [label, value] of [
      ["Máximo de competências ativas", "8"],
      ["Restritivas exigidas", "4"],
      ["Não restritivas exigidas", "4"],
    ] as const) {
      const input = within(block).getByLabelText(label);
      await userEvent.clear(input);
      await userEvent.type(input, value);
    }
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find((call) => {
        const [url, init] = call as [string, RequestInit | undefined];
        return String(url).endsWith(apiPath("/config/curation-policy")) && init?.method === "PUT";
      });
      expect(put).toBeTruthy();
      expect(JSON.parse(String((put![1] as RequestInit).body))).toEqual({
        maxActiveCompetencies: 8,
        requiredRestrictive: 4,
        requiredNonRestrictive: 4,
      });
    });

    // Invalidação encadeada ao sucesso: a query da política refaz o GET e o
    // snapshot de /api/v1/state também (é dele que vem `curation.status`).
    await waitFor(() => {
      expect(countGets(apiPath("/config/curation-policy"))).toBeGreaterThan(policyGetsBefore);
      expect(countGets(apiPath("/state"))).toBeGreaterThan(stateGetsBefore);
    });
  });

  it("400 INVALID_CATALOG_CURATION_POLICY do backend aparece no formulário (role=alert)", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/config/curation-policy")) && init?.method === "PUT"
            ? jsonResponse(
                {
                  code: "INVALID_CATALOG_CURATION_POLICY",
                  message:
                    "A soma requiredRestrictive + requiredNonRestrictive precisa ser exatamente maxActiveCompetencies.",
                },
                400,
              )
            : undefined,
        curationPolicyGetRoute,
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await policyBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));
    // Rascunho client-side válido (2 = 1 + 1) — o 400 simulado é a autoridade do backend.
    for (const [label, value] of [
      ["Máximo de competências ativas", "2"],
      ["Restritivas exigidas", "1"],
      ["Não restritivas exigidas", "1"],
    ] as const) {
      const input = within(block).getByLabelText(label);
      await userEvent.clear(input);
      await userEvent.type(input, value);
    }
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    const alert = await within(block).findByRole("alert");
    expect(alert.textContent).toBe(
      "A soma requiredRestrictive + requiredNonRestrictive precisa ser exatamente maxActiveCompetencies.",
    );
  });
});
