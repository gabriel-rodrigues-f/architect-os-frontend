import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as TeamRulesRoute } from "@/routes/team-rules";
import { fixtureAdminUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Os três defeitos visuais que o dono mandou com captura de tela em
 * 2026-08-30, na Régua do Time. Só DOIS deles viram teste aqui, e o terceiro
 * está declarado embaixo — teste que não pode morder não entra.
 *
 * V4 — "Capacidades exigidas" e "Piso de capacidades qualificadas" estão
 * desalinhados e um está em negrito e o outro não. Medido no navegador antes
 * do conserto: o primeiro rótulo em y=381 com peso 400, o segundo em y=365
 * com peso 500. A causa não é estilo solto, é DOIS jeitos de rotular campo na
 * mesma linha — um pelo `FilterField` que todos os filtros usam, outro pelo
 * `<Label>` cru. O invariante que fecha isso é "um jeito só", e é ele que
 * está afirmado abaixo; o alinhamento vertical é consequência.
 *
 * V5 — a lista de capacidades escolhidas aparece sem delimitação, uma ao lado
 * da outra. A sugestão veio do próprio dono: fundo cinza em cada capacidade.
 *
 * V3 — "Time" e "Nível de carreira" desalinhados: NÃO reproduz como
 * desalinhamento. Medido em cinco larguras de janela (1600, 1440, 1280, 1100,
 * 1024), os dois rótulos saem no mesmo y e os dois seletores também, com a
 * mesma altura. O que difere é a LARGURA (208 contra 197), o que deixa as
 * bordas direitas irregulares. Isso é geometria de layout e jsdom não a
 * calcula: a prova dele é a captura de tela, não este arquivo.
 */
const fetchMock = vi.fn();

const TeamRulesPage = TeamRulesRoute.options.component as () => ReactNode;

const teamsRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/teams"))
    ? jsonResponse([{ id: fixtureTeamId, name: "Time Plataforma", active: true }])
    : undefined;

const comRegua: FetchRoute = (href) =>
  href.includes("/rules/")
    ? jsonResponse({
        id: "regra-plataforma-i",
        teamId: fixtureTeamId,
        careerLevelId: "arquiteto-de-solucoes-i",
        minimumQualifiedCapabilities: 3,
        capabilityIds: ["cloud"],
        competencies: [
          { competencyId: "cloud-k8s", requirementType: "RESTRICTIVE", requiredLevel: 4 },
        ],
      })
    : undefined;

const renderPage = () => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    state: fixtureState,
    routes: [careerLevelsRoute, teamsRoute, comRegua],
  });
  renderWithApp(<TeamRulesPage />);
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Régua do Time — os dois campos da régua são rotulados do mesmo jeito (V4)", () => {
  it("o rótulo do piso sai do mesmo componente de campo que o das capacidades", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    const capacidades = document.querySelector<HTMLLabelElement>(
      'label[for="team-rule-capabilities"]',
    );
    const piso = document.querySelector<HTMLLabelElement>('label[for="team-rule-minimum"]');

    expect(capacidades?.className).toBe(piso?.className);
  });

  it("nenhum dos dois rótulos usa o peso de fonte do outro — não sobra `<Label>` cru na linha", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    const piso = document.querySelector<HTMLLabelElement>('label[for="team-rule-minimum"]');

    expect(piso?.className).not.toContain("font-medium");
  });
});

describe("Régua do Time — cada capacidade escolhida tem delimitação própria (V5)", () => {
  it("as capacidades da régua saem em fundo próprio, uma delimitada da outra", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    const itens = screen
      .getAllByText("Cloud Architecture")
      .flatMap((elemento) => elemento.closest("li") ?? []);

    expect(itens).not.toEqual([]);
    for (const item of itens) {
      expect(item.className).toContain("bg-secondary");
    }
  });
});
