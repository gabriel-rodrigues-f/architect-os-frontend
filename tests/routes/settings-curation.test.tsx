import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureUnassignedTechLeadUser } from "../helpers/fixtures";
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
 * CFG-04 (SPEC-OO3-13, §3.2), recortada pela onda 36 (ADRs 0081/0082) — aba
 * "Catálogo" de /settings: admin-only, a política tem UM número (máximo de
 * ativas, teto 4 imposto pelo backend) → PUT /api/v1/config/curation-policy,
 * validação client-side (inteiro positivo), invalidação da query da política
 * E do snapshot de /api/v1/state ao sucesso (o admin precisa VER os status
 * de curadoria recalculados) e 400 INVALID_CATALOG_CURATION_POLICY do
 * backend exibido no formulário (role="alert") — o teto de 4 é recusa DO
 * SERVIÇO, com a mensagem dele, nunca literal na tela.
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

/** GET /api/v1/config/curation-policy com o seed da onda 36: máximo 4. */
const curationPolicyGetRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/curation-policy")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({ maxActiveCompetencies: 4 })
    : undefined;

const countGets = (suffix: string) =>
  fetchMock.mock.calls.filter((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return (
      hrefOf(url as string | URL | Request).endsWith(suffix) &&
      ((init as RequestInit | undefined)?.method ?? "GET") === "GET"
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
  /**
   * Onda 31 — o member deixou de alcançar /settings (o dono tirou a Política
   * de Progressão do profissional); o não-admin que ainda a lê é o tech lead.
   */
  it("não-admin não vê a seção", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureUnassignedTechLeadUser,
      routes: [careerLevelsRoute, curationPolicyGetRoute],
    });
    renderWithApp(<SettingsPage />);
    expect(await screen.findByText("Referência do modelo")).toBeTruthy();
    expect(screen.queryByText("Composição por capacidade")).toBeNull();
  });

  it("admin vê o máximo efetivo e o aviso de impacto — sem campos por tipo", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, curationPolicyGetRoute] });
    renderWithApp(<SettingsPage />);

    const block = await policyBlock();
    expect(within(block).getByText("Máximo de competências ativas")).toBeTruthy();
    expect(within(block).queryByText("Restritivas exigidas")).toBeNull();
    expect(within(block).queryByText("Não restritivas exigidas")).toBeNull();
    expect(
      within(block).getByText(
        "Alterar a política recalcula a curadoria (Pronta/Requer curadoria) de todas as capacidades imediatamente.",
      ),
    ).toBeTruthy();
    await waitFor(() => {
      expect(within(block).getByText("4")).toBeTruthy();
    });
  });

  it("máximo que não é inteiro positivo mostra o erro client-side e desabilita salvar", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, curationPolicyGetRoute] });
    renderWithApp(<SettingsPage />);

    const block = await policyBlock();
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const max = within(block).getByLabelText("Máximo de competências ativas");
    await userEvent.clear(max);
    await userEvent.type(max, "0");

    const alert = within(block).getByRole("alert");
    expect(alert.textContent).toBe("Informe um inteiro maior que zero.");
    expect(
      (within(block).getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("salvar envia o PUT com a política inteira e invalida a query da política E as fatias de contexto", async () => {
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
    const stateGetsBefore = countGets(apiPath("/capabilities"));
    await userEvent.click(within(block).getByRole("button", { name: "Editar" }));

    const input = within(block).getByLabelText("Máximo de competências ativas");
    await userEvent.clear(input);
    await userEvent.type(input, "3");
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find((call) => {
        const [url, init] = call as [string, RequestInit | undefined];
        return String(url).endsWith(apiPath("/config/curation-policy")) && init?.method === "PUT";
      });
      expect(put).toBeTruthy();
      expect(JSON.parse(String((put![1] as RequestInit).body))).toEqual({
        maxActiveCompetencies: 3,
      });
    });

    // Invalidação encadeada ao sucesso: a query da política refaz o GET e as
    // fatias de contexto também (é da fatia `capabilities` que vem `curation.status`).
    await waitFor(() => {
      expect(countGets(apiPath("/config/curation-policy"))).toBeGreaterThan(policyGetsBefore);
      expect(countGets(apiPath("/capabilities"))).toBeGreaterThan(stateGetsBefore);
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
                  message: "maxActiveCompetencies não pode passar de 4 (recebido: 9).",
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
    // Rascunho client-side válido (9 é inteiro positivo) — o teto de 4 é a
    // autoridade do backend, e a mensagem que aparece é a DELE.
    const input = within(block).getByLabelText("Máximo de competências ativas");
    await userEvent.clear(input);
    await userEvent.type(input, "9");
    await userEvent.click(within(block).getByRole("button", { name: "Salvar" }));

    const alert = await within(block).findByRole("alert");
    expect(alert.textContent).toBe("maxActiveCompetencies não pode passar de 4 (recebido: 9).");
  });
});
