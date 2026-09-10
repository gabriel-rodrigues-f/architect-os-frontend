import { describe, expect, it } from "vitest";

import { PageFillingPane, ShellHeader } from "@/lib/design";
import { Bloco } from "../helpers/folha-de-estilo";
import { Varredura } from "../helpers/catraca";

/**
 * A altura do cabeçalho vivia em três literais ([N-02]): `h-[74px]` no
 * `AppShell`, `top-[74px]` e `HEADER_HEIGHT_PX = 74` no `PageFrame`. Agora é o
 * token `--shell-header-h`, e o número existe UMA vez, em `ShellHeader`.
 * Prova do vermelho no dia: 3 ocorrências de `74px` em src/ fora da paleta.
 */
/** O recuo que a caixa somava, e que deixou de existir. */
const RECUO_SUPOSTO = "--pane-page-inset-h";

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
   * 2026-09-09 a caixa que rola em si media "o resto da janela" somando
   * `100dvh − var(--shell-header-h) − var(--pane-page-inset-h)`. O segundo
   * termo era um CHUTE, e em 2026-09-10 o dono o encontrou em Contas e
   * Acessos: a lista vazava 25px abaixo da dobra em 1440×900.
   *
   * A régua não some — ela passa a cobrar do MECANISMO NOVO o que cobrava do
   * antigo, e mais: agora a caixa não lê altura NENHUMA. Nem o número, nem o
   * token: quem mede é a coluna do quadro. Um token a menos para adivinhar.
   */
  it("a caixa que ocupa o resto não lê altura nenhuma — nem o token, nem o número", () => {
    const doMecanismo = [
      PageFillingPane.paneClass,
      PageFillingPane.frameClass,
      PageFillingPane.shellClass,
    ].join(" ");
    expect(doMecanismo).not.toContain(String(ShellHeader.HEIGHT_PX));
    expect(doMecanismo).not.toContain(ShellHeader.TOKEN);
    expect(doMecanismo).not.toContain("100dvh");
  });

  it("o token do recuo suposto morreu: ninguém o declara e ninguém o lê", () => {
    expect(Bloco.de(":root {").valorDe(RECUO_SUPOSTO)).toBeNull();
    const usos = new Varredura().contagem((arquivo) =>
      arquivo.ocorrencias(new RegExp(`var\\(${RECUO_SUPOSTO}\\)|^\\s*${RECUO_SUPOSTO}\\s*:`, "gm")),
    );
    expect(usos).toEqual({});
  });
});
