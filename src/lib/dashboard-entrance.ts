import type { SessionUser } from "./gateways/auth.gateway";

/**
 * A entrada orquestrada do Painel acontece UMA vez: na primeira abertura
 * depois do login (referência FIAP 2026-09-06, §2 item 8). O login arma a
 * marca nesta aba, com o id da conta; o Painel a consome ao montar. Recarregar
 * a página ou voltar ao Painel pelo menu não repete — a marca já se foi.
 */
export class DashboardEntrance {
  static readonly STORAGE_KEY = "synapse:dashboard-entrance";

  static arm(user: Pick<SessionUser, "id">): void {
    try {
      window.sessionStorage.setItem(DashboardEntrance.STORAGE_KEY, user.id);
    } catch {
      return;
    }
  }

  /** Cabe a entrada agora? Só se a marca é desta conta — e ela some ao responder. */
  static consume(user: Pick<SessionUser, "id">): boolean {
    try {
      const armed = window.sessionStorage.getItem(DashboardEntrance.STORAGE_KEY) === user.id;
      if (armed) window.sessionStorage.removeItem(DashboardEntrance.STORAGE_KEY);
      return armed;
    } catch {
      return false;
    }
  }
}
