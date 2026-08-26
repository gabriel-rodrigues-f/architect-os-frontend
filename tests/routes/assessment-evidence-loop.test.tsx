import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import type { Evidence } from "@/lib/domain";
import { fixtureState } from "../helpers/fixtures";
import { emptyEligibilityRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * EPIC I — Evidence Loop: evidência aceita para a competência aparece como
 * contexto na avaliação seguinte, sem alterar nota nenhuma sozinha. Ver
 * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md.
 */

const fetchMock = vi.fn();

const evidenciaAceita: Evidence = {
  id: "ev-aceita",
  architectId: "ana",
  title: "ADR-014 — Estratégia de retry",
  description: "",
  type: "ADR",
  competencyIds: ["cloud-k8s"],
  date: "2026-07-20",
  complexity: "High",
  status: "Accepted",
};

const evidenciaPendente: Evidence = {
  id: "ev-pendente",
  architectId: "ana",
  title: "Curso de Kubernetes avançado",
  description: "",
  type: "Course",
  competencyIds: ["cloud-k8s"],
  date: "2026-07-01",
  complexity: "Medium",
  status: "Pending",
};

const state: AppState = {
  ...fixtureState,
  evidences: [...fixtureState.evidences, evidenciaAceita, evidenciaPendente],
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

describe("Avaliações — evidência aceita aparece como contexto", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    mockAppFetch(fetchMock, { state, routes: [emptyEligibilityRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra um selo na competência com evidência aceita", async () => {
    renderWithApp(<AssessmentsPage />);
    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(within(linha).getByLabelText(/evidência aceita/i)).toBeTruthy();
  });

  it("ao abrir a competência, lista a evidência aceita — mas não a pendente", async () => {
    renderWithApp(<AssessmentsPage />);
    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    await userEvent.click(within(linha).getByRole("button"));

    expect(await screen.findByText("Evidências aceitas")).toBeTruthy();
    expect(screen.getByText("ADR-014 — Estratégia de retry")).toBeTruthy();
    expect(screen.queryByText("Curso de Kubernetes avançado")).toBeNull();
  });

  it("competência sem evidência aceita não mostra selo nem a seção", async () => {
    renderWithApp(<AssessmentsPage />);
    const linha = (await screen.findByText("Serverless")).closest("tr")!;
    expect(within(linha).queryByLabelText(/evidência aceita/i)).toBeNull();

    await userEvent.click(within(linha).getByRole("button"));
    expect(screen.queryByText("Evidências aceitas")).toBeNull();
  });
});
