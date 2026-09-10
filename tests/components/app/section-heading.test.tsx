import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SectionHeading } from "@/components/app/ui-bits";

/**
 * Referência FIAP 2026-09-06, §2 item 5: cabeçalho de seção em caixa alta com
 * tracking, peso médio, sem negrito pesado. Um componente, `SectionHeading`,
 * onde antes cada cartão do Painel e das telas de Inteligência de Talentos
 * escrevia o próprio `<h3 className="font-display text-base font-semibold">`
 * ou o próprio rótulo `text-xs uppercase tracking-wide`.
 */

afterEach(cleanup);

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

class Ocorrencias {
  private total = 0;

  constructor(pasta: string) {
    this.percorre(pasta);
  }

  private percorre(pasta: string): void {
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) this.percorre(caminho);
      else if (caminho.endsWith(".tsx"))
        this.total += readFileSync(caminho, "utf8").match(/<SectionHeading\b/g)?.length ?? 0;
    }
  }

  get contagem(): number {
    return this.total;
  }
}

describe("SectionHeading", () => {
  it("é um título de verdade: h2 por padrão, h3 ou p quando pedido", () => {
    render(
      <>
        <SectionHeading>Padrão</SectionHeading>
        <SectionHeading as="h3">Três</SectionHeading>
        <SectionHeading as="p">Rótulo</SectionHeading>
      </>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Padrão" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Três" })).toBeTruthy();
    expect(screen.getByText("Rótulo").tagName).toBe("P");
  });

  it("carrega a utility section-heading e aceita id e className", () => {
    render(
      <SectionHeading id="x" className="mt-2">
        Título
      </SectionHeading>,
    );
    const el = screen.getByText("Título");
    expect(el.id).toBe("x");
    expect(el.className).toContain("section-heading");
    expect(el.className).toContain("mt-2");
  });

  it("a utility é caixa alta, tracking e peso médio — nunca semibold", () => {
    const inicio = css.indexOf("@utility section-heading {");
    expect(inicio).toBeGreaterThan(-1);
    const corpo = css.slice(inicio, css.indexOf("}", inicio));
    expect(corpo).toMatch(/text-transform:\s*uppercase/);
    expect(corpo).toMatch(/letter-spacing:\s*0\.0[5-9]em/);
    expect(corpo).toMatch(/font-weight:\s*var\(--weight-medium\)/);
  });

  it("substituiu os títulos ad hoc: está em pelo menos 8 lugares", () => {
    expect(new Ocorrencias(resolve(process.cwd(), "src")).contagem).toBeGreaterThanOrEqual(8);
  });

  it("nenhum cartão escreve mais o título ad hoc de antes", () => {
    const fontes = [
      "src/components/app/ui-bits.tsx",
      "src/components/app/AdherenceSummary.tsx",
      "src/components/app/EvaluatorCalibrationRow.tsx",
      "src/routes/capability-map.tsx",
      "src/components/app/PageHelp.tsx",
    ];
    for (const arquivo of fontes) {
      const texto = readFileSync(resolve(process.cwd(), arquivo), "utf8");
      expect(texto, arquivo).not.toMatch(/text-xs font-(medium|semibold) uppercase tracking-wide/);
    }
  });
});
