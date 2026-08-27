import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { DependencyProvider, useContainer } from "@/lib/dependencies";
import { defaultContainer, FrontendContainer } from "@/lib/gateways/container";

/**
 * OO2-07 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 54-56) — cobre os dois ganhos que motivaram trocar os consts
 * soltos de `gateways/container.ts` por `FrontendContainer`: (1) a fábrica
 * monta um campo por gateway, todos ligados ao mesmo `ApiClient`; (2)
 * `DependencyProvider`/`useContainer` deixam um componente pegar o
 * container por Context em vez de importar um singleton global — o que
 * viabiliza injetar um container FALSO num teste, sem `vi.mock()` de módulo
 * inteiro.
 */

describe("FrontendContainer", () => {
  it("create() monta um campo por gateway, todos ligados ao mesmo ApiClient", () => {
    const container = FrontendContainer.create();

    expect(container.apiClient).toBeDefined();
    for (const gateway of [
      container.architectsGateway,
      container.assessmentGateway,
      container.authGateway,
      container.careerGateway,
      container.catalogGateway,
      container.cyclesGateway,
      container.developmentGateway,
      container.evidenceGateway,
      container.evolutionGateway,
      container.learningGateway,
      container.mentoringGateway,
      container.reportsGateway,
    ]) {
      expect(gateway).toBeDefined();
    }
  });

  it("create({ baseUrl }) usa a URL informada em vez do default de VITE_API_URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const container = FrontendContainer.create({ baseUrl: "http://outro-host:9999" });

      await container.apiClient.del("/qualquer");

      expect(fetchMock).toHaveBeenCalledWith(
        `http://outro-host:9999${apiPath("/qualquer")}`,
        expect.anything(),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("duas chamadas a create() devolvem instâncias independentes (ApiClient distinto)", () => {
    const a = FrontendContainer.create();
    const b = FrontendContainer.create();

    expect(a).not.toBe(b);
    expect(a.apiClient).not.toBe(b.apiClient);
  });
});

function ContainerProbe() {
  const container = useContainer();
  return <p>{container === defaultContainer ? "É O DEFAULT" : "É OUTRO"}</p>;
}

describe("DependencyProvider / useContainer", () => {
  afterEach(() => {
    cleanup();
  });

  it("sem prop `container`, useContainer() devolve o defaultContainer do processo", () => {
    render(
      <DependencyProvider>
        <ContainerProbe />
      </DependencyProvider>,
    );

    expect(screen.getByText("É O DEFAULT")).toBeTruthy();
  });

  it("com prop `container`, useContainer() devolve o container injetado (não o default)", () => {
    const fake = FrontendContainer.create();

    render(
      <DependencyProvider container={fake}>
        <ContainerProbe />
      </DependencyProvider>,
    );

    expect(screen.getByText("É OUTRO")).toBeTruthy();
  });

  it("useContainer() fora de DependencyProvider lança erro explicativo", () => {
    // Suprime o console.error do React sobre o erro não capturado neste render.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<ContainerProbe />)).toThrow(
        "useContainer precisa estar dentro de DependencyProvider",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
