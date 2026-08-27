import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  fixtureUnassignedLeadUser,
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

function mockSession(
  user: typeof fixtureAdminUser | typeof fixtureMemberUser | typeof fixtureUnassignedLeadUser,
  state: AppState,
) {
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

  // Mesma avaliação, já enviada para revisão.
  const inReviewState: AppState = {
    ...fixtureState,
    assessments: fixtureState.assessments.map((a) =>
      a.id === "ana-h2" ? { ...a, status: "In Review" } : a,
    ),
  };

  it("member vê a autoavaliação editável (Rascunho) e a nota do Tech Lead travada", async () => {
    mockSession(fixtureMemberUser, draftState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    const selects = linha.querySelectorAll("select");
    // Só a coluna de autoavaliação continua <select>; alvo, líder e final viram texto.
    expect(selects).toHaveLength(1);
    expect(selects[0]?.value).toBe("4"); // self de "cloud-k8s" em ana-h2, na fixture

    expect(screen.getByRole("button", { name: "Enviar para revisão" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull();
  });

  /**
   * DOM-002 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — item ainda
   * não avaliado nasce `self: null`, nunca um nível fabricado; o botão de
   * envio para revisão precisa nascer desabilitado até todos os itens
   * estarem preenchidos, espelhando a completude que o backend já exige.
   */
  it("não avaliado mostra '—' e desabilita o envio até todos os itens terem self", async () => {
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
    mockSession(fixtureMemberUser, incompleteDraft);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Serverless")).closest("tr")!;
    // O select do item não avaliado não tem valor numérico selecionado.
    const select = linha.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("");

    const submit = screen.getByRole("button", { name: "Enviar para revisão" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(
        "Preencha a autoavaliação de todas as competências antes de enviar para revisão.",
      ),
    ).toBeTruthy();
  });

  // AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 2 — a autoavaliação
  // congela assim que sai do Rascunho; a pessoa não pode mais ajustá-la
  // enquanto o Tech Lead revisa.
  it("member não edita mais a autoavaliação depois de Em Revisão", async () => {
    mockSession(fixtureMemberUser, inReviewState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull();
  });

  // Seção 4 — líder/final ainda não abrem enquanto a avaliação está em
  // Rascunho, mesmo para o administrador.
  it("admin não edita líder nem final enquanto ainda é Rascunho", async () => {
    mockSession(fixtureAdminUser, draftState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    // Seção 3 — nem administrador pode concluir direto do Rascunho.
    expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull();
  });

  it("admin (Tech Lead) vê líder e final editáveis quando Em Revisão", async () => {
    mockSession(fixtureAdminUser, inReviewState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    const selects = linha.querySelectorAll("select");
    // Líder e final continuam <select>; autoavaliação e alvo viram texto.
    expect(selects).toHaveLength(2);

    expect(screen.getByRole("button", { name: "Concluir avaliação" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull();
  });

  /**
   * UX-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — antes,
   * `isLeadCapable(role)` liberava líder/final para QUALQUER conta `lead` da
   * empresa, não só o Tech Lead responsável por esta pessoa (`ana` não tem
   * `leadUserId` na fixture). O backend já recusava (`isLeadOf`); a tela
   * precisa nascer coerente com isso, não deixar preencher e devolver 403
   * tarde.
   */
  it("lead sem atribuição a esta pessoa não vê líder/final editáveis", async () => {
    mockSession(fixtureUnassignedLeadUser, inReviewState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull();
  });

  it("avaliação concluída: nenhum campo editável para ninguém", async () => {
    // "ana-h2" já é Completed na fixture original — sem sobrescrever o status.
    mockSession(fixtureAdminUser, fixtureState);
    renderWithApp(<AssessmentsPage />);

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    expect(await screen.findByText(/somente leitura/)).toBeTruthy();
  });

  // Correção pedida pelo usuário — depois de concluída, o Tech Lead precisa
  // conseguir reabrir a avaliação (Completed → In Review) e concluí-la de
  // novo, em vez de ficar travada para sempre.
  it("admin reabre avaliação concluída e volta a concluir depois", async () => {
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
    // Reaberta (In Review), líder e final voltam a ser <select> editável.
    expect(linha.querySelectorAll("select")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Concluir avaliação" }));
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
    window.history.pushState({}, "", "?architectId=ana&cycleId=2026-h1");
    mockSession(fixtureAdminUser, fixtureState);
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
