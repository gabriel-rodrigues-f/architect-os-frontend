import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthAlert } from "@/components/app/AuthAlert";
import { Callout } from "@/components/app/ui-bits";

/**
 * Revisão mestre 2026-09-08, [D-02] e [F-04]: onze formas de aviso em caixa
 * e nenhuma `info` — o banner do login (PR 9) não tinha onde nascer. O
 * `Callout` passa a ter quatro tons, cada um lendo o par faixa+tinta dos
 * tokens (`info`/`info-fg`, `success`/`success-fg`, `warning`/`warning-fg`,
 * `danger-subtle`/`destructive`), com ícone lucide `aria-hidden` e o papel
 * ARIA que o tom pede: só `danger` é `alert` (live region); os outros são
 * caixa estática, e quem chama pede `role="status"` quando o aviso nasce de
 * uma ação — 20 avisos de rota virando live region seria ruído. O
 * `AuthAlert` das telas de porta vira o compacto do tom `danger` e continua
 * live region, com a classe `auth-alert` que o login mede.
 */
describe("Callout — quatro tons pelos tokens", () => {
  afterEach(cleanup);

  it.each([
    ["info", "bg-info", "text-info-fg"],
    ["success", "bg-success", "text-success-fg"],
    ["warning", "bg-warning", "text-warning-fg"],
    ["danger", "bg-danger-subtle", "text-destructive"],
  ] as const)("%s lê a faixa %s e a tinta %s", (tone, faixa, tinta) => {
    const { container } = render(<Callout tone={tone}>Aviso</Callout>);
    const classe = container.firstElementChild?.className ?? "";
    expect(classe).toContain(faixa);
    expect(classe).toContain(tinta);
    expect(classe).not.toMatch(/\/\d{1,3}\b/);
  });

  it("cada tom traz um ícone lucide escondido do leitor de tela", () => {
    for (const tone of ["info", "success", "warning", "danger"] as const) {
      const { container } = render(<Callout tone={tone}>Aviso</Callout>);
      const icone = container.querySelector("svg");
      expect(icone, tone).not.toBeNull();
      expect(icone?.getAttribute("aria-hidden"), tone).toBe("true");
      cleanup();
    }
  });

  it("danger é alert; warning, success e info são caixa estática, sem papel", () => {
    render(<Callout tone="danger">Falhou</Callout>);
    expect(screen.getByRole("alert").textContent).toBe("Falhou");
    cleanup();
    for (const tone of ["warning", "success", "info"] as const) {
      const { container } = render(<Callout tone={tone}>Aviso</Callout>);
      expect(container.firstElementChild?.hasAttribute("role"), tone).toBe(false);
      cleanup();
    }
  });

  it("quem chama pode trocar o papel — o tom sugere, não impõe", () => {
    render(
      <Callout tone="info" role="status">
        Sessão renovada
      </Callout>,
    );
    expect(screen.getByRole("status").textContent).toBe("Sessão renovada");
  });
});

describe("AuthAlert — o compacto do tom danger nas telas de porta", () => {
  afterEach(cleanup);

  it("continua live region, sem foco, com ícone escondido e a classe que o login mede", () => {
    render(<AuthAlert>E-mail ou senha inválidos.</AuthAlert>);
    const alerta = screen.getByRole("alert");
    expect(alerta.textContent).toBe("E-mail ou senha inválidos.");
    expect(alerta.hasAttribute("tabindex")).toBe(false);
    expect(alerta.classList.contains("auth-alert")).toBe(true);
    expect(alerta.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
