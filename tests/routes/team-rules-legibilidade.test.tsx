import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as TeamRulesRoute } from "@/routes/team-rules";
import { fixtureAssignedManagerUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";
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
 * V4 — "Capacidades exigidas" e "Piso de capacidades qualificadas" estavam
 * desalinhados, um em negrito e o outro não, porque eram DOIS jeitos de
 * rotular campo na mesma linha. O DONO MATOU O PISO em 2026-09-10, junto com
 * a elegibilidade: com um campo só na linha, não existe o par que
 * desalinhava, e o teste do "um jeito só" perdeu o objeto. O que sobra
 * medido aqui é o resto da captura — a fileira de chips e o respiro da
 * coluna.
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
        capabilityIds: ["cloud"],
        competencies: [{ competencyId: "cloud-k8s", requiredLevel: 4 }],
      })
    : undefined;

const renderPage = () => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAssignedManagerUser,
    state: fixtureState,
    routes: [careerLevelsRoute, teamsRoute, comRegua],
  });
  renderWithApp(<TeamRulesPage />);
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * V5 (2026-09-08) pedia que cada capacidade escolhida saísse em fundo próprio,
 * uma delimitada da outra. O DONO REVOGOU essa fileira em 2026-09-09: *"apagar
 * a fileira de chips de capacidade logo abaixo de 'Piso de capacidades
 * qualificadas'"* — ela não filtrava nada, era a repetição do que o seletor
 * "Capacidades exigidas" já diz. O que este teste guarda agora é o que a
 * fileira carregava de único: o selo de curadoria pendente. Ele não some, muda
 * de lugar — o aviso passa a NOMEAR as capacidades, que era justamente o que
 * faltava nele.
 */
describe("Régua do Time — a fileira de capacidades saiu e o aviso nomeia (2026-09-09)", () => {
  it("a capacidade escolhida não é repetida em chip abaixo do seletor", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    const itens = screen
      .getAllByText("Cloud Architecture")
      .flatMap((elemento) => elemento.closest("li") ?? []);

    expect(itens).toEqual([]);
  });
});

/**
 * Dono (2026-09-08, item 1), com captura: *"falta respiro entre o seletor 'Na
 * régua' e o 'Nível mínimo' na mesma linha"*. jsdom não mede pixel, mas mede
 * a REGRA: a coluna que vem antes carrega o espaçamento da escala da casa, e
 * não um valor solto inventado na linha.
 */
describe("Perfil de Competências do Time — respiro entre 'Na régua' e 'Nível mínimo'", () => {
  it("a célula de 'Na régua' afasta a próxima coluna com o espaçamento da escala", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    const naRegua = screen
      .getByLabelText("Na régua — Kubernetes")
      .closest("td") as HTMLTableCellElement;
    const nivelMinimo = screen
      .getByLabelText("Nível mínimo — Kubernetes")
      .closest("td") as HTMLTableCellElement;

    expect(naRegua.className.split(" ")).toContain("pr-4");
    expect(naRegua.nextElementSibling).toBe(nivelMinimo);
  });

  it("o cabeçalho acompanha a célula — a coluna inteira respira", async () => {
    renderPage();
    await screen.findByText("Kubernetes");

    const cabecalho = screen.getByRole("columnheader", { name: "Na régua" });
    expect(cabecalho.className.split(" ")).toContain("pr-4");
  });
});
