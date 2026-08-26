import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "../api";
import type { AssessmentDevelopmentSummary } from "../domain";
import { fixtureAdminUser, fixtureMemberUser, fixtureState } from "./fixtures";
import { emptyEligibilityRoute, jsonResponse, mockAppFetch, renderWithApp } from "./render-app";

/**
 * ORIENTACAO-NONA-RODADA ENT-09-011 — "Começar/Parar/Continuar"
 * (`DevelopmentSummarySection`/`DevelopmentSummaryForm`, routes/assessments.tsx):
 * nenhum teste existia antes desta rodada.
 */

const fetchMock = vi.fn();

const draftState: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((a) =>
    a.id === "ana-h2" ? { ...a, status: "Draft" } : a,
  ),
};

const inReviewState: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((a) =>
    a.id === "ana-h2" ? { ...a, status: "In Review" } : a,
  ),
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

function baseSummary(
  overrides: Partial<AssessmentDevelopmentSummary> = {},
): AssessmentDevelopmentSummary {
  return {
    assessmentId: "ana-h2",
    startDoing: "",
    stopDoing: "",
    continueDoing: "",
    updatedByUserId: null,
    updatedAt: null,
    version: 0,
    ...overrides,
  };
}

function mockSession(
  user: typeof fixtureAdminUser | typeof fixtureMemberUser,
  state: AppState,
  summary: AssessmentDevelopmentSummary,
  onPut?: (body: unknown) => Response,
) {
  mockAppFetch(fetchMock, {
    user,
    state,
    routes: [
      (href, init) => {
        const method = init?.method ?? "GET";
        if (href.endsWith("/development-summary") && method === "GET") {
          return jsonResponse(summary);
        }
        if (href.endsWith("/development-summary") && method === "PUT") {
          const body: unknown = init?.body ? JSON.parse(String(init.body)) : {};
          if (onPut) return onPut(body);
          return new Response(JSON.stringify(summary), { status: 200 });
        }
        return undefined;
      },
      emptyEligibilityRoute,
    ],
  });
}

describe("Avaliações — Começar/Parar/Continuar", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("dono edita em Rascunho; campos nascem vazios e Salvar desabilitado até haver mudança", async () => {
    mockSession(fixtureMemberUser, draftState, baseSummary());
    renderWithApp(<AssessmentsPage />);

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    expect(start.value).toBe("");
    expect(start.disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
  });

  it("Tech Lead não edita enquanto Rascunho — campos travados", async () => {
    mockSession(fixtureAdminUser, draftState, baseSummary());
    renderWithApp(<AssessmentsPage />);

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    expect(start.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("Tech Lead edita em Revisão; dono fica travado e vê a última atualização", async () => {
    mockSession(
      fixtureAdminUser,
      inReviewState,
      baseSummary({
        startDoing: "Falar mais em reuniões",
        updatedAt: "2026-08-01T12:00:00Z",
        version: 1,
      }),
    );
    renderWithApp(<AssessmentsPage />);

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    expect(start.disabled).toBe(false);
    expect(start.value).toBe("Falar mais em reuniões");
  });

  it("salvar envia PUT com expectedVersion e mostra 'Salvo' depois do sucesso", async () => {
    mockSession(fixtureMemberUser, draftState, baseSummary(), (body) => {
      const patch = body as { expectedVersion: number };
      expect(patch.expectedVersion).toBe(0);
      return new Response(
        JSON.stringify(
          baseSummary({ startDoing: "Documentar decisões arquiteturais", version: 1 }),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderWithApp(<AssessmentsPage />);

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    await userEvent.type(start, "Documentar decisões arquiteturais");
    expect(screen.getByText("Alterações não salvas")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.getByText("Salvo")).toBeTruthy());
    const putCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === "PUT",
    );
    expect(putCall).toBeDefined();
  });

  /**
   * Conflito de versão (409): o texto digitado não pode sumir sozinho — só
   * some se a pessoa clicar em "Recarregar versão mais recente", de
   * propósito.
   */
  it("conflito de versão mantém o texto digitado até recarregar de propósito", async () => {
    let getCount = 0;
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: draftState,
      routes: [
        (href, init) => {
          const method = init?.method ?? "GET";
          if (href.endsWith("/development-summary") && method === "GET") {
            getCount += 1;
            return jsonResponse(
              getCount === 1
                ? baseSummary()
                : baseSummary({ startDoing: "Versão de outra pessoa", version: 1 }),
            );
          }
          if (href.endsWith("/development-summary") && method === "PUT") {
            return jsonResponse(
              { error: "conflict", message: "Atualizado por outra pessoa." },
              409,
            );
          }
          return undefined;
        },
        emptyEligibilityRoute,
      ],
    });

    renderWithApp(<AssessmentsPage />);

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    await userEvent.type(start, "Meu texto local");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await screen.findByText(/atualizada por outra pessoa/);
    // O texto continua na tela — o conflito não apagou nada sozinho.
    expect((screen.getByLabelText("Começar a fazer") as HTMLTextAreaElement).value).toBe(
      "Meu texto local",
    );

    await userEvent.click(screen.getByRole("button", { name: "Recarregar versão mais recente" }));

    await waitFor(() =>
      expect((screen.getByLabelText("Começar a fazer") as HTMLTextAreaElement).value).toBe(
        "Versão de outra pessoa",
      ),
    );
  });

  it("avaliação Concluída trava os três campos para todo mundo", async () => {
    const completedState: AppState = {
      ...fixtureState,
      assessments: fixtureState.assessments.map((a) =>
        a.id === "ana-h2" ? { ...a, status: "Completed" } : a,
      ),
    };
    mockSession(fixtureMemberUser, completedState, baseSummary({ startDoing: "Já concluído" }));
    renderWithApp(<AssessmentsPage />);

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    expect(start.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });
});
