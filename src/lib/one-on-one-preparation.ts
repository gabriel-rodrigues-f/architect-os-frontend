/**
 * A PREPARAÇÃO DO 1:1, do lado da tela (dono, 2026-09-07): *"ao clicar em
 * Preparar 1:1 a IA deve primeiro mostrar a liturgia do 1:1, mais abaixo um
 * resumo do perfil e, por fim, SWOT"*.
 *
 * Os três títulos são CONTRATO com o backend: o briefing de lá instrui o
 * modelo a abrir cada seção com estes títulos, e a tela os reconhece para
 * desenhar cada seção com o próprio cabeçalho. O objeto é o mesmo dos dois
 * lados, conferido por fixture copiada (`tests/lib/preparacao-do-1-1-secoes.fixture.json`),
 * como `message-codes` — um título renomeado de um lado só fica vermelho
 * nos dois repositórios.
 *
 * A narração continua texto único: quando os títulos não vêm (narrador
 * determinístico, provedor que não obedeceu), a tela desenha o texto corrido.
 * Nada aqui promete campo por seção.
 */
export class OneOnOnePreparationSections {
  static readonly TITLES = {
    liturgy: "Liturgia do 1:1",
    profileSummary: "Resumo do perfil",
    swot: "SWOT",
  } as const;

  static readonly QUADRANTS = {
    strengths: "Forças",
    weaknesses: "Fraquezas",
    opportunities: "Oportunidades",
    threats: "Ameaças",
  } as const;

  static readonly ORDER: readonly string[] = [
    OneOnOnePreparationSections.TITLES.liturgy,
    OneOnOnePreparationSections.TITLES.profileSummary,
    OneOnOnePreparationSections.TITLES.swot,
  ];

  static readonly QUADRANT_ORDER: readonly string[] = [
    OneOnOnePreparationSections.QUADRANTS.strengths,
    OneOnOnePreparationSections.QUADRANTS.weaknesses,
    OneOnOnePreparationSections.QUADRANTS.opportunities,
    OneOnOnePreparationSections.QUADRANTS.threats,
  ];

  static contract(): { sections: readonly string[]; swotQuadrants: readonly string[] } {
    return {
      sections: OneOnOnePreparationSections.ORDER,
      swotQuadrants: OneOnOnePreparationSections.QUADRANT_ORDER,
    };
  }
}

export interface TitledText {
  readonly title: string;
  readonly text: string;
}

/**
 * Um título de bloco, como o narrador o escreve: numa linha própria,
 * terminada em dois-pontos (o combinado de `FORMAT` no backend). A comparação
 * ignora caixa, acento e o dois-pontos final — o que ela NÃO ignora é o
 * texto: "Liturgia" sozinha não é a seção, e uma frase que só contém o título
 * também não.
 */
class TitledLine {
  private constructor(private readonly plain: string) {}

  static of(raw: string): TitledLine {
    return new TitledLine(TitledLine.normalize(raw.trim().replace(/:$/u, "")));
  }

  isOneOf(titles: readonly string[]): string | null {
    return titles.find((title) => TitledLine.normalize(title) === this.plain) ?? null;
  }

  private static normalize(text: string): string {
    return text.normalize("NFD").replace(/[̀-ͯ]/gu, "").toLowerCase();
  }
}

/**
 * A narração lida por seção. `of` devolve `null` quando NENHUM dos três
 * títulos aparece — aí não há o que seccionar, e a tela desenha o texto como
 * sempre desenhou. Quando aparece pelo menos um, o que vem antes do primeiro
 * título é `preamble`, e cada seção vai da linha do título até a próxima.
 */
export class OneOnOnePreparationReading {
  private constructor(
    readonly preamble: string,
    readonly sections: readonly TitledText[],
  ) {}

  static of(narration: string): OneOnOnePreparationReading | null {
    const split = OneOnOnePreparationReading.splitBy(narration, OneOnOnePreparationSections.ORDER);
    if (split.sections.length === 0) return null;
    return new OneOnOnePreparationReading(split.preamble, split.sections);
  }

  /**
   * O SWOT vira grade só quando os QUATRO quadrantes vieram: três quadrantes
   * numa grade de 2×2 deixariam uma célula vazia dizendo algo que a IA não
   * disse. Com menos, o texto corre como está.
   */
  static swotQuadrantsOf(text: string): readonly TitledText[] | null {
    const split = OneOnOnePreparationReading.splitBy(
      text,
      OneOnOnePreparationSections.QUADRANT_ORDER,
    );
    const complete =
      split.sections.length === OneOnOnePreparationSections.QUADRANT_ORDER.length &&
      OneOnOnePreparationSections.QUADRANT_ORDER.every((quadrant) =>
        split.sections.some((section) => section.title === quadrant),
      );
    return complete ? split.sections : null;
  }

  private static splitBy(
    text: string,
    titles: readonly string[],
  ): { preamble: string; sections: TitledText[] } {
    const preamble: string[] = [];
    const sections: { title: string; lines: string[] }[] = [];
    for (const line of text.split("\n")) {
      const title = TitledLine.of(line).isOneOf(titles);
      const current = sections[sections.length - 1];
      if (title !== null && !sections.some((section) => section.title === title)) {
        sections.push({ title, lines: [] });
      } else if (current) {
        current.lines.push(line);
      } else {
        preamble.push(line);
      }
    }
    return {
      preamble: preamble.join("\n").trim(),
      sections: sections.map((section) => ({
        title: section.title,
        text: section.lines.join("\n").trim(),
      })),
    };
  }
}
