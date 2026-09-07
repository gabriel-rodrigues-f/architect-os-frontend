import { describe, expect, it } from "vitest";

import { BRAND_HEADER_HEIGHT } from "@/components/app/AppShell";
import { StablePageFrame } from "@/components/app/PageFrame";
import { ShellHeader } from "@/lib/design";

/**
 * Dono (2026-09-07): "Desenvolvimento de Capacidades está comprimido e não
 * o vejo". A altura do bloco da marca era montada em tempo de execução e o
 * Tailwind não a compilava. Ela é literal, e acompanha a constante do frame.
 */
describe("o bloco da marca na coluna tem a altura do cabeçalho", () => {
  it("a classe é literal, lê o token do ShellHeader e o frame lê o mesmo número", () => {
    expect(BRAND_HEADER_HEIGHT).toBe(ShellHeader.heightClass);
    expect(BRAND_HEADER_HEIGHT).toBe("h-(--shell-header-h)");
    expect(StablePageFrame.HEADER_HEIGHT_PX).toBe(ShellHeader.HEIGHT_PX);
  });
});
