import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sem RouterProvider real, `<Link>` vira âncora — mas aqui o `href` importa:
 * o pedido é que cada pessoa abra a PRÓPRIA avaliação, então o mock monta
 * `to` + `search` como o router faria.
 */
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
import { fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 35, item 8 (dono, 2026-09-02): "De quem o time depende › Sem avaliação —
 * linkar para abrir". O número da coluna vira acesso às pessoas sem avaliação
 * naquela capacidade neste ciclo, e cada pessoa abre a própria avaliação em
 * `/assessments?architectId=<id>`. Zero continua só número.
 */
const fetchMock = vi.fn();

const CapabilityPage = CapabilityRoute.options.component as () => ReactNode;

const semAvaliacaoNoCicloAtivo = (id: string, name: string) => ({
  id,
  name,
  role: "Júnior",
  yearsAsArchitect: 2,
  specialization: "Cloud",
  email: `${id}@company.com`,
  active: true,
  version: 1,
});

/** Ana e Bruno têm avaliação concluída em 2026-h2; Carla e Diego não têm nenhuma. */
const stateComDuasPessoasSemAvaliacao: AppState = {
  ...fixtureState,
  architects: [
    ...fixtureState.architects,
    semAvaliacaoNoCicloAtivo("carla", "Carla Souza"),
    semAvaliacaoNoCicloAtivo("diego", "Diego Lima"),
  ],
};

const hrefDe = (link: HTMLElement) => new URL(link.getAttribute("href") ?? "", "http://localhost");

describe("De quem o time depende — 'Sem avaliação' abre a avaliação de cada pessoa", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("nos cartões: o acesso revela os dois nomes e cada link aponta para /assessments com o architectId certo", async () => {
    mockAppFetch(fetchMock, { state: stateComDuasPessoasSemAvaliacao });
    renderWithApp(<CapabilityPage />);

    const card = (await screen.findByText("Cloud Architecture")).closest("section")!;
    const acesso = within(card).getByRole("button", { name: /sem avaliação/i });
    expect(acesso.getAttribute("aria-expanded")).toBe("false");
    expect(within(card).queryByRole("link", { name: "Carla Souza" })).toBeNull();

    await userEvent.click(acesso);

    expect(acesso.getAttribute("aria-expanded")).toBe("true");
    const carla = within(card).getByRole("link", { name: "Carla Souza" });
    const diego = within(card).getByRole("link", { name: "Diego Lima" });
    expect(hrefDe(carla).pathname).toBe("/assessments");
    expect(hrefDe(carla).searchParams.get("architectId")).toBe("carla");
    expect(hrefDe(diego).pathname).toBe("/assessments");
    expect(hrefDe(diego).searchParams.get("architectId")).toBe("diego");
  });

  it("na tabela: o número da coluna é o acesso, com nome que diz a capacidade, e abre pelo teclado", async () => {
    mockAppFetch(fetchMock, { state: stateComDuasPessoasSemAvaliacao });
    renderWithApp(<CapabilityPage />);
    await screen.findByText("Cloud Architecture");
    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));

    const linha = screen.getByText("Cloud Architecture").closest("tr")!;
    const acesso = within(linha).getByRole("button", {
      name: /2.*sem avaliação.*Cloud Architecture/i,
    });
    expect(acesso.textContent).toBe("2");
    expect(acesso.getAttribute("aria-expanded")).toBe("false");

    acesso.focus();
    await userEvent.keyboard("{Enter}");

    expect(acesso.getAttribute("aria-expanded")).toBe("true");
    const links = within(linha).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Carla Souza", "Diego Lima"]);
    expect(links.map((link) => hrefDe(link).searchParams.get("architectId"))).toEqual([
      "carla",
      "diego",
    ]);
  });

  it("com zero pessoas sem avaliação não há acesso: a célula continua só o número 0", async () => {
    mockAppFetch(fetchMock, { state: fixtureState });
    renderWithApp(<CapabilityPage />);
    await screen.findByText("Cloud Architecture");

    expect(screen.queryByRole("button", { name: /sem avaliação/i })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));
    const linha = screen.getByText("Cloud Architecture").closest("tr")!;
    expect(within(linha).queryByRole("button")).toBeNull();
    expect(
      within(linha)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toContain("0");
  });
});
