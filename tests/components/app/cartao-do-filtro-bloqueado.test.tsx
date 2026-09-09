import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
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
      <a href={search ? `${to ?? ""}?${new URLSearchParams(search).toString()}` : to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { EmptySelectionField, useSelectionEmptyState } from "@/components/app/EmptySelection";
import { Registration } from "@/lib/registration";
import { fixtureAssignedManagerUser, fixtureMemberUser } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * Dono (2026-09-08, com captura): *"não havendo ciclos cadastrados, quero um
 * estado de hover em cima do campo de ciclos que hoje está bloqueado. Ao
 * clicar em 'Cadastrar primeiro ciclo', devo ser direcionado ao formulário de
 * cadastro de ciclo."*
 *
 * A régua mora no `EmptySelectionField`, então vale para TODO filtro
 * bloqueado — o de ciclo é só o caso que a captura mostrou. O que este
 * arquivo prova é o que a captura não mostra e o desenho quebra se esquecer:
 * o cartão não fecha quando o ponteiro sai do campo E ENTRA nele (senão o
 * botão é inalcançável), abre também por teclado, e o gatilho continua sem
 * escolher nada.
 */
const fetchMock = vi.fn();

function CampoDeCiclo() {
  const vazio = useSelectionEmptyState(Registration.CYCLE);
  return <EmptySelectionField id="cycle" label="Ciclo" empty={vazio} />;
}

const montar = (user: typeof fixtureAssignedManagerUser) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user });
  return renderWithApp(<CampoDeCiclo />);
};

const gatilho = () => screen.getByRole("button", { name: "Ciclo" });

describe("o filtro bloqueado explica o bloqueio num cartão", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("bloqueado, não desabilitado: o gatilho continua alcançável pelo teclado e pelo ponteiro", async () => {
    montar(fixtureAssignedManagerUser);
    await screen.findByText("Nenhum ciclo cadastrado");

    const campo = gatilho();
    expect(campo.getAttribute("aria-disabled")).toBe("true");
    expect(campo.hasAttribute("disabled")).toBe(false);
  });

  it("o hover abre o cartão com ícone, as duas linhas e o botão de largura cheia para o formulário", async () => {
    montar(fixtureAssignedManagerUser);
    const user = userEvent.setup();
    await screen.findByText("Nenhum ciclo cadastrado");

    await user.hover(gatilho());

    const cartao = await screen.findByRole("dialog");
    expect(cartao.textContent).toContain("Nenhum ciclo cadastrado");
    expect(cartao.textContent).toContain("O ciclo é a janela de tempo das avaliações");
    expect(cartao.querySelector("svg")).toBeTruthy();

    const botao = screen.getByRole("link", { name: "Cadastrar primeiro ciclo" });
    /*
     * "devo ser direcionado ao FORMULÁRIO de cadastro de ciclo" — levar à
     * tela não basta: o parâmetro que abre o diálogo viaja no link, e quem o
     * declara é o `Registration`, não este campo.
     */
    expect(botao.getAttribute("href")).toBe("/cycles?cadastrar=ciclo");
    expect(botao.className).toContain("w-full");
  });

  it("sair do campo PARA o cartão não fecha — senão o botão seria inalcançável", async () => {
    montar(fixtureAssignedManagerUser);
    const user = userEvent.setup();
    await screen.findByText("Nenhum ciclo cadastrado");

    await user.hover(gatilho());
    const cartao = await screen.findByRole("dialog");

    await user.hover(cartao);
    expect(screen.queryByRole("dialog")).toBe(cartao);

    await user.click(screen.getByRole("link", { name: "Cadastrar primeiro ciclo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("sair do campo para FORA do conjunto fecha", async () => {
    montar(fixtureAssignedManagerUser);
    const user = userEvent.setup();
    await screen.findByText("Nenhum ciclo cadastrado");

    await user.hover(gatilho());
    await screen.findByRole("dialog");

    await user.unhover(gatilho());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("o foco por teclado abre o cartão, e o Esc o fecha", async () => {
    montar(fixtureAssignedManagerUser);
    const user = userEvent.setup();
    await screen.findByText("Nenhum ciclo cadastrado");

    gatilho().focus();
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Enter no gatilho leva o foco para dentro do cartão, no botão de cadastro", async () => {
    montar(fixtureAssignedManagerUser);
    const user = userEvent.setup();
    await screen.findByText("Nenhum ciclo cadastrado");

    gatilho().focus();
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("link", { name: "Cadastrar primeiro ciclo" }),
      ),
    );
  });

  it("quem não alcança o cadastro lê o cartão e não recebe botão nenhum", async () => {
    montar(fixtureMemberUser);
    const user = userEvent.setup();
    await screen.findByText("Nenhum ciclo cadastrado");

    await user.hover(gatilho());
    const cartao = await screen.findByRole("dialog");

    expect(cartao.textContent).toContain("O ciclo é a janela de tempo das avaliações");
    expect(screen.queryByRole("link", { name: "Cadastrar primeiro ciclo" })).toBeNull();
  });
});
