import { fixtureAdminUser } from "../helpers/fixtures";
import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import { apiPath } from "@/lib/api-path";
vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { Route as ModelReferenceRoute } from "@/routes/model-reference";
import { Route as VocabulariesRoute } from "@/routes/vocabularies";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Onda 21 / apagar-o-vazio — a Política de Progressão empilhava, sob
 * "Referência do modelo", dois blocos que não informam nada:
 *
 *   · "Perfis de Competência por Cargo" — 13 capacidades × 3 cargos, traço em
 *     todas as células, pela mesma causa da Matriz (ADR-0032: o nível exigido
 *     é da régua do time);
 *   · "Taxonomias" — a mesma lista de tipos de ação e de item de trilha que o
 *     bloco "Vocabulários" mostra ACIMA, na mesma rolagem, e lá em versão
 *     editável.
 *
 * Os testes prendem a ausência dos dois e, no caso das taxonomias, prendem
 * também o que NÃO pode sumir junto: o conteúdo continua legível — em
 * Vocabulários, que é superconjunto.
 *
 * Onda do GRUPO (dono, 2026-09-10): a tela virou seis rotas. A referência
 * mora agora em `/model-reference` e os vocabulários em `/vocabularies`; a
 * ausência é cobrada em cada uma, no lugar onde o bloco reapareceria.
 */

const fetchMock = vi.fn();

const vocabulariesRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/config/vocabularies"))
    ? jsonResponse({
        LEARNING_ITEM_TYPE: [
          {
            vocabulary: "LEARNING_ITEM_TYPE",
            code: "COURSE",
            label: "Curso",
            order: 1,
            active: true,
          },
        ],
        ACTION_TYPE: [
          { vocabulary: "ACTION_TYPE", code: "LEARN", label: "Aprender", order: 1, active: true },
        ],
      })
    : undefined;

const ModelReferencePage = ModelReferenceRoute.options.component as () => ReactNode;
const VocabulariesPage = VocabulariesRoute.options.component as () => ReactNode;

describe("Referência do modelo — a referência não repete nem finge", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [careerLevelsRoute, vocabulariesRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * A âncora é a CÉLULA, não o título: apagar só a chave de locale deixaria o
   * bloco na tela com o cabeçalho quebrado e o teste passaria mesmo assim —
   * medido, foi o primeiro estado deste teste.
   */
  it("nenhuma célula da referência exibe traço no lugar do nível por cargo", async () => {
    const { container } = renderWithApp(<ModelReferencePage />);
    await screen.findByText("Escala de proficiência");

    const celulasVazias = [...container.querySelectorAll("td")].filter(
      (celula) => celula.textContent?.trim() === "—",
    );
    expect(celulasVazias, "a tabela de perfis por cargo é 13×3 células de traço").toEqual([]);
  });

  it("não há bloco de perfis de competência por cargo", async () => {
    renderWithApp(<ModelReferencePage />);
    await screen.findByText("Escala de proficiência");

    expect(screen.queryByText("Perfis de Competência por Cargo")).toBeNull();
    expect(screen.queryByText("Capacidade")).toBeNull();
  });

  it("não há bloco Taxonomias — Vocabulários já mostra a mesma lista, e editável", async () => {
    renderWithApp(<ModelReferencePage />);
    await screen.findByText("Escala de proficiência");

    expect(screen.queryByText("Taxonomias")).toBeNull();
    expect(screen.queryByText("Tipos de ação")).toBeNull();
    expect(screen.queryByText("Tipos de item de trilha")).toBeNull();
  });
});

describe("Vocabulários — o que NÃO pode sumir junto com o bloco repetido", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      routes: [careerLevelsRoute, vocabulariesRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("os tipos de ação e de item de trilha continuam legíveis, e o rótulo aparece uma vez só", async () => {
    renderWithApp(<VocabulariesPage />);
    await screen.findByRole("heading", { level: 1, name: "Vocabulários" });

    expect(screen.getByText("Tipos de ação do PDI")).toBeTruthy();
    expect(
      screen.getAllByText("Tipos de item de trilha"),
      "o rótulo aparecia duas vezes na mesma rolagem — em Vocabulários e em Taxonomias",
    ).toHaveLength(1);
    expect(screen.getByText("Aprender")).toBeTruthy();
    expect(screen.getByText("Curso")).toBeTruthy();
  });
});

/**
 * Onda do GRUPO (dono, 2026-09-10): a referência virou tela própria, e as
 * duas chaves que estas asserções guardavam mudaram de nome junto — o
 * subtítulo é o da tela Referência do modelo, e a ajuda é a dela.
 */
describe("o texto da referência não anuncia bloco que não existe mais", () => {
  const idiomas = { pt, en } as Record<string, Record<string, string>>;

  for (const idioma of ["pt", "en"] as const) {
    it(`o subtítulo (${idioma}) não promete perfis por cargo nem taxonomias`, () => {
      const subtitulo = idiomas[idioma]!["ref.reference.subtitle"]!;
      const promessas = idioma === "pt" ? [/cargos/i, /taxonomias/i] : [/roles/i, /taxonomies/i];
      for (const promessa of promessas) expect(subtitulo).not.toMatch(promessa);
    });

    it(`a ajuda da Referência (${idioma}) não promete taxonomias`, () => {
      const oQueE = idiomas[idioma]!["help.modelReference.lead.what"]!;
      expect(oQueE).not.toMatch(idioma === "pt" ? /taxonomias/i : /taxonomies/i);
    });
  }
});
