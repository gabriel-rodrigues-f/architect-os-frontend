import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, API_URL } from "@/lib/api";
import { apiPath } from "@/lib/api-path";

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

  it("monta a rota aninhada de item de PDI", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "pdi-ana" }));

    await api.patchPlanItem("pdi-ana", "pdi-ana-0", { status: "In Progress" }, 1);

    expect(fetchMock.mock.calls[0]![0]).toBe(
      `${API_URL}${apiPath("/plans/pdi-ana/items/pdi-ana-0")}`,
    );
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

  /**
   * ONDA 42 — a régua VIROU. Este teste exigia o caminho da API DENTRO da
   * mensagem, e era exatamente o vazamento que o dono viu na tela de login
   * ("POST /api/v1/auth/login falhou (404)"). Sem corpo, a frase agora vem da
   * SITUAÇÃO: 500 é "serviço fora do ar". O caminho continua acessível a quem
   * depura — pelo `status`, pelo `code` e pelo console —, nunca na tela.
   */
  it("sem corpo JSON, a mensagem é a da situação — e não carrega o caminho da API", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    const error = (await api.professional("ana").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.message).not.toContain(apiPath("/architects/ana"));
    expect(error.message).toBe(
      "O serviço está fora do ar no momento. Tente de novo em alguns instantes.",
    );
  });

  it("trata 204 sem corpo (DELETE de competência)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.deleteCompetency("cloud-k8s")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]![1].method).toBe("DELETE");
  });
});
