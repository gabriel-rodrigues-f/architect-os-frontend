import { describe, expect, it } from "vitest";

import { BRAND_HEADER_HEIGHT } from "@/components/app/AppShell";
import { StablePageFrame } from "@/components/app/PageFrame";

/**
 * Dono (2026-09-07): "Desenvolvimento de Capacidades está comprimido e não
 * o vejo". A altura do bloco da marca era montada em tempo de execução e o
 * Tailwind não a compilava. Ela é literal, e acompanha a constante do frame.
 */
describe("o bloco da marca na coluna tem a altura do cabeçalho", () => {
  it("a classe é literal e bate com StablePageFrame.HEADER_HEIGHT_PX", () => {
    expect(BRAND_HEADER_HEIGHT).toBe(`h-[${StablePageFrame.HEADER_HEIGHT_PX}px]`);
    expect(BRAND_HEADER_HEIGHT).toBe("h-[74px]");
  });
});
