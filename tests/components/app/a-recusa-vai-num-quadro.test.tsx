import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FailureCard } from "@/components/app/FailureCard";
import { ReadingRefusal } from "@/components/app/ReadingRefusal";
import { I18nProvider } from "@/lib/i18n";

/**
 * A MENSAGEM DE ERRO MORA NUM QUADRO.
 *
 * Dono (2026-09-09): *"Mensagem de erro não pode ser texto sem fundo.
 * Comporte a mensagem de erro em um quadro."* Como estava: uma linha de texto
 * vermelho solta no meio do vazio e um botão pequeno embaixo — sem cartão,
 * sem fundo, sem ícone, sem título.
 *
 * O quadro é o `FailureCard`, e ele serve a DOIS lugares — a recusa de
 * leitura (`ReadingRefusal`, que já atende a `QuerySection` e o
 * `ConnectionError`) e a página de erro da raiz. Regra da casa: o que serve a
 * 2 lugares vira componente, não se copia o cartão em cada tela.
 */
describe("FailureCard — o quadro do erro", () => {
  afterEach(cleanup);

  it("é um cartão com fundo e borda próprios, não texto solto", () => {
    const { container } = render(<FailureCard title="Título" sentence="Frase" />);
    const quadro = container.querySelector('[data-testid="failure-card"]');
    expect(quadro).not.toBeNull();
    const classe = quadro?.className ?? "";
    expect(classe).toContain("surface-card");
    expect(classe).toMatch(/\bborder\b/);
  });

  it("traz o ícone de alerta dentro de um círculo, escondido do leitor de tela", () => {
    const { container } = render(<FailureCard title="Título" sentence="Frase" />);
    const circulo = container.querySelector('[data-testid="failure-card-icon"]');
    expect(circulo?.className ?? "").toContain("rounded-full");
    const icone = circulo?.querySelector("svg");
    expect(icone).not.toBeNull();
    expect(icone?.getAttribute("aria-hidden")).toBe("true");
  });

  it("o título é cabeçalho e a frase explica — nessa ordem", () => {
    render(<FailureCard title="Algo não saiu como esperado" sentence="A frase da situação" />);
    const titulo = screen.getByRole("heading", { name: "Algo não saiu como esperado" });
    expect(titulo).not.toBeNull();
    expect(screen.getByText("A frase da situação")).not.toBeNull();
    expect(
      titulo.compareDocumentPosition(screen.getByText("A frase da situação")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("anuncia na hora: o quadro inteiro é a live region", () => {
    render(<FailureCard title="Título" sentence="Frase" />);
    expect(screen.getByRole("alert").getAttribute("data-testid")).toBe("failure-card");
  });
});

describe("ReadingRefusal — a recusa de leitura usa o quadro", () => {
  afterEach(cleanup);

  const recusa = (sentence: string) =>
    render(
      <I18nProvider>
        <ReadingRefusal sentence={sentence} onRetry={() => {}} />
      </I18nProvider>,
    );

  it("põe a frase de quem chama dentro do quadro", () => {
    const { container } = recusa("Não encontramos este profissional.");
    const quadro = container.querySelector('[data-testid="failure-card"]');
    expect(quadro).not.toBeNull();
    expect(quadro?.textContent).toContain("Não encontramos este profissional.");
  });

  it("o título em destaque vem do dicionário, não de literal no TS", () => {
    recusa("Frase");
    expect(screen.getByRole("heading", { name: "Algo não saiu como esperado" })).not.toBeNull();
  });

  it('"Tentar novamente" é botão primário, não o botão pequeno de contorno', () => {
    recusa("Frase");
    const botao = screen.getByRole("button", { name: "Tentar novamente" });
    expect(botao.className).toContain("bg-primary");
    expect(botao.className).not.toContain("border-input");
  });
});

describe("a página de erro da raiz não copia o quadro — usa o mesmo", () => {
  it("__root.tsx desenha o erro com o FailureCard", () => {
    const fonte = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(fonte).toContain('from "../components/app/FailureCard"');
    expect(fonte).toMatch(/<FailureCard/);
  });
});
