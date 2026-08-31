import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, API_URL } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { apiPath } from "@/lib/api-path";
import { HttpCalibrationGateway } from "@/lib/gateways/calibration.gateway";

/**
 * Mesma lacuna do sino, do outro lado: a Calibração passou a ler do servidor
 * na onda 24 e o `cycleId` que ela manda nunca foi afirmado. Perder esse
 * parâmetro não quebra a tela — ela desenha a distribuição de OUTRO ciclo com
 * cara de ser a do ciclo escolhido, na tela em que o gestor compara
 * avaliadores. É o pior tipo de falha: silenciosa e plausível.
 */
const fetchMock = vi.fn();

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const distribuicaoVazia = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

const snapshotVazio = (cycleId: string) => ({
  data: {
    cycleId,
    overall: { distribution: distribuicaoVazia, average: null },
    evaluators: [],
  },
});

const gatewayComInterceptador = (interceptar: (error: ApiError) => void = () => {}) =>
  new HttpCalibrationGateway(new ApiClient(API_URL, interceptar));

const gateway = () => gatewayComInterceptador();

const urlDaChamada = (): URL => {
  const chamada = fetchMock.mock.calls[0];
  expect(chamada).toBeDefined();
  return new URL(String(chamada![0]));
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(snapshotVazio("2026-h2")));
  vi.stubGlobal("fetch", fetchMock);
});

describe("HttpCalibrationGateway — a querystring da leitura é contrato", () => {
  it("o ciclo escolhido viaja como cycleId", async () => {
    await gateway().calibration("2026-h2");
    expect(urlDaChamada().searchParams.get("cycleId")).toBe("2026-h2");
  });

  it("ciclo diferente muda a querystring — a leitura não é fixa", async () => {
    await gateway().calibration("2025-h1");
    expect(urlDaChamada().searchParams.get("cycleId")).toBe("2025-h1");
  });

  it("a rota é /calibration sob o prefixo da API, com GET", async () => {
    await gateway().calibration("2026-h2");
    expect(urlDaChamada().pathname).toBe(apiPath("/calibration"));
    const init = fetchMock.mock.calls[0]![1] as RequestInit | undefined;
    expect(init?.method ?? "GET").toBe("GET");
  });

  it("id de ciclo com caractere especial é escapado uma vez só", async () => {
    await gateway().calibration("ciclo 2026/h2");
    expect(urlDaChamada().searchParams.get("cycleId")).toBe("ciclo 2026/h2");
  });

  it("carimba a origem como dado da organização", async () => {
    const snapshot = await gateway().calibration("2026-h2");
    expect(snapshot.dataOrigin).toBe("organization");
  });
});

describe("HttpCalibrationGateway — o caminho de erro", () => {
  it("falha do servidor vira ApiError com o código e o status que vieram", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: "INTERNAL", message: "Falha" }, 500));
    const failure = await gateway()
      .calibration("2026-h2")
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(500);
    expect((failure as ApiError).code).toBe("INTERNAL");
  });

  it("negativa de acesso chega ao interceptador da política de sessão", async () => {
    const interceptadas: ApiError[] = [];
    fetchMock.mockResolvedValue(jsonResponse({ code: "FORBIDDEN", message: "Sem acesso" }, 403));
    await gatewayComInterceptador((error) => interceptadas.push(error))
      .calibration("2026-h2")
      .catch(() => undefined);
    expect(interceptadas.map((error) => error.status)).toEqual([403]);
  });

  it("payload fora do contrato é recusado — a tela não desenha distribuição desconhecida", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { cycleId: "2026-h2" } }));
    await expect(gateway().calibration("2026-h2")).rejects.toThrow();
  });

  it("rede fora do ar não vira distribuição vazia — a leitura rejeita", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(gateway().calibration("2026-h2")).rejects.toThrow(ApiError);
  });
});
