import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { type AppState } from "@/lib/api";
import { fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * Exercita a Matriz de Competências de verdade: o componente da rota, ligado à
 * store, com `fetch` interceptado. É o caminho que o usuário percorre ao clicar
 * na lixeira de uma competência.
 */

const fetchMock = vi.fn();

/** Estado com duas competências no mesmo domínio, para checar a vizinha. */
const state: AppState = {
  ...fixtureState,
  competencies: fixtureState.competencies,
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

/**
 * REVISAO-360-FRONTEND, Seção 40-42 — a matriz virou um acordeão recolhido
 * por padrão (Cloud Architecture nasce fechado); "Expandir tudo" abre todos
 * os grupos de uma vez, exatamente como o comportamento antigo (sempre
 * expandido) que este teste pressupõe.
 */
const renderMatrix = async () => {
  renderWithApp(
    <>
      <MatrixPage />
      <Toaster theme="light" position="bottom-right" duration={3000} />
    </>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Expandir tudo" }));
};

describe("Matriz de Competências — exclusão", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      state,
      routes: [
        (_href, init) =>
          init?.method === "DELETE" ? new Response(null, { status: 204 }) : undefined,
        careerLevelsRoute,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("pede confirmação antes de excluir", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Excluir Kubernetes"));

    // o diálogo cita a competência e o domínio
    expect(
      await screen.findByText(/Tem certeza que deseja excluir Kubernetes de Cloud Architecture\?/),
    ).toBeTruthy();
    // e nada foi enviado ainda
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    expect(screen.getAllByText("Kubernetes").length).toBeGreaterThan(0);
  });

  it("cancelar mantém a competência", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Excluir Kubernetes"));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    expect(screen.getAllByText("Kubernetes").length).toBeGreaterThan(0);
  });

  it("confirmar remove da tela e chama DELETE na API", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Excluir Kubernetes"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.queryByText("Kubernetes")).toBeNull());

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    expect(String(deleteCall?.[0])).toContain(apiPath("/competencies/cloud-k8s"));

    // as vizinhas continuam na tela
    expect(screen.getByText("Serverless")).toBeTruthy();
    expect(screen.getByText("IAM")).toBeTruthy();
  });

  /**
   * A exclusão anterior era brusca: a linha sumia da tabela e nada mais
   * acontecia. O cartão confirma que a ação teve efeito, sem exigir clique
   * para fechar — ele mesmo se desfaz. Sem fake timers: o Sonner agenda o
   * próprio dismiss com `setTimeout` real, e trocar o relógio no meio do
   * teste também trava o `userEvent`, que depende de timers reais.
   */
  it("mostra um cartão de sucesso com o nome da competência e some sozinho", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Excluir Kubernetes"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    /*
      O Sonner duplica o texto: um `<li>` visível e uma região `aria-live`
      só para leitor de tela anunciar a mesma mensagem. `findByText` (que
      exige exatamente um) rejeitava por "múltiplos elementos" mesmo com o
      cartão certo na tela.
    */
    expect((await screen.findAllByText("Kubernetes excluída com sucesso")).length).toBeGreaterThan(
      0,
    );

    await waitFor(
      () => expect(screen.queryAllByText("Kubernetes excluída com sucesso").length).toBe(0),
      { timeout: 4000 },
    );
  }, 6000);

  /**
   * Regressão: o Radix foca o primeiro botão do rodapé ao abrir — o Cancelar,
   * por vir primeiro no DOM. Enter aciona quem está em foco, então a tecla
   * fechava o diálogo em vez de confirmar a exclusão.
   */
  it("Enter confirma a exclusão, não cancela", async () => {
    await renderMatrix();
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Excluir Kubernetes"));
    await screen.findByRole("button", { name: "Excluir" });
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByText("Kubernetes")).toBeNull());
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(deleteCall).toBeDefined();
  });
});
