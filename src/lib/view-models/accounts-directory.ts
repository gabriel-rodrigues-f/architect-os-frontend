import type { SessionUser, UserRole, UserStatus } from "../gateways/auth.gateway";
import type { ChoosableTeam } from "../team-choice";
import type { TableOrder } from "./table-order";

export type AccountsColumn = "name" | "email" | "role" | "status" | "team";

export interface AccountsDirectoryLabels {
  roleLabel(role: UserRole): string;
  statusLabel(status: UserStatus): string;
  noTeam: string;
  allTeams: string;
}

export interface TeamFilterOption {
  value: string;
  label: string;
}

/**
 * CONTAS CADASTRADAS — filtro por time e ordenação por coluna.
 *
 * Dono (2026-09-06): *"Em Usuários > Contas cadastradas deve ser possível
 * filtrar por time. Cada título (Nome, E-mail, Cargo, Status) deve ter uma
 * setinha para asc/desc."* O time da conta é o do VÍNCULO (`memberships`);
 * a conta sem vínculo é "Sem time" — e o filtro só oferece "Sem time" quando
 * existe alguma conta solta, para não oferecer o que a lista não desenha
 * (a mesma regra do filtro de nomes em Time, onda 45).
 *
 * Cargo e status ordenam pelo RÓTULO que a tela mostra, não pela chave: quem
 * lê "Administrador, Gerente, Membro" espera a ordem do que vê.
 */
export class AccountsDirectory {
  static readonly ALL_TEAMS = "todos-os-times";

  static readonly NO_TEAM = "sem-time";

  private readonly teamNames: ReadonlyMap<string, string>;

  constructor(
    private readonly accounts: readonly SessionUser[],
    teams: readonly ChoosableTeam[],
    private readonly labels: AccountsDirectoryLabels,
  ) {
    this.teamNames = new Map(teams.map((team) => [team.id, team.name]));
  }

  teamIdOf(account: SessionUser): string | null {
    return account.memberships?.[0]?.teamId ?? null;
  }

  teamNameOf(account: SessionUser): string {
    const teamId = this.teamIdOf(account);
    if (teamId === null) return this.labels.noTeam;
    return this.teamNames.get(teamId) ?? teamId;
  }

  /** Todos + os times do alcance de quem filtra + "Sem time" se alguma conta está solta. */
  teamFilterOptions(reachableTeams: readonly ChoosableTeam[]): TeamFilterOption[] {
    const options: TeamFilterOption[] = [
      { value: AccountsDirectory.ALL_TEAMS, label: this.labels.allTeams },
      ...reachableTeams.map((team) => ({ value: team.id, label: team.name })),
    ];
    if (this.accounts.some((account) => this.teamIdOf(account) === null)) {
      options.push({ value: AccountsDirectory.NO_TEAM, label: this.labels.noTeam });
    }
    return options;
  }

  list(teamFilter: string, order: TableOrder<AccountsColumn>): SessionUser[] {
    const byName = this.accounts
      .filter((account) => this.matches(account, teamFilter))
      .sort((left, right) => left.name.localeCompare(right.name));
    return order.apply(byName, (left, right, column) => this.compare(left, right, column));
  }

  private matches(account: SessionUser, teamFilter: string): boolean {
    if (teamFilter === AccountsDirectory.ALL_TEAMS) return true;
    const teamId = this.teamIdOf(account);
    if (teamFilter === AccountsDirectory.NO_TEAM) return teamId === null;
    return teamId === teamFilter;
  }

  private compare(left: SessionUser, right: SessionUser, column: AccountsColumn): number {
    return this.keyOf(left, column).localeCompare(this.keyOf(right, column));
  }

  private keyOf(account: SessionUser, column: AccountsColumn): string {
    switch (column) {
      case "name":
        return account.name;
      case "email":
        return account.email;
      case "role":
        return this.labels.roleLabel(account.role);
      case "status":
        return this.labels.statusLabel(account.status);
      case "team":
        return this.teamNameOf(account);
    }
  }
}
