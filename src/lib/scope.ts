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
 * Estas duas funções espelham as do backend, mas síncronas: o frontend já
 * tem o `Architect` inteiro (com `leadUserId`) carregado em `store`, sem
 * precisar de uma nova consulta para responder "posso agir sobre esta
 * pessoa?".
 */

type ScopedArchitect = Pick<Architect, "id" | "leadUserId">;

/** Espelha `canActFor` do backend: admin, a própria pessoa, ou o Tech Lead responsável por ela. */
export function canActFor(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
  if (user.role === "admin") return true;
  if (!architect) return false;
  if (user.architectId === architect.id) return true;
  return user.role === "lead" && architect.leadUserId === user.id;
}

/** Espelha `isLeadOf` do backend: só o lado Tech Lead — sem o bypass de dono. */
export function isLeadOf(user: SessionUser, architect: ScopedArchitect | undefined): boolean {
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
export function isAssignedTechLeadOf(
  user: SessionUser,
  architect: ScopedArchitect | undefined,
): boolean {
  if (!architect) return false;
  return user.role === "lead" && architect.leadUserId === user.id;
}
