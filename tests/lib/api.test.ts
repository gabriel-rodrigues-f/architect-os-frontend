import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, API_URL } from "../api";
import { emptyState } from "../selectors";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("cliente da API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("busca o snapshot no endpoint /api/state", async () => {
    fetchMock.mockResolvedValue(jsonResponse(emptyState));

    await api.getState();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_URL}/api/state`);
    expect(init?.method ?? "GET").toBe("GET");
  });

  /**
   * B-11 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-10) — o
   * problema que a validação existe para resolver: um campo removido ou
   * renomeado no servidor não pode virar `undefined` se propagando pela UI
   * em silêncio. `getState()` agora falha alto (o `ZodError` chega até
   * `useQuery`, que `store.tsx` já trata como qualquer erro de rede).
   */
  it("getState rejeita um payload que não bate com o contrato (campo ausente)", async () => {
    const { activeCycleId: _activeCycleId, ...semActiveCycleId } = emptyState;
    fetchMock.mockResolvedValue(jsonResponse(semActiveCycleId));

    await expect(api.getState()).rejects.toThrow();
  });

  it("getState rejeita um item de array com formato divergente", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...emptyState, architects: [{ id: "ana", nome: "Ana Martins" }] }),
    );

    await expect(api.getState()).rejects.toThrow();
  });

  it("getState aceita o payload completo sem lançar", async () => {
    fetchMock.mockResolvedValue(jsonResponse(emptyState));

    await expect(api.getState()).resolves.toEqual(emptyState);
  });

  it("monta a rota aninhada de item de PDI", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "pdi-ana" }));

    await api.patchPlanItem("pdi-ana", "pdi-ana-0", { status: "In Progress" }, 1);

    expect(fetchMock.mock.calls[0]![0]).toBe(`${API_URL}/api/plans/pdi-ana/items/pdi-ana-0`);
  });

  it("transforma resposta de erro em ApiError com status e detalhes", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: "ValidationError", message: "status inválido", details: { status: "Invalid" } },
        400,
      ),
    );

    const error = await api
      .patchPlanItem("pdi-ana", "pdi-ana-0", { status: "In Progress" }, 1)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: "status inválido" });
    expect((error as ApiError).details).toEqual({ status: "Invalid" });
  });

  it("usa mensagem padrão quando o erro não traz corpo JSON", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    const error = (await api.getState().catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.message).toContain("/api/state");
  });

  it("trata 204 sem corpo (DELETE de competência)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.deleteCompetency("cloud-k8s")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]![1].method).toBe("DELETE");
  });
});
