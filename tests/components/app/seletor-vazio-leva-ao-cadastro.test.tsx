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
    expect(gatilho.textContent).toContain("Nenhum profissional cadastrado");
    expect(gatilho.getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(gatilho);

    // O painel que abre é o CARTÃO que explica o bloqueio; lista de opções, nunca.
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
    // O hiperlink de cadastro, se houver, mora DENTRO do cartão que explica o
    // bloqueio — nunca pendurado no campo (dono, 2026-09-08).
    for (const hiperlink of screen.queryAllByRole("link")) {
      expect(screen.getByRole("dialog").contains(hiperlink)).toBe(true);
    }
  });

  it("não desenha nada PENDURADO ao redor do gatilho — o convite mora no cartão", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(
      <PersonCombobox
        picker={PersonPicker.many([], [])}
        onChange={vi.fn()}
        label="Profissionais"
      />,
    );

    const gatilho = await screen.findByRole("button", { name: "Profissionais" });
    expect(gatilho.parentElement?.querySelector("a")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
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
    expect(campo.textContent).toContain("Nenhum profissional cadastrado");
    expect(campo.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(campo);
    // O painel que abre é o CARTÃO que explica o bloqueio; lista de opções, nunca.
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
    // O hiperlink de cadastro, se houver, mora DENTRO do cartão que explica o
    // bloqueio — nunca pendurado no campo (dono, 2026-09-08).
    for (const hiperlink of screen.queryAllByRole("link")) {
      expect(screen.getByRole("dialog").contains(hiperlink)).toBe(true);
    }
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

    expect(await screen.findByText("Nenhum time cadastrado")).toBeTruthy();
    expect(screen.queryByText("Escolha o time")).toBeNull();

    const gatilho = screen.getByRole("button", { name: "Time" });
    expect(gatilho.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(gatilho);
    // O painel que abre é o CARTÃO que explica o bloqueio; lista de opções, nunca.
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
    // O hiperlink de cadastro, se houver, mora DENTRO do cartão que explica o
    // bloqueio — nunca pendurado no campo (dono, 2026-09-08).
    for (const hiperlink of screen.queryAllByRole("link")) {
      expect(screen.getByRole("dialog").contains(hiperlink)).toBe(true);
    }
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
    expect(screen.queryByText("Nenhum time cadastrado")).toBeNull();
  });
});
