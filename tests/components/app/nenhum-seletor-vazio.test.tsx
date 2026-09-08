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
 * Dono (2026-09-08), REINCIDENTE — já estava na FILA desde 2026-09-02:
 * *"não devemos ter comboboxes vazios. Quando ainda não houver ciclos
 * cadastrados, mostrar 'Não há ciclos cadastrados' + 'Cadastrar primeiro
 * ciclo' como hiperlink para a tela de cadastro"*.
 *
 * Voltou porque a régua morava em cada tela: a onda de 2026-09-02 cobriu o
 * Painel e Times, e o seletor do CABEÇALHO passou batido. Agora a régua mora
 * no COMPONENTE de seleção — sem opções, ele NUNCA desenha um campo vazio:
 * desenha a frase e, quando há tela de cadastro, o hiperlink que leva a ela.
 * Nenhuma tela precisa lembrar; nenhuma tela consegue esquecer.
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

  it("quando existe tela de cadastro, a frase vem com o hiperlink que leva a ela", () => {
    renderizar(
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
      />,
    );

    const link = screen.getByRole("link", { name: "Cadastrar primeiro ciclo" });
    expect(link.getAttribute("href")).toBe("/cycles");
  });

  it("sem tela de cadastro alcançável, só a frase — nenhum link para onde a pessoa não vai", () => {
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

  it("sem lista, diz a frase do domínio e leva à tela de cadastro", () => {
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

    // Com tela de cadastro alcançável o gatilho deixa de ser botão morto: é
    // a própria porta (dono, 2026-09-08, item 2).
    expect(screen.getByRole("link", { name: "Capacidades" }).textContent).toContain(
      "Não há capacidades cadastradas",
    );
    expect(
      screen.getByRole("link", { name: "Cadastrar primeira capacidade" }).getAttribute("href"),
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

  it("diz que não há ciclos e oferece o hiperlink de cadastro", async () => {
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
    const gatilho = await screen.findByRole("link", { name: "Ciclo" });
    expect(gatilho.textContent).toContain("Não há ciclos cadastrados");
    expect(
      screen.getByRole("link", { name: "Cadastrar primeiro ciclo" }).getAttribute("href"),
    ).toBe("/cycles");
    vi.unstubAllGlobals();
  });
});
