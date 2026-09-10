import { describe, expect, it } from "vitest";

import { PaneHeight, ShellHeader } from "@/lib/design";
import { Bloco } from "../helpers/folha-de-estilo";
import { Varredura } from "../helpers/catraca";

/**
 * A altura do cabeçalho vivia em três literais ([N-02]): `h-[74px]` no
 * `AppShell`, `top-[74px]` e `HEADER_HEIGHT_PX = 74` no `PageFrame`. Agora é o
 * token `--shell-header-h`, e o número existe UMA vez, em `ShellHeader`.
 * Prova do vermelho no dia: 3 ocorrências de `74px` em src/ fora da paleta.
 */
describe("a altura do cabeçalho é um token", () => {
  it("styles.css declara o token com o número do ShellHeader", () => {
    expect(Bloco.de(":root {").valorDe(ShellHeader.TOKEN)).toBe(
      `${String(ShellHeader.HEIGHT_PX)}px`,
    );
  });

  it("nenhum `74px` literal em src/ fora de styles.css", () => {
    const literais = new Varredura().contagem(
      (arquivo) => arquivo.ocorrencias(/\b74px\b/g),
      (arquivo) => arquivo.eFonteDeTela && arquivo.chave !== "src/styles.css",
    );
    expect(literais).toEqual({});
  });

  it("as classes leem a variável, não o número", () => {
    for (const classe of [
      ShellHeader.heightClass,
      ShellHeader.stickyBelowClass,
      ShellHeader.minContentHeightClass,
      // 2026-09-09: a coluna de apoio do PDI entrou pelo token, como as outras.
      ShellHeader.sideRailClass,
    ]) {
      expect(classe).toContain("--shell-header-h");
      expect(classe).not.toContain("74");
    }
  });

  /*
   * 2026-09-09, a padronização das treze telas: a caixa que rola em si mede o
   * que sobra da janela, e essa medida passa pelo MESMO token. Ela não é
   * classe — é expressão CSS que entra por `style` —, e por isso a catraca a
   * cobra aqui, e não na lista acima.
   */
  it("a medida do resto da página também lê a variável, não o número", () => {
    const css = PaneHeight.restOfPage().css;
    expect(css).toContain(`var(${ShellHeader.TOKEN})`);
    expect(css).not.toContain("74");
  });
});
