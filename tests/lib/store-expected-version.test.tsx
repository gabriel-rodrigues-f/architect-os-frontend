import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { useStore } from "@/lib/store";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";
import { SELECTOR_CONTEXTS } from "@/lib/context-scope";

/**
 * ENG-04 — o `expectedVersion` do trava otimista era calculado com
 * `...?.version ?? 1`: quando a entidade não estava no cache local, ou quando
 * o servidor não mandou `version` (o item de assessment tem `version`
 * opcional no contrato), o navegador INVENTAVA a versão 1 e mandava para o
 * servidor. Se a versão real também fosse 1, o servidor concluía "ninguém
 * mexeu" e a gravação passava por cima da edição de outra pessoa — dado
 * errado, indistinguível do legítimo.
 *
 * A regra: ausência de versão conhecida é erro, nunca default.
 */

const fetchMock = vi.fn();

const callsTo = (path: string, method: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).includes(apiPath(path)) && (init as RequestInit | undefined)?.method === method,
  );

function UpdateAssessmentItemProbe() {
  const store = useStore();
  return (
    <button
      type="button"
      onClick={() => store.updateAssessmentItem("ana-h1", "cloud-k8s", { self: 4 })}
    >
      Editar item da avaliação
    </button>
  );
}

function UpdatePlanStatusProbe({ onSettled }: { onSettled: (error: unknown) => void }) {
  const store = useStore();
  return (
    <button
      type="button"
      onClick={() => {
        void store
          .updatePlanStatus("pdi-que-nao-esta-no-cache", "Approved")
          .then(() => onSettled(null), onSettled);
      }}
    >
      Aprovar plano
    </button>
  );
}

describe("store — expectedVersion ausente é erro, não o palpite 1", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      routes: [
        (_href, init) =>
          init?.method === "PATCH" || init?.method === "POST" ? jsonResponse({}) : undefined,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("não manda PATCH de item de avaliação quando o item não tem version conhecida", async () => {
    renderWithApp(<UpdateAssessmentItemProbe />, { contexts: SELECTOR_CONTEXTS });
    const button = await screen.findByRole("button", { name: "Editar item da avaliação" });

    await userEvent.click(button);

    // Os itens da fixture não trazem `version` (o campo é opcional no
    // contrato): com `?? 1` o PATCH saía mesmo assim, carregando uma versão
    // que o navegador nunca leu do servidor.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(callsTo("/assessments/ana-h1/items/cloud-k8s", "PATCH")).toHaveLength(0);
  });

  it("rejeita a transição de status de um plano que não está no cache local", async () => {
    const settled = vi.fn();
    renderWithApp(<UpdatePlanStatusProbe onSettled={settled} />, { contexts: SELECTOR_CONTEXTS });
    const button = await screen.findByRole("button", { name: "Aprovar plano" });

    await userEvent.click(button);

    await waitFor(() => expect(settled).toHaveBeenCalled());
    expect(settled.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(callsTo("/plans/pdi-que-nao-esta-no-cache/status", "PATCH")).toHaveLength(0);
  });
});
