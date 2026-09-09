import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAsyncSubmit, useToastSubmit } from "@/hooks";
import { FrontendContainer } from "@/lib/gateways/container";
import { I18nProvider } from "@/lib/i18n";

/**
 * DENTRO DA APLICAÇÃO LOGADA A REDE NÃO PISCA (dono, 2026-09-08: *"vamos
 * manter a sinapse dentro da aplicação pós usuário logado, mas remova a
 * piscada, tanto azul quanto vermelha, por gentileza"*).
 *
 * A rede continua VIVA no fundo de todas as telas — o movimento próprio dos
 * nós é dela. O que saiu é o PULSO POR RESULTADO: o azul da escrita aceita, o
 * vermelho da recusa do serviço e o vermelho da recusa local. Este teste
 * guarda os três: se alguém religar o anúncio no `ApiClient`, ou devolver um
 * `rejectLocally()` aos hooks de envio, ele fica vermelho.
 *
 * A PORTA (login, primeiro acesso, criar senha, recuperação) não passa por
 * aqui: ela tem a própria rede, os próprios sinais e continua piscando — é
 * fora da aplicação logada, e o dono pediu assim.
 */
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("a aplicação logada não pisca por resultado", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("uma escrita aceita (2xx) não deixa pulso nenhum nos sinais da aplicação", async () => {
    const container = FrontendContainer.create({ baseUrl: "http://api.local" });
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "c1" } }, 201));

    await container.apiClient.post("/cycles", {});

    expect(container.synapseSignals.drainPulses()).toEqual([]);
  });

  it("uma recusa do serviço (4xx) não deixa pulso nenhum nos sinais da aplicação", async () => {
    const container = FrontendContainer.create({ baseUrl: "http://api.local" });
    fetchMock.mockResolvedValue(jsonResponse({ message: "dados inválidos" }, 422));

    await expect(container.apiClient.post("/cycles", {})).rejects.toThrow();

    expect(container.synapseSignals.drainPulses()).toEqual([]);
  });

  it("nem o lote: doze escritas seguidas continuam sem pulso", async () => {
    const container = FrontendContainer.create({ baseUrl: "http://api.local" });
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ data: {} })));

    for (let index = 0; index < 12; index += 1) {
      await container.apiClient.patch(`/assessments/a1/scores/${String(index)}`, {});
    }

    expect(container.synapseSignals.drainPulses()).toEqual([]);
  });

  it("a recusa local não tem mais por onde pulsar: os hooks de envio não expõem ponto de anúncio", () => {
    // FATIA IDIOMA: os hooks de envio compõem a frase no idioma de quem lê, e
    // por isso pedem o dicionário — o que eles continuam NÃO expondo é ponto
    // de anúncio para a rede piscar.
    const comDicionario = ({ children }: { children: ReactNode }) => (
      <I18nProvider>{children}</I18nProvider>
    );
    const semToast = renderHook(() => useAsyncSubmit("fallback"), { wrapper: comDicionario });
    const comToast = renderHook(() => useToastSubmit(), { wrapper: comDicionario });

    expect(Object.keys(semToast.result.current)).toEqual([
      "submitting",
      "error",
      "clearError",
      "run",
    ]);
    expect(Object.keys(comToast.result.current)).toEqual(["submitting", "run"]);
  });
});
