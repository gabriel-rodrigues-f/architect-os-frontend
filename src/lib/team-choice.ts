import type { SessionUser } from "./gateways/auth.gateway";
import { defaultUiAuthorizationPolicy, type UiAuthorizationPolicy } from "./scope";

export interface ChoosableTeam {
  id: string;
  name: string;
}

/**
 * ESCOLHE × TRAVADO NUM TIME — a decisão que três telas repetiam.
 *
 * Dono (2026-09-06): *"Com perfil de Gerente e Tech Lead não deve ser
 * possível clicar em menus de mudança de time. O time atual deve ser fixado e
 * deve aparecer um bloqueio ao passar o mouse por cima."* Quem lidera mais de
 * um time continua escolhendo entre os dele; o admin escolhe livremente.
 *
 * Cadastrar pessoa já fazia isto por conta própria (`teamLocked`); Régua do
 * Time e Política de Progressão deixavam o menu aberto. Duas ocorrências
 * viram um objeto: dado o ALCANCE de times de quem está na tela (a tela
 * decide o alcance — admissão, régua ou política têm réguas diferentes), este
 * objeto diz se há escolha ou se o único time fica fixado.
 */
export class TeamChoice {
  private constructor(
    readonly teams: readonly ChoosableTeam[],
    readonly lockedTeam: ChoosableTeam | null,
  ) {}

  static for(
    user: SessionUser,
    teams: readonly ChoosableTeam[],
    policy: UiAuthorizationPolicy = defaultUiAuthorizationPolicy,
  ): TeamChoice {
    const [only, ...rest] = teams;
    const locked = !policy.isAdmin(user) && only !== undefined && rest.length === 0;
    return new TeamChoice(teams, locked && only ? only : null);
  }

  get locked(): boolean {
    return this.lockedTeam !== null;
  }

  /**
   * O time que VALE para a tela: o travado; senão a escolha, se está no
   * alcance; senão o padrão — o primeiro time do alcance, ou o que a tela
   * mandar (`null` para "nenhum/todos").
   */
  resolve(
    chosen: string | null,
    fallback: string | null = this.teams[0]?.id ?? null,
  ): string | null {
    if (this.lockedTeam) return this.lockedTeam.id;
    if (chosen !== null && this.teams.some((team) => team.id === chosen)) return chosen;
    return fallback;
  }
}
