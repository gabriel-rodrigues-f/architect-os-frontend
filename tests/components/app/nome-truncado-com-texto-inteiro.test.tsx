import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TruncatedText } from "@/components/app/TruncatedText";

/**
 * Item 7 do lote de 2026-09-08: o nome truncado com o texto inteiro vira UM
 * componente. O que ele promete, e o `title=` nativo não entregava ([F-02]):
 * o gatilho é alcançável por teclado e o texto inteiro não depende de um
 * balão que só abre no ponteiro.
 */
afterEach(cleanup);

const NOME_LONGO = "Arquitetura de integração corporativa e mensageria assíncrona";

describe("TruncatedText — corta na tela, devolve inteiro", () => {
  it("mostra o texto e o corta na largura disponível", () => {
    render(<TruncatedText text={NOME_LONGO} />);

    expect(screen.getByText(NOME_LONGO).className).toContain("truncate");
  });

  it("o gatilho é alcançável por teclado — é isso que o title nativo não fazia", () => {
    render(<TruncatedText text={NOME_LONGO} />);

    expect(screen.getByText(NOME_LONGO).getAttribute("tabindex")).toBe("0");
  });

  it("não deixa title= nativo para trás", () => {
    const { container } = render(<TruncatedText text={NOME_LONGO} />);

    expect(container.querySelector("[title]")).toBeNull();
  });

  it("a classe de quem chama entra sem apagar o corte", () => {
    render(<TruncatedText text={NOME_LONGO} className="block text-xs" />);

    const alvo = screen.getByText(NOME_LONGO);
    expect(alvo.className).toContain("truncate");
    expect(alvo.className).toContain("block");
  });

  it("quando o que aparece é um rótulo curto, o texto inteiro continua sendo o do balão", () => {
    render(<TruncatedText text={NOME_LONGO}>INT</TruncatedText>);

    expect(screen.getByText("INT")).toBeTruthy();
    expect(screen.queryByText(NOME_LONGO)).toBeNull();
  });
});
