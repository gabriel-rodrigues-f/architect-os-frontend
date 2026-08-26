import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Initials } from "@/components/app/ui-bits";

/**
 * R2-VIS-11 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `n[0]` pegava o primeiro
 * caractere de cada palavra sem checar o que era: um nome com símbolo solto
 * no início de uma palavra virava algo como `A"` no avatar.
 */
describe("Initials — filtra por letra/dígito, ignora símbolo solto", () => {
  afterEach(() => cleanup());

  it("nome normal: iniciais das duas primeiras palavras", () => {
    const { getByText } = render(<Initials name="Ana Martins" />);
    expect(getByText("AM")).toBeTruthy();
  });

  it("nome com aspas/símbolos soltos: pula até achar letra, não gera aspas nas iniciais", () => {
    const { getByText, queryByText } = render(<Initials name={'Arquiteto "R&D" <Ops>'} />);
    expect(getByText("AR")).toBeTruthy();
    expect(queryByText('A"')).toBeNull();
  });

  it("espaço duplo: palavra vazia não conta como iniciais", () => {
    const { getByText } = render(<Initials name="Ana  Martins" />);
    expect(getByText("AM")).toBeTruthy();
  });

  it("nome de uma palavra só: uma inicial", () => {
    const { getByText } = render(<Initials name="Madonna" />);
    expect(getByText("M")).toBeTruthy();
  });
});
