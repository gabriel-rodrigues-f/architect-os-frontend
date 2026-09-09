import { useState } from "react";

import { CycleInFocus } from "@/lib/cycle-in-focus";
import { initialSearchParam } from "@/lib/search-params";

/**
 * O ciclo da tela: o do `?cycleId=` do link enquanto o cabeçalho não se mexeu,
 * e o ciclo ativo a partir da primeira troca (dono, 2026-09-08 — trocar o ciclo
 * troca a avaliação). Quem decide é `CycleInFocus`; o hook só guarda o instante
 * da entrada e entrega o ciclo ativo deste render.
 */
export function useCycleInFocus(activeCycleId: string): string {
  const [focus] = useState(() =>
    CycleInFocus.pinnedAt(initialSearchParam("cycleId"), activeCycleId),
  );
  return focus.under(activeCycleId);
}
