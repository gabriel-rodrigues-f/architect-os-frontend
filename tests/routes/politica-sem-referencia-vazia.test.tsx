import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import { apiPath } from "@/lib/api-path";
import { Route as SettingsRoute } from "@/routes/settings";
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
 *   · "Taxonomias" — a mesma lista de tipos de ação e de evidência que o bloco
 *     "Vocabulários" mostra ACIMA, na mesma rolagem, e lá em versão editável.
 *
 * Os testes prendem a ausência dos dois e, no caso das taxonomias, prendem
 * também o que NÃO pode sumir junto: o conteúdo continua legível — em
 * Vocabulários, que é superconjunto.
 */

const fetchMock = vi.fn();

const vocabulariesRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/config/vocabularies"))
    ? jsonResponse({
        EVIDENCE_TYPE: [
          { vocabulary: "EVIDENCE_TYPE", code: "ADR", label: "ADR", order: 1, active: true },
        ],
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

const SettingsPage = SettingsRoute.options.component as () => ReactNode;

describe("Política de Progressão — a referência não repete nem finge", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute, vocabulariesRoute] });
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
    const { container } = renderWithApp(<SettingsPage />);
    await screen.findByText("Escala de proficiência");

    const celulasVazias = [...container.querySelectorAll("td")].filter(
      (celula) => celula.textContent?.trim() === "—",
    );
    expect(celulasVazias, "a tabela de perfis por cargo é 13×3 células de traço").toEqual([]);
  });

  it("não há bloco de perfis de competência por cargo", async () => {
    renderWithApp(<SettingsPage />);
    await screen.findByText("Escala de proficiência");

    expect(screen.queryByText("Perfis de Competência por Cargo")).toBeNull();
    expect(screen.queryByText("Capacidade")).toBeNull();
  });

  it("não há bloco Taxonomias — Vocabulários já mostra a mesma lista, e editável", async () => {
    renderWithApp(<SettingsPage />);
    await screen.findByText("Escala de proficiência");

    expect(screen.queryByText("Taxonomias")).toBeNull();
    expect(screen.queryByText("Tipos de ação")).toBeNull();
    expect(
      screen.getAllByText("Tipos de evidência"),
      "o rótulo aparecia duas vezes na mesma rolagem — em Vocabulários e em Taxonomias",
    ).toHaveLength(1);
  });

  it("os tipos de ação e de evidência continuam legíveis em Vocabulários", async () => {
    renderWithApp(<SettingsPage />);
    await screen.findByText("Vocabulários");

    expect(screen.getByText("Tipos de ação do PDI")).toBeTruthy();
    expect(screen.getByText("Tipos de evidência")).toBeTruthy();
    expect(screen.getByText("Aprender")).toBeTruthy();
    expect(screen.getByText("ADR")).toBeTruthy();
  });
});

describe("o texto da Política não anuncia referência que não existe mais", () => {
  const idiomas = { pt, en } as Record<string, Record<string, string>>;

  for (const idioma of ["pt", "en"] as const) {
    it(`o subtítulo (${idioma}) não promete perfis por cargo nem taxonomias`, () => {
      const subtitulo = idiomas[idioma]!["ref.subtitle"]!;
      const promessas = idioma === "pt" ? [/cargos/i, /evid[êe]ncia/i] : [/roles/i, /evidence/i];
      for (const promessa of promessas) expect(subtitulo).not.toMatch(promessa);
    });

    it(`a ajuda da Política (${idioma}) não promete taxonomias`, () => {
      const oQueE = idiomas[idioma]!["help.settings.lead.what"]!;
      expect(oQueE).not.toMatch(idioma === "pt" ? /taxonomias/i : /taxonomies/i);
    });
  }
});
