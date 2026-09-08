import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, type ApiOutcome } from "@/lib/api-client";
import { FrontendContainer } from "@/lib/gateways/container";
import { SynapseSignals } from "@/lib/synapse-network";
import { SynapseOutcomeAnnouncer } from "@/lib/synapse-outcome";

/**
 * O ANÚNCIO ÚNICO (inventário 2026-09-08, §1.3-2): quem conta à rede o
 * resultado de um envio é o `ApiClient`, funil de TODAS as escritas — nunca a
 * tela. Ele entrega (método, recurso, status) a um observador; a régua de cor
 * e a coalescência moram no `SynapseOutcomeAnnouncer`. Aqui, o fio inteiro:
 * resposta HTTP → tom na fila dos sinais.
 */
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clienteLigadoARede() {
  let now = 0;
  const signals = new SynapseSignals();
  const announcer = new SynapseOutcomeAnnouncer(signals, () => now);
  const client = new ApiClient(
    "http://api.local",
    () => undefined,
    () => ({}),
    (outcome) => announcer.observe(outcome),
  );
  return { client, signals, advance: (ms: number) => (now += ms) };
}

describe("ApiClient — anuncia o resultado de cada resposta", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("entrega método, recurso e status ao observador — no sucesso e na recusa", async () => {
    const outcomes: ApiOutcome[] = [];
    const client = new ApiClient(
      "http://api.local",
      () => undefined,
      () => ({}),
      (outcome) => outcomes.push(outcome),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: "c1" } }, 201));
    await client.post("/cycles", { name: "Ciclo" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "inválido" }, 422));
    await client.patch("/cycles/c1", {}).catch(() => undefined);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await client.del("/cycles/c1").catch(() => undefined);
    expect(outcomes).toEqual([
      { method: "POST", resource: "/cycles", status: 201 },
      { method: "PATCH", resource: "/cycles/c1", status: 422 },
      { method: "DELETE", resource: "/cycles/c1", status: 0 },
    ]);
  });

  it("escrita 2xx → pulso azul", async () => {
    const { client, signals } = clienteLigadoARede();
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "c1" } }, 201));
    await client.post("/cycles", {});
    expect(signals.drainPulses()).toEqual(["primary"]);
  });

  it("recusa 422 → pulso vermelho", async () => {
    const { client, signals } = clienteLigadoARede();
    fetchMock.mockResolvedValue(jsonResponse({ message: "inválido" }, 422));
    await client.post("/cycles", {}).catch(() => undefined);
    expect(signals.drainPulses()).toEqual(["danger"]);
  });

  it("leitura → nada, mesmo com 404", async () => {
    const { client, signals } = clienteLigadoARede();
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await client.request("/cycles");
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "não há" }, 404));
    await client.request("/cycles/x").catch(() => undefined);
    expect(signals.drainPulses()).toEqual([]);
  });

  it("rota de IA → nada; exportação → nada; marcar aviso lido → nada", async () => {
    const { client, signals } = clienteLigadoARede();
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ data: {} })));
    await client.request("/professionals/a1/one-on-one-preparation?profile=moderate");
    await client.post("/notices/n1/read", {});
    fetchMock.mockResolvedValueOnce(
      new Response(new Blob(), {
        status: 200,
        headers: { "content-disposition": 'attachment; filename="x.pdf"' },
      }),
    );
    await client.requestBlob("/reports/evolution/pdf", {});
    expect(signals.drainPulses()).toEqual([]);
  });

  it("queda (0/5xx) e sessão expirada (401) → nada", async () => {
    const { client, signals } = clienteLigadoARede();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await client.post("/cycles", {}).catch(() => undefined);
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "caiu" }, 503));
    await client.post("/cycles", {}).catch(() => undefined);
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "expirou" }, 401));
    await client.post("/cycles", {}).catch(() => undefined);
    expect(signals.drainPulses()).toEqual([]);
  });

  it("um lote de escritas em 400 ms é um pulso só", async () => {
    const { client, signals, advance } = clienteLigadoARede();
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ data: {} })));
    for (let index = 0; index < 12; index += 1) {
      await client.patch(`/assessments/a1/scores/${String(index)}`, {});
      advance(25);
    }
    expect(signals.drainPulses()).toEqual(["primary"]);
  });
});

describe("FrontendContainer — um único SynapseSignals de aplicação, ligado ao ApiClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("a escrita pelo cliente do container chega aos sinais do container", async () => {
    const container = FrontendContainer.create({ baseUrl: "http://api.local" });
    expect(container.synapseSignals).toBeInstanceOf(SynapseSignals);
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "c1" } }, 201));
    await container.apiClient.post("/cycles", {});
    expect(container.synapseSignals.drainPulses()).toEqual(["primary"]);
  });
});
