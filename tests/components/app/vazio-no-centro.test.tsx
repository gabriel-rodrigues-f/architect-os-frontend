import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      search?: Record<string, string> | undefined;
    }) => (
      <a href={search ? `${to ?? ""}?${new URLSearchParams(search).toString()}` : to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { EmptyStateCallToAction } from "@/components/app/EmptyStateCallToAction";
import { PageAction } from "@/components/app/PageAction";
import { Registration } from "@/lib/registration";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
} from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * O CONVITE DE CADASTRO SAIU DO FILTRO E FOI PARA O CENTRO — pedido do dono
 * (2026-09-08), literal: *"o usuário precisa ver, à primeira vista, o botão
 * de cadastro quando não há nada cadastrado. ... disponibilizamos o botão de
 * criação mais abaixo, dentro do quadro principal e centralizado na tela."*
 *
 * O bloco é UM componente — a frase, uma linha curta de apoio e o(s)
 * botão(ões) —, e quem sabe o rótulo, o destino e a pergunta de alcance é o
 * `Registration`, não a tela. Onze telas usam este bloco; nenhuma repete a
 * régua.
 */
const fetchMock = vi.fn();

const montar = (user: typeof fixtureAssignedManagerUser) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user });
};

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("synapse:locale", "pt");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("o bloco de cadastro no centro do quadro principal", () => {
  it("diz a frase, a linha de apoio e leva ao cadastro — no rótulo do negócio", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(
      <EmptyStateCallToAction
        title="Não há profissionais cadastrados."
        hint="Cadastre alguém para começar."
        registrations={[Registration.PROFESSIONAL]}
      />,
    );

    expect(await screen.findByText("Não há profissionais cadastrados.")).toBeTruthy();
    expect(screen.getByText("Cadastre alguém para começar.")).toBeTruthy();
    const botao = screen.getByRole("link", { name: "Cadastrar Profissional" });
    expect(botao.getAttribute("href")).toBe("/users?cadastrar=profissional");
  });

  it("DOIS assuntos vazios, DOIS botões — na ordem em que a tela os declara", async () => {
    // Só quem opera o sistema cadastra capacidade; o gerente com vínculo, não.
    montar(fixtureAdminUser);

    renderWithApp(
      <EmptyStateCallToAction
        title="Não há o que avaliar ainda"
        registrations={[Registration.PROFESSIONAL, Registration.CAPABILITY]}
      />,
    );

    const bloco = (await screen.findByText("Não há o que avaliar ainda")).closest("div");
    expect(bloco).not.toBeNull();
    const rotulos = within(bloco as HTMLElement)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(rotulos).toEqual(["Cadastrar Profissional", "Cadastrar Capacidade"]);
  });

  /** Mandar alguém para uma porta fechada é pior do que não oferecer porta. */
  it("quem NÃO alcança o cadastro lê a frase e não recebe botão nenhum", async () => {
    montar(fixtureMemberUser);

    renderWithApp(
      <EmptyStateCallToAction
        title="Não há profissionais cadastrados."
        registrations={[Registration.PROFESSIONAL, Registration.CAPABILITY]}
      />,
    );

    expect(await screen.findByText("Não há profissionais cadastrados.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  /**
   * Quando o cadastro é um DIÁLOGO da própria tela (Trilhas, Ciclos,
   * Catálogo), o botão do centro é o MESMO da tela — não há para onde
   * navegar, e o bloco só o hospeda.
   */
  it("a ação da própria tela entra no bloco, ao lado dos botões de cadastro", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(
      <EmptyStateCallToAction title="Nenhuma trilha cadastrada">
        <PageAction label="Cadastrar Trilha" onClick={vi.fn()} />
      </EmptyStateCallToAction>,
    );

    expect(await screen.findByRole("button", { name: "Cadastrar Trilha" })).toBeTruthy();
  });
});
