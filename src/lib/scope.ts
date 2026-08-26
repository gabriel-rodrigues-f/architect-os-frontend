import type { SessionUser } from "./api";
import type { Architect } from "./domain";

/**
 * UX-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — `isLeadCapable(role)`
 * responde "esta conta pode agir como Tech Lead de alguém?", nunca "desta
 * pessoa específica?". Usado sozinho para decidir se um campo nasce editável
 * na tela de uma pessoa, ele libera edição para Lead de QUALQUER equipe, não
 * só de quem `architect.leadUserId` de fato aponta para esta conta — a UI
 * autoriza por papel onde o backend (`auth/scope.ts`, `canActFor`/`isLeadOf`)
 * autoriza pela relação real. O resultado é um campo que parece editável e
 * volta um 403 tardio ao salvar.
 *
 * Estas regras espelham as do backend, mas síncronas: o frontend já tem o
 * `Architect` inteiro (com `leadUserId`) carregado em `store`, sem precisar
 * de uma nova consulta para responder "posso agir sobre esta pessoa?".
 *
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 70) — as três funções soltas que existiam aqui viraram métodos de
 * `UiAuthorizationPolicy`, para dar aos ViewModels de tela (Seção 58-61) um
 * único objeto injetável por construtor em vez de três imports de função.
 * As funções soltas continuam exportadas, delegando para uma instância
 * compartilhada (`defaultUiAuthorizationPolicy`) — nenhum dos ~16 call
 * sites que já importam `canActFor`/`isLeadOf`/`isAssignedTechLeadOf`
 * precisou mudar nesta PR.
 *
 * Repetindo o aviso da Seção 70: isto é só apresentação (mostrar/esconder
 * botão, campo editável ou não). NUNCA é autorização de verdade — essa
 * continua só no backend (`auth/scope.ts`, ainda não migrado para OO —
 * OO2-06), e cada método aqui tem uma chamada real equivalente do lado do
 * servidor que recusa de qualquer forma se a UI mentir ou for contornada.
 */

type ScopedArchitect = Pick<Architect, "id" | "leadUserId">;

export class UiAuthorizationPolicy {
  /** Espelha `canActFor` do backend: admin, a própria pessoa, ou o Tech Lead responsável por ela. */
  canActFor(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (user.role === "admin") return true;
    if (!architect) return false;
    if (user.architectId === architect.id) return true;
    return user.role === "lead" && architect.leadUserId === user.id;
  }

  /** Espelha `isLeadOf` do backend: só o lado Tech Lead — sem o bypass de dono. */
  isLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (user.role === "admin") return true;
    if (!architect) return false;
    return user.role === "lead" && architect.leadUserId === user.id;
  }

  /**
   * Espelha `isAssignedTechLeadOf` do backend (ENT-AUTH-002/003,
   * AUDITORIA-ENTERPRISE-SYNAPSE-SEXTA-RODADA-2026-08-19.md, Seção 5/6) — o
   * mesmo `isLeadOf`, mas **sem** o bypass de admin. Usado só para decidir se
   * o botão "Reabrir PDI" (reabertura de plano concluído) aparece: a regra
   * pede explicitamente que admin não reabra só por ser administrador.
   */
  isAssignedTechLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
    if (!architect) return false;
    return user.role === "lead" && architect.leadUserId === user.id;
  }

  /**
   * Cadastro/edição do roster (`/team`) é decisão administrativa — usado
   * pelo `TeamViewModel` (OO2-08) no lugar do `user.role === "admin"` que
   * antes ficava inline na rota. Backend já recusa o resto de qualquer
   * forma; isto só decide o que a UI oferece.
   */
  isAdmin(user: SessionUser): boolean {
    return user.role === "admin";
  }
}

/**
 * Instância única e sem estado (as três regras só leem os parâmetros
 * recebidos) — compartilhada pelas funções soltas abaixo e por quem
 * injetar `UiAuthorizationPolicy` num ViewModel sem precisar instanciar de
 * novo.
 */
export const defaultUiAuthorizationPolicy = new UiAuthorizationPolicy();

/** @deprecated Prefira injetar `UiAuthorizationPolicy` (ex.: `defaultUiAuthorizationPolicy`) em código novo — mantido para os call sites existentes. */
export const canActFor = (user: SessionUser, architect: ScopedArchitect | undefined): boolean =>
  defaultUiAuthorizationPolicy.canActFor(user, architect);

/** @deprecated Prefira injetar `UiAuthorizationPolicy` (ex.: `defaultUiAuthorizationPolicy`) em código novo — mantido para os call sites existentes. */
export const isLeadOf = (user: SessionUser, architect: ScopedArchitect | undefined): boolean =>
  defaultUiAuthorizationPolicy.isLeadOf(user, architect);

/** @deprecated Prefira injetar `UiAuthorizationPolicy` (ex.: `defaultUiAuthorizationPolicy`) em código novo — mantido para os call sites existentes. */
export const isAssignedTechLeadOf = (
  user: SessionUser,
  architect: ScopedArchitect | undefined,
): boolean => defaultUiAuthorizationPolicy.isAssignedTechLeadOf(user, architect);
