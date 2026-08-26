import { cleanup, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as PlansRoute } from "@/routes/development-plans";
import type { AppState } from "@/lib/api";
import type { ActionType } from "@/lib/domain";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * CFG-06 (guard rail) — os selects de tipo de ação derivam do vocabulário
 * SERVIDO, não mais do array hardcoded: um code extra servido aparece como
 * opção; um code desativado some das opções de escrita — mas um item
 * HISTÓRICO gravado com ele continua renderizável (opção injetada/rotulada,
 * nunca apagada).
 */

const fetchMock = vi.fn();
const PlansPage = PlansRoute.options.component as () => ReactNode;

const vocabItem = (code: string, labelKey: string, sortOrder: number, active = true) => ({
  vocabulary: "ACTION_TYPE",
  code,
  labelKey,
  sortOrder,
  active,
});

/** ACTION_TYPE servido: seed com "Lead" DESATIVADO e um code extra "Shadow". */
const vocabulariesRoute: FetchRoute = (href, init) =>
  href.endsWith("/api/config/vocabularies") && (init?.method ?? "GET") === "GET"
    ? jsonResponse({
        EVIDENCE_TYPE: [],
        LEARNING_ITEM_TYPE: [],
        ACTION_TYPE: [
          vocabItem("Learn", "actionType.learn", 1),
          vocabItem("Practice", "actionType.practice", 2),
          vocabItem("Apply", "actionType.apply", 3),
          vocabItem("Teach", "actionType.teach", 4),
          vocabItem("Mentor", "actionType.mentor", 5),
          vocabItem("Lead", "actionType.lead", 6, false),
          vocabItem("Shadow", "actionType.shadow", 7),
        ],
      })
    : undefined;

/** Plano em Draft (select de tipo editável) com item histórico gravado como "Lead". */
const stateWithDraftLeadItem: AppState = {
  ...fixtureState,
  plans: fixtureState.plans.map((plan) =>
    plan.id === "pdi-ana"
      ? {
          ...plan,
          status: "Draft" as const,
          items: plan.items.map((item, index) =>
            index === 0 ? { ...item, actionType: "Lead" as ActionType } : item,
          ),
        }
      : plan,
  ),
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { state: stateWithDraftLeadItem, routes: [vocabulariesRoute] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PDI × vocabulário ACTION_TYPE servido (CFG-06)", () => {
  it("code extra vira opção; desativado some da escrita; histórico continua rotulado", async () => {
    renderWithApp(<PlansPage />);

    // O select do item mostra o valor HISTÓRICO ("Lead" → "Liderar"), mesmo desativado.
    const select = (await screen.findByDisplayValue("Liderar")) as HTMLSelectElement;
    await waitFor(() => {
      const optionTexts = Array.from(select.options).map((option) => option.textContent);
      // Code extra servido aparece — sem mensagem i18n neste build, cai no próprio code.
      expect(optionTexts).toContain("Shadow");
      expect(optionTexts).toContain("Aprender");
      // "Liderar" só existe como a opção injetada do valor gravado (1x), não como opção de escrita.
      expect(optionTexts.filter((text) => text === "Liderar")).toHaveLength(1);
      expect(select.options[0]?.textContent).toBe("Liderar");
    });

    // O modelo 70-20-10 lista as opções ATIVAS do vocabulário servido:
    // "Shadow" entra (6ª ativa), "Lead" sai.
    expect(await screen.findByText("6. Shadow")).toBeTruthy();
    expect(screen.queryByText(/\d+\. Lead$/)).toBeNull();
  });
});
