import type { MessageKey } from "../i18n/registry";
import type { SessionUser } from "../api";
import type { Professional, RoleName, TeamTransferRequest } from "../domain";
import type { TeamTransfersGateway } from "../gateways/team-transfers.gateway";
import type { TeamSummary } from "../gateways/teams.gateway";
import type { UiAuthorizationPolicy } from "../scope";
import { SeniorityReading } from "../seniority";
import { TeamNames } from "./team-names";
import type { Api } from "../store";

/** Vazio enquanto nenhum nível de carreira estiver escolhido — nunca um `RoleName` inventado. */
export type ProfessionalFormRole = RoleName | "";

/**
 * ONDA 37 — o que /team ainda escreve. Cadastrar, editar e desativar saíram
 * daqui: a pessoa nasce, muda de cargo e é desativada em Usuários, num ato
 * só (backend ADR-0084). A REATIVAÇÃO é o mesmo ato de volta — profissional
 * e conta —, por rota própria; até 2026-09-05 ela saía por `PATCH
 * {active: true}` e deixava a conta revogada.
 */
export type TeamRosterService = Pick<
  Api,
  | "reactivateProfessional"
  | "transitionCareerLevel"
  | "allocateProfessionalToTeam"
  | "releaseProfessionalFromTeam"
>;

/** Quem SOLICITA a transferência quando a mudança de time não é imediata (dono, 2026-09-06). */
export type TeamTransferRequester = Pick<TeamTransfersGateway, "requestTeamTransfer">;

export interface TeamChangeRequested {
  /** A pessoa como ficou depois do que mudou na hora (o nível). */
  readonly updated: Professional;
  /** A solicitação criada, quando o time mudou; `null` quando só o nível mudou. */
  readonly requested: TeamTransferRequest | null;
}

export class TeamOrLevelChange {
  constructor(
    readonly professional: Professional,
    readonly toRole: ProfessionalFormRole,
    readonly toTeamId: string | null,
  ) {}

  get levelChanged(): boolean {
    if (!SeniorityReading.has(this.professional)) return false;
    return this.toRole !== "" && this.toRole !== this.professional.role;
  }

  get teamChanged(): boolean {
    return this.toTeamId !== (this.professional.teamId ?? null);
  }

  get isEffective(): boolean {
    return this.levelChanged || this.teamChanged;
  }

  /**
   * A pergunta do campo de motivo acompanha o que está mudando de verdade.
   * Pedido do dono (2026-09-03): *"se eu estiver mudando o nível, quero ver
   * 'Por que o nível de carreira está mudando?'; se eu estiver mudando o
   * time, 'Por que o time está mudando?'"*. Mudando os dois — ou ainda nada —
   * a pergunta é a das duas coisas, que é a única honesta nesse instante.
   */
  get reasonPlaceholderKey(): MessageKey {
    if (this.levelChanged && !this.teamChanged) return "team.transition.reasonPlaceholder.level";
    if (this.teamChanged && !this.levelChanged) return "team.transition.reasonPlaceholder.team";
    return "team.transition.reasonPlaceholder";
  }
}

export class TeamViewModel {
  constructor(
    private readonly service: TeamRosterService,
    private readonly policy: UiAuthorizationPolicy,
  ) {}

  isAdmin(user: SessionUser): boolean {
    return this.policy.operatesTheSystem(user);
  }

  /** D3 (dono, 2026-09-05): nível, desativação e reativação — gerente designado, ou admin como correção. */
  decidesCareerOf(user: SessionUser, professional: Pick<Professional, "id" | "teamId">): boolean {
    return this.policy.decidesCareerOf(user, professional);
  }

  decidesCareerOfSomeone(user: SessionUser): boolean {
    return this.policy.operatesTheSystem(user) || this.policy.canComposeAnyTeam(user);
  }

  allocatableTeams(teams: readonly TeamSummary[]): TeamSummary[] {
    return teams.filter((team) => team.active);
  }

  /** Delegado a `TeamNames` — a busca do nome do time mora num lugar só. */
  teamNameOf(teamId: string | null | undefined, teams: readonly TeamSummary[]): string | null {
    return TeamNames.of(teams).nameOf(teamId);
  }

  otherCareerLevels<TLevel extends { name: string }>(
    levels: readonly TLevel[],
    currentRole: RoleName | null,
  ): TLevel[] {
    return levels.filter((level) => level.name !== currentRole);
  }

  /** Otimista: `onConfirmed` roda quando o serviço confirma — o aviso de sucesso vai lá, não no clique. */
  reactivate(professional: Professional, onConfirmed?: () => void): void {
    this.service.reactivateProfessional(professional.id, professional.version, onConfirmed);
  }

  transitionCareerLevel(
    professionalId: string,
    toRole: RoleName,
    reason: string,
  ): Promise<Professional> {
    return this.service.transitionCareerLevel(professionalId, toRole, reason);
  }

  /**
   * O caminho do GERENTE (dono, 2026-09-06): o nível muda na hora, porque é
   * dele; o time vira SOLICITAÇÃO ao gerente do destino, com o mesmo motivo.
   * "Sem time" não existe neste caminho — uma transferência tem destino.
   */
  async requestTeamChange(
    change: TeamOrLevelChange,
    reason: string,
    transfers: TeamTransferRequester,
  ): Promise<TeamChangeRequested> {
    const { id } = change.professional;
    let updated = change.professional;
    if (change.levelChanged && change.toRole !== "") {
      updated = await this.service.transitionCareerLevel(id, change.toRole, reason);
    }
    const requested =
      change.teamChanged && change.toTeamId !== null
        ? await transfers.requestTeamTransfer(id, change.toTeamId, reason)
        : null;
    return { updated, requested };
  }

  async changeTeamOrLevel(change: TeamOrLevelChange, reason: string): Promise<Professional> {
    const { id } = change.professional;
    let updated = change.professional;
    if (change.levelChanged && change.toRole !== "") {
      updated = await this.service.transitionCareerLevel(id, change.toRole, reason);
    }
    if (change.teamChanged) {
      updated =
        change.toTeamId === null
          ? await this.service.releaseProfessionalFromTeam(id)
          : await this.service.allocateProfessionalToTeam(id, change.toTeamId, reason);
    }
    return updated;
  }
}
