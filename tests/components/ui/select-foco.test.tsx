import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Input, ReadOnlyField } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Bloco } from "../../helpers/folha-de-estilo";

/**
 * Revisão mestre 2026-09-08, [F-01] e [A-01]: não existia `Select` — 21
 * selects nativos estilizados à mão, três alturas, nenhum com anel de foco.
 * A primitiva é o `<select>` nativo (o formulário do app não precisa de
 * listbox custom) com a MESMA classe do `Input`, altura pelo token
 * `--control-h` (36 no app; `--control-h-lg` 44 nas telas de porta) e o anel
 * `focus-ring` por `focus-visible:` — o Tab mostra o anel, o clique do mouse
 * não. O jsdom não calcula `:focus-visible`; a prova de "teclado sim, mouse
 * não" é a própria classe: o anel só existe sob o prefixo `focus-visible:`,
 * nunca sob `focus:`.
 */
function Opcoes() {
  return (
    <>
      <option value="a">Alfa</option>
      <option value="b">Beta</option>
    </>
  );
}

describe("Select — o campo nativo com a classe do Input", () => {
  afterEach(cleanup);

  it("é um <select> nativo, com nome acessível pelo rótulo", () => {
    render(
      <label>
        Nível
        <Select defaultValue="a">
          <Opcoes />
        </Select>
      </label>,
    );
    const campo = screen.getByRole("combobox", { name: "Nível" });
    expect(campo.tagName).toBe("SELECT");
  });

  it("veste a classe do Input: borda `border-input`, altura `--control-h`, foco `focus-ring`", () => {
    render(
      <>
        <Input aria-label="texto" />
        <Select aria-label="escolha">
          <Opcoes />
        </Select>
      </>,
    );
    const input = screen.getByRole("textbox", { name: "texto" });
    const select = screen.getByRole("combobox", { name: "escolha" });
    for (const classe of ["border-input", "h-(--control-h)", "focus-visible:focus-ring"]) {
      expect(input.className, classe).toContain(classe);
      expect(select.className, classe).toContain(classe);
    }
    expect(select.className).not.toMatch(/(?<![\w-])focus:/);
    expect(select.className).not.toMatch(/\bring-[12]\b/);
  });

  it("o tamanho lg é a altura das telas de porta (`--control-h-lg`)", () => {
    render(
      <Select aria-label="escolha" size="lg">
        <Opcoes />
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: "escolha" }).className).toContain(
      "h-(--control-h-lg)",
    );
  });

  it("Tab leva o foco ao select; o clique do mouse foca sem o prefixo de teclado", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Input aria-label="antes" />
        <Select aria-label="escolha">
          <Opcoes />
        </Select>
      </>,
    );
    const select = screen.getByRole("combobox", { name: "escolha" });
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(select);
    await user.click(select);
    expect(document.activeElement).toBe(select);
  });

  it("os dois tokens de altura existem e valem 36 e 44", () => {
    const raiz = Bloco.de(":root {\n  --control-h");
    expect(raiz.valorDe("--control-h")).toBe("36px");
    expect(raiz.valorDe("--control-h-lg")).toBe("44px");
  });
});

describe("ReadOnlyField — a caixa de leitura com a moldura do campo", () => {
  afterEach(cleanup);

  it("não é um campo editável, mas veste a mesma moldura", () => {
    render(<ReadOnlyField aria-label="valor">42</ReadOnlyField>);
    const caixa = screen.getByText("42");
    expect(caixa.tagName).not.toBe("INPUT");
    expect(caixa.className).toContain("border-input");
    expect(caixa.className).toContain("h-(--control-h)");
  });
});
