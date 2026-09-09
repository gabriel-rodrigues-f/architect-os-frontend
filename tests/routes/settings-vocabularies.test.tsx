import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureUnassignedTechLeadUser, fixtureAdminUser } from "../helpers/fixtures";
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
        LEARNING_ITEM_TYPE: [
          vocabItem("LEARNING_ITEM_TYPE", "Curso", "learningItemType.curso", 1),
          vocabItem("LEARNING_ITEM_TYPE", "Podcast", "learningItemType.podcast", 2, false),
        ],
        ACTION_TYPE: [vocabItem("ACTION_TYPE", "Learn", "actionType.learn", 1)],
      })
    : undefined;

const countGets = (suffix: string) =>
  fetchMock.mock.calls.filter((call) => {
    const [url, init] = call as [string, RequestInit | undefined];
    return String(url).endsWith(suffix) && ((init as RequestInit)?.method ?? "GET") === "GET";
  }).length;

async function vocabularySection(): Promise<HTMLElement> {
  // Onda 35, item 14: o cabeçalho do bloco é o NOME do grupo, nunca o código técnico.
  const title = await screen.findByText("Tipos de item de trilha");
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

/**
 * Onda 35, item 14 do dono (2026-09-02), literal: "Vocabulários mostram
 * 'ACTION_TYPE' e 'Apply · actionType.apply' (código cru)." Pedido: texto
 * humano — cabeçalho é o nome do grupo, a linha mostra o rótulo, e o código
 * técnico fica só num "código: …" discreto com o resto no tooltip.
 */
describe("Vocabulários falam a língua de quem configura", () => {
  it("nenhum bloco mostra o nome técnico do vocabulário como cabeçalho", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [careerLevelsRoute, vocabulariesGetRoute],
    });
    renderWithApp(<SettingsPage />);

    await vocabularySection();
    expect(screen.queryByText("LEARNING_ITEM_TYPE")).toBeNull();
    expect(screen.queryByText("ACTION_TYPE")).toBeNull();
    expect(screen.getByText("Tipos de ação do PDI")).toBeTruthy();
    expect(screen.getByText("Tipos de item de trilha")).toBeTruthy();
  });

  it("a linha mostra o rótulo; o código vem discreto e a chave de rótulo só no tooltip", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [careerLevelsRoute, vocabulariesGetRoute],
    });
    renderWithApp(<SettingsPage />);

    const block = await vocabularySection();
    await waitFor(() => {
      expect(within(block).getByText("código: Curso")).toBeTruthy();
    });
    expect(within(block).queryByText(/Curso · learningItemType\.curso · #1/)).toBeNull();
    expect(within(block).queryByText(/learningItemType\.curso/)).toBeNull();
    expect(within(block).getByText("código: Curso").getAttribute("title")).toContain(
      "learningItemType.curso",
    );
  });
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
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [careerLevelsRoute, vocabulariesGetRoute],
    });
    renderWithApp(<SettingsPage />);

    const block = await vocabularySection();
    await waitFor(() => {
      expect(within(block).getAllByText(/Podcast/).length).toBeGreaterThan(0);
    });
    expect(within(block).getByText("Inativo")).toBeTruthy();
    expect(within(block).getByRole("button", { name: "Reativar" })).toBeTruthy();
    expect(within(block).queryByRole("button", { name: /Excluir|Remover/ })).toBeNull();
  });

  it("toggle de active faz PATCH {active} e invalida a query de vocabulários", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.includes(apiPath("/config/vocabularies/LEARNING_ITEM_TYPE/")) &&
          init?.method === "PATCH"
            ? jsonResponse(
                vocabItem("LEARNING_ITEM_TYPE", "Curso", "learningItemType.curso", 1, false),
              )
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
          String(url).endsWith(apiPath("/config/vocabularies/LEARNING_ITEM_TYPE/Curso")) &&
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
      user: fixtureAdminUser,
      routes: [
        careerLevelsRoute,
        (href, init) =>
          href.endsWith(apiPath("/config/vocabularies/LEARNING_ITEM_TYPE/Webinar")) &&
          init?.method === "POST"
            ? jsonResponse(
                { message: 'O vocabulário LEARNING_ITEM_TYPE já tem o código "Webinar".' },
                409,
              )
            : undefined,
        vocabulariesGetRoute,
      ],
    });
    renderWithApp(<SettingsPage />);

    const block = await vocabularySection();
    await userEvent.click(within(block).getByRole("button", { name: "Novo código" }));
    await userEvent.type(within(block).getByLabelText("Código"), "Webinar");
    await userEvent.type(
      within(block).getByLabelText("Chave de rótulo (i18n)"),
      "learningItemType.webinar",
    );
    await userEvent.click(within(block).getByRole("button", { name: "Adicionar" }));

    const post = await waitFor(() => {
      const call = fetchMock.mock.calls.find((entry) => {
        const [url, init] = entry as [string, RequestInit | undefined];
        return (
          String(url).endsWith(apiPath("/config/vocabularies/LEARNING_ITEM_TYPE/Webinar")) &&
          init?.method === "POST"
        );
      });
      expect(call).toBeTruthy();
      return call!;
    });
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({
      labelKey: "learningItemType.webinar",
    });

    const alert = await within(block).findByRole("alert");
    expect(alert.textContent).toContain("já tem o código");
  });
});
