import { UserRoles, type SessionUser } from "../gateways/auth.gateway";

/**
 * A saudação do PRIMEIRO acesso do dia (dono, 2026-09-06): aparece uma vez
 * por dia, por pessoa, neste navegador. O que decide "já apareceu hoje" é
 * uma marca com a data local e o id da conta — nada vai ao servidor.
 */
export class DailyGreeting {
  static readonly STORAGE_KEY = "synapse:daily-greeting";
  static readonly VISIBLE_MS = 3000;

  static todayKey(user: Pick<SessionUser, "id">, now: Date = new Date()): string {
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return `${user.id}@${day}`;
  }

  /** Cabe mostrar hoje? Só se a marca de hoje ainda não foi gravada. */
  static isDueFor(user: Pick<SessionUser, "id">, now: Date = new Date()): boolean {
    try {
      return (
        window.localStorage.getItem(DailyGreeting.STORAGE_KEY) !== DailyGreeting.todayKey(user, now)
      );
    } catch {
      return false;
    }
  }

  static markShown(user: Pick<SessionUser, "id">, now: Date = new Date()): void {
    try {
      window.localStorage.setItem(DailyGreeting.STORAGE_KEY, DailyGreeting.todayKey(user, now));
    } catch {
      return;
    }
  }

  /** O primeiro nome, como a pessoa é chamada. */
  static firstNameOf(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
  }

  /** A chave da mensagem por perfil — os textos são do dono, em `greeting.*`. */
  static messageKeyFor(
    role: SessionUser["role"],
  ):
    | "greeting.manager"
    | "greeting.techLead"
    | "greeting.member"
    | "greeting.admin"
    | "greeting.director" {
    if (role === UserRoles.MANAGER) return "greeting.manager";
    if (role === UserRoles.TECH_LEAD) return "greeting.techLead";
    // A saudação de quem mantém o sistema é do suporte (o antigo admin); a diretoria tem a dela.
    if (UserRoles.readsTheOrganization(role)) return "greeting.director";
    if (UserRoles.operatesTheSystem(role)) return "greeting.admin";
    return "greeting.member";
  }
}
