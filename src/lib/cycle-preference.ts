import type { SessionUser } from "./gateways/auth.gateway";

/**
 * O CICLO EM FOCO É ESCOLHA DE CADA PESSOA (dono, 2026-09-10): *"quero que
 * todos os perfis possam mudar o ciclo enquanto logados. Essa mudança deve
 * valer apenas para o seu perfil."*
 *
 * Até aqui o seletor do rodapé não era filtro: era ESCRITA GLOBAL. Escolher
 * um ciclo gravava `PUT /settings/active-cycle`, que fecha o ciclo ativo da
 * organização inteira — e por isso só aparecia para quem opera o sistema, e o
 * tech lead perdeu o controle. Agora o seletor guarda uma preferência de
 * leitura, por conta, neste navegador; ninguém fecha ciclo de ninguém.
 * Ativar e encerrar ciclo continua existindo, com outro nome e outro lugar:
 * Modelo de Carreira → Ciclos de Avaliação → *Ativar* / *Encerrar*.
 *
 * Sem escolha guardada — ou com uma escolha que já não existe no cadastro —,
 * a pessoa lê o ciclo ativo da organização, que é o que sempre leu.
 */
export class CyclePreference {
  static readonly STORAGE_KEY = "synapse:cycle-in-focus";

  constructor(
    private readonly storage: Pick<Storage, "getItem" | "setItem">,
    private readonly user: Pick<SessionUser, "id">,
  ) {}

  static forBrowser(user: Pick<SessionUser, "id">): CyclePreference {
    return new CyclePreference(window.localStorage, user);
  }

  /** O ciclo a ler: a escolha da pessoa, se ainda existe; senão o ativo da organização. */
  static resolve(
    chosen: string | null,
    organizationActiveCycleId: string,
    knownCycleIds?: readonly string[],
  ): string {
    if (chosen === null || chosen === "") return organizationActiveCycleId;
    if (knownCycleIds !== undefined && !knownCycleIds.includes(chosen))
      return organizationActiveCycleId;
    return chosen;
  }

  read(): string | null {
    try {
      return this.storage.getItem(this.key());
    } catch {
      return null;
    }
  }

  write(cycleId: string): void {
    try {
      this.storage.setItem(this.key(), cycleId);
    } catch {
      // Sem armazenamento a escolha vale só até recarregar — melhor do que não valer.
    }
  }

  private key(): string {
    return `${CyclePreference.STORAGE_KEY}:${this.user.id}`;
  }
}
