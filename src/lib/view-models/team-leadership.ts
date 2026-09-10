import { TeamLeadershipRoles, type TeamLeadershipRole } from "../gateways/auth.gateway";
import type { TeamRoster, TeamRosterMember } from "../gateways/team-roster.gateway";
import type { TeamSummary } from "../gateways/teams.gateway";

/**
 * QUEM LIDERA UM TIME, lido do VÍNCULO — a mesma fonte que o Quadro desenha
 * (`GET /teams/:teamId/memberships`), nunca o cargo da conta.
 *
 * A distinção não é preciosismo: `users.role` diz o que a PESSOA é na
 * organização, e `team_memberships` diz o que ela é NAQUELE time. Um gerente
 * pode existir sem gerir este time; um time pode não ter gerente nenhum. A
 * coluna da tela responde a segunda pergunta, então lê a segunda tabela.
 *
 * A leitura tem TRÊS estados, e a tela precisa dos três: enquanto o quadro
 * não chega não se pode afirmar ausência, e quando o quadro não pode ser
 * lido (a exceção nomeada da REGRA 18 — o 404 que quer dizer "quadro
 * indisponível") a tela cala em vez de mentir "sem gerente".
 */
export type LeadershipReading = "loading" | "unreadable" | "read";

export class TeamLeadership {
  private constructor(
    readonly reading: LeadershipReading,
    private readonly leaders: ReadonlyMap<TeamLeadershipRole, TeamRosterMember>,
  ) {}

  /** O quadro ainda não chegou — nada se afirma sobre este time. */
  static readonly LOADING = new TeamLeadership("loading", new Map());

  /** O quadro existe e não pode ser lido daqui (REGRA 18) — a tela cala. */
  static readonly UNREADABLE = new TeamLeadership("unreadable", new Map());

  /** O quadro chegou: quem lidera é quem tem o vínculo de liderança. */
  static of(roster: TeamRoster): TeamLeadership {
    if (roster.reading === "unavailable") return TeamLeadership.UNREADABLE;
    const leaders = new Map<TeamLeadershipRole, TeamRosterMember>();
    for (const member of roster.members) {
      if (TeamLeadershipRoles.includes(member.role) && !leaders.has(member.role)) {
        leaders.set(member.role, member);
      }
    }
    return new TeamLeadership("read", leaders);
  }

  /** O NOME de quem ocupa o papel; nulo quando ninguém ocupa ou não se sabe. */
  nameOf(role: TeamLeadershipRole): string | null {
    return this.leaders.get(role)?.name ?? null;
  }

  /** AUSÊNCIA de verdade: o quadro foi lido E ninguém ocupa o papel. */
  lacks(role: TeamLeadershipRole): boolean {
    return this.reading === "read" && !this.leaders.has(role);
  }
}

/**
 * A liderança de TODOS os times listados, num objeto só — a tabela lê linha a
 * linha e o bloco de pendências conta sobre o mesmo conjunto. Duas leituras,
 * uma fonte (regra de reuso).
 */
export class TeamLeadershipBoard {
  constructor(private readonly byTeam: ReadonlyMap<string, TeamLeadership>) {}

  static from(readings: readonly (readonly [string, TeamLeadership])[]): TeamLeadershipBoard {
    return new TeamLeadershipBoard(new Map(readings));
  }

  of(teamId: string): TeamLeadership {
    return this.byTeam.get(teamId) ?? TeamLeadership.LOADING;
  }

  /**
   * Só se CONTA pendência quando todo quadro do conjunto já foi lido: um
   * contador que sobe enquanto as leituras chegam pisca números falsos.
   */
  settledOver(teams: readonly TeamSummary[]): boolean {
    return teams.every((team) => this.of(team.id).reading !== "loading");
  }

  teamsLacking(role: TeamLeadershipRole, teams: readonly TeamSummary[]): TeamSummary[] {
    return teams.filter((team) => this.of(team.id).lacks(role));
  }
}
