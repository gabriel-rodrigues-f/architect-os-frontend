import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A Central de avisos chama `useRouter()` no render e desenha `<Link>`; ambos
 * exigem `RouterProvider` real. Mesmo motivo dos testes de `AppShell`.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouter: () => ({ history: { push: () => {} } }),
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { apiPath } from "@/lib/api-path";
import { Route as NoticesRoute } from "@/routes/notices";
import { fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * As duas telas com gateway real (o sino/Central de avisos e a Calibração)
 * tinham rede só para o caminho FELIZ. O caminho de erro importa aqui mais
 * do que em outras telas porque o estado vazio delas é uma frase tranquila:
 * "Nenhum aviso" e "Nenhuma avaliação com nota neste ciclo". Se a falha de
 * servidor cair no ramo vazio, o líder lê "está tudo em dia" enquanto três
 * PDIs esperam aprovação, e o gerente lê "ninguém deu nota" enquanto a
 * distribuição existe e não chegou.
 *
 * O invariante: falha de leitura mostra FALHA, com o convite de tentar de
 * novo — nunca a caixa vazia, nunca a contagem antiga no badge.
 *
 * DEFEITO ACHADO AQUI, e ele era pior do que "sem rede": o sino do cabeçalho
 * ficava no ESQUELETO PARA SEMPRE quando a leitura de avisos falhava antes de
 * alguém abrir o popover — ele lia só o payload (`query.data`), e de
 * 'carregando' para 'falhou' o payload não muda. O conserto foi o
 * `observedQuery`: quem é dono da consulta materializa o estado INTEIRO da
 * leitura no próprio render.
 *
 * O SINO SAIU DO PRODUTO em 2026-09-10 (dono: *"Vamos remover também o ícone
 * de notificações"*), e com ele os três testes que o usavam como veículo. O
 * que era DELE e não sobreviveria de outro jeito mudou de casa, não de
 * existência: a leitura que falha continua provada pela Central de avisos,
 * logo abaixo, e "sem contagem do servidor ninguém inventa número" passou a
 * ser prendido no selo do item de menu, em
 * `tests/components/app/avisos-contam-no-menu.test.tsx`.
 */
const fetchMock = vi.fn();

const NoticesPage = NoticesRoute.options.component as () => ReactNode;

const FALHA_DE_AVISOS = "Não foi possível carregar os avisos.";
const CAIXA_VAZIA = "Nenhum aviso";
const TENTAR_DE_NOVO = "Tentar novamente";
const RECARREGAR = "Recarregar";
const TELA_DE_QUEDA = "service-outage";

const rotaQueFalha =
  (caminho: string, status = 500): FetchRoute =>
  (href) =>
    href.includes(apiPath(caminho))
      ? jsonResponse({ code: "INTERNAL", message: "x" }, status)
      : undefined;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * A FORMA DA TELA TAMBÉM CONTAVA (auditoria de 2026-09-09): o 500 ficava de
 * fora da leitura de queda, então um gateway fora do ar virava o jogo e um
 * erro interno virava um aviso na seção — duas aparências para a mesma coisa,
 * legíveis sem abrir o inspetor. Desde então, todo 5xx é a MESMA tela.
 *
 * O invariante deste arquivo não mudou e continua sendo o que importa: falha
 * de leitura mostra FALHA, com saída — nunca a caixa vazia que faz o líder ler
 * "está tudo em dia" enquanto três PDIs esperam.
 */
describe("a Central de avisos declara a falha em vez de dizer que não há aviso", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: fixtureState,
      routes: [rotaQueFalha("/notices")],
    });
  });

  it("com a leitura falhando, a Central mostra a queda, não o estado vazio", async () => {
    renderWithApp(<NoticesPage />);
    expect(await screen.findByTestId(TELA_DE_QUEDA)).toBeTruthy();
    expect(screen.queryByText(CAIXA_VAZIA)).toBeNull();
  });

  it("sem contagem do servidor, marcar todos como lidos fica indisponível", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByTestId(TELA_DE_QUEDA);
    const botao = screen.getByRole("button", { name: "Marcar todos como lidos" });
    expect(botao.hasAttribute("disabled")).toBe(true);
  });

  it("a queda vem com o convite de recarregar — a pessoa não fica sem saída", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByTestId(TELA_DE_QUEDA);
    expect(screen.getByRole("button", { name: RECARREGAR })).toBeTruthy();
  });
});
