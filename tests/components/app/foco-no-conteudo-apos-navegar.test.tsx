import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PageFrame, StablePageFrame } from "@/components/app/PageFrame";

/**
 * [A-02] Sem gestão de foco, trocar de rota deixava o foco no item do menu
 * que a pessoa clicou: o leitor de tela não anunciava a página nova e o Tab
 * seguinte continuava no fim do menu. Depois de navegar, o foco vai para o
 * `main` — sem rolar, porque a tela já voltou ao topo.
 */
describe("o foco vai para o main depois de navegar", () => {
  afterEach(cleanup);

  it("na primeira pintura o foco fica onde estava; na troca de rota vai para o main", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const { rerender } = render(
      <PageFrame id="conteudo" pathname="/">
        <button type="button">antes</button>
      </PageFrame>,
    );
    const main = document.querySelector("main")!;
    expect(document.activeElement).not.toBe(main);

    rerender(
      <PageFrame id="conteudo" pathname="/team">
        <button type="button">depois</button>
      </PageFrame>,
    );
    expect(document.activeElement).toBe(main);
    expect(main.id).toBe("conteudo");
    expect(main.tabIndex).toBe(-1);
  });

  it("focar o conteúdo não rola a tela — a rolagem já voltou ao topo", () => {
    const focus = vi.fn();
    StablePageFrame.focusContent({ focus });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    StablePageFrame.focusContent(null);
  });
});
