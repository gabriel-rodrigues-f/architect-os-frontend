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
import {
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureState,
} from "../helpers/fixtures";
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

describe("a Calibração declara a falha em vez de dizer que ninguém deu nota", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: fixtureState,
      routes: [rotaQueFalha("/calibration")],
    });
  });

  it("com a leitura falhando, a tela mostra a queda, não o ciclo sem notas", async () => {
    renderWithApp(<CalibrationPage />);
    expect(await screen.findByTestId(TELA_DE_QUEDA)).toBeTruthy();
    expect(screen.queryByText(CICLO_SEM_NOTA)).toBeNull();
  });

  it("a falha não desenha KPI nenhum — média geral inventada seria pior que tela vazia", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByTestId(TELA_DE_QUEDA);
    expect(screen.queryByText("Média geral")).toBeNull();
    expect(screen.queryByText("Avaliadores")).toBeNull();
  });

  it("a falha vem com o convite de tentar de novo", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByTestId(TELA_DE_QUEDA);
    expect(screen.getByRole("button", { name: RECARREGAR })).toBeTruthy();
  });
});

/**
 * REGRA 18 (dono, 2026-09-09): a recusa da calibração é de ALCANCE, e passa a
 * chegar como 404 — o mesmo número e o mesmo corpo de um ciclo que não
 * existe, que é justamente o ponto: o número deixa de contar quem existe.
 *
 * Para esta tela nada disso muda o que a pessoa lê, e é isso que o teste
 * guarda: recusa e ausência caem na mesma falha de leitura declarada, nunca
 * na caixa vazia que diria "nenhuma avaliação com nota" para quem sequer
 * podia perguntar. O caso do 403 fica ao lado porque a recusa de ATO continua
 * existindo, e ela também não pode virar caixa vazia.
 */
describe("negativa de acesso também é falha declarada, não caixa vazia", () => {
  const renderComRecusa = (status: number) => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: fixtureState,
      routes: [rotaQueFalha("/calibration", status)],
    });
    renderWithApp(<CalibrationPage />);
  };

  it("404 na calibração mostra a falha de leitura, não 'nenhuma avaliação com nota'", async () => {
    renderComRecusa(404);
    expect(await screen.findByText(FALHA_DE_CALIBRACAO)).toBeTruthy();
    expect(screen.queryByText(CICLO_SEM_NOTA)).toBeNull();
  });

  it("403 na calibração também é falha de leitura — a recusa de ato não sumiu", async () => {
    renderComRecusa(403);
    expect(await screen.findByText(FALHA_DE_CALIBRACAO)).toBeTruthy();
    expect(screen.queryByText(CICLO_SEM_NOTA)).toBeNull();
  });
});
