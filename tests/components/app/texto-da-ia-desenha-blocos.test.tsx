import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdviceLine, AdviceText } from "@/components/app/ai-shared";

/**
 * 2026-09-05 — o dono viu "## Pontos para discussão" e "**negrito**" crus na
 * tela: o modelo escrevia markdown e a tela desenhava texto. O combinado
 * agora é de linhas — título termina em dois-pontos, tópico começa com
 * travessão — e a tela desenha cada uma pelo que é, sem interpretar markdown
 * (o texto continua entrando como filho de JSX, inerte).
 */
describe("AdviceText — o texto da IA vira blocos legíveis", () => {
  afterEach(cleanup);

  it("classifica título, tópico e parágrafo", () => {
    expect(
      AdviceLine.allOf("Pontos para discussão:\n– Aderência em 93%.\n\nSeguimos daqui.").map(
        (line) => line.kind,
      ),
    ).toEqual(["heading", "item", "paragraph"]);
  });

  it("uma frase longa terminada em dois-pontos é parágrafo, não título", () => {
    const longa = `${"palavra ".repeat(20)}e termina assim:`;
    expect(AdviceLine.of(longa).kind).toBe("paragraph");
  });

  it("desenha o título sem os dois-pontos e o tópico sem o travessão, e nada de markdown é interpretado", () => {
    render(
      <AdviceText text={"Evolução percebida:\n– Degrau em TOGAF.\n<b>x</b> ## não é título"} />,
    );
    expect(screen.getByText("Evolução percebida")).toBeTruthy();
    expect(screen.getByText("Degrau em TOGAF.")).toBeTruthy();
    expect(screen.getByText("<b>x</b> ## não é título")).toBeTruthy();
    expect(document.querySelector("b")).toBeNull();
  });
});

/**
 * Dono, 2026-09-05: tópicos com marcador de verdade, texto justificado na
 * linha inteira, e um sinal ao lado do título que diga se o bloco pede ação.
 */
describe("AdviceText — marcadores, largura e sinal", () => {
  afterEach(cleanup);

  it("tópicos consecutivos viram uma lista com marcadores", () => {
    render(<AdviceText text={"Próximos passos:\n– Um.\n– Dois.\nFecho."} />);
    const list = document.querySelector("ul");
    expect(list?.className).toContain("list-disc");
    expect(list?.querySelectorAll("li").length).toBe(2);
  });

  it("o texto é justificado e sem teto de largura", () => {
    const { container } = render(<AdviceText text="Uma frase." />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("text-justify");
    expect(root.className).not.toContain("max-w-prose");
  });

  it("o título ganha o sinal da semiótica, escondido do leitor de tela", () => {
    render(<AdviceText text={"Riscos:\n– Um."} />);
    const sign = screen.getByText("⚠️");
    expect(sign.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Riscos")).toBeTruthy();
  });
});
