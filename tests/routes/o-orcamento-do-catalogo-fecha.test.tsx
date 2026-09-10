import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState } from "@/lib/api";
import type { Capability } from "@/lib/domain";
import { PageFillingPane, PaneHeight, PaneRhythm, ShellHeader } from "@/lib/design";
import { PageFrame } from "@/components/app/PageFrame";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * O ORÇAMENTO DE ALTURA DO CATÁLOGO, em 1440×900.
 *
 * A tela publicada em `a81d139` não fechava: sobravam capacidades arquivadas
 * abaixo da dobra. MEDIDO no navegador com o CSS compilado, depois de o ritmo
 * do cartão passar a ser o passo medido (112 no lugar dos 92 chutados), a
 * conta ANTES era esta — faixa útil de 841px (900 menos o cabeçalho de 59),
 * dos quais 32 de recuo do topo e 48 de folga do rodapé:
 *
 * | bloco                                  | ocupa        |
 * |----------------------------------------|--------------|
 * | recuo do topo (`py-8`)                 |  32          |
 * | cabeçalho da página                    |  76 + 24     |
 * | cartão "Níveis de Proficiência"        | 218,9 + 24   |
 * | filtros                                |  56 + 16     |
 * | caixa de capacidades (3 cartões)       | 336          |
 * | intervalo até Arquivadas (`mt-6`)      |  24          |
 * | Arquivadas, no mínimo                  | 222,89       |
 * | folga do rodapé (`pb-12`)              |  48          |
 * | **total**                              | **1077,79**  |
 *
 * 1077,79 contra 841: faltavam **236,79px**. Medido no navegador, o documento
 * ia a 1015 numa janela de 900 — 115 abaixo da dobra, com a caixa de
 * Arquivadas espremida a 40px.
 *
 * O que saiu foi a LEGENDA, não capacidade nenhuma: a escala L1–L5 é texto de
 * referência numa tela onde NADA é medido em nível — o único L1–L5 da tela era
 * o da própria legenda. Os cinco selos foram para a linha do título
 * (`PageHeader.legend`) e as descrições para o "?" da casa
 * (`ProficiencyScaleLegend`). Uma linha PRÓPRIA teria custado 28 + 16, e não
 * havia 44 sobrando; na linha do título o custo medido é ZERO, porque a linha
 * já mede 32 por causa do `h1` e um selo mede 22.
 *
 * Medido depois: documento de 900 numa janela de 900 — sobra ZERO —, a caixa
 * de Arquivadas com 114,11 (acima do piso de 108, três linhas à vista e o
 * resto rolando nela) e os 48 de folga do rodapé visíveis abaixo do cartão.
 *
 * Esta régua guarda a ARITMÉTICA (o que jsdom não mede, o teste soma) e as
 * duas decisões que a fizeram fechar: a caixa pede três cartões no ritmo do
 * CARTÃO, e a escala não é mais um cartão.
 */
const fetchMock = vi.fn();
const MatrixPage = MatrixRoute.options.component as () => ReactNode;

/** A janela do dono, e o que a página gasta fora dos blocos. */
const JANELA_H = 900;
const RECUO_DO_TOPO = 32; // `py-8` do quadro
const FOLGA_DO_RODAPE = PageFillingPane.SLACK_STEP * 4; // `pb-12`

/** MEDIDO no navegador, 1440×900 — o que cada bloco ocupa, mais seu intervalo. */
const CABECALHO_DA_PAGINA = 76 + 24;
/** A escala mora na LINHA DO TÍTULO, que já mede 32 por causa do `h1`. */
const LEGENDA_DA_ESCALA = 0;
const FILTROS = 56 + 16;
const INTERVALO_DAS_ARQUIVADAS = 24;
/** Cartão (`p-5`) + título e subtítulo (58,89) + `mb-4` + o piso de 3 linhas. */
const ARQUIVADAS_NO_MINIMO = 20 + 58.89 + 16 + 3 * 36 + 20;

const ativas: Capability[] = [1, 2, 3, 4, 5].map((numero) => ({
  id: `ativa-${String(numero)}`,
  name: `Capacidade Ativa ${String(numero)}`,
  short: `A${String(numero)}`,
  curation: { competencyCount: 3, status: "READY" },
}));
const arquivadas: Capability[] = [1, 2, 3, 4, 5, 6].map((numero) => ({
  id: `arquivada-${String(numero)}`,
  name: `Capacidade Arquivada ${String(numero)}`,
  short: `X${String(numero)}`,
  curation: { competencyCount: 0, status: "READY" },
}));

const state: AppState = { ...fixtureState, capabilities: [...ativas, ...arquivadas] };

function renderPagina() {
  mockAppFetch(fetchMock, { user: fixtureAdminUser, state, routes: [careerLevelsRoute] });
  return renderWithApp(
    <PageFrame pathname="/competency-matrix">
      <MatrixPage />
    </PageFrame>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A caixa de capacidades, em pixels, como o CSS a calcula. */
const caixaDeCapacidades = 3 * 112;

describe("o orçamento de altura do Catálogo fecha em 1440×900", () => {
  it("a soma dos blocos cabe na faixa útil, e sobra folga", () => {
    const faixaUtil = JANELA_H - ShellHeader.HEIGHT_PX;
    const ocupado =
      RECUO_DO_TOPO +
      CABECALHO_DA_PAGINA +
      LEGENDA_DA_ESCALA +
      FILTROS +
      caixaDeCapacidades +
      INTERVALO_DAS_ARQUIVADAS +
      ARQUIVADAS_NO_MINIMO +
      FOLGA_DO_RODAPE;
    expect(ocupado).toBeLessThanOrEqual(faixaUtil);
    expect(FOLGA_DO_RODAPE).toBeGreaterThan(0);
  });

  it("a caixa de capacidades pede três cartões no ritmo do CARTÃO, e o ritmo é o medido", () => {
    expect(PaneHeight.items(3, PaneRhythm.CARD).css).toBe("calc(3 * var(--pane-card-h))");
  });

  it("a escala L1–L5 deixou de ser cartão: é legenda de uma linha, com o ? da casa", async () => {
    renderPagina();
    await screen.findByText(ativas[0]!.name);

    // O título da escala não desenha bloco nenhum no corpo da tela.
    expect(screen.queryByText("Níveis de Proficiência")).toBeNull();

    // Os cinco selos ficam à vista, lado a lado, na LINHA DO TÍTULO da página.
    const linhaDoTitulo = screen.getByRole("heading", { level: 1 }).parentElement!;
    for (const nivel of [1, 2, 3, 4, 5]) {
      expect(linhaDoTitulo.textContent).toContain(`L${String(nivel)}`);
    }
    // E o gesto da consulta é o "?" da casa, não um bloco permanente na tela.
    expect(
      linhaDoTitulo.querySelector('button[aria-label="Escala de proficiência"]'),
    ).not.toBeNull();
  });

  it("as descrições dos cinco níveis não ocupam a tela — só o balão do ?", async () => {
    renderPagina();
    await screen.findByText(ativas[0]!.name);
    expect(screen.queryByText(/Conhece os conceitos principais/i)).toBeNull();
  });
});
