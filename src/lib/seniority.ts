import { useMemo } from "react";

import type { Architect, RoleName } from "./domain";
import { useI18n, type MessageKey } from "./i18n";

/**
 * Onda 37 (backend ADR-0084) — gestor e tech lead não têm senioridade. A
 * ausência tem UM símbolo nesta casa, já registrado em `DECISOES.md`: o
 * travessão, dono exclusivo de "não existe". Ele nunca é um nível a mais —
 * quem não tem senioridade fica de FORA de toda leitura por nível e continua
 * contado como pessoa (consequência 3 da onda 37, aceita pelo dono).
 */
export const AUSENCIA = "—";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export class SeniorityReading {
  constructor(private readonly t: Translate) {}

  /** O que a coluna, a ficha ou o cabeçalho MOSTRA. */
  labelOf(role: RoleName | null | undefined): string {
    return role ?? AUSENCIA;
  }

  /** O que o travessão SIGNIFICA, para quem lê por título ou leitor de tela. */
  titleOf(role: RoleName | null | undefined): string {
    return role ?? this.t("seniority.absent");
  }

  /** Tem senioridade? É o que decide se a tela oferece senioridade a esta pessoa. */
  static has(architect: Pick<Architect, "role">): boolean {
    return architect.role != null;
  }

  /**
   * A leitura POR NÍVEL só alcança quem tem senioridade — quem não tem fica
   * de fora dela e continua contado como pessoa em toda contagem de gente.
   */
  static withinLevels(
    architect: Pick<Architect, "role">,
    chosenLevels: readonly string[],
  ): boolean {
    return architect.role != null && chosenLevels.includes(architect.role);
  }
}

export function useSeniorityReading(): SeniorityReading {
  const { t } = useI18n();
  return useMemo(() => new SeniorityReading(t), [t]);
}
