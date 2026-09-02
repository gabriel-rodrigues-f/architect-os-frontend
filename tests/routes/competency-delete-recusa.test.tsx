import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { apiPath } from "@/lib/api-path";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Onda 35, achado 15 do dono: "no diálogo 'Tem certeza que deseja excluir X
 * de Y?', clicar Excluir não faz nada".
 *
 * Raiz reproduzida aqui: o `onConfirm` do diálogo fazia
 * `await viewModel.removeCompetency()` sem tratar a rejeição. Quando o
 * serviço recusa (409, 403, 500), a promessa rejeita, o `setConfirmDelete(null)`
 * nunca roda, o diálogo fica aberto e nenhuma mensagem aparece — para quem
 * olha, o botão "não faz nada". A régua da casa (teams-alocacao): recusa do
 * serviço mostra a mensagem DELE, a tela não inventa outra.
 */

const fetchMock = vi.fn();

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const MENSAGEM_DA_RECUSA =
  "Kubernetes é exigida na régua do Time Plataforma e não pode ser excluída.";

const recusaDoServico: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/competencies/cloud-k8s")) && init?.method === "DELETE"
    ? jsonResponse({ code: "COMPETENCY_REQUIRED_BY_TEAM_RULE", message: MENSAGEM_DA_RECUSA }, 409)
    : undefined;

const renderMatrix = async () => {
  renderWithApp(
    <>
      <MatrixPage />
      <Toaster theme="light" position="bottom-right" duration={3000} />
    </>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Expandir tudo" }));
  await screen.findByText("Kubernetes");
};

describe("Matriz de Competências — recusa ao excluir uma competência", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [recusaDoServico, careerLevelsRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o 409 do serviço aparece na tela com a mensagem dele, o diálogo fecha e a competência fica", async () => {
    await renderMatrix();

    await userEvent.click(screen.getByLabelText("Excluir Kubernetes"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    expect((await screen.findAllByText(MENSAGEM_DA_RECUSA)).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull());
    expect(screen.getAllByText("Kubernetes").length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
  });
});
