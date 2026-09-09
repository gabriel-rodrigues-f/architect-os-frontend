import { useEffect, useState } from "react";

import { CycleInFocus } from "@/lib/cycle-in-focus";
import { initialSearchParam } from "@/lib/search-params";

/**
 * O ciclo da tela: o do `?cycleId=` do link enquanto o cabeçalho não se mexeu,
 * e o ciclo ativo a partir da primeira troca (dono, 2026-09-08 — trocar o ciclo
 * troca a avaliação). Quem decide é `CycleInFocus`; o hook só guarda o instante
 * da entrada e a passagem de mão única para o cabeçalho.
 *
 * A troca de estado mora num efeito porque o render em que o cabeçalho se mexe
 * já responde certo (`under` devolve o ciclo ativo); o que o efeito preserva é
 * a MEMÓRIA de que o cabeçalho mandou, para o link não ressuscitar quando o
 * ciclo ativo voltar a ser o da entrada.
 */
export function useCycleInFocus(activeCycleId: string): string {
  const [focus, setFocus] = useState(() =>
    CycleInFocus.enteringWith(initialSearchParam("cycleId"), activeCycleId),
  );
  useEffect(() => {
    setFocus((atual) => atual.after(activeCycleId));
  }, [activeCycleId]);
  return focus.under(activeCycleId);
}
