import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { Route as AssessmentsRoute } from "@/routes/assessments";
import { fixtureAssignedTechLeadUser, fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import { emptyEligibilityRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono (2026-09-08, com captura): *"acessando como profissional, não posso ver
 * um botão de 'Abrir avaliação do ciclo'; consequentemente não verei a
 * mensagem em vermelho acima. Verei dados de avaliação nesta tela quando estas
 * forem realizadas."*
 *
 * A decisão vigente (2026-09-06) é que o profissional é SOMENTE LEITURA em
 * tudo — então oferecer-lhe a ação e depois explicar em vermelho que ele não
 * pode é o defeito duas vezes. A régua não é o PAPEL: quem responde é a
 * `UiAuthorizationPolicy`, pelo `AssessmentViewModel` (`canOpen`), para valer
 * também para a liderança sem vínculo com aquela pessoa.
 *
 * O estado do teste é a fixture SEM NENHUMA avaliação — exatamente o da
 * captura: o ciclo vigente está aberto, a pessoa existe, e ninguém avaliou.
 */
const fetchMock = vi.fn();
const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const semAvaliacao = { ...fixtureState, assessments: [] };

const abrir = (user: SessionUser) => {
  mockAppFetch(fetchMock, { user, state: semAvaliacao, routes: [emptyEligibilityRoute] });
  renderWithApp(<AssessmentsPage />);
};

describe("Avaliação de Desempenho sem avaliação no ciclo — a ação só para quem age", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o profissional lê que a avaliação ainda não existe — sem botão e sem aviso vermelho", async () => {
    abrir(fixtureMemberUser);

    await screen.findByText("Nenhuma avaliação neste ciclo");
    expect(screen.queryByRole("button", { name: "Abrir avaliação do ciclo" })).toBeNull();
    expect(
      screen.getByText(
        "Os dados de avaliação aparecem aqui assim que a liderança registrar a avaliação deste ciclo.",
      ),
    ).toBeTruthy();
    // A explicação de COMO abrir é de quem abre; para ele não faz sentido.
    expect(screen.queryByText(/Abrir a avaliação cria/)).toBeNull();
    expect(document.querySelectorAll(".text-destructive")).toHaveLength(0);
  });

  it("quem lidera a pessoa continua vendo a ação e a explicação de como abrir", async () => {
    abrir(fixtureAssignedTechLeadUser);

    expect(await screen.findByRole("button", { name: "Abrir avaliação do ciclo" })).toBeTruthy();
    expect(
      screen.queryByText(
        "Os dados de avaliação aparecem aqui assim que a liderança registrar a avaliação deste ciclo.",
      ),
    ).toBeNull();
  });
});
