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

/**
 * Dono, 2026-09-08, sobre o aviso de sessão expirada na tela de entrar:
 * *"centralize verticalmente o ícone de informação e centralize centralmente
 * o texto, identado à esquerda"*. A frase do aviso quebra em duas linhas e o
 * ícone ficava preso ao topo da primeira, como se apontasse para meia frase.
 *
 * A regra vale para o `compact` — a caixa das telas de porta e dos diálogos,
 * onde o conteúdo é sempre uma frase curta. O `Callout` largo continua
 * alinhado pelo topo: ali cabe parágrafo com lista, e ícone no meio de cinco
 * linhas flutuaria no vazio.
 */
describe("Callout compacto — o ícone no meio da frase (dono, 2026-09-08)", () => {
  afterEach(cleanup);

  it("compacto: a linha centraliza e o ícone não desce meio degrau", () => {
    const { container } = render(
      <Callout tone="info" compact>
        Sua sessão expirou por inatividade. Entre novamente para continuar.
      </Callout>,
    );
    const caixa = container.firstElementChild as HTMLElement;
    expect(caixa.className).toContain("items-center");
    expect(caixa.className).not.toContain("items-start");
    expect(container.querySelector("svg")?.getAttribute("class") ?? "").not.toContain("mt-0.5");
  });

  it("largo: continua pelo topo, porque ali cabe conteúdo composto", () => {
    const { container } = render(
      <Callout tone="info">
        <p>Um parágrafo</p>
        <p>e outro embaixo</p>
      </Callout>,
    );
    const caixa = container.firstElementChild as HTMLElement;
    expect(caixa.className).toContain("items-start");
    expect(container.querySelector("svg")?.getAttribute("class") ?? "").toContain("mt-0.5");
  });

  it("o texto do aviso é irmão do ícone, então as duas linhas alinham na mesma margem", () => {
    const { container } = render(
      <Callout tone="info" compact>
        Sua sessão expirou por inatividade. Entre novamente para continuar.
      </Callout>,
    );
    const caixa = container.firstElementChild as HTMLElement;
    expect(caixa.childNodes.length).toBe(2);
    expect(caixa.childNodes[1]?.nodeType).toBe(Node.TEXT_NODE);
  });
});
