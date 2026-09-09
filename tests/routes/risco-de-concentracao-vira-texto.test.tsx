import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Sem `RouterProvider` real, `<Link>` vira âncora — com `href`, para o papel `link` existir. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params: _params,
      search,
      ...rest
    }: ComponentProps<"a"> & {
      to?: string;
      params?: unknown;
      search?: Record<string, string>;
    }) => (
      <a href={search ? `${to}?${new URLSearchParams(search).toString()}` : to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { Route as CapabilityRoute } from "@/routes/capability-map";
import type { AppState } from "@/lib/api";
import {
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Item 5 do lote do dono (2026-09-08): *"Risco de Concentração: normalizar
 * tudo para texto — tirar o pontilhado da coluna 'Sem avaliação' e o aspecto
 * de botão da coluna 'Risco'. Os dois parecem clicáveis e não são."*
 *
 * O "Risco" nunca foi clicável — era um `Badge`, com moldura, fundo e peso de
 * botão. E o número de "Sem avaliação" abre mesmo uma lista, mas o sublinhado
 * pontilhado o fazia parecer um link para outra tela; o que ele faz é revelar
 * nomes ali embaixo. Os dois viram TEXTO: quem age continua sendo botão de
 * verdade (papel, `aria-expanded`, teclado), sem se disfarçar de link.
 */
const fetchMock = vi.fn();

const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;

const semAvaliacaoNoCicloAtivo = (id: string, name: string) => ({
  id,
  name,
  role: "Júnior",
  yearsAsProfessional: 2,
  specialization: "Cloud",
  email: `${id}@company.com`,
  active: true,
  version: 1,
  teamId: fixtureTeamId,
});

const stateComPessoaSemAvaliacao: AppState = {
  ...fixtureState,
  professionals: [...fixtureState.professionals, semAvaliacaoNoCicloAtivo("carla", "Carla Souza")],
};

const PONTILHADO = /\b(?:underline|decoration-dotted|underline-offset-\d)\b/;
const ASPECTO_DE_BOTAO = /\b(?:rounded|border|bg-[a-z])/;

describe("Risco de Concentração — o que não é clicável não parece clicável", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: scopedFixtureStateFor(fixtureAssignedManagerUser, stateComPessoaSemAvaliacao, [
        fixtureTeamId,
      ]),
    });
    renderWithApp(<CapabilityPage />);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const abrirTabela = async () => {
    await screen.findByText("Cloud Architecture");
    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));
    return screen.getByText("Cloud Architecture").closest("tr") as HTMLElement;
  };

  it("na tabela, o valor de 'Sem avaliação' não tem pontilhado de link", async () => {
    const linha = await abrirTabela();

    const acesso = within(linha).getByRole("button", { name: /sem avaliação/i });
    expect(acesso.className).not.toMatch(PONTILHADO);
  });

  it("nos cartões, o acesso de 'Sem avaliação' também perde o pontilhado", async () => {
    // A tela passou a nascer na TABELA (dono, 2026-09-09); este caso é sobre
    // os CARTÕES, então ele pede os cartões em vez de contar com o padrão.
    await screen.findByText("Cloud Architecture");
    await userEvent.click(screen.getByRole("button", { name: "Cartões" }));
    const card = (await screen.findByText("Cloud Architecture")).closest("section") as HTMLElement;

    const acesso = within(card).getByRole("button", { name: /sem avaliação/i });
    expect(acesso.className).not.toMatch(PONTILHADO);
  });

  it("a coluna 'Risco' é texto: sem moldura, sem fundo e sem raio de botão", async () => {
    const linha = await abrirTabela();

    const risco = linha.querySelector("[data-risk]") as HTMLElement;
    expect(risco).not.toBeNull();
    expect(risco.className).not.toMatch(ASPECTO_DE_BOTAO);
  });

  it("a coluna 'Risco' não é elemento de ação — ninguém clica nela", async () => {
    const linha = await abrirTabela();
    const risco = linha.querySelector("[data-risk]") as HTMLElement;

    expect(risco.tagName.toLowerCase()).toBe("span");
    expect(within(linha).queryByRole("button", { name: /concentração|distribuída/i })).toBeNull();
  });

  it("o risco continua dizendo o que é, por extenso, para quem lê com leitor de tela", async () => {
    const linha = await abrirTabela();

    expect(linha.textContent).toContain("Risco de concentração");
  });

  it("o número continua abrindo a lista — virar texto não tirou a ação de quem age", async () => {
    const linha = await abrirTabela();
    const acesso = within(linha).getByRole("button", { name: /sem avaliação/i });

    await userEvent.click(acesso);

    expect(acesso.getAttribute("aria-expanded")).toBe("true");
    expect(within(linha).getByRole("link", { name: "Carla Souza" })).toBeTruthy();
  });
});
