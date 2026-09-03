import { ApiError } from "./api-errors";

/**
 * Onda 36.1/37 — o nome de competência é único em toda a aplicação, e o
 * serviço tem DUAS recusas distintas: a do nome já usado na mesma capacidade e
 * a do nome que vive em outra (esta NOMEIA a capacidade dona). As mensagens
 * são contrato e vão cruas para a tela; o que esta classe resolve é de qual
 * CAMPO a mensagem é — o modal de fundação tem vários — e por quanto tempo ela
 * trava o envio: até o nome recusado mudar.
 *
 * O nome recusado sai da própria mensagem, que o traz entre aspas na primeira
 * posição. Quando a mensagem não o revelar, a recusa continua visível no
 * formulário e o envio não fica preso — errar para o lado de deixar tentar de
 * novo é melhor que travar a tela sem saída.
 */
export class CompetencyNameConflict {
  private static readonly CODES = [
    "COMPETENCY_NAME_TAKEN_IN_CAPABILITY",
    "COMPETENCY_NAME_TAKEN_IN_ANOTHER_CAPABILITY",
  ];

  private constructor(
    readonly message: string,
    private readonly takenName: string,
  ) {}

  static from(error: unknown): CompetencyNameConflict | null {
    if (!(error instanceof ApiError)) return null;
    if (error.code === undefined || !CompetencyNameConflict.CODES.includes(error.code)) return null;
    return new CompetencyNameConflict(error.message, CompetencyNameConflict.quoted(error.message));
  }

  blocks(name: string): boolean {
    if (this.takenName.length === 0) return false;
    return (
      CompetencyNameConflict.comparable(name) === CompetencyNameConflict.comparable(this.takenName)
    );
  }

  positionIn(names: readonly string[]): number {
    return names.findIndex((name) => this.blocks(name));
  }

  private static quoted(message: string): string {
    return /"([^"]+)"/.exec(message)?.[1] ?? "";
  }

  private static comparable(name: string): string {
    return name
      .trim()
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }
}
