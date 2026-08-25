import type { UserRole } from "./gateways/auth.gateway";
import {
  architectsGateway,
  assessmentGateway,
  authGateway,
  careerGateway,
  catalogGateway,
  cyclesGateway,
  defaultApiClient,
  developmentGateway,
  evidenceGateway,
  evolutionGateway,
  learningGateway,
  mentoringGateway,
  reportsGateway,
} from "./gateways/container";

/**
 * OO-FE-01/OO-FE-02 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, Anexo F.6) — este
 * arquivo deixou de ser a implementação e virou FACHADA: a infra de fetch
 * (`ApiClient`, antes as funções soltas `request`/`requestBlob`/`post`/
 * `patch`/`put`/`del` + `let unauthorizedHandler` de módulo) mudou para
 * `api-client.ts`; os ~50 métodos do objeto-deus `api` foram decompostos
 * em gateways por contexto sob `gateways/` (`CyclesGateway`,
 * `ArchitectsGateway`, `CareerGateway`, `CatalogGateway`,
 * `AssessmentGateway`, `DevelopmentGateway`, `LearningGateway`,
 * `MentoringGateway`, `EvidenceGateway`, mais `AuthGateway`/
 * `EvolutionGateway`/`ReportsGateway` que já eram objetos separados); um
 * composition root (`gateways/container.ts`) monta UM `ApiClient` + todos
 * os gateways, uma vez.
 *
 * Migração de FORMA, não de comportamento (F.3): `api`, `authApi`,
 * `evolutionApi`, `reportsApi`, `ApiError`, `isLeadCapable`, `API_URL`,
 * `AppState` e os demais tipos continuam exportados daqui com a MESMA
 * forma de antes — mesmos nomes de método, mesma assinatura, mesma
 * URL/verbo/corpo por chamada — para que `store.tsx` e o resto do app
 * (que só importam `api`/`authApi`/tipos deste módulo) não precisem mudar
 * uma linha. O objeto `api` é literalmente o spread dos gateways por
 * contexto (`gateways/*.gateway.ts` documentam por que os métodos são
 * arrow functions de campo — isso é o que faz este spread preservar os
 * métodos, já presos à instância certa, sem precisar de `.bind()`).
 */
export const api = {
  getState: () => defaultApiClient.getState(),
  ...cyclesGateway,
  ...architectsGateway,
  ...careerGateway,
  ...catalogGateway,
  ...assessmentGateway,
  ...developmentGateway,
  ...learningGateway,
  ...mentoringGateway,
  ...evidenceGateway,
};

export const authApi = { ...authGateway };
export const evolutionApi = { ...evolutionGateway };
export const reportsApi = { ...reportsGateway };

/**
 * B-33 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12 — "sem
 * tratamento global de 401") — sessão expirando NO MEIO do uso (não o
 * `/api/auth/me` inicial, nem um 401 de negócio (senha atual errada) no
 * próprio formulário de login) caía como qualquer outro erro de rede:
 * `store.tsx` mostrava "Não foi possível acessar o serviço" e a pessoa
 * nunca era levada de volta ao login. `api.ts` é um módulo comum (não um
 * hook) — não pode chamar `setUser(null)` direto —, então só notifica quem
 * registrar interesse; `AuthProvider` (`auth.tsx`) é quem decide se um 401
 * específico significa "sessão que existia caiu" (só quando já havia
 * usuário autenticado) ou é irrelevante (login/register/me sem sessão
 * nenhuma ainda).
 *
 * OO-FE-01 — a função de módulo continua com a mesma assinatura
 * (`auth.tsx` não precisou mudar), mas agora só delega para o campo de
 * instância do `ApiClient` padrão (`api-client.ts` documenta a honestidade
 * sobre essa mutabilidade escopada). Decisão deliberada desta PR: `auth.tsx`
 * continua chamando esta função de módulo (não passou a puxar o gateway
 * via Context React) — nenhuma tela migrou para `useGateways()` ainda
 * nesta leva (ver `gateways/container.ts`), então trocar o fio de
 * `auth.tsx` só aumentaria a superfície de mudança num arquivo sensível
 * (a lógica de 401 do R2-TEC-21) sem ganho de comportamento nenhum agora.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  defaultApiClient.setUnauthorizedHandler(handler);
}

/** Quem pode agir como Tech Lead: revisar avaliação/evidência, escrever no PDI de outra pessoa. */
export const isLeadCapable = (role: UserRole): boolean => role === "admin" || role === "lead";

export { ApiError } from "./api-errors";
export { API_URL, type AppState } from "./api-client";
export type { AssessmentItemPatch, CommentInput } from "./gateways/assessment.gateway";
export type { AuthResult, SessionUser, UserRole, UserStatus } from "./gateways/auth.gateway";
