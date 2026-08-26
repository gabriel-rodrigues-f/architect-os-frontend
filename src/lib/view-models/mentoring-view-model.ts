import type { Architect, DevelopmentPlan, MentoringSession, ProficiencyUpdate } from "../domain";
import type { Gap } from "../selectors";
import type { Api } from "../store";
import { defaultDateFormatter } from "../text";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — sétimo (e último) ViewModel de tela desta fase. Mesmo
 * formato enxuto de `LearningPathsViewModel`/`DevelopmentPlansViewModel`: UM
 * `service` no construtor, SEM `UiAuthorizationPolicy` — nenhuma das três
 * ações de escrita desta tela (registrar sessão, agendar follow-up, virar
 * item de PDI) tem autorização própria no frontend; as três já são
 * inteiramente resolvidas pelo backend (`isLeadOf`/`isAssignedTechLeadOf` no
 * POST, `mentorUserId === user.id || admin` no PATCH — ver
 * `backend/src/modules/mentoring/mentoring.controller.ts`, não alterado
 * nesta PR) e o `store` já resolve cache/reconciliação para as três (nenhuma
 * bypassa `STATE_QUERY_KEY` como o portfólio de `AssessmentViewModel`) — um
 * `store` só já é o "serviço" completo.
 *
 * OO2-05 (backend, commit `8f82d27`) documentou que `MentoringSession` NÃO
 * ganhou métodos de domínio ricos (`scheduleFollowUp()`/`close()`/
 * `recordObservation()` foram cogitados e rejeitados): `patchNextSession` é
 * escrita de campo incondicional, sem invariante de verdade para proteger.
 * O espelho no frontend é igualmente fino de propósito — `scheduleFollowUp`
 * abaixo é uma delegação de uma linha, não porque a extração foi
 * preguiçosa, mas porque não HÁ regra para encapsular (mesmo raciocínio já
 * registrado para `LearningPathsViewModel.removeItem`/`recordProgress`: um
 * ViewModel de tela não exige validação rica para justificar existir, only
 * um agrupamento coerente da ação de negócio — diferente de uma entidade de
 * domínio).
 *
 * As duas checagens de autorização/elegibilidade que a tela hoje computa
 * continuam INLINE, deliberadamente, por serem espelhos 1:1 do backend sem
 * lógica nova (mesmo critério documentado em `learning-paths-view-model.ts`
 * para `canEdit`/`canEditProgress`):
 *  - `isAssignedTechLeadOf(user, mentee)` em `NewMentoringSessionDialog`, que
 *    decide se a seção "Evolução observada" aparece — espelha exatamente a
 *    checagem do POST quando `proficiencyUpdates.length > 0`.
 *  - `session.mentorUserId === user.id || user.role === "admin"` em
 *    `MentoringTimelineItem`, que decide se `FollowUpScheduler` aparece —
 *    espelha exatamente a checagem do PATCH.
 * Trazer uma política pra cá só para essas duas delegarem 1:1 infligiria uma
 * dependência que nenhum método deste ViewModel usa.
 *
 * Escopo desta PR: os três comandos de escrita do arquivo (~834 linhas) —
 * registrar sessão de mentoria (com evolução de proficiência opcional),
 * agendar/limpar follow-up de uma sessão já registrada, e transformar uma
 * sessão em item de PDI a partir de um gap oficial — mais o filtro de
 * elegibilidade que decide QUAL gap (se algum) pode virar esse item.
 * Ficam de fora, deliberadamente — mesma entanglement com o ciclo de render
 * do React já documentada nos seis ViewModels anteriores:
 *  - `useMentoringSessionForm` (diálogo aberto, rascunho dos ~9 campos do
 *    formulário, quais campos estão em vermelho depois de um Salvar
 *    inválido, toast de "preencha os campos obrigatórios") — validação que
 *    destaca campo é decisão de UI (o que RENDERIZA agora), não ação de
 *    negócio; mesma categoria de `TeamViewModel`/`useArchitectForm`. A
 *    conversão de `ProficiencyDraft[]` (rascunho, `observedLevel` pode ser
 *    `null`) para `ProficiencyUpdate[]` (o que a API espera) também fica no
 *    hook, porque só é segura IMEDIATAMENTE depois da checagem "nenhum nulo
 *    sobrou" — mover a conversão pra cá duplicaria essa invariante em dois
 *    lugares em vez de um.
 *  - `useMentoringTimeline` (filtro de mentorado da linha do tempo,
 *    ordenação) — mesma categoria de `curationFilter`/`expandedIds` em
 *    `competency-matrix-view-model.ts`.
 *  - `editing`/`value`/`saving` em `FollowUpScheduler` (campo de data em
 *    edição inline, rascunho antes de confirmar, flag de "ocupado" da
 *    chamada em voo) — mesmo contrato de `saving` em
 *    `CompetencyMatrixViewModel`.
 *  - `sendingSessionId` em `MentoringTimelineItem` (qual sessão está com o
 *    botão "Virar item de PDI" em voo) — mesma categoria de `saving` acima.
 *  - `competencyFilter`/`proficiencyFilter` em `NewMentoringSessionDialog`
 *    (filtro local de competências acima de 20, dois checklists
 *    independentes) — filtro de UI, não ação de negócio.
 */

/**
 * Fatia de `useStore()` que esta tela precisa. OO3-10 — derivada de `Api`
 * (`store.tsx`, agora exportada) via `Pick`, em vez de recopiar as
 * assinaturas à mão: qualquer divergência vira erro de compilação, e
 * `useStore()` satisfaz a forma estruturalmente. (A recópia anterior de
 * `createPlanItemFromGap` já tinha divergido em silêncio: faltava o campo
 * opcional `dedicationHoursPerWeek` que a `Api` real aceita — exatamente o
 * drift que esta derivação elimina.)
 */
export type MentoringService = Pick<
  Api,
  "addMentoringSession" | "scheduleMentoringFollowUp" | "createPlanItemFromGap"
>;

/** Os campos de texto do formulário de nova sessão — `durationMin` fica de fora porque `createSession` recebe o valor já convertido para número (validado por `useMentoringSessionForm` antes de chamar). */
export interface MentoringSessionDraft {
  menteeId: string;
  date: string;
  topic: string;
  notes: string;
  decisions: string;
  actions: string;
  nextSession: string;
}

export class MentoringViewModel {
  constructor(private readonly service: MentoringService) {}

  /**
   * Sem otimismo (mesmo contrato de `TeamViewModel.submit`/
   * `LearningPathsViewModel.createPath`): id sempre vazio — o servidor gera
   * o de verdade (IDOR-002, ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-
   * 19.md). `mentor` é só apresentação — o backend sempre deriva a autoria
   * real (`mentorUserId`) do usuário autenticado, nunca deste campo. Não
   * decide toast nem fecha diálogo — isso é orquestração de UI, fica em
   * `useMentoringSessionForm`.
   */
  createSession(
    mentorName: string,
    form: MentoringSessionDraft,
    durationMin: number,
    competencyIds: string[],
    proficiencyUpdates: ProficiencyUpdate[],
  ): Promise<MentoringSession> {
    return this.service.addMentoringSession(
      {
        id: "",
        mentor: mentorName,
        menteeId: form.menteeId,
        date: form.date,
        durationMin,
        topic: form.topic,
        competencyIds,
        notes: form.notes,
        decisions: form.decisions,
        actions: form.actions,
        ...(form.nextSession ? { nextSession: form.nextSession } : {}),
      },
      proficiencyUpdates,
    );
  }

  /**
   * AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md, EPIC 5 — agendar (ou
   * limpar, `nextSession: null`) o follow-up de uma sessão já registrada.
   * Delegação de uma linha de propósito (ver docstring da classe: espelha o
   * `patchNextSession` do backend, que OO2-05 documentou como escrita de
   * campo incondicional, sem invariante para encapsular aqui também).
   */
  scheduleFollowUp(sessionId: string, nextSession: string | null): Promise<MentoringSession> {
    return this.service.scheduleMentoringFollowUp(sessionId, nextSession);
  }

  /**
   * ORIENTACAO-NONA-RODADA, Seção 12/17.1 (ENT-09-006) — `progressionGapsFor`,
   * nunca `gapsFor` bruta: um gap de Maestria (Nível III) não tem assessment
   * oficial do qual `/from-gap` possa derivar nível/prioridade — o servidor
   * rejeitaria mesmo assim, mas o botão nem deve aparecer. Entre as
   * competências discutidas NA sessão, a primeira que ainda tem gap de
   * progressão ativo e ainda não virou item do PDI — extraído byte a byte do
   * cálculo que já existia solto em `MentoringTimelineItem`, só nomeado.
   */
  eligibleGapForPlan(
    session: Pick<MentoringSession, "competencyIds">,
    gaps: readonly Gap[],
    plan: Pick<DevelopmentPlan, "items"> | undefined,
  ): Gap | undefined {
    return session.competencyIds
      .map((competencyId) => gaps.find((g) => g.item.competencyId === competencyId))
      .find((g) => g && !plan?.items.some((i) => i.competencyId === g.item.competencyId));
  }

  /**
   * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC J /
   * ORIENTACAO-NONA-RODADA, Seção 4/12 (ENT-09-001/006) — fecha o loop da
   * mentoria: "ações" da sessão vira item de PDI de verdade. Único caminho
   * para criar o item a partir de um GAP oficial — `currentLevel`/
   * `targetLevel`/`priority` nunca são calculados aqui, o servidor deriva os
   * três a partir do assessment referenciado por `eligible.assessmentId`.
   * Id nasce no cliente (`pdi-${menteeId}-${competencyId}-${Date.now()}`) —
   * mesmo padrão pré-existente deste sub-recurso, preservado tal como
   * estava (zero mudança de comportamento nesta extração). `eligible` recebe
   * só os dois campos primitivos que este método usa (não o `Gap` inteiro,
   * cujo `competency` é opcional) — o chamador já garantiu que a competência
   * existe antes de chegar aqui (mesmo checkbox que decide se o botão
   * aparece); tipar `eligible` como os dois primitivos já resolvidos evita
   * repetir aqui uma checagem de nulidade que só faz sentido no componente,
   * perto do `eligible?.competency` que decide a renderização.
   */
  sendToPlan(
    session: Pick<MentoringSession, "menteeId" | "topic" | "actions" | "nextSession">,
    mentee: Pick<Architect, "name">,
    eligible: { assessmentId: string; competencyId: string },
  ): Promise<DevelopmentPlan> {
    return this.service.createPlanItemFromGap(session.menteeId, {
      id: `pdi-${session.menteeId}-${eligible.competencyId}-${Date.now()}`,
      assessmentId: eligible.assessmentId,
      competencyId: eligible.competencyId,
      objective: session.topic,
      actionType: "Mentor",
      actionPlan: session.actions,
      startDate: defaultDateFormatter.todayIso(),
      targetDate: session.nextSession ?? defaultDateFormatter.todayIso(),
      owner: mentee.name,
    });
  }
}
