import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import type { SessionUser } from "@/lib/api";
import { Route as CareerFileRoute } from "@/routes/professionals.$professionalId";
import { Route as ProfileRoute } from "@/routes/professionals.$professionalId.index";
import { Route as StatementRoute } from "@/routes/professionals.$professionalId.statement";
import {
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureState,
  fixtureSupportUser,
  fixtureUnassignedTechLeadUser,
} from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch } from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

/**
 * A VISÃO GERAL GANHA A GUARDA QUE ELA NUNCA TEVE.
 *
 * Até esta fatia, `CareerFileTabs.isLeadershipTab` dizia que a pergunta de
 * alcance só valia para Evolução, Extrato e Roteiro: a Visão geral abria para
 * qualquer sessão, e quem a segurava era A RECUSA DO SERVIDOR — as quatro
 * listagens por pessoa (avaliações, PDI, mentoria, trilhas) respondiam 403 a
 * quem não alcança.
 *
 * Essas quatro listagens passaram a responder `200 []` no lugar do 403, para
 * fechar o oráculo (quem pergunta não descobre mais se aquela pessoa existe).
 * A decisão é certa e desarma, sem querer, a única barreira da Visão geral: a
 * tela passaria a DESENHAR ZEROS sobre alguém cujos dados quem olha não pode
 * ver — e zero não é vazio, é afirmação.
 *
 * A guarda passou a morar no LAYOUT da ficha ([FA-08]), uma vez para as
 * QUATRO abas: `beforeLoad: requireCareerTabsReach` na rota-pai, e o gêmeo de
 * tela (`!canOpenCareerTabs`) sem o desvio da Visão geral. A PRÓPRIA ficha
 * continua abrindo para a própria pessoa (dono, 2026-09-05, D2).
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;
const StatementPage = StatementRoute.options.component as () => ReactNode;

const A_FICHA_E_DE_QUEM_LIDERA =
  "A ficha de carreira de uma pessoa é dela e de quem a lidera por vínculo.";

function renderFichaDe(professionalId: string, user: SessionUser, Page: () => ReactNode) {
  // O estado do cliente traz a pessoa DE PROPÓSITO: é o mundo em que a tela
  // tem o nome e a listagem vazia, e ainda assim não pode afirmar nada.
  mockAppFetch(fetchMock, { user, state: fixtureState, routes: [careerLevelsRoute] });
  return renderCareerFile(<Page />, { tab: "overview", professionalId });
}

describe("a Visão geral da ficha é guardada pela mesma pergunta de alcance", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a guarda de navegação da ficha mora na ROTA-PAI, e vale para as quatro abas", () => {
    expect(CareerFileRoute.options.beforeLoad).toBeTypeOf("function");
  });

  it("o profissional que abre a ficha de OUTRA pessoa não vê a ficha — vê a negativa", async () => {
    renderFichaDe("bruno", fixtureMemberUser, ProfilePage);

    expect(await screen.findByText(A_FICHA_E_DE_QUEM_LIDERA)).toBeTruthy();
    expect(screen.queryByText("Bruno Almeida")).toBeNull();
  });

  it("e a tela negada não desenha os números de ninguém — nem zerados", async () => {
    renderFichaDe("bruno", fixtureMemberUser, ProfilePage);

    await screen.findByText(A_FICHA_E_DE_QUEM_LIDERA);
    expect(screen.queryByText("Competências em evolução")).toBeNull();
    expect(screen.queryByText("Nível médio")).toBeNull();
  });

  it("a PRÓPRIA ficha continua abrindo para a própria pessoa (D2, dono, 2026-09-05)", async () => {
    renderFichaDe("ana", fixtureMemberUser, ProfilePage);

    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.queryByText(A_FICHA_E_DE_QUEM_LIDERA)).toBeNull();
  });

  it("quem lidera continua abrindo a ficha de quem lidera", async () => {
    renderFichaDe("ana", fixtureAssignedManagerUser, ProfilePage);

    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.queryByText(A_FICHA_E_DE_QUEM_LIDERA)).toBeNull();
  });

  it("a negativa das abas de liderança segue de pé — a régua é uma só", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: fixtureState,
      routes: [careerLevelsRoute],
    });
    renderCareerFile(<StatementPage />, { tab: "statement", professionalId: "bruno" });

    expect(await screen.findByText(A_FICHA_E_DE_QUEM_LIDERA)).toBeTruthy();
  });

  /**
   * A guarda é a do PAPEL — é tudo o que a rota tem em mãos antes de o estado
   * chegar. Quem lidera alguém em algum lugar passa por ela; o que a segura
   * sobre ESTA pessoa é o vínculo, e é o que as telas perguntam depois
   * (`a-ficha-nao-afirma-sobre-quem-nao-alcanca.test.tsx`).
   */
  it("a conta de liderança sem vínculo passa pela porta — o vínculo é pergunta das telas", async () => {
    renderFichaDe("ana", fixtureUnassignedTechLeadUser, ProfilePage);

    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
  });

  /**
   * O DESVIO DO SUPORTE CONTINUA DE PÉ. O suporte opera o sistema e sobre uma
   * pessoa só LÊ em modo de suporte, por ticket — e o que o desvia para lá é a
   * ficha funcional (`SupportAccessDialog`), depois da guarda. A guarda nova
   * não pode chegar antes dele: o suporte passa por ela como liderança, e
   * quem o segura é o passe. (A ficha em modo de suporte inteira está em
   * `ficha-em-modo-de-suporte.test.tsx`.)
   */
  it("o suporte não é barrado pela guarda — ele é desviado para o passe", async () => {
    renderFichaDe("ana", fixtureSupportUser, ProfilePage);

    expect(await screen.findByText("Abrir a ficha em modo de suporte")).toBeTruthy();
    expect(screen.queryByText(A_FICHA_E_DE_QUEM_LIDERA)).toBeNull();
  });
});
