import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "../store";
import { fixtureState } from "./fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "./render-app";

/**
 * B-09 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-10, "409
 * espúrios") — `updatePlanItem` era otimista e carregava `expectedVersion`
 * (concorrência otimista), mas nunca reconciliava a resposta do servidor no
 * sucesso: o `version` do cache ficava travado no palpite otimista (este
 * PATCH nunca o incrementa sozinho), e a PRÓXIMA edição mandava um
 * `expectedVersion` já defasado — um 409 sem nenhum conflito real, só duas
 * edições sequenciais da mesma pessoa.
 */

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

/** Dispara `updatePlanItem` diretamente no store, sem depender da UI de `development-plans.tsx`. */
function UpdatePlanItemProbe() {
  const store = useStore();
  return (
    <button
      type="button"
      onClick={() => store.updatePlanItem("pdi-ana", "pdi-ana-0", { actionPlan: "atualizado" })}
    >
      Atualizar item
    </button>
  );
}

describe("store.updatePlanItem — reconcilia version no sucesso (evita 409 espúrio)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    mockAppFetch(fetchMock, {
      routes: [
        (href, init) => {
          if (init?.method === "PATCH" && href.includes("/api/plans/pdi-ana/items/pdi-ana-0")) {
            const body = JSON.parse(String(init.body)) as { expectedVersion: number };
            const plan = fixtureState.plans.find((p) => p.id === "pdi-ana")!;
            // Simula o servidor: aceita a versão pedida e devolve o plano com o
            // item já incrementado — exatamente como a API real faz.
            return jsonResponse({
              ...plan,
              items: plan.items.map((i) =>
                i.id === "pdi-ana-0" ? { ...i, version: body.expectedVersion + 1 } : i,
              ),
            });
          }
          return undefined;
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a segunda edição manda o expectedVersion reconciliado da primeira, não o palpite otimista original", async () => {
    renderWithApp(<UpdatePlanItemProbe />);
    const button = await screen.findByRole("button", { name: "Atualizar item" });

    await userEvent.click(button);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([, init]) =>
            (init as RequestInit | undefined)?.method === "PATCH" &&
            String((init as RequestInit).body).includes("expectedVersion"),
        ),
      ).toHaveLength(1),
    );

    await userEvent.click(button);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
        ),
      ).toHaveLength(2),
    );

    const patchCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
    );
    const firstBody = JSON.parse(String((patchCalls[0]![1] as RequestInit).body));
    const secondBody = JSON.parse(String((patchCalls[1]![1] as RequestInit).body));

    expect(firstBody.expectedVersion).toBe(1);
    // Sem a reconciliação, isto também seria 1 (o cache nunca soube que o
    // servidor já tinha avançado para 2) — o bug exato que o 409 espúrio produzia.
    expect(secondBody.expectedVersion).toBe(2);
  });
});
