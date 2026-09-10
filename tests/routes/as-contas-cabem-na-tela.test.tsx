import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import { PageFrame } from "@/components/app/PageFrame";
import { PageFillingPane } from "@/lib/design";
import { Route as UsersRoute } from "@/routes/users";
import { fixtureAdminUser, fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Dono (2026-09-10): *"Em Contas e Acessos, ainda preciso rolar para baixo
 * para ver a lista. Quero que comporte o grupo de Contas cadastradas dentro
 * da tela. Diminua o tamanho do grupo. Quero ver uma folga abaixo deste grupo
 * quando estiver em zoom de 100%."*
 *
 * A caixa JÁ rolava em si — o que estava errado era a CONTA. `restOfPage()`
 * era `100dvh − var(--shell-header-h) − var(--pane-page-inset-h)`, e os 16rem
 * do recuo eram um chute: a faixa de título e filtros "de uma página típica".
 * Nesta tela o topo real da caixa é mais baixo (título, subtítulo, cabeçalho
 * do cartão, o filtro de Time DENTRO do cartão e o cabeçalho da tabela), e a
 * caixa vazava.
 *
 * Medido na réplica da casca e da grade, com o CSS compilado, janela
 * 1440×900: a base da caixa caía em 925px (25px abaixo da dobra), a base do
 * cartão em 945px (45px abaixo) e o documento ia a 977px — a página rolava.
 *
 * O conserto não é outro número: é PARAR de somar números. A caixa deixa de
 * ter teto e passa a ser o filho que ocupa o resto de uma coluna de altura
 * cheia — a altura vira MEDIDA. Esta régua guarda a cadeia que torna isso
 * possível, que é o que uma tela deixaria escapar ao montar a caixa à mão.
 */
const fetchMock = vi.fn();
const UsersPage = UsersRoute.options.component as () => ReactNode;

const TIMES = [
  { id: "time-plataforma", name: "Plataforma", active: true },
  { id: "time-dados", name: "Dados", active: true },
];

const contas: SessionUser[] = [
  { ...fixtureMemberUser, id: "ana", name: "Ana Martins", email: "ana@empresa.com" },
  { ...fixtureAdminUser, id: "bruno", name: "Bruno Admin", email: "bruno@empresa.com" },
];

const rotaDeContas: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/auth/users")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(contas)
    : undefined;

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(TIMES)
    : undefined;

/** A tela DENTRO do quadro da casa — é a cadeia inteira que está sob teste. */
function renderPagina() {
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    state: fixtureState,
    routes: [rotaDeContas, rotaDeTimes],
  });
  return renderWithApp(
    <PageFrame pathname="/users">
      <UsersPage />
    </PageFrame>,
  );
}

/*
 * O cartão e a caixa se chamam igual ("Contas cadastradas"): o cartão é
 * `<section aria-labelledby>`, a caixa é `<div role="region" aria-label>`.
 * Procurar por papel devolvia o CARTÃO, e um teste que mede o elemento errado
 * passa por acidente — foi o que aconteceu no primeiro vermelho. A caixa se
 * acha pelo rótulo escrito nela.
 */
const caixa = async (): Promise<HTMLElement> => {
  await screen.findByRole("table");
  const encontrada = document.querySelector<HTMLElement>(
    'div[role="region"][aria-label="Contas cadastradas"]',
  );
  if (!encontrada) throw new Error("A lista de contas não está dentro de caixa nenhuma.");
  return encontrada;
};

const quadro = (): HTMLElement => {
  const main = document.querySelector("main[data-page-frame]");
  if (!main) throw new Error("A página não está dentro do quadro da casa.");
  return main as HTMLElement;
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Contas e Acessos: a lista cabe na tela porque a altura é medida", () => {
  it("a caixa não declara teto nenhum — nem token de janela, nem faixa suposta", async () => {
    renderPagina();
    const pane = await caixa();
    expect(pane.getAttribute("style")).toBeNull();
    expect(pane.className).not.toContain("max-h");
  });

  it("a caixa se anuncia ao quadro e é o filho que ocupa o resto", async () => {
    renderPagina();
    const pane = await caixa();
    expect(pane.hasAttribute(PageFillingPane.MARKER)).toBe(true);
    for (const classe of PageFillingPane.paneClass.split(/\s+/)) {
      expect(pane.className.split(/\s+/)).toContain(classe);
    }
  });

  it("o quadro da página vira coluna de altura cheia ao hospedar a caixa", async () => {
    renderPagina();
    await caixa();
    for (const classe of PageFillingPane.frameClass.split(/\s+/)) {
      expect(quadro().className.split(/\s+/)).toContain(classe);
    }
  });

  it("a folga abaixo do grupo é da GRADE — degrau da catraca, no quadro", async () => {
    renderPagina();
    await caixa();
    expect(PageFillingPane.frameClass).toContain(`pb-${String(PageFillingPane.SLACK_STEP)}`);
    expect(PageFillingPane.SLACK_STEP % 4).toBe(0);
  });

  /**
   * A cadeia entre o quadro e a caixa é o que a régua genérica veste de
   * coluna. Um ancestral que já FOSSE grade (ou linha) perderia o próprio
   * arranjo ao ser vestido — por isso nenhum pode ser.
   */
  it("nenhum ancestral entre o quadro e a caixa é grade ou linha", async () => {
    renderPagina();
    let atual = (await caixa()).parentElement;
    const vestidos: string[] = [];
    while (atual && atual !== quadro()) {
      vestidos.push(atual.className);
      atual = atual.parentElement;
    }
    expect(atual).toBe(quadro());
    for (const classes of vestidos) {
      expect(classes).not.toMatch(/(?:^|[\s:])(?:grid|flex-row|grid-cols-)/);
    }
  });

  it("em tela estreita não sobra caixa nenhuma: tudo que a monta é `xl:`", async () => {
    renderPagina();
    await caixa();
    const doMecanismo = [
      ...PageFillingPane.paneClass.split(/\s+/),
      ...PageFillingPane.frameClass.split(/\s+/),
      ...PageFillingPane.shellClass.split(/\s+/),
    ];
    expect(doMecanismo.length).toBeGreaterThanOrEqual(6);
    for (const classe of doMecanismo) expect(classe.startsWith("xl:")).toBe(true);
  });
});
