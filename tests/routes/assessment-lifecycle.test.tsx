import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState, type SessionUser } from "@/lib/api";
import {
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureState,
  fixtureUnassignedTechLeadUser,
} from "../helpers/fixtures";
import {
  emptyEligibilityRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * PLANO-360-AGENTES-SYNAPSE.md, Seção 9 e 39 — o campo certo precisa nascer
 * desabilitado para o papel errado, não só ser rejeitado depois pelo backend.
 * Espelha, na tela, o que `assessments.ts` (backend) já impõe na API.
 */

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

function mockSession(user: SessionUser, state: AppState) {
  mockAppFetch(fetchMock, { user, state, routes: [emptyEligibilityRoute] });
}

describe("Avaliações — campos por papel e status", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // A avaliação ativa de Ana ("ana-h2") é Draft — a única a que ela é dona.
  const draftState: AppState = {
    ...fixtureState,
    assessments: fixtureState.assessments.map((a) =>
      a.id === "ana-h2" ? { ...a, status: "Draft" } : a,
    ),
  };

  /*
   * A ETAPA DO MEIO SAIU (dono, 2026-09-10): não existe mais um estado "em
   * revisão" para separar quem escreve o quê. Rascunho é a única etapa aberta,
   * e nela os TRÊS campos são editáveis por quem lidera.
   */

  /**
   * Dono, 2026-09-06: "Autoavaliação é um processo de PDI e 1:1, não um menu
   * para o membro. Para o membro é sempre view-only." O profissional LÊ a
   * própria autoavaliação em Rascunho — nenhum campo editável, nenhum botão.
   */
  it("o profissional LÊ a autoavaliação em Rascunho: nenhum campo editável, nenhuma ação (dono, 2026-09-06)", async () => {
    mockSession(fixtureMemberUser, draftState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    // O número dele continua visível — em texto.
    expect(linha.textContent).toContain("4");

    expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull();
  });

  it("quem lidera registra os TRÊS campos em Rascunho, na mesma conversa (dono, 2026-09-10)", async () => {
    mockSession(fixtureAssignedTechLeadUser, draftState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    const selects = linha.querySelectorAll("select");
    // Autoavaliação, líder e final são <select>; só o alvo é texto.
    expect(selects).toHaveLength(3);
    expect(selects[0]?.value).toBe("4"); // self de "cloud-k8s" em ana-h2, na fixture

    // Quem pontua não conclui: concluir é decisão de quem responde pela pessoa.
    expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull();
  });

  /**
   * DOM-002 — item ainda não avaliado nasce `self: null`, nunca um nível
   * fabricado; o botão que fecha a avaliação nasce desabilitado até todos os
   * itens estarem preenchidos, espelhando a completude que o backend exige.
   * Ele era "Enviar para revisão"; desde 2026-09-10 é "Concluir avaliação" —
   * a exigência mudou de degrau, não morreu.
   */
  it("não avaliado mostra '—' e desabilita a conclusão até todos os itens terem self", async () => {
    const incompleteDraft: AppState = {
      ...draftState,
      assessments: draftState.assessments.map((a) =>
        a.id === "ana-h2"
          ? {
              ...a,
              items: a.items.map((i) =>
                i.competencyId === "cloud-serverless" ? { ...i, self: null } : i,
              ),
            }
          : a,
      ),
    };
    mockSession(fixtureAssignedManagerUser, incompleteDraft);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Serverless")).closest("tr")!;
    // O select do item não avaliado não tem valor numérico selecionado.
    const select = linha.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("");

    const concluir = screen.getByRole("button", { name: "Concluir avaliação" });
    expect((concluir as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Preencha a autoavaliação de todas as competências antes de concluir."),
    ).toBeTruthy();
  });

  it("gerente vinculado edita os três campos em Rascunho, e é ele quem conclui (D4)", async () => {
    mockSession(fixtureAssignedManagerUser, draftState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Concluir avaliação" })).toBeTruthy();
  });

  /**
   * D4 (dono, 2026-09-05) — o tech lead vinculado PONTUA, mas concluir e
   * reabrir são decisão de carreira, do gerente designado.
   */
  it("D4 (dono, 2026-09-05) — tech lead vinculado pontua, mas não conclui nem reabre", async () => {
    mockSession(fixtureAssignedTechLeadUser, draftState);
    const { unmount } = renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull();
    unmount();
    cleanup();

    // "ana-h2" é Completed na fixture original.
    mockSession(fixtureAssignedTechLeadUser, fixtureState);
    renderWithApp(<AssessmentsPage />);
    await screen.findByText("Kubernetes");
    expect(screen.queryByRole("button", { name: "Reabrir avaliação" })).toBeNull();
  });

  /**
   * UX-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md), semântica
   * pós-Fase 2 — o vínculo virou o TIME (ADR-0035): um lead de outro time
   * nem recebe a pessoa no recorte do servidor; o caso que a UI ainda decide
   * sozinha é o profissional SEM time. Revisão de papéis (2026-09-05): o alcance
   * é o VÍNCULO, não o papel — a pessoa sem time nem entra no seletor de
   * Avaliações do tech lead sem vínculo, então a avaliação dela não abre.
   */
  it("tech lead sem vínculo não alcança a avaliação de profissional sem time — nem líder/final, nem a tabela", async () => {
    mockSession(fixtureUnassignedTechLeadUser, {
      ...draftState,
      professionals: draftState.professionals.map((professional) => ({
        ...professional,
        teamId: null,
      })),
    });
    renderWithApp(<AssessmentsPage />);

    expect(await screen.findByText("Nenhuma avaliação neste ciclo")).toBeTruthy();
    expect(screen.queryByText("Kubernetes")).toBeNull();
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull();
  });

  it("avaliação concluída: nenhum campo editável para ninguém", async () => {
    // "ana-h2" já é Completed na fixture original — sem sobrescrever o status.
    mockSession(fixtureAssignedManagerUser, fixtureState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    // O selo "somente leitura" saiu com o bloco de situação (dono, 2026-09-10);
    // o que resta dizendo que está fechada é a ausência de campo editável e a
    // presença do "Reabrir avaliação".
    expect(screen.getByRole("button", { name: "Reabrir avaliação" })).toBeTruthy();
  });

  // Depois de concluída, quem decide carreira (o gerente designado, D4)
  // reabre a avaliação (Completed → Rascunho) e a conclui de novo, em vez de
  // ela ficar travada. Desde 2026-09-10 a reabertura tem JANELA — só o ciclo
  // vigente —, e quem julga isso é o domínio, no servidor.
  it("gerente reabre avaliação concluída e volta a concluir depois", async () => {
    const completedAssessment = fixtureState.assessments.find((a) => a.id === "ana-h2")!;

    mockAppFetch(fetchMock, {
      routes: [
        (href, init) => {
          if (init?.method === "PATCH" && href.endsWith(apiPath("/assessments/ana-h2/status"))) {
            const body = JSON.parse(String(init.body)) as { status: string };
            return jsonResponse({ ...completedAssessment, status: body.status });
          }
          return undefined;
        },
        emptyEligibilityRoute,
      ],
    });

    renderWithApp(<AssessmentsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Reabrir avaliação" }));

    expect(await screen.findByRole("button", { name: "Concluir avaliação" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reabrir avaliação" })).toBeNull();

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    // Reaberta (Rascunho), os três campos voltam a ser <select> editável.
    expect(linha.querySelectorAll("select")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Concluir avaliação" }));
    // Onda 33 — concluir pede confirmação explícita antes de fechar o ciclo.
    const confirmacao = await screen.findByRole("dialog");
    await userEvent.click(
      within(confirmacao).getByRole("button", { name: "Confirmar e concluir" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull(),
    );
    expect(await screen.findByRole("button", { name: "Reabrir avaliação" })).toBeTruthy();
  });

  /**
   * HIST-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — o link
   * "Ver" do histórico do perfil passa `cycleId` na URL; a tela precisa abrir
   * o assessment daquele ciclo específico, não sempre o do ciclo ativo do
   * time. Na fixture, Ana tem "ana-h1" (2026-h1, final=3 em Kubernetes) e
   * "ana-h2" (2026-h2, o ciclo ativo, final=4 em Kubernetes) — valores
   * diferentes, então o teste prova qual dos dois realmente abriu.
   */
  it("deep-link com cycleId abre o assessment do ciclo do link, não o ciclo ativo", async () => {
    window.history.pushState({}, "", "?professionalId=ana&cycleId=2026-h1");
    mockSession(fixtureAssignedManagerUser, fixtureState);
    renderWithApp(<AssessmentsPage />);

    expect(await screen.findByText(/2026 H1/)).toBeTruthy();
    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    // Colunas: competência, self, líder, alvo, final, gap, notas.
    const finalCell = linha.querySelectorAll("td")[4];
    // final=3 é de "ana-h1"; se tivesse caído no ciclo ativo (ana-h2), seria 4.
    expect(finalCell?.textContent).toContain("3");

    window.history.pushState({}, "", "/");
  });
});
