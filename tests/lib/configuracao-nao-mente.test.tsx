import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GapBadge } from "@/components/app/ui-bits";
import { apiPath } from "@/lib/api-path";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * CFG-03 — configuração que falha não pode virar régua de fábrica.
 *
 * As faixas de pontuação, os níveis de carreira, o piso de capacidades
 * qualificadas e a política de curadoria são a RÉGUA pela qual as pessoas
 * são avaliadas. Até esta fatia, falha na rota de qualquer uma delas era
 * engolida por `withDefault*`/`?? []` e a tela desenhava com o padrão de
 * fábrica — número errado com cara de número certo, na tela em que o gestor
 * decide promoção.
 *
 * Os três estados passam a ser distintos:
 *   - falhou ao carregar  → tela de falha de serviço (`ConnectionError`);
 *   - ainda não carregou  → `LoadingState`;
 *   - carregou e está vazio → padrão, como sempre foi (pinado em
 *     `store-scoring-bands.test.tsx` e no último caso deste arquivo).
 *
 * A separação régua × enfeite é a decisão de design da fatia: texto de
 * template e vocabulário de rótulos NÃO derrubam a aplicação, porque o
 * padrão deles é uma frase e uma lista de rótulos, não um número que
 * ranqueia gente.
 */
const fetchMock = vi.fn();

const TELA_DE_FALHA = "Não foi possível acessar o serviço";
const RECADO_DA_REGUA = "Gap 2 · Prioridade alta";

const rotaQueFalha =
  (caminho: string): FetchRoute =>
  (href) =>
    href.endsWith(apiPath(caminho))
      ? jsonResponse({ code: "INTERNAL", message: "x" }, 500)
      : undefined;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("configuração-régua que falha não desenha padrão de fábrica (CFG-03)", () => {
  const reguas = [
    ["faixas de pontuação", "/config/bands"],
    ["níveis de carreira", "/career-levels"],
    ["parâmetros operacionais", "/config/settings"],
    ["política de curadoria", "/config/curation-policy"],
  ] as const;

  for (const [nome, caminho] of reguas) {
    it(`${nome}: falha em ${caminho} mostra a falha de serviço, não a régua padrão`, async () => {
      mockAppFetch(fetchMock, { routes: [rotaQueFalha(caminho)] });
      renderWithApp(<GapBadge gap={2} />);

      expect(await screen.findByText(TELA_DE_FALHA)).toBeTruthy();
      expect(screen.queryByText(RECADO_DA_REGUA)).toBeNull();
    });
  }
});

describe("configuração de enfeite que falha não derruba a aplicação (CFG-03)", () => {
  const enfeites = [
    ["templates de texto", "/config/templates"],
    ["vocabulários", "/config/vocabularies"],
  ] as const;

  for (const [nome, caminho] of enfeites) {
    it(`${nome}: falha em ${caminho} mantém a tela de pé`, async () => {
      mockAppFetch(fetchMock, { routes: [rotaQueFalha(caminho)] });
      renderWithApp(<GapBadge gap={2} />);

      expect(await screen.findByText(RECADO_DA_REGUA)).toBeTruthy();
      expect(screen.queryByText(TELA_DE_FALHA)).toBeNull();
    });
  }
});

describe("configuração-régua vazia continua caindo no padrão (CFG-03)", () => {
  it("faixas carregadas e vazias mantêm o rótulo padrão, sem tela de falha", async () => {
    mockAppFetch(fetchMock, {
      routes: [(href) => (href.endsWith(apiPath("/config/bands")) ? jsonResponse({}) : undefined)],
    });
    renderWithApp(<GapBadge gap={2} />);

    expect(await screen.findByText(RECADO_DA_REGUA)).toBeTruthy();
    expect(screen.queryByText(TELA_DE_FALHA)).toBeNull();
  });
});
