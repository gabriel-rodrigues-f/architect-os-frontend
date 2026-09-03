import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
 * Onda 36.1/37 — pedido do dono: nome de competência é único em TODA a
 * aplicação, e a tela impede seguir. As duas recusas do serviço têm textos
 * diferentes de propósito (a segunda NOMEIA a capacidade dona); a tela mostra
 * a mensagem crua junto do campo e trava o envio enquanto o nome não mudar.
 */

const fetchMock = vi.fn();
const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const takenInAnother =
  'A competência "Kubernetes" já existe na capacidade "Cloud Architecture" — o nome de uma competência não se repete entre capacidades.';

const takenInSame =
  'A competência "Serverless" já existe na capacidade "Cloud Architecture" — escolha outro nome.';

const refuseFoundation: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/capabilities")) && init?.method === "POST"
    ? jsonResponse(
        {
          code: "COMPETENCY_NAME_TAKEN_IN_ANOTHER_CAPABILITY",
          message: takenInAnother,
          correlationId: "x",
        },
        409,
      )
    : undefined;

const refuseCompetencyCreation: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/competencies")) && init?.method === "POST"
    ? jsonResponse(
        { code: "COMPETENCY_NAME_TAKEN_IN_CAPABILITY", message: takenInSame, correlationId: "x" },
        409,
      )
    : undefined;

const refuseRename: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/competencies/cloud-k8s")) && init?.method === "PATCH"
    ? jsonResponse(
        {
          code: "COMPETENCY_NAME_TAKEN_IN_ANOTHER_CAPABILITY",
          message: takenInAnother,
          correlationId: "x",
        },
        409,
      )
    : undefined;

const cardOf = (name: string) => {
  const card = screen.getByText(name).closest(".surface-card");
  if (!card) throw new Error(`card de ${name} não encontrado`);
  return within(card as HTMLElement);
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Matriz — nome repetido de competência impede seguir", () => {
  it("no modal de fundação, a recusa aparece no bloco recusado e trava 'Criar'", async () => {
    mockAppFetch(fetchMock, { routes: [refuseFoundation, careerLevelsRoute] });
    renderWithApp(<MatrixPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Nova capacidade" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Plataformas");
    await userEvent.type(screen.getByLabelText("Competência 1"), "Terraform");
    await userEvent.type(screen.getByLabelText("Competência 2"), "Kubernetes");
    await userEvent.type(screen.getByLabelText("Competência 3"), "Helm");
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));

    const refusal = await screen.findByText(takenInAnother);
    expect(refusal.closest("div")?.contains(screen.getByLabelText("Competência 2"))).toBe(true);
    expect(screen.getByRole("button", { name: "Criar" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("heading", { name: "Nova capacidade" })).toBeTruthy();

    await userEvent.clear(screen.getByLabelText("Competência 2"));
    await userEvent.type(screen.getByLabelText("Competência 2"), "Kustomize");
    expect(screen.queryByText(takenInAnother)).toBeNull();
    expect(screen.getByRole("button", { name: "Criar" })).toHaveProperty("disabled", false);
  });

  it("em 'Nova competência', a recusa aparece no campo e trava 'Adicionar'", async () => {
    mockAppFetch(fetchMock, { routes: [refuseCompetencyCreation, careerLevelsRoute] });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(
      cardOf("Cloud Architecture").getByRole("button", { name: "Nova competência" }),
    );
    await userEvent.type(screen.getByLabelText("Nome"), "Serverless");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText(takenInSame)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar" })).toHaveProperty("disabled", true);

    await userEvent.type(screen.getByLabelText("Nome"), " Avançado");
    expect(screen.queryByText(takenInSame)).toBeNull();
    expect(screen.getByRole("button", { name: "Adicionar" })).toHaveProperty("disabled", false);
  });

  it("ao renomear, a recusa aparece no campo, trava 'Salvar' e o diálogo não fecha", async () => {
    mockAppFetch(fetchMock, { routes: [refuseRename, careerLevelsRoute] });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Expandir Cloud Architecture"));
    await userEvent.click(await screen.findByLabelText("Editar Kubernetes"));
    await userEvent.clear(screen.getByLabelText("Nome"));
    await userEvent.type(screen.getByLabelText("Nome"), "Kubernetes");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(takenInAnother)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("heading", { name: "Editar competência" })).toBeTruthy();
  });
});
