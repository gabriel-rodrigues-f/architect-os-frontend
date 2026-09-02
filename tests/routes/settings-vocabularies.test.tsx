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
 * CFG-06 (SPEC-OO3-13, §3.2) — aba "Vocabulários" de /settings: admin-only,
 * lista por vocabulário com toggle de `active` (sem delete), cadastro de
 * code novo (code + labelKey → POST), edição de labelKey/sortOrder (PATCH
 * só do que mudou), invalidação da query de vocabulários e 400/409 do
 * backend exibidos em role="alert".
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

const vocabItem = (
  vocabulary: string,
  code: string,
  labelKey: string,
  sortOrder: number,
  active = true,
) => ({ vocabulary, code, labelKey, sortOrder, active });

const vocabulariesGetRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/vocabularies")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({
        EVIDENCE_TYPE: [
          vocabItem("EVIDENCE_TYPE", "ADR", "evidenceType.adr", 1),
          vocabItem("EVIDENCE_TYPE", "Patente", "evidenceType.patente", 2, false),
        ],
        LEARNING_ITEM_TYPE: [vocabItem("LEARNING_ITEM_TYPE", "Curso", "learningItemType.curso", 1)],
        ACTION_TYPE: [vocabItem("ACTION_TYPE", "Learn", "actionType.learn", 1)],
      })
    : undefined;

const countGets = (suffix: string) =>
  fetchMock.mock.calls.filter((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return String(url).endsWith(suffix) && ((init as RequestInit)?.method ?? "GET") === "GET";
  }).length;

async function vocabularySection(): Promise<HTMLElement> {
  // O nome técnico do vocabulário só aparece no bloco da aba (o glossário usa o rótulo traduzido).
  const title = await screen.findByText("EVIDENCE_TYPE");
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

describe("Vocabulários (CFG-06 admin UI)", () => {
  /**
   * Onda 31 — o member deixou de alcançar /settings (o dono tirou a Política
   * de Progressão do profissional); o não-admin que ainda a lê é o tech lead.
   */
  it("não-admin não vê a seção", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureUnassignedTechLeadUser,
      routes: [careerLevelsRoute, vocabulariesGetRoute],
    });
    renderWithApp(<SettingsPage />);
    expect(await screen.findByText("Referência do modelo")).toBeTruthy();
    expect(screen.queryByText("Vocabulários")).toBeNull();
  });

  it("admin vê os itens servidos, com o desativado marcado e SEM botão de excluir", async () => {
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, vocabulariesGetRoute] });
    renderWithApp(<SettingsPage />);

    const block = await vocabularySection();
    await waitFor(() => {
      expect(within(block).getAllByText(/Patente/).length).toBeGreaterThan(0);
    });
    expect(within(block).getByText("Inativo")).toBeTruthy();
    expect(within(block).getByRole("button", { name: "Reativar" })).toBeTruthy();
    expect(within(block).queryByRole("button", { name: /Excluir|Remover/ })).toBeNull();
  });

  it("toggle de active faz PATCH {active} e invalida a query de vocabulários", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.includes(apiPath("/config/vocabularies/EVIDENCE_TYPE/")) && init?.method === "PATCH"
            ? jsonResponse(vocabItem("EVIDENCE_TYPE", "ADR", "evidenceType.adr", 1, false))
            : undefined,
        vocabulariesGetRoute,
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await vocabularySection();
    await waitFor(() => {
      expect(within(block).getByRole("button", { name: "Reativar" })).toBeTruthy();
    });
    const getsBefore = countGets(apiPath("/config/vocabularies"));
    await userEvent.click(within(block).getAllByRole("button", { name: "Desativar" })[0]!);

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find((call) => {
        const [url, init] = call as [string, RequestInit | undefined];
        return (
          String(url).endsWith(apiPath("/config/vocabularies/EVIDENCE_TYPE/ADR")) &&
          init?.method === "PATCH"
        );
      });
      expect(patch).toBeTruthy();
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({ active: false });
    });
    await waitFor(() => {
      expect(countGets(apiPath("/config/vocabularies"))).toBeGreaterThan(getsBefore);
    });
  });

  it("cadastrar code novo faz POST {labelKey} e mostra o 409 do backend em role=alert", async () => {
    mockAppFetch(fetchMock, {
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/config/vocabularies/EVIDENCE_TYPE/Palestra")) &&
          init?.method === "POST"
            ? jsonResponse(
                { message: 'O vocabulário EVIDENCE_TYPE já tem o código "Palestra".' },
                409,
              )
            : undefined,
        vocabulariesGetRoute,
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await vocabularySection();
    await userEvent.click(within(block).getByRole("button", { name: "Novo código" }));
    await userEvent.type(within(block).getByLabelText("Código"), "Palestra");
    await userEvent.type(
      within(block).getByLabelText("Chave de rótulo (i18n)"),
      "evidenceType.palestra",
    );
    await userEvent.click(within(block).getByRole("button", { name: "Adicionar" }));

    const post = await waitFor(() => {
      const call = fetchMock.mock.calls.find((entry) => {
        const [url, init] = entry as [string, RequestInit | undefined];
        return (
          String(url).endsWith(apiPath("/config/vocabularies/EVIDENCE_TYPE/Palestra")) &&
          init?.method === "POST"
        );
      });
      expect(call).toBeTruthy();
      return call!;
    });
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({
      labelKey: "evidenceType.palestra",
    });

    const alert = await within(block).findByRole("alert");
    expect(alert.textContent).toContain("já tem o código");
  });
});
