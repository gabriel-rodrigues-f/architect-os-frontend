import type { SessionUser } from "../api";
import type { Architect, RoleName } from "../domain";
import type { UiAuthorizationPolicy } from "../scope";
import type { Api } from "../store";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — primeiro ViewModel de tela desta fase, seguindo o
 * exemplo literal da Seção 60 (`DevelopmentPlansViewModel`): construtor
 * recebe o serviço + a política de autorização, expõe métodos de ação que
 * devolvem `Promise` e getters/computados — nunca estado próprio que
 * precisaria de um mecanismo de re-render (isto é uma classe comum, não um
 * observable).
 *
 * Escopo desta PR: só a fatia de cadastro/edição/reativação do roster
 * (`useArchitectForm` em `team-shared.tsx`), não a tela `/team` inteira.
 * `useTeamRoster` (filtro/ordenação/paginação, ~280 linhas do mesmo
 * arquivo) NÃO virou ViewModel — é um hook com 8 `useState`/`useEffect`
 * cujo próprio motivo de existir é reagir ao ciclo de render do React
 * (paginação reage a filtro, filtro reage ao catálogo carregado); mover
 * isso para uma classe comum exigiria inventar um mecanismo de
 * observação/assinatura que o código atual não tem — exatamente a
 * armadilha que o brief desta fase pede para não forçar. Ver nota mais
 * longa no relatório desta sessão.
 */

export interface ArchitectFormValues {
  name: string;
  role: RoleName;
  /** Legado — só preservado para quem ainda não migrou (Seção 10, passo 6: nunca gravado numa edição nova). */
  specialization: string;
  primarySpecializationCompetencyId: string | null;
  years: string;
  email: string;
  leadUserId: string;
}

export const emptyArchitectForm = (defaultRole: RoleName): ArchitectFormValues => ({
  name: "",
  role: defaultRole,
  specialization: "",
  primarySpecializationCompetencyId: null,
  years: "",
  email: "",
  leadUserId: "",
});

/**
 * Fatia de `useStore()` que o `TeamViewModel` precisa — só cadastro/edição,
 * não o roster inteiro. OO3-10 — derivada de `Api` (`store.tsx`, agora
 * exportada) via `Pick`, em vez de recopiar as assinaturas à mão: qualquer
 * divergência vira erro de compilação, e `useStore()` satisfaz a forma
 * estruturalmente, sem adaptador em tempo de execução.
 */
export type TeamRosterService = Pick<
  Api,
  "addArchitect" | "updateArchitect" | "transitionCareerLevel" | "deactivate"
>;

export class TeamViewModel {
  constructor(
    private readonly service: TeamRosterService,
    private readonly policy: UiAuthorizationPolicy,
  ) {}

  /** Cadastro/edição do roster é decisão administrativa — usado no lugar do `user.role === "admin"` que antes ficava inline na rota. */
  isAdmin(user: SessionUser): boolean {
    return this.policy.isAdmin(user);
  }

  /**
   * Nada aqui tem fallback: e-mail inventado do nome e "1 ano" fantasma
   * escondiam dado que ninguém preencheu como se fosse real. Falta um
   * campo, o cadastro não valida — sem exceção. Ver
   * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 16 e 17.
   */
  validate(form: ArchitectFormValues): { yearsValid: boolean; canSubmit: boolean } {
    const yearsValid =
      form.years.trim() !== "" && Number.isInteger(Number(form.years)) && Number(form.years) >= 0;
    const canSubmit =
      form.name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.email.includes("@") &&
      yearsValid;
    return { yearsValid, canSubmit };
  }

  /**
   * Cria (sem `editingId`) ou atualiza (com `editingId`) — mesmo payload de
   * antes: `role` só entra ao criar (ENT-CAR-017: depois de criado, nível
   * de carreira muda só pelo comando dedicado `transitionCareerLevel`,
   * nunca por este PATCH genérico), e `specialization` legado nunca é
   * gravado numa edição/criação nova (Seção 10, passo 6 — só a FK).
   * Não decide toast nem fecha diálogo: isso é orquestração de UI, fica no
   * hook adaptador (`useArchitectForm`).
   */
  async submit(form: ArchitectFormValues, editingId: string | null): Promise<void> {
    const payload = {
      name: form.name.trim(),
      yearsAsArchitect: Number(form.years),
      primarySpecializationCompetencyId: form.primarySpecializationCompetencyId,
      email: form.email.trim(),
      leadUserId: form.leadUserId || null,
    };

    if (editingId) {
      this.service.updateArchitect(editingId, payload);
      return;
    }

    // B-32 — id é gerado no servidor (nunca mais slug(nome)); sem
    // otimismo, quem chama só fecha o diálogo depois que a Promise resolve.
    await this.service.addArchitect({
      ...payload,
      specialization: "",
      role: form.role,
      active: true,
    });
  }

  reactivate(architect: Architect): void {
    this.service.updateArchitect(architect.id, { active: true });
  }

  /**
   * OO3-11c — os dois comandos "com motivo" da tela de Time passam pelo
   * ViewModel (os diálogos chamavam `store.transitionCareerLevel`/
   * `store.deactivate` direto, ignorando o VM que a própria tela instancia).
   * Delegantes 1:1 de propósito: o `store` já resolve versão otimista/409;
   * o ganho aqui é o ponto único de dublê nos testes, não lógica nova.
   * A Promise é repropagada sem `catch` — engolir a rejeição faria o 409
   * (`ARCHITECT_VERSION_CONFLICT`) sumir do diálogo.
   */
  transitionCareerLevel(architectId: string, toRole: RoleName, reason: string): Promise<Architect> {
    return this.service.transitionCareerLevel(architectId, toRole, reason);
  }

  deactivate(architectId: string, reason: string): Promise<Architect> {
    return this.service.deactivate(architectId, reason);
  }
}
