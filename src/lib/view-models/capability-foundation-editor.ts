import type { CompetencyCountRange } from "../curation-policy";
import type { CapabilityFoundationPayload } from "../gateways/catalog.gateway";

/**
 * Onda 37 (backend ADR-0085) — fundar a capacidade é UM ato: ela nasce com as
 * competências que a definem. O editor guarda o rascunho do modal encadeado e
 * a régua de quando "Criar" pode ser apertado; o piso e o teto são os da
 * política de curadoria vigente, nunca números escritos na tela.
 */
export class CapabilityFoundationEditor {
  private constructor(
    readonly name: string,
    readonly competencyNames: readonly string[],
    private readonly range: CompetencyCountRange,
  ) {}

  static begin(range: CompetencyCountRange): CapabilityFoundationEditor {
    return new CapabilityFoundationEditor(
      "",
      Array.from({ length: range.min }, () => ""),
      range,
    );
  }

  withName(name: string): CapabilityFoundationEditor {
    return new CapabilityFoundationEditor(name, this.competencyNames, this.range);
  }

  withCompetencyName(index: number, name: string): CapabilityFoundationEditor {
    return this.withCompetencyNames(
      this.competencyNames.map((current, position) => (position === index ? name : current)),
    );
  }

  addCompetency(): CapabilityFoundationEditor {
    if (!this.canAddCompetency) return this;
    return this.withCompetencyNames([...this.competencyNames, ""]);
  }

  removeCompetency(index: number): CapabilityFoundationEditor {
    if (!this.canRemoveCompetency(index)) return this;
    return this.withCompetencyNames(
      this.competencyNames.filter((_, position) => position !== index),
    );
  }

  get canAddCompetency(): boolean {
    return this.competencyNames.length < this.range.max;
  }

  canRemoveCompetency(index: number): boolean {
    return index >= this.range.min && index < this.competencyNames.length;
  }

  get limits(): CompetencyCountRange {
    return this.range;
  }

  get isValid(): boolean {
    return this.payload() !== null;
  }

  payload(): CapabilityFoundationPayload | null {
    const name = this.name.trim();
    const competencyNames = this.competencyNames.map((current) => current.trim());
    if (name.length === 0) return null;
    if (competencyNames.some((current) => current.length === 0)) return null;
    if (!this.range.admits(competencyNames.length)) return null;
    return {
      name,
      active: true,
      competencies: competencyNames.map((competencyName) => ({ name: competencyName })),
    };
  }

  private withCompetencyNames(competencyNames: readonly string[]): CapabilityFoundationEditor {
    return new CapabilityFoundationEditor(this.name, competencyNames, this.range);
  }
}
