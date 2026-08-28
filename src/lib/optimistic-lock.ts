import { UserFacingError } from "./api-errors";

export class UnknownExpectedVersionError extends UserFacingError {
  constructor(
    readonly entity: string,
    readonly entityId: string,
  ) {
    super(
      `A tela não conhece a versão atual de ${entity} e não pode gravar sem ela. Recarregue a página e refaça a alteração.`,
    );
    this.name = "UnknownExpectedVersionError";
  }
}

export function expectedVersionOf(
  version: number | undefined,
  entity: string,
  entityId: string,
): number {
  if (version === undefined) throw new UnknownExpectedVersionError(entity, entityId);
  return version;
}
