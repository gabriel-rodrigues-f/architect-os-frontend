import type { SessionUser } from "../api";
import type { CareerLevel, Capability, Competency, Level, RequirementType } from "../domain";
import type { UiAuthorizationPolicy } from "../scope";
import type { Api } from "../store";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — quinto ViewModel de tela desta fase, mesmo formato de
 * `TeamViewModel`/`DevelopmentPlansViewModel`: UMA fonte narrow no
 * construtor (`CatalogService`), porque diferente de `AssessmentViewModel`
 * (`assessment-view-model.ts`, a única com duas fontes até aqui), TODA
 * escrita do catálogo em `routes/competency-matrix.tsx` passa por
 * `store.tsx` (`useStore()`) — capacidade e competência não têm nenhuma
 * ação que bypasse o cache de `STATE_QUERY_KEY` como o portfólio de
 * capacidades do assessment tinha. Um `store` só já é o "serviço" completo.
 *
 * O backend deste catálogo acabou de passar por OO2-04 (commit `629b5ae`,
 * repo backend): `Capability.evaluateCurationStatus` (READY exige
 * EXATAMENTE 6 competências ativas, 3 RESTRICTIVE + 3 NON_RESTRICTIVE) e
 * `Competency.assertCanSwapRequirementTypeWith` (troca só entre duas
 * competências da MESMA capacidade, ambas ativas, tipos hoje diferentes)
 * viraram invariantes de entidade lá. O front nunca recalcula
 * `curation.status` — chega pronto do servidor e só é exibido (badge
 * READY/REQUIRES_CURATION na rota). O que O FRONT precisa espelhar (mesmo
 * raciocínio de `UiAuthorizationPolicy`: só apresentação, nunca autorização
 * de verdade) são as DUAS regras cross-aggregate que ficaram de propósito
 * FORA das entidades de domínio do backend por precisarem de contagem
 * fresca (`CapabilityLimitError`/`assertCapabilityLimits`, hoje em
 * `CompetencyValidationGuard`, chamado por `CreateCompetency`/
 * `UpdateCompetency`): no máximo 6 competências ativas por capacidade, no
 * máximo 3 de cada tipo. Sem espelhar isso aqui, a tela deixaria escolher
 * "Nova competência"/"Restritiva" quando o servidor já vai recusar — dai
 * `isCapabilityAtCapacity`/`isRequirementTypeFull` abaixo, extraídos byte a
 * byte dos cálculos que já existiam soltos nos dois diálogos
 * (`CompetencyCreateDialog`/`CompetencyEditDialog`), só nomeados e
 * centralizados (a versão de criação e a de edição divergiam só no desconto
 * da própria competência, `excluding` abaixo). `swapCandidates` espelha o
 * mesmo "mesma capacidade, ambas ativas, tipos diferentes" de
 * `assertCanSwapRequirementTypeWith` do lado do CANDIDATO a troca (quem
 * pode aparecer no `SwapPicker`), não da checagem em si — o servidor
 * confirma a troca de verdade (`swapCompetencyRequirement`, atrás de
 * `FOR UPDATE`, ver `store.tsx`).
 *
 * Escopo desta PR: os sete comandos de escrita do catálogo (criar/editar/
 * arquivar capacidade, restaurar capacidade, criar/editar/arquivar
 * competência, restaurar competência, trocar tipo de exigência) e as três
 * regras de capacidade/elegibilidade acima. Ficam de fora, deliberadamente
 * — mesma entanglement com o ciclo de render do React já documentada nos
 * quatro ViewModels anteriores:
 *  - Busca por texto, filtro de status de curadoria (`curationFilter`) e
 *    expandir/recolher card por capacidade (`expandedIds`) em `MatrixPage`
 *    — filtro/busca/estado de expansão é exatamente a categoria que
 *    `team-view-model.ts` já descreve para `useTeamRoster`: não é uma ação
 *    de negócio, é o que decide o que RENDERIZA agora.
 *  - `saving`/`swapping`/`swapTargetId`/`swapError` (rascunho local do
 *    `SwapPicker` e das duas dialogs de criação) — flags de "ocupado" e
 *    seleção pendente que só existem para desabilitar botão/mostrar
 *    spinner enquanto uma chamada individual está em voo; decidir SE um
 *    erro vira banner inline (`swapError`) ou `toast` também é orquestração
 *    de UI, não fica aqui (mesmo contrato de `TeamViewModel.submit` e
 *    `AssessmentViewModel.removeCapability`).
 *  - `confirmDelete`/`confirmDeleteCapability`/`editing`/`creatingIn`/
 *    `editingCapability`/`creatingCapability` — só controlam qual diálogo
 *    está aberto e para qual linha; ficam em `MatrixPage`.
 *  - `capabilityCompetencyCount` (contagem usada só para compor o texto do
 *    diálogo de confirmação de exclusão de capacidade) — derivação trivial
 *    de uma linha, um único call site, sem regra de negócio nova; fica
 *    inline na rota.
 */

/**
 * Fatia de `useStore()` que o catálogo (capacidade + competência) precisa.
 * OO3-10 — derivada de `Api` (`store.tsx`, agora exportada) via `Pick`, em
 * vez de recopiar as assinaturas à mão: qualquer divergência vira erro de
 * compilação, e `useStore()` satisfaz a forma estruturalmente.
 */
export type CatalogService = Pick<
  Api,
  | "addCapability"
  | "updateCapability"
  | "removeCapability"
  | "addCompetency"
  | "updateCompetency"
  | "removeCompetency"
  | "swapCompetencyRequirement"
>;

export class CompetencyMatrixViewModel {
  constructor(
    private readonly service: CatalogService,
    private readonly policy: UiAuthorizationPolicy,
  ) {}

  /** Catálogo mestre é administrativo — usado no lugar do `user.role === "admin"` que antes ficava inline na rota (mesmo tratamento de `TeamViewModel.isAdmin`). Backend já recusa o resto de qualquer forma. */
  isAdmin(user: SessionUser): boolean {
    return this.policy.isAdmin(user);
  }

  // ---- Capacidade ----

  /**
   * ORIENTACAO-BLOCO-2-UX-POR-TELA — `short` nunca é coletado no formulário
   * (pedido da dona do produto: nunca mais digitar a sigla manualmente); o
   * backend gera a partir de `name`, com resolução de colisão. B-32 — `id`
   * também nasce no servidor. Quem chama decide o que fazer com o erro
   * (`toast`), mesmo contrato de `TeamViewModel.submit`.
   */
  createCapability(name: string): Promise<Capability> {
    return this.service.addCapability({ name: name.trim(), active: true });
  }

  /**
   * ORIENTACAO-BLOCO-2-UX-POR-TELA — mesma razão de `createCapability`:
   * `short` não é reenviado aqui, o backend regenera a sigla a partir do
   * `name` novo quando o patch muda `name` sem mandar `short` explícito.
   */
  renameCapability(id: string, name: string): void {
    this.service.updateCapability(id, { name: name.trim() });
  }

  /** Apaga se nenhuma competência da capacidade já foi usada; senão arquiva a capacidade e as competências dela — o resultado diz qual dos dois aconteceu (mesmo contrato de `store.removeCapability`). */
  removeCapability(id: string): Promise<{ archived: boolean; competenciesRemoved: number }> {
    return this.service.removeCapability(id);
  }

  /** Capacidade arquivada nunca desaparece — fica restaurável a qualquer momento (ver `ArchivedCompetencies` na rota). */
  restoreCapability(id: string): void {
    this.service.updateCapability(id, { active: true });
  }

  /**
   * Espelha `CapabilityLimitError`/`assertCapabilityLimits` do backend (no
   * máximo 6 competências ativas por capacidade) — só apresentação (some o
   * botão "Nova competência" antes de deixar tentar e descobrir pelo erro
   * do servidor), a validação real continua só lá.
   */
  isCapabilityAtCapacity(capability: Pick<Capability, "curation">): boolean {
    return capability.curation.activeCompetencyCount >= 6;
  }

  // ---- Competência ----

  /**
   * Nível esperado por cargo nasce em branco — nunca 3/4/5 fabricado só
   * para satisfazer o formulário; quem chama já garantiu isso via
   * `canCreateCompetency` antes de invocar (mesmo contrato de
   * `TeamViewModel.validate`/`submit`). B-32 — `id` nasce no servidor.
   */
  createCompetency(
    capabilityId: string,
    name: string,
    levels: Partial<Record<string, Level>>,
    requirementType: RequirementType,
  ): Promise<Competency> {
    return this.service.addCompetency({
      name: name.trim(),
      capabilityId,
      requirementType,
      expected: levels as Record<string, Level>,
      active: true,
    });
  }

  /**
   * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 39 — admin escolhe os
   * TRÊS níveis (um por nível de carreira) antes de conseguir salvar; sem
   * fallback nenhum. Mesmo booleano único reaproveitado para desabilitar o
   * botão "Adicionar" e para guardar o Enter no campo de nome (era um único
   * `canSave` local nos dois lugares antes desta extração).
   */
  canCreateCompetency(
    name: string,
    levels: Partial<Record<string, Level>>,
    careerLevels: readonly Pick<CareerLevel, "id">[],
  ): boolean {
    return name.trim().length > 0 && careerLevels.every((cl) => levels[cl.id] !== undefined);
  }

  /**
   * Nome, nível esperado por cargo e exigência (ENT-CAR-011) — trocar de
   * capacidade fica fora (reorganização maior, decisão que continua fora
   * desta tela). PATCH faz merge (`jsonbMerge`, backend): enviar só os
   * níveis já preenchidos não zera os demais do Perfil por Cargo.
   */
  updateCompetency(
    id: string,
    name: string,
    levels: Partial<Record<string, Level>>,
    requirementType: RequirementType,
  ): void {
    this.service.updateCompetency(id, {
      name: name.trim(),
      expected: levels as Record<string, Level>,
      requirementType,
    });
  }

  /** Apaga se a competência nunca foi usada; senão arquiva — o resultado diz qual dos dois aconteceu. */
  removeCompetency(id: string): Promise<{ archived: boolean }> {
    return this.service.removeCompetency(id);
  }

  /** Competência arquivada nunca desaparece — fica restaurável a qualquer momento. */
  restoreCompetency(id: string): void {
    this.service.updateCompetency(id, { active: true });
  }

  /**
   * ORIENTACAO-NONA-RODADA — quando o lado de destino já está em 3/3, um
   * PATCH comum sempre recusa; a única saída é trocar de lugar com uma
   * competência existente do outro tipo, numa transação só no servidor
   * (`swapCompetencyRequirement`, `store.tsx`), para nunca passar por um
   * estado fora de 3+3. Sem otimismo aqui: quem chama decide o que fazer
   * com sucesso (virar o próprio `requirementType` local) ou erro
   * (`swapError` inline), mesmo contrato de
   * `AssessmentViewModel.updateDevelopmentSummary`.
   */
  swapRequirementType(id: string, withCompetencyId: string): Promise<void> {
    return this.service.swapCompetencyRequirement(id, withCompetencyId);
  }

  /**
   * Espelha `CapabilityLimitError`/`assertCapabilityLimits` do backend (no
   * máximo 3 competências de cada tipo por capacidade) — extraído byte a
   * byte dos dois cálculos que existiam soltos: `CompetencyCreateDialog`
   * (sem `excluding`, competência nova não desconta nada) e
   * `CompetencyEditDialog` (com `excluding` = a própria competência, que já
   * ocupa uma vaga do seu tipo atual e por isso não conta contra o limite
   * dela mesma).
   */
  isRequirementTypeFull(
    capability: Pick<Capability, "curation"> | undefined,
    type: RequirementType,
    excluding?: Pick<Competency, "requirementType"> | null,
  ): boolean {
    const count =
      type === "RESTRICTIVE"
        ? (capability?.curation.restrictiveCompetencyCount ?? 0)
        : (capability?.curation.nonRestrictiveCompetencyCount ?? 0);
    const adjustment = excluding?.requirementType === type ? 1 : 0;
    return count - adjustment >= 3;
  }

  /**
   * Candidatas a aparecer no `SwapPicker` quando `isRequirementTypeFull`
   * bloqueia o tipo desejado: mesma capacidade, ativas, já do tipo `type`
   * (o tipo que `excludingCompetencyId` está tentando virar), excluindo a
   * própria competência editada. Espelha o lado "quem pode ser candidato"
   * de `Competency.assertCanSwapRequirementTypeWith` (mesma capacidade,
   * ambas ativas, tipos diferentes) — a confirmação de verdade da troca
   * continua só no servidor.
   */
  swapCandidates(
    competencies: readonly Competency[],
    capabilityId: string,
    type: RequirementType,
    excludingCompetencyId: string,
  ): Competency[] {
    return competencies.filter(
      (c) =>
        c.capabilityId === capabilityId &&
        c.active &&
        c.requirementType === type &&
        c.id !== excludingCompetencyId,
    );
  }
}
