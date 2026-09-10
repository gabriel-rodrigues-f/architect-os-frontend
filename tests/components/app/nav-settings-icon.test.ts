import { Scale, Settings } from "lucide-react";
import { describe, expect, it } from "vitest";

import { NAV_GROUPS } from "@/lib/navigation-catalog";

/**
 * R2-VIS-04 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o item de menu "Política
 * de Progressão" (`/settings`) usava o mesmo ícone de engrenagem
 * (`Settings`) do menu de tema/idioma no cabeçalho — dois significados sob
 * o mesmo símbolo. O menu passa a usar `Scale`; `Settings` fica reservado
 * para configuração de verdade (preferências).
 */
describe("ícone do item de menu 'Elegibilidade'", () => {
  /**
   * Onda do GRUPO (dono, 2026-09-10): "Critérios de Progressão" virou GRUPO e
   * `/settings` virou endereço antigo. A balança seguiu com a fatia que
   * herdou a régua da carreira — Elegibilidade —, e a engrenagem continua
   * reservada às preferências.
   */
  it("usa Scale, não o Settings genérico de preferências", () => {
    const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.to === "/eligibility");
    expect(item?.icon).toBe(Scale);
    expect(item?.icon).not.toBe(Settings);
  });
});
