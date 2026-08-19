import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, API_URL } from "../api";

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
    fetchMock.mockResolvedValue(jsonResponse({ architects: [] }));

    await api.getState();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_URL}/api/state`);
    expect(init?.method ?? "GET").toBe("GET");
  });

  it("monta a rota aninhada de item de PDI", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "pdi-ana" }));

    await api.patchPlanItem("pdi-ana", "pdi-ana-0", { progress: 80 });

    expect(fetchMock.mock.calls[0]![0]).toBe(`${API_URL}/api/plans/pdi-ana/items/pdi-ana-0`);
  });

  it("transforma resposta de erro em ApiError com status e detalhes", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: "ValidationError", message: "progresso inválido", details: { progress: 500 } },
        400,
      ),
    );

    const error = await api.patchKeyResult("okr-ana", "kr-1", 500).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: "progresso inválido" });
    expect((error as ApiError).details).toEqual({ progress: 500 });
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
