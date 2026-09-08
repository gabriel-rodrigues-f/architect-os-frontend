import { cleanup, screen } from "@testing-library/react";
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

import { PersonCombobox } from "@/components/app/PersonCombobox";
import { TeamChoiceField } from "@/components/app/TeamChoiceField";
import { PersonPicker } from "@/lib/person-selection";
import { TeamChoice } from "@/lib/team-choice";
import { fixtureAssignedManagerUser, fixtureMemberUser } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * FILTRO SEM OPÇÕES É FILTRO BLOQUEADO — pedido do dono (2026-09-08), que
 * SUBSTITUI o desenho anterior (o convite de cadastro dentro do painel do
 * filtro): *"o usuário precisa ver, à primeira vista, o botão de cadastro
 * quando não há nada cadastrado. Ao invés de aparecer como linha clicável no
 * filtro, vamos bloquear o filtro e disponibilizamos o botão de criação mais
 * abaixo, dentro do quadro principal e centralizado na tela."*
 *
 * A régua continua não morando em tela nenhuma: mora na `PersonCombobox` e no
 * `TeamChoiceField`, que perguntam ao `Registration` a frase do domínio. O que
 * mudou é que a porta saiu do campo — ela é o botão do centro, provado em
 * `vazio-no-centro.test.tsx`. Aqui provamos o que o CAMPO faz: diz a frase e
 * não abre nada, para todos.
 */
const fetchMock = vi.fn();

const montar = (user: typeof fixtureAssignedManagerUser) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("synapse:locale", "pt");
});

describe("o filtro de pessoa sem ninguém cadastrado", () => {
  it("diz a frase do domínio e fica bloqueado — mesmo para quem cadastra gente", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(
      <PersonCombobox
        picker={PersonPicker.many([], [])}
        onChange={vi.fn()}
        label="Profissionais"
      />,
    );

    const gatilho = await screen.findByRole("button", { name: "Profissionais" });
    expect(gatilho.textContent).toContain("Não há profissionais cadastrados");
    expect(gatilho.hasAttribute("disabled")).toBe(true);

    await userEvent.click(gatilho);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("não desenha NADA ao redor do gatilho — nem linha clicável, nem hiperlink", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(
      <PersonCombobox
        picker={PersonPicker.many([], [])}
        onChange={vi.fn()}
        label="Profissionais"
      />,
    );

    const gatilho = await screen.findByRole("button", { name: "Profissionais" });
    expect(gatilho.nextElementSibling).toBeNull();
    expect(gatilho.parentElement?.querySelector("a")).toBeNull();
    expect(gatilho.getAttribute("aria-haspopup")).toBeNull();
  });

  it("para quem NÃO cadastra gente é exatamente a mesma coisa", async () => {
    montar(fixtureMemberUser);

    renderWithApp(
      <PersonCombobox
        picker={PersonPicker.many([], [])}
        onChange={vi.fn()}
        label="Profissionais"
      />,
    );

    const campo = await screen.findByRole("button", { name: "Profissionais" });
    expect(campo.textContent).toContain("Não há profissionais cadastrados");
    expect(campo.hasAttribute("disabled")).toBe(true);
    await userEvent.click(campo);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("o campo de time do diálogo de cadastro, sem nenhum time", () => {
  const campo = (choice: TeamChoice) => (
    <TeamChoiceField
      id="admit-team"
      label="Time"
      choice={choice}
      value=""
      onChange={vi.fn()}
      emptyOption={{ value: "", label: "Escolha o time" }}
      lockedExplanation="travado"
    />
  );

  it("some a opção 'Escolha o time' e entra a frase do vazio, sem lista a abrir", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(campo(TeamChoice.for(fixtureAssignedManagerUser, [])));

    expect(await screen.findByText("Não há times cadastrados")).toBeTruthy();
    expect(screen.queryByText("Escolha o time")).toBeNull();

    const gatilho = screen.getByRole("button", { name: "Time" });
    expect(gatilho.hasAttribute("disabled")).toBe(true);
    await userEvent.click(gatilho);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("com times cadastrados, o campo é o de sempre — com a opção vazia de volta", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(
      campo(
        TeamChoice.for(fixtureMemberUser, [
          { id: "t-1", name: "Plataforma" },
          { id: "t-2", name: "Dados" },
        ]),
      ),
    );

    expect(await screen.findByRole("button", { name: "Time" })).toBeTruthy();
    expect(screen.queryByText("Não há times cadastrados")).toBeNull();
  });
});
