import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, NETWORK_UNAVAILABLE_CODE } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { authErrorMessage } from "@/lib/auth";
import { SessionPolicy } from "@/lib/session-policy";

/**
 * ONDA3/FE4, item 3 — caminho offline/DNS/timeout, onde o `fetch` REJEITA e
 * nunca existe `response`. A implementação de referência do rmanguinho
 * estoura `TypeError` aqui (lê `error.response` de um erro que não tem
 * `response`). O nosso cliente nunca teve esse bug — mas deixava vazar o
 * `TypeError: Failed to fetch` cru do navegador, e `useToastSubmit` mostrava
 * essa string em inglês, sem tradução, direto no toast de quem usa o produto.
 */

const fetchMock = vi.fn();

const NETWORK_REJECTIONS: [string, unknown][] = [
  ["offline (Chrome)", new TypeError("Failed to fetch")],
  ["offline (Node/undici)", new TypeError("fetch failed")],
  ["DNS não resolve", new TypeError("NetworkError when attempting to fetch resource.")],
  ["timeout abortado", new DOMException("The operation was aborted.", "AbortError")],
];

describe("ApiClient — o fetch rejeita (offline, DNS, timeout)", () => {
  let policy: SessionPolicy;
  let client: ApiClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    policy = new SessionPolicy();
    client = new ApiClient("http://api.local", (error) => policy.reviewFailure(error));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  for (const [scenario, rejection] of NETWORK_REJECTIONS) {
    it(`${scenario} vira ApiError de rede, não o erro cru do navegador`, async () => {
      fetchMock.mockRejectedValue(rejection);
      const failure = await client.request("/state").catch((e: unknown) => e);

      expect(failure).toBeInstanceOf(ApiError);
      expect(failure).not.toBeInstanceOf(TypeError);
      const error = failure as ApiError;
      expect(error.status).toBe(0);
      expect(error.code).toBe(NETWORK_UNAVAILABLE_CODE);
      expect(error.cause).toBe(rejection);
    });
  }

  it("a mensagem mostrada é em português e não a string do navegador", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const failure = await client.request("/state").catch((e: unknown) => e);

    expect((failure as ApiError).message).toBe(
      "Não foi possível falar com o serviço. Verifique sua conexão e tente novamente.",
    );
    expect(authErrorMessage(failure)).not.toBe("Failed to fetch");
    expect(authErrorMessage(failure)).toMatch(/Verifique sua conexão/);
  });

  it("a exportação de PDF offline também vira ApiError de rede", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const failure = await client.requestBlob("/reports/evolution.pdf", {}).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe(NETWORK_UNAVAILABLE_CODE);
  });

  it("falha de rede não encerra a sessão — quem está offline não é quem foi deslogado", async () => {
    const endSession = vi.fn();
    policy.whenSessionEnded(endSession);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await client.request("/state").catch(() => undefined);

    expect(endSession).not.toHaveBeenCalled();
  });

  it("a promessa continua REJEITANDO — React Query precisa disso para isError/retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(client.request("/state")).rejects.toBeInstanceOf(ApiError);
  });
});
