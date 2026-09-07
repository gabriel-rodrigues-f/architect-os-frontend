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

/** O corpo da utility, com as chaves aninhadas (a `@media` de dentro) incluídas. */
function utilityBody(nome: string): string {
  const css = styles();
  const inicio = css.indexOf(`@utility ${nome} {`);
  if (inicio === -1) return "";
  let profundidade = 0;
  for (let cursor = css.indexOf("{", inicio); cursor < css.length; cursor += 1) {
    if (css[cursor] === "{") profundidade += 1;
    if (css[cursor] === "}") profundidade -= 1;
    if (profundidade === 0) return css.slice(inicio, cursor + 1);
  }
  return css.slice(inicio);
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
  /**
   * [H-01] A reserva cobre DUAS linhas de descrição no desktop (três em telas
   * < 768 px): nada abaixo do cabeçalho se move quando a descrição quebra. A
   * conta é feita com os tokens de linha, não com um degrau solto da escala.
   */
  it("a utility reserva título + respiro + duas linhas de corpo no desktop, três no estreito", () => {
    const corpo = utilityBody(HEADING_BLOCK)
      .replace(/\s+/g, " ")
      .replace(/\( /g, "(")
      .replace(/ \)/g, ")");
    expect(corpo).toContain(
      "min-height: calc(var(--text-page--line-height) + var(--space-1) + 3 * var(--text-body--line-height))",
    );
    expect(corpo).toContain("@media (min-width: 768px)");
    expect(corpo).toContain(
      "min-height: calc(var(--text-page--line-height) + var(--space-1) + 2 * var(--text-body--line-height))",
    );
  });

  it("a descrição é cortada em duas linhas no desktop e três no estreito — nunca cresce além da reserva", () => {
    const { container } = render(<PageHeader title="Meu painel" description="Visão do ciclo." />);
    const descricao = container.querySelector("p");
    expect(descricao?.className).toContain("line-clamp-3");
    expect(descricao?.className).toContain("md:line-clamp-2");
  });

  it("a medida reservada cobre título, respiro e duas linhas de descrição", () => {
    // [T-03]: a altura de linha do título é o token `--text-page--line-height`, lido da escala.
    expect(utilityBody("page-title")).toContain("line-height: var(--text-page--line-height)");
    const alturaLinhaTitulo = fontSize.lineHeight("page");
    expect(alturaLinhaTitulo).toBeGreaterThan(fontSize.get("page"));

    const maisAlto = alturaLinhaTitulo + spacing.get("1") + 2 * fontSize.lineHeight("body");
    expect(maisAlto).toBe(32 + 4 + 2 * 20);
  });
});
