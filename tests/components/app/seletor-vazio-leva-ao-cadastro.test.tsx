import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O `<Link>` do roteador, aqui, guarda TAMBÉM o `search` no `href`: é
 * exatamente o que esta suíte precisa provar — o link do time vazio não leva
 * à tela de times, leva ao FORMULÁRIO de cadastro (dono, 2026-09-08, item
 * 12: *"levando ao formulário de cadastro de times já aberto (não só à
 * tela)"*).
 */
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
 * SELETOR VAZIO É PORTA, NÃO PAREDE — pedido literal do dono (2026-09-08):
 * *"o filtro hoje obscurecido (desabilitado) passa a poder ser aberto,
 * mostrando 'Nenhum profissional cadastrado — clique para cadastrar', que
 * leva ao cadastro. Este é o padrão que as outras telas repetem."*
 *
 * A régua não mora em tela nenhuma: mora na `PersonCombobox` e no
 * `TeamChoiceField`, que perguntam ao `Registration` a frase, o destino e o
 * alcance. Por isso esta suíte prova o COMPONENTE — as onze telas que o dono
 * listou herdam o comportamento sem repetir uma linha.
 *
 * RECUSA DO DONO no mesmo dia, sobre o desenho que a primeira volta deu:
 * *"não podemos, do ponto de vista de UX, ter um hiperlink abaixo de um botão
 * assim. O texto deve aparecer quando o usuário clicar no botão do filtro."*
 * O convite deixou de ser irmão do gatilho e passou a morar DENTRO do painel
 * que o gatilho abre — e o gatilho voltou a ser botão, não âncora.
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
  it("diz a frase do dono e, no clique, abre o painel com o convite de cadastro", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(
      <PersonCombobox
        picker={PersonPicker.many([], [])}
        onChange={vi.fn()}
        label="Profissionais"
      />,
    );

    // O campo continua se chamando "Profissionais" para quem usa leitor de tela —
    // o que muda é que ele deixou de ser um botão morto e passou a abrir painel.
    const gatilho = await screen.findByRole("button", { name: "Profissionais" });
    expect(gatilho.textContent).toContain("Nenhum profissional cadastrado — clique para cadastrar");
    expect(screen.queryByRole("link")).toBeNull();

    await userEvent.click(gatilho);

    const painel = await screen.findByRole("dialog");
    const convite = within(painel).getByRole("link", {
      name: "Cadastrar primeiro profissional",
    });
    expect(convite.getAttribute("href")).toBe("/users?cadastrar=profissional");
  });

  it("não desenha NADA abaixo do gatilho — a recusa do dono, virada asserção", async () => {
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

    await userEvent.click(gatilho);

    await screen.findByRole("dialog");
    expect(gatilho.nextElementSibling).toBeNull();
    expect(gatilho.parentElement?.querySelector("a")).toBeNull();
  });

  it("para quem NÃO cadastra gente, o campo continua obscurecido e sem porta", async () => {
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

  it("some a opção 'Escolha o time' e entra o convite a cadastrar o primeiro", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(campo(TeamChoice.for(fixtureAssignedManagerUser, [])));

    expect(await screen.findByText("Nenhum time cadastrado — clique para cadastrar")).toBeTruthy();
    expect(screen.queryByText("Escolha o time")).toBeNull();
  });

  it("o convite, dentro do painel, abre o FORMULÁRIO de cadastro de times, não só a tela", async () => {
    montar(fixtureAssignedManagerUser);

    renderWithApp(campo(TeamChoice.for(fixtureAssignedManagerUser, [])));

    await userEvent.click(await screen.findByRole("button", { name: "Time" }));

    const painel = await screen.findByRole("dialog");
    const link = within(painel).getByRole("link", { name: "Cadastrar primeiro time" });
    expect(link.getAttribute("href")).toBe("/teams?cadastrar=time");
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
    expect(screen.queryByText("Nenhum time cadastrado — clique para cadastrar")).toBeNull();
  });
});
