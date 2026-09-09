import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import type { AppState, SessionUser } from "@/lib/api";
import type { Evidence } from "@/lib/domain";
import { fixtureAssignedManagerUser, fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import {
  emptyEligibilityRoute,
  mockAppFetch,
  renderWithApp,
  stubNarrowViewport,
} from "../helpers/render-app";

/**
 * Dono, 2026-09-08: *"Remova o campo Evidências e tudo o que está relacionado
 * a ele"* — na tela de Avaliação de Desempenho.
 *
 * O que sai da Avaliação: o bloco "Evidências" da pessoa, o botão de registrar,
 * o diálogo de registro, o reenvio a partir dali, o selo de evidência aceita na
 * competência e a lista "Evidências aceitas" dentro do painel de comentários —
 * na tabela e na versão empilhada (telas estreitas).
 *
 * O que NÃO sai: a evidência em si. Ela é entidade TRANSVERSAL na direção de
 * reestruturação do mesmo dia (`reestruturacao-ia-2026-09-08.md`, §18 e §26) e
 * continua viva na ficha da pessoa — quem registra, revisa e reenvia é a ficha
 * (`professional-profile-evidence-actions.test.tsx`).
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

/** Evidência aceita EXATAMENTE na competência que a tela mostra (Kubernetes). */
const evidenciaAceita: Evidence = {
  id: "ev-aceita",
  professionalId: "ana",
  title: "ADR-014 — Estratégia de retry",
  description: "",
  type: "ADR",
  competencyIds: ["cloud-k8s"],
  date: "2026-07-20",
  complexity: "High",
  status: "Accepted",
};

const comEvidenciaAceita: AppState = {
  ...fixtureState,
  evidences: [...fixtureState.evidences, evidenciaAceita],
};

/** O painel de comentários da competência, pelo id que o botão aponta. */
const painelDeComentarios = () => document.getElementById("asmt-comments-cloud-k8s");

function abrirAvaliacaoComo(user: SessionUser, state: AppState = comEvidenciaAceita) {
  mockAppFetch(fetchMock, { user, state, routes: [emptyEligibilityRoute] });
  renderWithApp(<AssessmentsPage />);
}

describe("Avaliação de Desempenho — a evidência saiu da tela", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("quem lidera não vê o bloco de evidências nem o botão de registrar", async () => {
    abrirAvaliacaoComo(fixtureAssignedManagerUser);
    await screen.findByText("Kubernetes");

    expect(screen.queryByText("Evidências")).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
    expect(screen.queryByText("ADR-014 — Estratégia de retry")).toBeNull();
  });

  it("o profissional não vê o bloco de evidências na própria avaliação", async () => {
    abrirAvaliacaoComo(fixtureMemberUser);
    await screen.findByText("Kubernetes");

    expect(screen.queryByText("Evidências")).toBeNull();
    expect(screen.queryByText("Nenhuma evidência registrada.")).toBeNull();
  });

  it("a competência não ganha selo de evidência aceita", async () => {
    abrirAvaliacaoComo(fixtureAssignedManagerUser);
    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;

    expect(within(linha).queryByLabelText(/evidência aceita/i)).toBeNull();
  });

  it("abrir os comentários da competência não lista evidências aceitas", async () => {
    abrirAvaliacaoComo(fixtureAssignedManagerUser);
    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;

    fireEvent.click(within(linha).getByRole("button", { name: /Kubernetes$/ }));

    expect(painelDeComentarios()).not.toBeNull();
    expect(within(painelDeComentarios()!).queryByText("Evidências aceitas")).toBeNull();
    expect(within(painelDeComentarios()!).queryByText("ADR-014 — Estratégia de retry")).toBeNull();
  });

  it("na tela estreita, o cartão empilhado também não fala de evidência", async () => {
    const restaurar = stubNarrowViewport(true);
    try {
      abrirAvaliacaoComo(fixtureAssignedManagerUser);
      const cartao = (await screen.findByText("Kubernetes")).closest<HTMLElement>(
        "[data-testid='competency-stacked-card']",
      )!;

      expect(within(cartao).queryByLabelText(/evidência aceita/i)).toBeNull();

      fireEvent.click(within(cartao).getByRole("button", { name: /Kubernetes$/ }));
      expect(painelDeComentarios()).not.toBeNull();
      expect(within(painelDeComentarios()!).queryByText("Evidências aceitas")).toBeNull();
    } finally {
      restaurar();
    }
  });

  it("o texto do comentário não convida a escrever evidência ali", async () => {
    abrirAvaliacaoComo(fixtureAssignedManagerUser);
    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;

    fireEvent.click(within(linha).getByRole("button", { name: /Kubernetes$/ }));

    const campo = within(painelDeComentarios()!).getByRole("textbox");
    expect(campo.getAttribute("placeholder")).not.toMatch(/evid/i);
  });
});
