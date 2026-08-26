import type { Architect, Capability } from "../domain";
import type { MessageKey } from "../i18n";
import type { CapabilityAverage } from "../selectors";

/**
 * OO3-11h — a derivação da tela de Cobertura de Capacidades
 * (`routes/capability-map.tsx`): faixas de proficiência, risco de
 * concentração e a montagem de `areas`. Extraída da rota para ganhar
 * cobertura unitária (fronteiras de faixa, os 4 estados de risco) sem DOM.
 */

/**
 * Faixas de proficiência absoluta dentro da capacidade — não é a mesma coisa
 * que "gap" (que é relativo ao nível esperado do cargo da pessoa). Um
 * arquiteto júnior em nível 2 pode não ter gap nenhum (é o nível esperado
 * para o cargo dele), mesmo caindo aqui na faixa mais baixa. Por isso a
 * primeira faixa chama "Em desenvolvimento", não "Lacunas" — "lacuna" é
 * conceito de avaliação individual (`gapsFor`), não de proficiência
 * absoluta agregada por capacidade. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-
 * ATUAL-SYNAPSE.md, EPIC 6.
 *
 * A ordem é crescente — da menor proficiência para a maior — para a leitura
 * ocidental da esquerda para a direita acompanhar a evolução do time.
 * Cada faixa é `min <= nível < max`; as pontas usam ±Infinity de propósito
 * ("developing" pega qualquer coisa abaixo de 2.5, inclusive nível 1).
 */
export const BANDS = [
  {
    key: "developing",
    labelKey: "cap.band.developing",
    tone: "bg-level-1/60",
    min: -Infinity,
    max: 2.5,
  },
  {
    key: "practitioners",
    labelKey: "cap.band.practitioners",
    tone: "bg-level-3/60",
    min: 2.5,
    max: 3.5,
  },
  { key: "advanced", labelKey: "cap.band.advanced", tone: "bg-level-4/60", min: 3.5, max: 4.5 },
  { key: "experts", labelKey: "cap.band.experts", tone: "bg-level-5/60", min: 4.5, max: Infinity },
] as const;

/**
 * Estados explícitos de risco de concentração — antes um `else` genérico
 * classificava "0 Experts + 3 Avançados" como "healthy" (mesma etiqueta de
 * uma capacidade com especialista de verdade), e "0 Experts + 1 Avançado" caía
 * no mesmo `else` mesmo sendo literalmente uma única pessoa segurando a
 * capacidade sozinha. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md, EPIC 6.
 */
export type RiskState =
  "insufficientData" | "noReference" | "concentrationRisk" | "distributedCoverage";

export interface CapabilityCoverageArea {
  cat: Capability;
  bands: {
    key: string;
    labelKey: MessageKey;
    tone: string;
    people: { architect: Architect; level: number }[];
  }[];
  assessedCount: number;
  notAssessed: number;
  references: { architect: Architect; level: number }[];
  risk: RiskState;
}

export class CapabilityCoveragePresenter {
  constructor(
    private readonly capabilities: readonly Capability[],
    private readonly capabilityAveragesFor: (architectId: string) => readonly CapabilityAverage[],
  ) {}

  classifyRisk(assessedCount: number, referenceCount: number): RiskState {
    if (assessedCount === 0) return "insufficientData";
    if (referenceCount === 0) return "noReference";
    if (referenceCount === 1) return "concentrationRisk";
    return "distributedCoverage";
  }

  /**
   * Só capacidades ativas, como a tela sempre fez. Ausência de avaliação
   * oficial não é lacuna: quem não tem `avg` para a capacidade não entra em
   * faixa nenhuma — entra na contagem separada `notAssessed`. Ver AUDITORIA-
   * RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 7.
   */
  areas(population: readonly Architect[]): CapabilityCoverageArea[] {
    return this.capabilities
      .filter((cat) => cat.active)
      .map((cat) => {
        const people = population.map((a) => ({
          architect: a,
          level: this.capabilityAveragesFor(a.id).find((d) => d.capability.id === cat.id)?.avg,
        }));
        const assessed = people.filter(
          (p): p is { architect: Architect; level: number } => p.level !== undefined,
        );
        const notAssessed = people.length - assessed.length;
        const bands = BANDS.map((band) => ({
          ...band,
          people: assessed.filter((p) => p.level >= band.min && p.level < band.max),
        }));
        const experts = bands.find((b) => b.key === "experts")?.people ?? [];
        const advanced = bands.find((b) => b.key === "advanced")?.people ?? [];
        const references = [...experts, ...advanced];
        const risk = this.classifyRisk(assessed.length, references.length);
        return { cat, bands, assessedCount: assessed.length, notAssessed, references, risk };
      });
  }
}
