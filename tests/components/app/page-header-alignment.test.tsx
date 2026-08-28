import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageHeader } from "@/components/app/ui-bits";
import { fontSize, spacing } from "@/lib/design";

/**
 * UI-06b — o botão de criação dançava de altura conforme a rota. O cabeçalho
 * alinha os filhos por `items-end`, e o bloco de título só era alto quando a
 * rota passava `description`: onde havia descrição o botão descia, onde não
 * havia ele subia. A mesma ação, em posições diferentes em cada tela.
 *
 * O invariante é a altura determinística do bloco de título — igual com e sem
 * descrição —, que é o que fixa a linha de base do botão. jsdom não calcula
 * layout, então o que se verifica aqui é o contrato: o bloco reserva altura
 * própria, essa reserva não depende da prop, e a medida reservada cobre o caso
 * mais alto (título + respiro + descrição).
 */

const HEADING_BLOCK = "page-heading";

const styles = () => readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

function utilityBody(nome: string): string {
  const css = styles();
  const inicio = css.indexOf(`@utility ${nome} {`);
  if (inicio === -1) return "";
  return css.slice(inicio, css.indexOf("}", inicio));
}

function tituloBloco(container: HTMLElement): Element {
  const cabecalho = container.querySelector("h1")?.closest("div.mb-6");
  if (!cabecalho?.firstElementChild) throw new Error("cabeçalho não encontrado");
  return cabecalho.firstElementChild;
}

describe("PageHeader — o bloco de título tem altura determinística", () => {
  afterEach(cleanup);

  it("reserva altura própria quando a rota não passa descrição", () => {
    const { container } = render(<PageHeader title="Meu painel" />);
    expect(tituloBloco(container).className).toContain(HEADING_BLOCK);
  });

  it("reserva a mesma altura quando a rota passa descrição", () => {
    const { container } = render(<PageHeader title="Meu painel" description="Visão do ciclo." />);
    expect(tituloBloco(container).className).toContain(HEADING_BLOCK);
  });

  it("a altura do bloco não varia com a presença da descrição", () => {
    const { container: semDescricao } = render(<PageHeader title="Meu painel" />);
    const classesSem = tituloBloco(semDescricao).className;
    cleanup();

    const { container: comDescricao } = render(
      <PageHeader title="Meu painel" description="Visão do ciclo." />,
    );
    expect(classesSem).toContain(HEADING_BLOCK);
    expect(tituloBloco(comDescricao).className).toBe(classesSem);
  });

  it("o botão de ação continua sendo o irmão alinhado ao bloco, não um filho dele", () => {
    const { container } = render(
      <PageHeader title="Meu painel" actions={<button type="button">Novo</button>} />,
    );
    const cabecalho = container.querySelector("h1")?.closest("div.mb-6");
    expect(cabecalho?.children).toHaveLength(2);
    expect(tituloBloco(container).querySelector("button")).toBeNull();
  });
});

describe("a reserva de altura vem do sistema de tokens, não de um valor solto", () => {
  it("a utility declara min-height a partir da escala de espaçamento", () => {
    expect(utilityBody(HEADING_BLOCK)).toContain("min-height: var(--space-16)");
  });

  /**
   * A reserva só resolve o desalinhamento se couber o caso mais alto: título
   * numa linha, respiro do `mt-1` e descrição numa linha. Se um degrau da
   * escala mudar e a conta estourar, o bloco volta a crescer com a descrição.
   */
  it("a medida reservada cobre título, respiro e descrição", () => {
    const alturaLinhaTitulo = Number(
      /line-height:\s*([\d.]+)/.exec(utilityBody("page-title"))?.[1] ?? "0",
    );
    expect(alturaLinhaTitulo).toBeGreaterThan(0);

    const LINHA_TEXT_SM = 20;
    const maisAlto = fontSize.get("page") * alturaLinhaTitulo + spacing.get("1") + LINHA_TEXT_SM;

    expect(spacing.get("16")).toBeGreaterThanOrEqual(maisAlto);
  });
});
