import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import type { SessionUser } from "@/lib/api";
import type { AppState } from "@/lib/api";
import {
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { emptyEligibilityRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono, 2026-09-09: a tela de Avaliação oferecia a caixa de comentário a quem
 * não pode escrever. A pessoa digitava o texto inteiro e só descobria no
 * envio, quando o servidor respondia *"só quem lidera esta pessoa altera esta
 * avaliação — a autoavaliação é registrada na 1:1"*.
 *
 * É o mesmo defeito que ele já tinha nomeado em 2026-09-08 sobre o Plano de
 * Ação: *"hoje eu vejo um bloco de texto, enganando o usuário"*. Uma caixa de
 * texto é uma promessa; oferecê-la a quem vai ser recusado é mentir e cobrar o
 * preço em trabalho perdido.
 *
 * A régua é a mesma que já governa as notas na tela (`canEditLeaderFinal`) —
 * não uma segunda régua paralela, que é como as duas se desencontrariam.
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

/** A mesma base, com a avaliação de Ana ainda aberta (a da fixture é concluída). */
const emRevisao: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((avaliacao) =>
    avaliacao.id === "ana-h2" ? { ...avaliacao, status: "In Review" as const } : avaliacao,
  ),
};

async function abrirNotasComo(user: SessionUser, base: AppState = fixtureState) {
  const lidera = user === fixtureAssignedManagerUser;
  mockAppFetch(fetchMock, {
    ...(lidera ? {} : { user }),
    state: lidera ? base : scopedFixtureStateFor(user),
    routes: [emptyEligibilityRoute],
  });
  renderWithApp(<AssessmentsPage />);
  const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
  const gatilho = within(linha)
    .getAllByRole("button")
    .find((botao) => /coment/i.test(botao.textContent ?? ""));
  await userEvent.click(gatilho ?? within(linha).getAllByRole("button")[0]!);
}

describe("a caixa de comentário só é oferecida a quem pode escrever", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o profissional na própria avaliação NÃO recebe a caixa de texto", async () => {
    await abrirNotasComo(fixtureMemberUser);

    expect(
      screen.queryAllByPlaceholderText("Feedback ou contexto sobre esta competência"),
    ).toHaveLength(0);
  });

  it("e a tela diz onde a fala dele é registrada, em vez de calar", async () => {
    await abrirNotasComo(fixtureMemberUser);

    expect(await screen.findByText(/registrada na 1:1/i)).toBeTruthy();
  });

  it("quem lidera, com a avaliação ainda aberta, continua com a caixa", async () => {
    await abrirNotasComo(fixtureAssignedManagerUser, emRevisao);

    expect(
      screen.getAllByPlaceholderText("Feedback ou contexto sobre esta competência").length,
    ).toBeGreaterThan(0);
  });

  /**
   * A segunda metade do mesmo defeito, que só apareceu quando a régua foi
   * escrita: a avaliação CONCLUÍDA está trancada no servidor
   * (`AssessmentLockedError`), e a tela oferecia a caixa mesmo assim — para
   * quem lidera, inclusive. Era o caso da própria fixture da casa.
   */
  it("nem quem lidera comenta numa avaliação concluída — o servidor a tranca", async () => {
    await abrirNotasComo(fixtureAssignedManagerUser);

    expect(
      screen.queryAllByPlaceholderText("Feedback ou contexto sobre esta competência"),
    ).toHaveLength(0);
  });
});
