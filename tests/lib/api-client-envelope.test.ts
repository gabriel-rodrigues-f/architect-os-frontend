import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, messageCodeOf } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ApiClient — envelope de sucesso RF-05 ({ data, message })", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("desembrulha `data` de resposta 2xx em /api/*", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "c1", name: "Ciclo" } }));
    const client = new ApiClient("http://api.local");
    const result = await client.request<{ id: string }>("/api/cycles/c1");
    expect(result).toEqual({ id: "c1", name: "Ciclo" });
  });

  it("expõe o message.code da mutação via messageCodeOf(data)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { id: "c1" }, message: { code: "cycle.create.success" } }, 201),
    );
    const client = new ApiClient("http://api.local");
    const result = await client.post<{ id: string }>("/api/cycles", { id: "c1" });
    expect(result).toEqual({ id: "c1" });
    expect(messageCodeOf(result)).toBe("cycle.create.success");
  });

  it("GET sem message não expõe code", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: "c1" }] }));
    const client = new ApiClient("http://api.local");
    const result = await client.request<{ id: string }[]>("/api/cycles");
    expect(result).toEqual([{ id: "c1" }]);
    expect(messageCodeOf(result)).toBeUndefined();
  });

  it("payload com chave `data` própria do domínio não é confundido com envelope", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { x: 1 }, extra: true }));
    const client = new ApiClient("http://api.local");
    const result = await client.request<{ data: { x: number }; extra: boolean }>("/api/misc");
    expect(result).toEqual({ data: { x: 1 }, extra: true });
  });

  it("corpo cru (sem envelope) passa intacto — tolerância de transição", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "a1", name: "Ana" }));
    const client = new ApiClient("http://api.local");
    const result = await client.request<{ id: string }>("/api/architects/a1");
    expect(result).toEqual({ id: "a1", name: "Ana" });
  });

  it("rota fora de /api não é desembrulhada", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: "ok" }));
    const client = new ApiClient("http://api.local");
    const result = await client.request<{ data: string }>("/health");
    expect(result).toEqual({ data: "ok" });
  });

  it("204 continua devolvendo undefined", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ApiClient("http://api.local");
    await expect(client.del("/api/cycles/c1")).resolves.toBeUndefined();
  });

  it("erro não-envelopado segue intacto no ApiError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { code: "NOT_FOUND", message: "Ciclo não encontrado", correlationId: "corr-1" },
        404,
      ),
    );
    const client = new ApiClient("http://api.local");
    const failure = await client.request("/api/cycles/x").catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    const error = failure as ApiError;
    expect(error.status).toBe(404);
    expect(error.message).toBe("Ciclo não encontrado");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.correlationId).toBe("corr-1");
  });
});
