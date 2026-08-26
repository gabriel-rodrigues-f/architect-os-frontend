import type { Architect, Capability } from "../domain";
import type { MessageKey } from "../i18n";
import {
  concentrationRiskMaxReferencesFrom,
  DEFAULT_SCORING_BANDS,
  proficiencyViewBandsFrom,
  type ProficiencyViewBand,
  type ScoringBand,
} from "../scoring-bands";
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
 *
 * CFG-02 — os cortes deixaram de ser literais aqui: a escala PROFICIENCY
 * vem de `GET /api/config/bands` (via `useScoringBands`, passada no
 * construtor); este export é a MESMA lista derivada do default
 * (`DEFAULT_SCORING_BANDS`, o fallback byte-idêntico ao seed).
 */
export const BANDS: readonly ProficiencyViewBand[] = proficiencyViewBandsFrom(
  DEFAULT_SCORING_BANDS.PROFICIENCY,
);

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
  /** As faixas efetivas da tela (cabeçalho da tabela e baldes dos cards) — derivadas da escala recebida. */
  readonly bands: readonly ProficiencyViewBand[];
  private readonly concentrationRiskMaxReferences: number;

  /**
   * CFG-02 — as réguas (PROFICIENCY e CONCENTRATION_RISK) entram por
   * parâmetro, com o default byte-idêntico ao seed: a rota passa o que
   * `useScoringBands` carregou; testes que não configuram nada continuam
   * exercendo exatamente o comportamento antigo.
   */
  constructor(
    private readonly capabilities: readonly Capability[],
    private readonly capabilityAveragesFor: (architectId: string) => readonly CapabilityAverage[],
    scales: {
      PROFICIENCY: readonly ScoringBand[];
      CONCENTRATION_RISK: readonly ScoringBand[];
    } = DEFAULT_SCORING_BANDS,
  ) {
    this.bands = proficiencyViewBandsFrom(scales.PROFICIENCY);
    this.concentrationRiskMaxReferences = concentrationRiskMaxReferencesFrom(
      scales.CONCENTRATION_RISK,
    );
  }

  classifyRisk(assessedCount: number, referenceCount: number): RiskState {
    if (assessedCount === 0) return "insufficientData";
    if (referenceCount === 0) return "noReference";
    if (referenceCount < this.concentrationRiskMaxReferences) return "concentrationRisk";
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
        const bands = this.bands.map((band) => ({
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
