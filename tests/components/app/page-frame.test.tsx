import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PageFrame, StablePageFrame } from "@/components/app/PageFrame";

/**
 * "Mudança de menu nunca pode deslocar a tela" (dono, 2026-09-06). A regra é
 * UM objeto (`StablePageFrame`) aplicado pelo `AppShell` a todas as páginas:
 * a área de conteúdo tem a altura mínima do viewport útil, e trocar de rota
 * volta ao topo. jsdom não mede altura real — o que dá para provar é que a
 * classe de altura mínima é a mesma antes e depois da troca de rota, e que a
 * rolagem foi zerada na troca.
 */
describe("PageFrame — a tela não se desloca ao trocar de menu (dono, 2026-09-06)", () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    scrollTo.mockReset();
    vi.stubGlobal("scrollTo", scrollTo);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const frame = () => document.querySelector<HTMLElement>("main[data-page-frame]")!;

  it("a altura mínima é o viewport útil — o que sobra abaixo do cabeçalho do shell", () => {
    expect(StablePageFrame.minHeightClass).toBe("min-h-[calc(100dvh-74px)]");
  });

  it("a troca de rota não muda a altura do frame — uma página curta ocupa o mesmo que uma longa", () => {
    const { rerender } = render(
      <PageFrame pathname="/assessments">
        <div style={{ height: 4000 }}>página longa</div>
      </PageFrame>,
    );
    const antes = frame().className;
    expect(antes).toContain(StablePageFrame.minHeightClass);

    rerender(
      <PageFrame pathname="/mentoring">
        <div>página curta</div>
      </PageFrame>,
    );
    expect(frame().className).toBe(antes);
  });

  it("toda troca de rota volta ao topo, sem animação; sem troca, não rola", () => {
    const { rerender } = render(<PageFrame pathname="/assessments">a</PageFrame>);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    rerender(<PageFrame pathname="/assessments">a de novo</PageFrame>);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    rerender(<PageFrame pathname="/development-plans">b</PageFrame>);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" });
  });
});
