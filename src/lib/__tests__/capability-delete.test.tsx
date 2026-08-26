import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { type AppState } from "../api";
import { fixtureState } from "./fixtures";
import { careerLevelsRoute, jsonResponse, mockAppFetch, renderWithApp } from "./render-app";

/**
 * Exercita a Matriz de Competências de verdade: o componente da rota, ligado
 * à store, com `fetch` interceptado — o caminho que o usuário percorre ao
 * clicar na lixeira de uma capacidade.
 *
 * Excluir capacidade migrou do Mapa de Capacidades (agora só
 * leitura de risco/cobertura) para a Matriz de Competências, que já é a
 * página administrativa do catálogo — curadoria não deveria viver numa tela
 * de leitura de risco. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-
 * SYNAPSE.md, EPIC 6.
 *
 * `strongDomain`/`gapDomain` saíram do cadastro de arquiteto (AUDITORIA-
 * TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, Seção 11), então excluir
 * uma capacidade não bloqueia mais por vínculo — só pede confirmação.
 */

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const renderPage = (state: AppState) => {
  mockAppFetch(fetchMock, {
    state,
    routes: [
      (_href, init) =>
        init?.method === "DELETE" ? jsonResponse({ competenciesRemoved: 0 }) : undefined,
      careerLevelsRoute,
    ],
  });
  return renderWithApp(<MatrixPage />);
};

describe("Matriz de Competências — exclusão de capacidade", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("exclui a capacidade após confirmar", async () => {
    renderPage(fixtureState);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Excluir Cloud Architecture"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.queryByText("Cloud Architecture")).toBeNull());

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    expect(String(deleteCall?.[0])).toContain("/api/capabilities/cloud");
  });

  /**
   * Regressão: o DELETE ia com `content-type: application/json` e sem corpo, e o
   * Fastify respondia 400 (FST_ERR_CTP_EMPTY_JSON_BODY). A store revertia a
   * remoção otimista e a capacidade reaparecia na tela.
   */
  it("não manda content-type em requisição sem corpo", async () => {
    renderPage(fixtureState);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Excluir Cloud Architecture"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true),
    );

    const bodyless = fetchMock.mock.calls.filter(([, init]) => init?.body === undefined);
    expect(bodyless.length).toBeGreaterThan(0);
    for (const [, init] of bodyless) {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers["content-type"]).toBeUndefined();
    }
  });
});
