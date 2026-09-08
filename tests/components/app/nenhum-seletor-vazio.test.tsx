import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
      search?: Record<string, string> | undefined;
    }) => (
      <a href={search ? `${to ?? ""}?${new URLSearchParams(search).toString()}` : to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { AppShell } from "@/components/app/AppShell";
import { MultiSelectFilter } from "@/components/app/MultiSelectFilter";
import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { fixtureAdminUser } from "../../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * FILTRO SEM OPÇÕES É FILTRO BLOQUEADO — pedido do dono (2026-09-08), que
 * SUBSTITUI o desenho anterior (o convite de cadastro dentro do painel do
 * filtro): *"o usuário precisa ver, à primeira vista, o botão de cadastro
 * quando não há nada cadastrado. Ao invés de aparecer como linha clicável no
 * filtro, vamos bloquear o filtro e disponibilizamos o botão de criação mais
 * abaixo, dentro do quadro principal e centralizado na tela."*
 *
 * Então o seletor vazio é a MOLDURA COM A FRASE: o gatilho não escolhe nada,
 * não abre lista e não vira âncora, e não há hiperlink pendurado embaixo dele
 * — para TODOS, inclusive para quem alcança o cadastro. O convite do CENTRO
 * da tela mudou de lugar, não de existência: vive no `EmptyStateCallToAction`
 * e é o teste `vazio-no-centro` que o guarda.
 *
 * O que entrou depois (dono, 2026-09-08): o bloqueio passou a EXPLICAR-SE num
 * cartão que abre no hover e no foco, com o convite dentro. O cartão é do
 * `EmptySelectionField` e quem o prova é `cartao-do-filtro-bloqueado`; aqui
 * a régua que continua valendo é a outra — nada pendurado ao redor do campo,
 * e lista de opções nunca.
 */
const renderizar = (ui: React.ReactElement) => render(<I18nProvider>{ui}</I18nProvider>);

afterEach(() => cleanup());

describe("SingleSelectFilter sem opções — moldura, frase e nada mais", () => {
  it("sem lista e sem frase declarada, ainda assim diz que não há o que escolher", () => {
    renderizar(
      <SingleSelectFilter id="ciclo" label="Ciclo" options={[]} value="" onChange={vi.fn()} />,
    );

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.textContent).toContain("Não há nada para escolher aqui");
    expect(gatilho.getAttribute("aria-disabled")).toBe("true");
  });

  it("com a frase do domínio, é ela que aparece — e o campo não abre nada", async () => {
    renderizar(
      <SingleSelectFilter
        id="ciclo"
        label="Ciclo"
        options={[]}
        value=""
        onChange={vi.fn()}
        empty={{ message: "Nenhum ciclo cadastrado" }}
      />,
    );

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.textContent).toContain("Nenhum ciclo cadastrado");
    await userEvent.click(gatilho);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  const comCadastro = (
    <SingleSelectFilter
      id="ciclo"
      label="Ciclo"
      options={[]}
      value=""
      onChange={vi.fn()}
      empty={{
        message: "Nenhum ciclo cadastrado",
        registration: { label: "Cadastrar primeiro ciclo", to: "/cycles" },
      }}
    />
  );

  /**
   * A troca de desenho, virada asserção: mesmo QUEM ALCANÇA o cadastro vê o
   * filtro bloqueado. O botão de cadastro dele está no centro da tela.
   */
  it("mesmo com cadastro alcançável, o gatilho fica bloqueado e nunca abre LISTA", async () => {
    renderizar(comCadastro);

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.textContent).toContain("Nenhum ciclo cadastrado");
    expect(gatilho.getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(gatilho);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("nada fica PENDURADO ao redor do gatilho: o convite mora dentro do cartão", () => {
    renderizar(comCadastro);

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.tagName).toBe("BUTTON");
    // Fechado, não há nem hiperlink irmão nem hiperlink no campo.
    expect(gatilho.parentElement?.querySelector("a")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("com opções, nada disso aparece: o seletor é o de sempre", async () => {
    renderizar(
      <SingleSelectFilter
        id="ciclo"
        label="Ciclo"
        options={[{ value: "1", label: "2026.1" }]}
        value="1"
        onChange={vi.fn()}
        empty={{ message: "Nenhum ciclo cadastrado" }}
      />,
    );

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.textContent).toContain("2026.1");
    await userEvent.click(gatilho);
    expect(await screen.findByRole("listbox")).toBeTruthy();
  });
});

describe("MultiSelectFilter sem opções — a mesma régua, o mesmo desenho", () => {
  const comum = {
    id: "capacidades",
    label: "Capacidades",
    selected: [],
    onChange: vi.fn(),
    selectAllLabel: "Todas",
    allSummaryLabel: "Todas",
    noneSummaryLabel: "Nenhuma",
  };

  it("sem lista, diz a frase do domínio e fica bloqueado", async () => {
    renderizar(
      <MultiSelectFilter
        {...comum}
        options={[]}
        empty={{
          message: "Nenhuma capacidade cadastrada",
          registration: { label: "Cadastrar primeira capacidade", to: "/competency-matrix" },
        }}
      />,
    );

    const gatilho = screen.getByRole("button", { name: "Capacidades" });
    expect(gatilho.textContent).toContain("Nenhuma capacidade cadastrada");
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

  it("sem frase declarada, cai na frase da casa — nunca num campo vazio", () => {
    renderizar(<MultiSelectFilter {...comum} options={[]} />);

    expect(screen.getByRole("button", { name: "Capacidades" }).textContent).toContain(
      "Não há nada para escolher aqui",
    );
  });
});

/**
 * O CASO DO DONO, na tela onde ele o viu: o seletor de ciclo do CABEÇALHO.
 * Sem ciclo cadastrado ele diz a frase e não abre nada — o cadastro de ciclo
 * mora no centro da tela de Ciclos de Avaliação.
 */
describe("o seletor de ciclo do cabeçalho, sem ciclo cadastrado", () => {
  const fetchMock = vi.fn();

  const semCiclos = (href: string) => (href.includes("/cycles") ? jsonResponse([]) : undefined);

  it("diz que não há ciclos e fica bloqueado, sem painel e sem hiperlink", async () => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [semCiclos] });

    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );

    await screen.findByText("conteúdo");
    const gatilho = await screen.findByRole("button", { name: "Ciclo" });
    expect(gatilho.textContent).toContain("Nenhum ciclo cadastrado");
    expect(gatilho.getAttribute("aria-disabled")).toBe("true");
    expect(gatilho.nextElementSibling).toBeNull();

    await userEvent.click(gatilho);

    // O painel que abre é o CARTÃO que explica o bloqueio; lista de opções, nunca.
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
    vi.unstubAllGlobals();
  });
});
