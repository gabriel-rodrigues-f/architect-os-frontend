import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import type { AppState, SessionUser } from "@/lib/api";
import type { CareerFileTab } from "@/lib/career-file";
import { Route as ProfileRoute } from "@/routes/professionals.$professionalId.index";
import { Route as RoadmapRoute } from "@/routes/professionals.$professionalId.roadmap";
import {
  fixtureAdminUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureState,
} from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch } from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

/**
 * Pedido do dono (2026-09-05), literal: *"O gerente, tech lead e o
 * profissional hoje podem executar ações em 'Minha Carreira' que não fazem
 * sentido poder fazer. 'Minha carreira' deve ser uma tela apenas para
 * visualização de seu progresso, sem nenhuma ação e nem IA."*
 *
 * A regra é uma só: NA PRÓPRIA FICHA, NINGUÉM É LÍDER. O tech lead que é a
 * Ana abre a ficha da Ana e vê o que a Ana pode ver — nenhum roteiro, nenhum
 * "+ PDI" para levar a distância ao plano, nenhuma explicação de prontidão.
 * Na ficha do Bruno, liderado dele, tudo continua.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;
const RoadmapPage = RoadmapRoute.options.component as () => ReactNode;

// Desde 2026-09-07 a ficha não gera nada com IA (os roteiros moram em Mentoria
// e no PDI). Com a evidência fora do produto (dono, 2026-09-08, regra 17) a
// ficha perdeu "Revisar" e "Registrar": a ÚNICA ação que resta a quem lidera é
// levar a distância para o PDI. A ficha continua sendo lugar de decisão, mas
// de uma decisão só.
const ACOES_DA_LIDERANCA = [/^\+ PDI$/];

/**
 * A ficha só oferece "+ PDI" quando existe distância FORA do plano. Na fixture
 * a única distância aberta da Ana (security-iam) já está no plano dela, então
 * o estado abaixo tira esse item — é o mundo em que a ação de liderança tem o
 * que fazer.
 */
const comDistanciaForaDoPlano: AppState = {
  ...fixtureState,
  plans: fixtureState.plans.map((plan) =>
    plan.id === "pdi-ana"
      ? { ...plan, items: plan.items.filter((item) => item.competencyId !== "security-iam") }
      : plan,
  ),
};

const techLeadQueEAna: SessionUser = { ...fixtureAssignedTechLeadUser, professionalId: "ana" };
const adminQueEAna: SessionUser = { ...fixtureAdminUser, professionalId: "ana" };

function renderAs(
  user: SessionUser,
  Page: () => ReactNode,
  tab: CareerFileTab = "overview",
  state: AppState = comDistanciaForaDoPlano,
) {
  mockAppFetch(fetchMock, { user, state, routes: [careerLevelsRoute] });
  return renderCareerFile(<Page />, { tab });
}

describe("a própria ficha é leitura — sem ação e sem IA, para qualquer papel", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ["tech lead", techLeadQueEAna],
    ["admin", adminQueEAna],
    ["profissional", fixtureMemberUser],
  ])("%s que é a Ana abre a própria ficha e não encontra ação nem IA", async (_papel, user) => {
    renderAs(user, ProfilePage);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.getByText("Nível médio")).toBeTruthy();
    for (const acao of ACOES_DA_LIDERANCA) {
      expect(screen.queryByRole("button", { name: acao }), String(acao)).toBeNull();
    }
  });

  it("na própria ficha, o roteiro não oferece 'Explicar a prontidão'", async () => {
    renderAs(techLeadQueEAna, RoadmapPage, "roadmap");
    expect((await screen.findAllByText(/Roteiro/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Explicar a prontidão/ })).toBeNull();
  });

  it("na ficha de um liderado, o mesmo tech lead continua com as ações de liderança", async () => {
    renderAs({ ...fixtureAssignedTechLeadUser, professionalId: "bruno" }, ProfilePage);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    for (const acao of ACOES_DA_LIDERANCA) {
      expect(screen.getByRole("button", { name: acao }), String(acao)).toBeTruthy();
    }
  });
});
