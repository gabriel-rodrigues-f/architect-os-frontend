import type { Architect } from "@/lib/domain";
import { Selection } from "@/lib/selection";
import { defaultNameFormatter } from "@/lib/text";

/**
 * Escolha de pessoa — o objeto de apresentação que TODO seletor de pessoa da
 * aplicação usa (dono, 2026-09-06: "não aplicamos orientação a objeto em todos
 * estes seletores ... precisamos corrigir isso orientado a objeto e GoF tanto
 * para a mensagem quanto para o formato da combobox apresentado").
 *
 * GoF Strategy: a FORMA da escolha (`PersonPickShape`) é uma estratégia
 * trocável — uma pessoa (Avaliações, PDI, Mentoria, Ciclos, Calibração),
 * várias com "Todo o time" (Prioridades, Progressão, Time) ou várias com teto
 * e sem "Todo o time" (Comparativo). `PersonPicker` é o contexto: carrega o
 * alcance (quem a pessoa logada pode escolher), a seleção corrente e delega à
 * forma tudo o que muda entre elas. O que NÃO muda entre elas mora aqui:
 * alcance vazio é alcance vazio em qualquer forma — não há "Todo o time" de
 * ninguém, e a única coisa a dizer é que não há pessoas cadastradas.
 */

/** O que o gatilho da combobox resume; o texto vem da i18n na tela. */
export type PersonSummary =
  | { readonly kind: "empty" }
  | { readonly kind: "none" }
  | { readonly kind: "wholeTeam"; readonly n: number }
  | { readonly kind: "one"; readonly name: string }
  | { readonly kind: "count"; readonly n: number };

export type WholeTeamMark = "checked" | "unchecked" | "indeterminate";

export interface PersonPickShape {
  /** Marca várias pessoas (caixinhas) ou uma só (marca de escolhido)? */
  readonly many: boolean;
  /** Teto de pessoas; `undefined` quando não há. */
  readonly max: number | undefined;
  /** A forma oferece "Todo o time"? Nunca com alcance vazio. */
  offersWholeTeam(reach: readonly Architect[]): boolean;
  /** A seleção que resulta de escolher `id` a partir de `selected`. */
  pick(selected: readonly string[], id: string): string[];
  /** `id` ainda pode ser marcado (teto não batido)? */
  canPick(selected: readonly string[], id: string): boolean;
}

class OnePerson implements PersonPickShape {
  readonly many = false;
  readonly max = 1;

  offersWholeTeam(): boolean {
    return false;
  }

  pick(_selected: readonly string[], id: string): string[] {
    return [id];
  }

  canPick(_selected: readonly string[], _id: string): boolean {
    return true;
  }
}

class ManyPeople implements PersonPickShape {
  readonly many = true;
  readonly max: number | undefined = undefined;

  offersWholeTeam(reach: readonly Architect[]): boolean {
    return reach.length > 0;
  }

  pick(selected: readonly string[], id: string): string[] {
    if (selected.includes(id)) return selected.filter((other) => other !== id);
    if (!this.canPick(selected, id)) return [...selected];
    return [...selected, id];
  }

  canPick(_selected: readonly string[], _id: string): boolean {
    return true;
  }
}

/**
 * Várias pessoas com teto (Comparativo): marcar o time inteiro contradiz um
 * teto, então "Todo o time" some — quem a remove é o teto, não a tela.
 */
class ManyPeopleUpTo extends ManyPeople {
  override readonly max: number;

  constructor(max: number) {
    super();
    this.max = max;
  }

  override offersWholeTeam(): boolean {
    return false;
  }

  override canPick(selected: readonly string[], id: string): boolean {
    return selected.includes(id) || selected.length < this.max;
  }
}

export class PersonPicker {
  /** O alcance em ordem alfabética — a ordem em que a lista desenha. */
  readonly people: readonly Architect[];

  private constructor(
    readonly shape: PersonPickShape,
    reach: readonly Architect[],
    readonly selected: readonly string[],
  ) {
    this.people = [...reach].sort(defaultNameFormatter.byName);
  }

  static one(reach: readonly Architect[], selectedId: string | null | undefined): PersonPicker {
    return new PersonPicker(new OnePerson(), reach, selectedId ? [selectedId] : []);
  }

  static many(reach: readonly Architect[], selected: readonly string[]): PersonPicker {
    return new PersonPicker(new ManyPeople(), reach, selected);
  }

  static upTo(max: number, reach: readonly Architect[], selected: readonly string[]): PersonPicker {
    return new PersonPicker(new ManyPeopleUpTo(max), reach, selected);
  }

  /** Alcance vazio: não há ninguém a escolher, em nenhuma forma. */
  get isEmpty(): boolean {
    return this.people.length === 0;
  }

  get many(): boolean {
    return this.shape.many;
  }

  get max(): number | undefined {
    return this.shape.max;
  }

  get offersWholeTeam(): boolean {
    return this.shape.offersWholeTeam(this.people);
  }

  /** Só os ids que ainda estão no alcance — um id órfão não conta. */
  get visibleSelected(): readonly string[] {
    return this.selected.filter((id) => this.people.some((person) => person.id === id));
  }

  get isWholeTeamSelected(): boolean {
    return !this.isEmpty && this.visibleSelected.length === this.people.length;
  }

  get wholeTeamMark(): WholeTeamMark {
    if (this.isWholeTeamSelected) return "checked";
    return this.visibleSelected.length === 0 ? "unchecked" : "indeterminate";
  }

  isPicked(id: string): boolean {
    return this.selected.includes(id);
  }

  canPick(id: string): boolean {
    return this.shape.canPick(this.selected, id);
  }

  pick(id: string): string[] {
    return this.shape.pick(this.selected, id);
  }

  /** "Todo o time" é um alternador de verdade: tudo marcado → nada; senão → todos. */
  toggleWholeTeam(): string[] {
    return this.isWholeTeamSelected ? [] : this.people.map((person) => person.id);
  }

  get summary(): PersonSummary {
    if (this.isEmpty) return { kind: "empty" };
    const visible = this.visibleSelected;
    if (visible.length === 0) return { kind: "none" };
    if (this.many && this.isWholeTeamSelected) return { kind: "wholeTeam", n: this.people.length };
    if (visible.length === 1) {
      const first = visible[0];
      const person = this.people.find((person) => person.id === first);
      return person ? { kind: "one", name: person.name } : { kind: "none" };
    }
    return { kind: "count", n: visible.length };
  }

  /** Quem da lista entra no recorte que a tela desenha. */
  static peopleIn<T extends { id: string }>(
    people: readonly T[],
    selected: readonly string[],
  ): T[] {
    return Selection.explicit(selected).apply(people);
  }
}
