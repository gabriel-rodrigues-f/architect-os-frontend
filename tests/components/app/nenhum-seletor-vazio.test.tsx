import { cleanup, render, screen, within } from "@testing-library/react";
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
 * Dono (2026-09-08), REINCIDENTE — já estava na FILA desde 2026-09-02:
 * *"não devemos ter comboboxes vazios. Quando ainda não houver ciclos
 * cadastrados, mostrar 'Não há ciclos cadastrados' + 'Cadastrar primeiro
 * ciclo' como hiperlink para a tela de cadastro"*.
 *
 * Voltou porque a régua morava em cada tela: a onda de 2026-09-02 cobriu o
 * Painel e Times, e o seletor do CABEÇALHO passou batido. Agora a régua mora
 * no COMPONENTE de seleção — sem opções, ele NUNCA desenha um campo vazio:
 * desenha a frase e, quando há tela de cadastro, o convite de cadastro.
 * Nenhuma tela precisa lembrar; nenhuma tela consegue esquecer.
 *
 * RECUSA DO DONO (2026-09-08), literal: *"isso que você fez com os botões não
 * está aceitável... não podemos, do ponto de vista de UX, ter um hiperlink
 * abaixo de um botão assim. O texto deve aparecer quando o usuário clicar no
 * botão do filtro. Isso vale para todos."* Então o convite mudou de lugar:
 * ele mora DENTRO do painel do seletor, que abre no clique. Nada, em hipótese
 * nenhuma, é desenhado abaixo do gatilho — e o gatilho volta a ser botão, não
 * âncora: gatilho é gatilho.
 */
const renderizar = (ui: React.ReactElement) => render(<I18nProvider>{ui}</I18nProvider>);

afterEach(() => cleanup());

describe("SingleSelectFilter sem opções — nunca um campo vazio", () => {
  it("sem lista e sem frase declarada, ainda assim diz que não há o que escolher", () => {
    renderizar(
      <SingleSelectFilter id="ciclo" label="Ciclo" options={[]} value="" onChange={vi.fn()} />,
    );

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.textContent).toContain("Não há nada para escolher aqui");
    expect(gatilho.hasAttribute("disabled")).toBe(true);
  });

  it("com a frase do domínio, é ela que aparece — e o campo não abre lista nenhuma", async () => {
    renderizar(
      <SingleSelectFilter
        id="ciclo"
        label="Ciclo"
        options={[]}
        value=""
        onChange={vi.fn()}
        empty={{ message: "Não há ciclos cadastrados" }}
      />,
    );

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.textContent).toContain("Não há ciclos cadastrados");
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
        message: "Não há ciclos cadastrados",
        registration: { label: "Cadastrar primeiro ciclo", to: "/cycles" },
      }}
    />
  );

  it("o convite de cadastro só aparece DENTRO do painel, quando o gatilho é clicado", async () => {
    renderizar(comCadastro);

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.textContent).toContain("Não há ciclos cadastrados");
    expect(gatilho.hasAttribute("disabled")).toBe(false);
    // Antes do clique não há convite nenhum na tela — nem abaixo, nem ao lado.
    expect(screen.queryByRole("link")).toBeNull();

    await userEvent.click(gatilho);

    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText("Não há ciclos cadastrados")).toBeTruthy();
    const convite = within(painel).getByRole("link", { name: "Cadastrar primeiro ciclo" });
    expect(convite.getAttribute("href")).toBe("/cycles");
  });

  /**
   * A recusa do dono, virada asserção: NADA é renderizado depois do gatilho.
   * O hiperlink irmão que ficava "abaixo do botão" não existe mais — nem
   * fechado, nem aberto.
   */
  it("nada é renderizado abaixo do gatilho — nem antes, nem depois de abrir o painel", async () => {
    renderizar(comCadastro);

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.nextElementSibling).toBeNull();
    expect(gatilho.tagName).toBe("BUTTON");

    await userEvent.click(gatilho);

    await screen.findByRole("dialog");
    expect(gatilho.nextElementSibling).toBeNull();
    expect(gatilho.parentElement?.querySelector("a")).toBeNull();
  });

  it("o painel é alcançável por teclado, e o convite dentro dele também", async () => {
    renderizar(comCadastro);

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    gatilho.focus();
    await userEvent.keyboard("{Enter}");

    const painel = await screen.findByRole("dialog");
    const convite = within(painel).getByRole("link", { name: "Cadastrar primeiro ciclo" });
    await userEvent.tab();
    expect(document.activeElement).toBe(convite);
  });

  it("sem tela de cadastro alcançável, só a frase — gatilho obscurecido e nenhum painel", async () => {
    renderizar(
      <SingleSelectFilter
        id="ciclo"
        label="Ciclo"
        options={[]}
        value=""
        onChange={vi.fn()}
        empty={{ message: "Não há ciclos cadastrados" }}
      />,
    );

    const gatilho = screen.getByRole("button", { name: "Ciclo" });
    expect(gatilho.hasAttribute("disabled")).toBe(true);
    await userEvent.click(gatilho);
    expect(screen.queryByRole("dialog")).toBeNull();
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
        empty={{ message: "Não há ciclos cadastrados" }}
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

  it("sem lista, diz a frase do domínio e abre o convite de cadastro no clique", async () => {
    renderizar(
      <MultiSelectFilter
        {...comum}
        options={[]}
        empty={{
          message: "Não há capacidades cadastradas",
          registration: { label: "Cadastrar primeira capacidade", to: "/competency-matrix" },
        }}
      />,
    );

    // Com tela de cadastro alcançável o gatilho deixa de ser botão morto: ele
    // abre o painel onde mora o convite (dono, 2026-09-08 — recusa dos botões).
    const gatilho = screen.getByRole("button", { name: "Capacidades" });
    expect(gatilho.textContent).toContain("Não há capacidades cadastradas");
    expect(screen.queryByRole("link")).toBeNull();

    await userEvent.click(gatilho);

    const painel = await screen.findByRole("dialog");
    expect(
      within(painel)
        .getByRole("link", { name: "Cadastrar primeira capacidade" })
        .getAttribute("href"),
    ).toBe("/competency-matrix");
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
 * Foi o único que a onda de 2026-09-02 não cobriu, e por isso o pedido voltou.
 */
describe("o seletor de ciclo do cabeçalho, sem ciclo cadastrado", () => {
  const fetchMock = vi.fn();

  const semCiclos = (href: string) => (href.includes("/cycles") ? jsonResponse([]) : undefined);

  it("diz que não há ciclos e, no clique, abre o painel com o convite de cadastro", async () => {
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
    expect(gatilho.textContent).toContain("Não há ciclos cadastrados");
    expect(gatilho.nextElementSibling).toBeNull();

    await userEvent.click(gatilho);

    const painel = await screen.findByRole("dialog");
    expect(
      within(painel).getByRole("link", { name: "Cadastrar primeiro ciclo" }).getAttribute("href"),
    ).toBe("/cycles");
    vi.unstubAllGlobals();
  });
});
