import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `NoticeBell` chama `useRouter()` no render e `<Link>` no rodapé do popover;
 * ambos exigem `RouterProvider` real. Mesmo motivo dos testes de `AppShell`.
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

import { NoticeBell } from "@/components/app/NoticeBell";
import { apiPath } from "@/lib/api-path";
import { Route as CalibrationRoute } from "@/routes/calibration";
import { Route as NoticesRoute } from "@/routes/notices";
import { fixtureAdminUser, fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * As duas telas com gateway real (o sino/Central de avisos e a Calibração)
 * tinham rede só para o caminho FELIZ. O caminho de erro importa aqui mais
 * do que em outras telas porque o estado vazio delas é uma frase tranquila:
 * "Nenhum aviso" e "Nenhuma avaliação com nota neste ciclo". Se a falha de
 * servidor cair no ramo vazio, o líder lê "está tudo em dia" enquanto três
 * evidências esperam revisão, e o gestor lê "ninguém deu nota" enquanto a
 * distribuição existe e não chegou.
 *
 * O invariante: falha de leitura mostra FALHA, com o convite de tentar de
 * novo — nunca a caixa vazia, nunca a contagem antiga no badge.
 *
 * DEFEITO ACHADO AQUI, e ele era pior do que "sem rede": o sino ficava no
 * ESQUELETO PARA SEMPRE quando a leitura de avisos falhava antes de alguém
 * abrir o popover. Causa medida, não deduzida: o `useQuery` do React Query
 * só reavisa o componente quando muda uma propriedade que o componente LEU
 * durante o próprio render, e o `NoticeBell` lia apenas o payload
 * (`query.data`). De 'carregando' para 'falhou' o payload não muda — segue
 * `undefined` —, então o sino nunca era reavisado: guardava o resultado
 * 'carregando' e o popover abria num esqueleto eterno, sem o botão de tentar
 * de novo, para sempre (o `refetchInterval` de 60 s também não reavisa).
 * Quem lia `isPending`/`isError` era o `QuerySection`, e ele só monta quando
 * o popover abre — tarde demais.
 *
 * O conserto é o `observedQuery`: o dono da consulta materializa o estado
 * INTEIRO da leitura no próprio render, não só o que ela devolveu. Provado
 * pelos dois sentidos — os dois primeiros testes falham com o sino voltando
 * a observar só o payload.
 */
const fetchMock = vi.fn();

const NoticesPage = NoticesRoute.options.component as () => ReactNode;
const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;

const FALHA_DE_AVISOS = "Não foi possível carregar os avisos.";
const FALHA_DE_CALIBRACAO = "Não foi possível carregar a calibração.";
const CAIXA_VAZIA = "Nenhum aviso";
const CICLO_SEM_NOTA = "Nenhuma avaliação com nota neste ciclo";
const TENTAR_DE_NOVO = "Tentar novamente";

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

describe("o sino de avisos declara a falha em vez de dizer que não há aviso", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: fixtureState,
      routes: [rotaQueFalha("/notices")],
    });
  });

  it("com a leitura de avisos falhando, o popover mostra a falha, não a caixa vazia", async () => {
    renderWithApp(<NoticeBell />);
    await userEvent.click(await screen.findByRole("button", { name: /avisos/i }));
    expect(await screen.findByText(FALHA_DE_AVISOS)).toBeTruthy();
    expect(screen.queryByText(CAIXA_VAZIA)).toBeNull();
  });

  it("a falha vem com o convite de tentar de novo — o usuário não fica sem saída", async () => {
    renderWithApp(<NoticeBell />);
    await userEvent.click(await screen.findByRole("button", { name: /avisos/i }));
    await screen.findByText(FALHA_DE_AVISOS);
    expect(screen.getByRole("button", { name: TENTAR_DE_NOVO })).toBeTruthy();
  });

  it("sem contagem do servidor o badge não inventa número — o rótulo não fala em não lidos", async () => {
    renderWithApp(<NoticeBell />);
    const sino = await screen.findByRole("button", { name: /avisos/i });
    expect(sino.getAttribute("aria-label")).toBe("Avisos");
  });
});

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

  it("com a leitura falhando, a Central mostra a falha, não o estado vazio", async () => {
    renderWithApp(<NoticesPage />);
    expect(await screen.findByText(FALHA_DE_AVISOS)).toBeTruthy();
    expect(screen.queryByText(CAIXA_VAZIA)).toBeNull();
  });

  it("sem contagem do servidor, marcar todos como lidos fica indisponível", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText(FALHA_DE_AVISOS);
    const botao = screen.getByRole("button", { name: "Marcar todos como lidos" });
    expect(botao.hasAttribute("disabled")).toBe(true);
  });
});

describe("a Calibração declara a falha em vez de dizer que ninguém deu nota", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [rotaQueFalha("/calibration")],
    });
  });

  it("com a leitura falhando, a tela mostra a falha, não o ciclo sem notas", async () => {
    renderWithApp(<CalibrationPage />);
    expect(await screen.findByText(FALHA_DE_CALIBRACAO)).toBeTruthy();
    expect(screen.queryByText(CICLO_SEM_NOTA)).toBeNull();
  });

  it("a falha não desenha KPI nenhum — média geral inventada seria pior que tela vazia", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText(FALHA_DE_CALIBRACAO);
    expect(screen.queryByText("Média geral")).toBeNull();
    expect(screen.queryByText("Avaliadores")).toBeNull();
  });

  it("a falha vem com o convite de tentar de novo", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText(FALHA_DE_CALIBRACAO);
    expect(screen.getByRole("button", { name: TENTAR_DE_NOVO })).toBeTruthy();
  });
});

describe("negativa de acesso também é falha declarada, não caixa vazia", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [rotaQueFalha("/calibration", 403)],
    });
  });

  it("403 na calibração mostra a falha de leitura, não 'nenhuma avaliação com nota'", async () => {
    renderWithApp(<CalibrationPage />);
    expect(await screen.findByText(FALHA_DE_CALIBRACAO)).toBeTruthy();
    expect(screen.queryByText(CICLO_SEM_NOTA)).toBeNull();
  });
});
