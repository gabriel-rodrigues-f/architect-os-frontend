import { render, renderHook } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { PageHeader } from "@/components/app/ui-bits";
import { useNarrowViewport } from "@/hooks/use-narrow-viewport";

/** Mesmo motivo de capability-map-risk.test.tsx: sem RouterProvider real, `<Link>` vira âncora comum. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to: _to, ...rest }: ComponentProps<"a"> & { to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

/**
 * Bloco 3b — RESPONSIVIDADE (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md). Trava as
 * classes de layout que evitam overflow/quebra em telas estreitas — não dá
 * para medir largura real em jsdom, então o que é testável é a PRESENÇA das
 * classes responsivas certas, não o resultado visual em si (isso fica para
 * a verificação manual em viewport real).
 */
describe("R2-RESP-02 — PageHeader.actions quebra linha em vez de vazar", () => {
  it("o container das ações tem flex-wrap", () => {
    const { container } = render(
      <PageHeader
        title="Título"
        actions={
          <>
            <button type="button">Um</button>
            <button type="button">Dois</button>
          </>
        }
      />,
    );
    const actionsDiv = container.querySelector("h1")?.closest("div.mb-6")?.lastElementChild;
    expect(actionsDiv?.className).toContain("flex-wrap");
  });
});

describe("R2-RESP-06 — useNarrowViewport", () => {
  it("reflete matchMedia no mount, sem quebrar no SSR (default false)", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("640"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useNarrowViewport());
    expect(result.current).toBe(true);

    window.matchMedia = originalMatchMedia;
  });
});
