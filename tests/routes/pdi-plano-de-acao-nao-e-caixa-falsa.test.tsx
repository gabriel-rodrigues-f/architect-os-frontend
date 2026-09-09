import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState, SessionUser } from "@/lib/api";
import { Route as PlansRoute } from "@/routes/development-plans";
import { fixtureAssignedTechLeadUser, fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono (2026-09-08, com captura de PDI > Plano de Ação): *"hoje eu vejo um
 * bloco de texto, enganando o usuário a passar o mouse por ali, mas este bloco
 * na realidade está bloqueado. Não precisamos deste bloco. Quando um avaliador
 * escrever algo, deve aparecer como bloco de escrita, não como texto."*
 *
 * A régua é a mesma que o `ReflectionField` das Avaliações já seguia desde
 * 2026-09-07 e que só o Plano de Ação descumpria: **quem pode escrever vê a
 * caixa de escrita; quem não pode não vê caixa nenhuma, nem desabilitada.**
 * Aquele `ReflectionField` saiu do produto em 2026-09-09, junto com o
 * Começar/Parar/Continuar (ADR-0101) — a régua ficou, e este teste é agora o
 * único lugar que a guarda.
 * Sem nada escrito, vale o padrão do Extrato — duas linhas dizendo que
 * avaliação nenhuma foi feita ainda.
 *
 * Ninguém age sobre si (2026-09-06), então o profissional é sempre leitura no
 * PRÓPRIO PDI — é exatamente o caso da captura.
 */
const fetchMock = vi.fn();
const PlansPage = PlansRoute.options.component as () => ReactNode;

const PLACEHOLDER = /descreva as atividades práticas/i;

const semPlanoEscrito: AppState = {
  ...fixtureState,
  plans: fixtureState.plans.map((plan) => ({
    ...plan,
    items: plan.items.map((item) => ({ ...item, actionPlan: "" })),
  })),
};

const abrir = (user: SessionUser, state: AppState = fixtureState) => {
  mockAppFetch(fetchMock, { user, state });
  renderWithApp(<PlansPage />);
};

const caixas = () => document.querySelectorAll("textarea");

describe("PDI — o Plano de ação nunca é uma caixa de escrita falsa", () => {
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

  it("quem só lê e já tem plano escrito vê TEXTO — nenhuma caixa, nem desabilitada", async () => {
    abrir(fixtureMemberUser);

    expect(await screen.findByText("Curso + laboratório")).toBeTruthy();
    expect([...caixas()].filter((caixa) => caixa.disabled)).toHaveLength(0);
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  it("quem só lê e não tem nada escrito recebe o vazio de DUAS linhas, sem caixa", async () => {
    abrir(fixtureMemberUser, semPlanoEscrito);

    expect(await screen.findAllByText("Nenhuma avaliação neste ciclo")).not.toHaveLength(0);
    expect(
      screen.getAllByText(
        "O plano de ação aparece aqui quando o avaliador escrever, na avaliação deste ciclo.",
      ).length,
    ).toBeGreaterThan(0);
    expect([...caixas()].filter((caixa) => caixa.disabled)).toHaveLength(0);
  });

  it("quem escreve continua com a caixa de escrita de verdade", async () => {
    abrir(fixtureAssignedTechLeadUser);

    const caixa = await screen.findAllByPlaceholderText(PLACEHOLDER);
    expect(caixa.length).toBeGreaterThan(0);
    expect(caixa.every((campo) => !(campo as HTMLTextAreaElement).disabled)).toBe(true);
  });
});
