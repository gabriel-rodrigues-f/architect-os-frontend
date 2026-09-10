import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { Route as CatalogPolicyRoute } from "@/routes/catalog-policy";
import { Route as EligibilityRoute } from "@/routes/eligibility";
import { Route as ModelReferenceRoute } from "@/routes/model-reference";
import { Route as ScoringRulersRoute } from "@/routes/scoring-rulers";
import { Route as TextTemplatesRoute } from "@/routes/text-templates";
import { Route as VocabulariesRoute } from "@/routes/vocabularies";
import { fixtureAdminUser, fixtureAssignedManagerUser } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 35, item 13 do dono (2026-09-02), literal: "Grupos de configuração
 * (Severidade de distância, Risco de concentração, Catálogo, Textos, Operação,
 * Tipos de item de trilha, Tipos de ação do PDI, Vocabulários) ganham '?'
 * explicando finalidade e como configurar."
 *
 * É o mesmo `?` do cabeçalho de página, descido para o título de cada grupo:
 * um botão "Como configurar {grupo}" que abre finalidade e passo a passo.
 */

const fetchMock = vi.fn();
const pagina = (route: { options: { component?: unknown } }) =>
  route.options.component as () => ReactNode;

const CatalogPolicyPage = pagina(CatalogPolicyRoute);
const EligibilityPage = pagina(EligibilityRoute);
const ModelReferencePage = pagina(ModelReferenceRoute);
const ScoringRulersPage = pagina(ScoringRulersRoute);
const TextTemplatesPage = pagina(TextTemplatesRoute);
const VocabulariesPage = pagina(VocabulariesRoute);

/**
 * Onda do GRUPO (dono, 2026-09-10): a tela única virou seis rotas, e o `?` de
 * um grupo que virou TELA subiu para o cabeçalho da página — o texto é o
 * mesmo, portado chave a chave. Os grupos que continuam sendo grupos DENTRO
 * de uma tela mantêm o `?` do título deles.
 *
 * Nenhuma das oito explicações que o dono nomeou no item 13 se perdeu: ou ela
 * é o `?` da tela, ou continua sendo o `?` do grupo.
 */
const GRUPOS_DENTRO_DE_UMA_TELA = [
  { grupo: "Severidade de distância", pagina: ScoringRulersPage, ancora: "Réguas e limiares" },
  { grupo: "Risco de concentração", pagina: ScoringRulersPage, ancora: "Réguas e limiares" },
  { grupo: "Operação", pagina: ScoringRulersPage, ancora: "Réguas e limiares" },
  { grupo: "Tipos de item de trilha", pagina: VocabulariesPage, ancora: "Vocabulários" },
  { grupo: "Tipos de ação do PDI", pagina: VocabulariesPage, ancora: "Vocabulários" },
  { grupo: "Escala de proficiência", pagina: ModelReferencePage, ancora: "Referência do modelo" },
  { grupo: "Ciclos", pagina: ModelReferencePage, ancora: "Referência do modelo" },
] as const;

/** Os grupos que viraram TELA: o `?` deles agora é o do cabeçalho da página. */
const GRUPOS_QUE_VIRARAM_TELA = [
  { tela: "Catálogo", pagina: CatalogPolicyPage },
  { tela: "Textos", pagina: TextTemplatesPage },
  { tela: "Vocabulários", pagina: VocabulariesPage },
  { tela: "Réguas e limiares", pagina: ScoringRulersPage },
  { tela: "Elegibilidade", pagina: EligibilityPage },
] as const;

/**
 * Revisão de papéis (dono, 2026-09-05, D1): os grupos de configuração do
 * SISTEMA (Severidade, Risco, Catálogo, Textos, Operação, Tipos, Vocabulários)
 * são do admin; a Política de Progressão e as referências (Escala, Ciclos)
 * também aparecem para o gerente com vínculo — é ele quem rege a régua.
 */
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const entrarComo = (user: typeof fixtureAdminUser) =>
  mockAppFetch(fetchMock, { user, routes: [careerLevelsRoute] });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Onda 35, item 11 do dono (2026-09-02), literal: "as descrições. eu quero um
 * pequeno interrogação em cada parte pra saber como utilizar cada coisa, o
 * mesmo que utilizamos nos títulos da aplicação."
 */
describe("cada fatia dos Critérios de Progressão se explica", () => {
  it.each(GRUPOS_QUE_VIRARAM_TELA)(
    '"$tela" tem o ? no cabeçalho da tela, para quem a alcança',
    async ({ tela, pagina: Pagina }) => {
      entrarComo(fixtureAdminUser);
      renderWithApp(<Pagina />);

      expect(await screen.findByRole("button", { name: `Como usar ${tela}` })).toBeTruthy();
    },
  );

  it("o ? da Elegibilidade diz que o mínimo conta grupos prontos e que ela não promove sozinha", async () => {
    entrarComo(fixtureAssignedManagerUser);
    renderWithApp(<EligibilityPage />);
    await screen.findByText("Júnior");

    await userEvent.click(screen.getByRole("button", { name: "Como usar Elegibilidade" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.textContent).toMatch(/grupos prontos/i);
    expect(dialogo.textContent).toMatch(/nunca promove/i);
  });
});

describe("cada grupo dentro de uma tela se explica", () => {
  it.each(GRUPOS_DENTRO_DE_UMA_TELA)(
    '"$grupo" tem o ? ao lado do título, em $ancora',
    async ({ grupo, pagina: Pagina }) => {
      entrarComo(fixtureAdminUser);
      renderWithApp(<Pagina />);

      expect(await screen.findByRole("button", { name: `Como configurar ${grupo}` })).toBeTruthy();
    },
  );

  it("o ? abre a finalidade e o como configurar do grupo", async () => {
    entrarComo(fixtureAdminUser);
    renderWithApp(<VocabulariesPage />);
    await screen.findByRole("heading", { level: 1, name: "Vocabulários" });

    await userEvent.click(screen.getByRole("button", { name: "Como usar Vocabulários" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.textContent).toContain("O que é");
    expect(dialogo.textContent).toMatch(/listas de opções/);
  });

  /**
   * D1 (revisão de papéis, 2026-09-05) virou ALCANCE DE ROTA: o gerente não
   * vê os grupos do sistema porque nem entra na tela deles — ouve a recusa.
   */
  it("as telas do sistema recusam o gerente, e nenhum grupo delas é desenhado", async () => {
    entrarComo(fixtureAssignedManagerUser);
    renderWithApp(<ScoringRulersPage />);
    await screen.findByText("Esta configuração é de quem opera o sistema.");

    for (const { grupo } of GRUPOS_DENTRO_DE_UMA_TELA) {
      expect(screen.queryByRole("button", { name: `Como configurar ${grupo}` })).toBeNull();
    }
  });
});
