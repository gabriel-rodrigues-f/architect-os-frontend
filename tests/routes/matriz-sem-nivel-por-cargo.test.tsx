import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 21 / apagar-o-vazio — a Matriz de Competências prometia o nível
 * exigido por cargo em três colunas (NÍVEL I/II/III, 78 linhas × 3 = 234
 * células) e entregava traço em todas: o ADR-0032 do backend mudou o alvo de
 * endereço e ele mora na Régua do Time. Coluna que não pode ter dado é pior
 * que coluna ausente — ela ensina o lugar errado. Estes testes prendem os
 * DOIS lados do engano: a tabela e o texto de ajuda que mandava buscar ali.
 */

const fetchMock = vi.fn();

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

describe("Matriz de Competências — o alvo não mora aqui", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a tabela de competências não tem coluna por nível de carreira, mesmo com os três níveis carregados", async () => {
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Expandir Cloud Architecture"));
    await screen.findByText("Kubernetes");

    for (const nivel of ["Nível I", "Nível II", "Nível III"]) {
      expect(
        screen.queryByRole("columnheader", { name: nivel }),
        `a coluna "${nivel}" promete um alvo que a Matriz não tem`,
      ).toBeNull();
    }
  });

  it("nenhuma linha de competência exibe célula de nível vazia", async () => {
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Expandir Cloud Architecture"));
    const linha = (await screen.findByText("Kubernetes")).closest("tr");
    expect(linha).toBeTruthy();

    expect(
      within(linha!).queryAllByText("—"),
      "célula de nível vazia sobrevivendo na linha da competência",
    ).toEqual([]);
  });
});

describe("a ajuda das telas não manda buscar o alvo na Matriz", () => {
  const idiomas = { pt, en } as Record<string, Record<string, string>>;

  const NOME_DA_MATRIZ = { pt: "Matriz de Competências", en: "Competency Matrix" };
  const NOME_DA_REGUA = { pt: "Régua do Time", en: "Team Rule" };

  for (const idioma of ["pt", "en"] as const) {
    for (const persona of ["lead", "member"] as const) {
      it(`a ajuda de Avaliações (${idioma}/${persona}) aponta o alvo para a Régua do Time`, () => {
        const texto = idiomas[idioma]![`help.assessments.${persona}.comesFrom`]!;
        expect(texto).toContain(NOME_DA_REGUA[idioma]);
        expect(texto).not.toContain(NOME_DA_MATRIZ[idioma]);
      });

      it(`a ajuda da Matriz (${idioma}/${persona}) não promete nível por cargo nem edição de alvo`, () => {
        const oQueE = idiomas[idioma]![`help.competencyMatrix.${persona}.what`]!;
        const proximoPasso = idiomas[idioma]![`help.competencyMatrix.${persona}.nextStep`]!;
        const promessaDeNivel =
          idioma === "pt" ? /n[íi]vel esperado por cargo/i : /level expected per role/i;
        const promessaDeAlvo = idioma === "pt" ? /alvo/i : /target/i;

        expect(oQueE).not.toMatch(promessaDeNivel);
        expect(proximoPasso).not.toMatch(promessaDeAlvo);
      });
    }
  }
});
