import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ArquivoFonte, Catraca, raizDoFrontend } from "../helpers/catraca";

/**
 * Revisão mestre 2026-09-08, [F-02]: o `title` não aparece no toque, não abre
 * por teclado e, no `LevelBadge`, era a ÚNICA forma de ler o nome do nível.
 *
 * Política: `title=` só onde não há `Tooltip` acessível — como redundância
 * de `aria-label` em botão-ícone, nunca como o lugar da informação. Quem
 * precisa explicar um valor usa o `Tooltip` (ou o `tooltip` do `Chip`), que
 * também deixa uma cópia legível para o leitor de tela. O número por arquivo
 * só desce.
 *
 * A RÉGUA FOI AFIADA EM 2026-09-08, e o motivo é que ela media outra coisa.
 * A varredura era `\stitle=` no texto, e `title` é também o nome da PROP de
 * meia dúzia de componentes da casa — `PageHeader`, `SectionCard`,
 * `SectionGroup`, `EmptyState`, `Dialog`. O número "227 títulos nativos" da
 * revisão contava esses; a fixture congelou a contagem inflada; e a régua
 * passou a proibir uma coisa que a política nunca proibiu — dar título a uma
 * tela. Uma tela nova com `<PageHeader title=…>` nascia vermelha, e o único
 * jeito de passar era não ter título.
 *
 * Agora a contagem é pela ÁRVORE: `title` como atributo de TAG NATIVA (letra
 * minúscula — `<a>`, `<div>`, `<span>`), que é o atributo do navegador de que
 * a política fala. Prop de componente não conta, porque nunca virou `title`
 * no HTML. A baseline foi regravada para baixo na mesma passada — a catraca
 * segue só descendo, e agora cada unidade que ela guarda é um `title` de
 * verdade.
 *
 * Regravar: `ATUALIZAR_BASELINE_TITLE=1 npx vitest run tests/architecture/title-por-arquivo.test.ts`
 */

/** O `title` do NAVEGADOR: atributo de tag nativa, não prop de componente da casa. */
export function titlesNativosEm(arquivo: ArquivoFonte): number {
  if (!/\.tsx?$/.test(arquivo.caminho)) return 0;
  const fonte = ts.createSourceFile(
    arquivo.caminho,
    arquivo.conteudo,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let total = 0;
  const visitar = (no: ts.Node): void => {
    const marcacao = ts.isJsxSelfClosingElement(no)
      ? no
      : ts.isJsxOpeningElement(no)
        ? no
        : undefined;
    if (marcacao && Tag.eNativa(marcacao.tagName.getText(fonte)) && Tag.temTitle(marcacao, fonte)) {
      total += 1;
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return total;
}

class Tag {
  /**
   * As primitivas que REPASSAM o atributo ao DOM: elas espalham as props num
   * elemento nativo, então `title` nelas vira `title` no HTML e é a mesma
   * coisa que a política proíbe. Fora desta lista, `title` é conteúdo de um
   * componente da casa (o título de um cartão, de uma seção, de um diálogo).
   * A lista é o limite declarado desta régua: uma primitiva nova que espalhe
   * props entra aqui, ou o `title` dela passa despercebido.
   */
  private static readonly REPASSAM_AO_DOM = ["Link", "Button", "Badge", "CommandItem"];

  /** JSX: tag em minúscula é elemento do HTML; em maiúscula é componente. */
  static eNativa(nome: string): boolean {
    return /^[a-z]/.test(nome) || Tag.REPASSAM_AO_DOM.includes(nome);
  }

  static temTitle(
    marcacao: ts.JsxSelfClosingElement | ts.JsxOpeningElement,
    fonte: ts.SourceFile,
  ): boolean {
    return marcacao.attributes.properties.some(
      (atributo) => ts.isJsxAttribute(atributo) && atributo.name.getText(fonte) === "title",
    );
  }
}

const catraca = new Catraca({
  fixture: join(raizDoFrontend, "tests", "architecture", "title-por-arquivo.fixture.json"),
  variavelDeRegravacao: "ATUALIZAR_BASELINE_TITLE",
  conta: (arquivo) => titlesNativosEm(arquivo),
});

describe("title= nativo por arquivo só desce", () => {
  catraca.registrarTestes();
  if (catraca.regravando) return;

  it("a régua conta o atributo da tag nativa e ignora a prop de componente e a chave de objeto", () => {
    const contar = (fonte: string) => titlesNativosEm(new ArquivoFonte("src/x.tsx", fonte));
    expect(contar('<div><span title={x} /><a title="y">z</a></div>')).toBe(2);
    expect(contar('<PageHeader title={x} /> <SectionCard title="y">z</SectionCard>')).toBe(0);
    // …e a primitiva que espalha props num elemento nativo conta como nativa.
    expect(contar('<Link to="/x" title="y">z</Link><Button title="w" />')).toBe(2);
    expect(contar("const meta = { title: x };\nconst n = page.title;")).toBe(0);
  });

  it("o `title` de um botão-ícone continua contado — é dele que a política fala", () => {
    const botao = '<button aria-label="Fechar" title="Fechar" onClick={() => sair()} />';
    expect(titlesNativosEm(new ArquivoFonte("src/x.tsx", botao))).toBe(1);
  });
});
