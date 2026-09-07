import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

/**
 * Revisão mestre 2026-09-08, [B-01] e decisão UX-d do dono: o papel
 * "secondary" tinha dois visuais (`outline` com 81 usos e o `secondary`
 * sólido com 17). Agora são seis variantes — `primary | secondary | ghost |
 * danger | danger-ghost | link` — e `secondary` É a borda com fundo de card
 * (o `outline` de ontem). `default` e `outline` continuam aceitos como alias
 * para os 98 usos que o PR 10 migra; hover e active leem os tokens
 * `primary-hover`/`primary-active` em vez de opacidade sobre o primário.
 */
function classesDe(variant: Parameters<typeof Button>[0]["variant"]) {
  render(<Button variant={variant}>Ação</Button>);
  const classe = screen.getByRole("button", { name: "Ação" }).className;
  cleanup();
  return classe;
}

describe("Button — seis variantes, dois aliases", () => {
  afterEach(cleanup);

  it("primary é o padrão e lê hover/active por token, sem opacidade sobre o primário", () => {
    render(<Button>Ação</Button>);
    const classe = screen.getByRole("button", { name: "Ação" }).className;
    cleanup();
    expect(classe).toContain("bg-primary");
    expect(classe).toContain("hover:bg-primary-hover");
    expect(classe).toContain("active:bg-primary-active");
    expect(classe).not.toMatch(/bg-primary\/\d+/);
    expect(classesDe("primary")).toBe(classe);
  });

  it("secondary é borda + fundo de card — o outline de ontem; o sólido sumiu", () => {
    const classe = classesDe("secondary");
    expect(classe).toContain("border");
    expect(classe).toContain("bg-card");
    expect(classe).not.toContain("bg-secondary");
    expect(classesDe("outline")).toBe(classe);
  });

  it("default é alias de primary e destructive é alias de danger", () => {
    expect(classesDe("default")).toBe(classesDe("primary"));
    expect(classesDe("destructive")).toBe(classesDe("danger"));
  });

  it("danger-ghost é texto destrutivo com hover na faixa `danger-subtle`", () => {
    const classe = classesDe("danger-ghost");
    expect(classe).toContain("text-destructive");
    expect(classe).toContain("hover:bg-danger-subtle");
    expect(classe).not.toContain("bg-destructive ");
  });

  it("só a variante link sublinha no ponteiro", () => {
    expect(classesDe("link")).toContain("hover:underline");
    for (const variant of ["primary", "secondary", "ghost", "danger", "danger-ghost"] as const) {
      expect(classesDe(variant), variant).not.toContain("hover:underline");
    }
  });

  it("nenhuma variante carrega sombra, nem anel solto: o foco é a utility `focus-ring` por focus-visible", () => {
    for (const variant of [
      "primary",
      "secondary",
      "ghost",
      "danger",
      "danger-ghost",
      "link",
    ] as const) {
      const classe = classesDe(variant);
      expect(classe, variant).not.toMatch(/\bshadow(?:-[a-z]+)?\b/);
      expect(classe, variant).not.toMatch(/\bring-[12]\b/);
      expect(classe, variant).toContain("focus-visible:focus-ring");
    }
  });

  it("a altura padrão é o token `--control-h` — a mesma do Input e do Select", () => {
    expect(classesDe("primary")).toContain("h-(--control-h)");
  });
});
