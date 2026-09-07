import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Upload } from "lucide-react";

import { PageAction, PageActions, SectionAction } from "@/components/app/PageAction";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { I18nProvider } from "@/lib/i18n";

/**
 * Dono (2026-09-08): *"'Estrutura de Times > Criar time' e 'Contas e Acessos >
 * Cadastrar pessoas' não seguem o mesmo padrão. Normalize aplicando orientação
 * a objeto e reaproveitando componentes."*
 *
 * A régua da ação de cabeçalho é UM objeto — `PageActionRank` —, e cada papel
 * é uma instância dele: a principal da página (primary, tamanho padrão), a de
 * apoio ao lado dela (secondary, mesmo tamanho) e a de cabeçalho de seção
 * (secondary, menor). Quem escreve tela escolhe o PAPEL, nunca a variante e o
 * tamanho.
 */
const botao = (nome: string) => screen.getByRole("button", { name: nome });

describe("PageAction — a ação principal do cabeçalho de página", () => {
  afterEach(cleanup);

  it("nasce primary, no tamanho padrão do controle, com o ícone de somar", () => {
    render(<PageAction label="Nova trilha" onClick={vi.fn()} />);
    const acao = botao("Nova trilha");
    expect(acao.className).toContain("bg-primary");
    expect(acao.className).toContain("h-(--control-h)");
    expect(acao.getAttribute("data-page-action")).toBe("main");
    const icone = acao.querySelector("svg");
    expect(icone).not.toBeNull();
    expect(icone?.getAttribute("aria-hidden")).toBe("true");
  });

  it("o ícone é do ato: quem importa não soma", () => {
    render(<PageAction label="Importar catálogo" icon={Upload} onClick={vi.fn()} />);
    expect(botao("Importar catálogo").querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-upload",
    );
  });

  it("o rótulo continua sendo o nome acessível — o ícone não entra na leitura", () => {
    render(<PageAction label="Criar time" onClick={vi.fn()} />);
    expect(botao("Criar time").textContent).toBe("Criar time");
  });

  it("leva o clique e a recusa de quem a usa", async () => {
    const abrir = vi.fn();
    render(<PageAction label="Novo ciclo" onClick={abrir} />);
    await userEvent.click(botao("Novo ciclo"));
    expect(abrir).toHaveBeenCalledTimes(1);

    cleanup();
    render(<PageAction label="Novo ciclo" disabled onClick={abrir} />);
    expect((botao("Novo ciclo") as HTMLButtonElement).disabled).toBe(true);
  });

  it("`asChild` veste o elemento de quem chama — o link com a identidade da ação", () => {
    render(
      <PageAction asChild label="Cadastrar pessoa">
        <a href="/users">ignorado</a>
      </PageAction>,
    );
    const acao = screen.getByRole("link", { name: "Cadastrar pessoa" });
    expect(acao.tagName).toBe("A");
    expect(acao.className).toContain("bg-primary");
    expect(acao.querySelector("svg")).not.toBeNull();
  });

  it("serve de gatilho de diálogo sem invólucro nenhum", async () => {
    render(
      <I18nProvider>
        <Dialog>
          <DialogTrigger asChild>
            <PageAction label="Registrar sessão" />
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Sessão de mentoria</DialogTitle>
          </DialogContent>
        </Dialog>
      </I18nProvider>,
    );
    await userEvent.click(botao("Registrar sessão"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});

describe("PageActions — o grupo diz quem é a principal", () => {
  afterEach(cleanup);

  it("a última é a principal; as outras são de apoio, no mesmo tamanho", () => {
    render(
      <PageActions>
        <PageAction label="Importar catálogo" icon={Upload} />
        <PageAction label="Nova capacidade" />
      </PageActions>,
    );
    const principal = botao("Nova capacidade");
    const apoio = botao("Importar catálogo");
    expect(principal.getAttribute("data-page-action")).toBe("main");
    expect(principal.className).toContain("bg-primary");
    expect(apoio.getAttribute("data-page-action")).toBe("supporting");
    expect(apoio.className).toContain("bg-card");
    expect(apoio.className).not.toContain("bg-primary");
    expect(apoio.className).toContain("h-(--control-h)");
  });

  it("o papel declarado vence a posição", () => {
    render(
      <PageActions>
        <PageAction label="Nova capacidade" rank="main" />
        <PageAction label="Importar catálogo" icon={Upload} rank="supporting" />
      </PageActions>,
    );
    expect(botao("Nova capacidade").className).toContain("bg-primary");
    expect(botao("Importar catálogo").className).not.toContain("bg-primary");
  });

  it("quem não é ação nenhuma passa intacto pelo grupo", () => {
    render(
      <PageActions>
        <span data-testid="filtro">filtro</span>
        <PageAction label="Novo ciclo" />
      </PageActions>,
    );
    expect(screen.getByTestId("filtro").textContent).toBe("filtro");
    expect(botao("Novo ciclo").getAttribute("data-page-action")).toBe("main");
  });
});

describe("SectionAction — a ação de cabeçalho de seção", () => {
  afterEach(cleanup);

  it("é secondary e menor que a da página, com o mesmo ícone de somar", () => {
    render(<SectionAction label="Nova competência" />);
    const acao = botao("Nova competência");
    expect(acao.getAttribute("data-page-action")).toBe("section");
    expect(acao.className).toContain("bg-card");
    expect(acao.className).not.toContain("bg-primary");
    expect(acao.className).toContain("h-8");
    expect(acao.querySelector("svg")).not.toBeNull();
  });

  it("dentro de um grupo continua sendo de seção — a régua da seção não se mistura", () => {
    render(
      <PageActions>
        <SectionAction label="Alocar pessoa" />
      </PageActions>,
    );
    expect(botao("Alocar pessoa").getAttribute("data-page-action")).toBe("section");
  });
});
