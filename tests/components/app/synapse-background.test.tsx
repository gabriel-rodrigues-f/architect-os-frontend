import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SynapseBackground } from "@/components/app/SynapseBackground";
import { SynapseSignals } from "@/lib/synapse-network";

/**
 * O canvas da rede de sinapses (login). O jsdom não desenha: o componente
 * precisa viver sem contexto 2D; com movimento reduzido mostra um quadro
 * parado; e o relógio é cancelado no unmount.
 */
function comMovimento(reduzido: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduzido && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })),
  );
}

function relogioFalso() {
  const request = vi.fn<(callback: FrameRequestCallback) => number>().mockReturnValue(42);
  const cancel = vi.fn<(handle: number) => void>();
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  return { request, cancel };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SynapseBackground", () => {
  it("desenha um canvas decorativo, fora da árvore acessível, e liga o relógio", () => {
    comMovimento(false);
    const { request } = relogioFalso();
    render(<SynapseBackground signals={new SynapseSignals()} focalRef={createRef()} />);
    const canvas = screen.getByTestId("synapse-network");
    expect(canvas.tagName).toBe("CANVAS");
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(canvas.getAttribute("data-motion")).toBe("live");
    expect(request).toHaveBeenCalled();
  });

  it("com movimento reduzido, é um quadro parado: nenhum relógio ligado", () => {
    comMovimento(true);
    const { request } = relogioFalso();
    render(<SynapseBackground signals={new SynapseSignals()} focalRef={createRef()} />);
    expect(screen.getByTestId("synapse-network").getAttribute("data-motion")).toBe("still");
    expect(request).not.toHaveBeenCalled();
  });

  it("ao desmontar, cancela o quadro pendente", () => {
    comMovimento(false);
    const { cancel } = relogioFalso();
    const { unmount } = render(
      <SynapseBackground signals={new SynapseSignals()} focalRef={createRef()} />,
    );
    unmount();
    expect(cancel).toHaveBeenCalledWith(42);
  });
});
