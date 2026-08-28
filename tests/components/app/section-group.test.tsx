import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Callout, PageHeader, SectionCard, SectionGroup } from "@/components/app/ui-bits";

/**
 * UX-01 — faltava um degrau de hierarquia. Havia título de página (`h1`) e
 * título de card (`h2`), e nada entre os dois: a tela de configuração chegou a
 * inventar um `<h2>` solto, sem seção nem nome acessível, só para preencher a
 * lacuna. `SectionGroup` é esse degrau — agrupa cards sob um título de seção e
 * empurra o título do card para o nível abaixo, que é o que faz o agrupamento
 * existir para quem navega por cabeçalho.
 */
describe("SectionGroup — o degrau entre a página e o card", () => {
  afterEach(cleanup);

  const grupo = (
    <SectionGroup title="Configuração do modelo" description="Parâmetros editáveis do ciclo.">
      <SectionCard title="Réguas e limiares">
        <p>a</p>
      </SectionCard>
      <SectionCard title="Vocabulários">
        <p>b</p>
      </SectionCard>
    </SectionGroup>
  );

  it("o título do grupo é o nível 2", () => {
    render(grupo);
    expect(screen.getByRole("heading", { name: "Configuração do modelo", level: 2 })).toBeTruthy();
  });

  it("o card dentro do grupo desce para o nível 3 — o grupo o contém", () => {
    render(grupo);
    expect(screen.getByRole("heading", { name: "Réguas e limiares", level: 3 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Vocabulários", level: 3 })).toBeTruthy();
  });

  it("card fora de grupo continua no nível 2 — nada muda em quem não agrupa", () => {
    render(
      <SectionCard title="Principais lacunas">
        <p>c</p>
      </SectionCard>,
    );
    expect(screen.getByRole("heading", { name: "Principais lacunas", level: 2 })).toBeTruthy();
  });

  it("o grupo é uma região anunciada pelo próprio título", () => {
    render(grupo);
    expect(screen.getByRole("region", { name: "Configuração do modelo" })).toBeTruthy();
  });

  it("dois grupos na mesma tela não achatam a hierarquia dos cards", () => {
    render(
      <>
        {grupo}
        <SectionGroup title="Referência do modelo">
          <SectionCard title="Escala de proficiência">
            <p>d</p>
          </SectionCard>
        </SectionGroup>
      </>,
    );
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Configuração do modelo",
      "Referência do modelo",
    ]);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});

/**
 * UX-04 — o aviso era `border-amber-500/40 bg-amber-500/10` com `text-amber-700`
 * por cima: sem par no tema escuro e, medido, abaixo de 4.5:1 lá. O papel
 * semântico existe agora, e o bloco tem de usá-lo em vez da paleta crua.
 */
describe("Callout — aviso e sucesso pelo papel, não pela paleta", () => {
  afterEach(cleanup);

  it("o aviso usa o token de warning", () => {
    const { container } = render(<Callout tone="warning">Limite atingido</Callout>);
    const classe = container.firstElementChild?.className ?? "";
    expect(classe).toContain("bg-warning");
    expect(classe).toContain("text-warning-fg");
  });

  it("o sucesso usa o token de success", () => {
    const { container } = render(<Callout tone="success">Salvo</Callout>);
    const classe = container.firstElementChild?.className ?? "";
    expect(classe).toContain("bg-success");
    expect(classe).toContain("text-success-fg");
  });

  it("nenhum tom carrega cor crua do Tailwind", () => {
    for (const tone of ["warning", "success"] as const) {
      const { container } = render(<Callout tone={tone}>x</Callout>);
      expect(container.firstElementChild?.className ?? "").not.toMatch(/amber|emerald/);
      cleanup();
    }
  });
});

/**
 * UX-02 — o texto corrido esticava com o monitor. A faixa de leitura tem de
 * estar no componente, não repetida a cada tela.
 */
describe("largura de leitura", () => {
  afterEach(cleanup);

  it("a descrição da página é presa na medida de leitura", () => {
    const { container } = render(<PageHeader title="Painel" description="Visão do ciclo." />);
    expect(container.querySelector("p")?.className).toContain("max-w-prose");
  });

  it("a descrição do card também", () => {
    const { container } = render(
      <SectionCard title="Time" description="Arquitetos ativos no ciclo.">
        <p>e</p>
      </SectionCard>,
    );
    expect(container.querySelector("p")?.className).toContain("max-w-prose");
  });
});
