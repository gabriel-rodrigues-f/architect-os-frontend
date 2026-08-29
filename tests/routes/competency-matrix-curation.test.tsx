import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { type AppState } from "@/lib/api";
import type { Capability, Competency } from "@/lib/domain";
import { fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * ORIENTACAO-NONA-RODADA, Seção 8, problemas 7/13, recortada pela Fase 2
 * (backend ADRs 0032/0034): a contagem por tipo morreu com
 * `competencies.requirement_type` (obrigatoriedade é da régua do time) e o
 * teto virou SINAL — a Matriz mostra a contagem de ativas e o status
 * READY/REQUIRES_CURATION, e desabilita "Nova competência" no teto.
 */

const fetchMock = vi.fn();

/** Capacidade "no limite" (6 ativas) — READY, sem espaço para nova competência. */
const fullCapability: Capability = {
  id: "full",
  name: "Full Capability",
  short: "Full",
  active: true,
  curation: {
    activeCompetencyCount: 6,
    status: "READY",
  },
};

/** Capacidade que EXTRAPOLOU o alvo (7 ativas) — o sinal REQUIRES_CURATION da Fase 2. */
const overCapability: Capability = {
  id: "over",
  name: "Over Capability",
  short: "Over",
  active: true,
  curation: {
    activeCompetencyCount: 7,
    status: "REQUIRES_CURATION",
  },
};

const fullCompetencies: Competency[] = [1, 2, 3].flatMap((n) => [
  {
    id: `full-r${n}`,
    name: `Competência ${n}A`,
    capabilityId: "full",
    active: true,
  },
  {
    id: `full-n${n}`,
    name: `Competência ${n}B`,
    capabilityId: "full",
    active: true,
  },
]);

const state: AppState = {
  ...fixtureState,
  capabilities: [...fixtureState.capabilities, fullCapability, overCapability],
  competencies: [...fixtureState.competencies, ...fullCompetencies],
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const renderMatrix = () => renderWithApp(<MatrixPage />);

describe("Matriz de Competências — curadoria e escala", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { state, routes: [careerLevelsRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra a contagem de ativas e o status de curadoria por capacidade — sem contagem por tipo (morreu com a Fase 2)", async () => {
    renderMatrix();
    // Contagem e status de curadoria moram no cabeçalho do card — visíveis mesmo com a seção recolhida (Seção 40-42).
    await screen.findByText("Cloud Architecture");

    expect(screen.getByText("6/6 competências")).toBeTruthy();
    expect(screen.getByText("7/6 competências")).toBeTruthy();
    expect(screen.getAllByText("Pronta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requer curadoria").length).toBeGreaterThan(0);
    expect(screen.queryByText(/restritivas/)).toBeNull();
  });

  it("desabilita 'Nova competência' quando a capacidade já tem 6 competências ativas", async () => {
    renderMatrix();
    await screen.findByText("Full Capability");

    const newCompetencyButtons = screen.getAllByRole("button", { name: "Nova competência" });
    // A capacidade "cloud" (2/6) permite; "Full Capability" (6/6) não.
    const fullCapabilityCard = screen.getByText("Full Capability").closest(".surface-card");
    expect(fullCapabilityCard).toBeTruthy();
    const disabledButton = newCompetencyButtons.find((btn) => fullCapabilityCard?.contains(btn));
    expect(disabledButton).toHaveProperty("disabled", true);
  });

  it("o diálogo de nova competência pede SÓ o nome — obrigatoriedade e níveis exigidos moram na régua do time", async () => {
    renderMatrix();
    await screen.findByText("Cloud Architecture");

    const cloudCard = screen.getByText("Cloud Architecture").closest(".surface-card");
    expect(cloudCard).toBeTruthy();
    await userEvent.click(
      screen
        .getAllByRole("button", { name: "Nova competência" })
        .find((btn) => cloudCard?.contains(btn))!,
    );
    await screen.findByText("Nova competência em Cloud Architecture");
    expect(screen.getByLabelText("Nome")).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Restritiva" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Não restritiva" })).toBeNull();
  });

  it("filtro de busca esconde capacidades que não combinam com o termo e expande as que casam", async () => {
    renderMatrix();
    await screen.findByText("Cloud Architecture");

    await userEvent.type(screen.getByLabelText("Buscar capacidade ou competência…"), "Security");

    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.queryByText("Cloud Architecture")).toBeNull();
  });

  /**
   * R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o filtro de curadoria era
   * um `<select>` nativo, agora `SingleSelectFilter`. Mesmo raciocínio de
   * nome acessível dos outros testes de conversão: o `role="button"` chama-
   * se pelo `label` fixo ("Curadoria", renderizado pelo próprio componente),
   * a opção atual é conferida pelo texto visível dentro do gatilho.
   */
  it("filtro de curadoria esconde capacidades que não combinam com o status escolhido", async () => {
    renderMatrix();
    await screen.findByText("Cloud Architecture");
    await screen.findByText("Full Capability");

    const trigger = screen.getByRole("button", { name: "Curadoria" });
    expect(trigger.textContent).toContain("Todas");

    await userEvent.click(trigger);
    const readyOption = await screen.findByRole("option", { name: "Prontas" });
    await userEvent.click(readyOption);

    expect(trigger.textContent).toContain("Prontas");
    expect(screen.getByText("Full Capability")).toBeTruthy();
    expect(screen.getByText("Cloud Architecture")).toBeTruthy();
    expect(screen.queryByText("Over Capability")).toBeNull();
  });

  it("expandir uma seção mostra a tabela; recolher de novo esconde, mas mantém o título visível", async () => {
    renderMatrix();
    // Seção 40-42 — a matriz nasce com todo grupo recolhido.
    await screen.findByText("Cloud Architecture");
    expect(screen.queryByText("Kubernetes")).toBeNull();

    await userEvent.click(screen.getByLabelText("Expandir Cloud Architecture"));
    expect(await screen.findByText("Kubernetes")).toBeTruthy();

    await userEvent.click(screen.getByLabelText("Recolher Cloud Architecture"));
    expect(screen.getByText("Cloud Architecture")).toBeTruthy();
    expect(screen.queryByText("Kubernetes")).toBeNull();
  });
});
