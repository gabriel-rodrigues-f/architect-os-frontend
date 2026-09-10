import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import {
  CapabilityAssessmentCard,
  ConfirmDialog,
  EmptyStateCallToAction,
  PageHeader,
  PersonCombobox,
  ScrollPane,
  SectionCard,
  useAssessmentPermissions,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import type { Assessment } from "@/lib/domain";
import { ContextScope, type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { UserFacingError } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { PaneHeight } from "@/lib/design";
import { PersonPicker } from "@/lib/person-selection";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { Registration } from "@/lib/registration";
import { useSelectors, useStore } from "@/lib/store";
import { useCycleInFocus, useSearchParamString } from "@/hooks";

const assessmentsSearchSchema = z.object({
  professionalId: z.string().optional(),
  cycleId: z.string().optional(),
});

export const Route = createFileRoute("/assessments")({
  validateSearch: assessmentsSearchSchema,
  head: () => ({
    meta: [
      { title: "Avaliação de Desempenho — Synapse" },
      {
        name: "description",
        content: "Autoavaliação, avaliação do Tech Lead, nível alvo e nível final por competência.",
      },
      { property: "og:title", content: "Avaliação de Desempenho — Synapse" },
      {
        property: "og:description",
        content:
          "Conduza assessments de competências com comentários do profissional e do Tech Lead.",
      },
    ],
  }),
  component: AssessmentsPage,
});

const ASSESSMENTS_CONTEXTS: readonly ContextScopeRequest[] = [...SELECTOR_CONTEXTS, "cycles"];

function AssessmentsPage() {
  return (
    <ContextScope contexts={ASSESSMENTS_CONTEXTS}>
      <AssessmentsScreen />
    </ContextScope>
  );
}

/**
 * A TELA SIMPLIFICA — dono (2026-09-10): *"A tela está confusa. Vamos
 * simplificar ela. A ordem agora é simplificar."*
 *
 * O que saiu, e por quê:
 *
 * - **O filtro de capacidades.** Escolher o que ver era um passo antes de
 *   ver: *"Todas as capacidades listadas."* Sem escolha não há paginação de
 *   capacidade, não há aviso de "muitas selecionadas", não há botão
 *   "selecionar as do portfólio" e não há estado vazio de "nenhuma capacidade
 *   selecionada" — quatro blocos que só existiam para administrar a escolha.
 * - **O bloco de situação.** Ele mostrava o selo do estado e três botões. Com
 *   dois estados e duas transições, o selo não informa e o que restou de ato
 *   sobe para o cabeçalho, ao lado do filtro de pessoa.
 * - **"Enviar para revisão".** *"Não deve haver revisão nessa tela. Quem
 *   fizer a avaliação já conclui."* Não é um botão escondido: a etapa saiu da
 *   máquina de estados (backend, `AssessmentStatus`).
 * - **O Portfólio de Capacidades do Ciclo**, inteiro.
 *
 * O que entrou: UM bloco, do título ao pé da página, que rola por dentro
 * (`ScrollPane` + `PaneHeight.restOfPage()`), com uma capacidade por cartão e
 * a tabela de competências dentro dela. A altura não é chutada — a caixa é o
 * filho que ocupa o que sobra da coluna, e o navegador mede.
 */
function AssessmentsScreen() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const assessable = defaultUiAuthorizationPolicy.assessableBy(user, store.professionals);
  const [professionalId, setProfessionalId] = useSearchParamString(
    "professionalId",
    () => assessable[0]?.id ?? "",
  );

  /*
   * Dono (2026-09-08): *"quando mudo um ciclo, ainda vejo a mesma avaliação de
   * desempenho."* Uma avaliação pertence a UM ciclo, e quem manda no ciclo é o
   * seletor do cabeçalho; o `?cycleId=` do link do histórico (HIST-001) diz por
   * onde a tela entra e vale até a primeira troca. A regra mora em
   * `CycleInFocus`.
   */
  const cycleId = useCycleInFocus(store.activeCycleId);
  const isActiveCycle = cycleId === store.activeCycleId;
  const viewedCycle = store.cycles.find((c) => c.id === cycleId);
  const { t } = useI18n();
  const help = usePageHelp("assessments");
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);

  const assessment = sel.assessmentFor(professionalId, cycleId);
  const selectedProfessional = sel.professionalById(professionalId);

  const {
    status,
    canOpen,
    canEditSelf,
    canEditLeaderFinal,
    canComment,
    canComplete,
    canReopen,
    incompleteSelf,
    incompleteLeaderFinal,
    seesAssessmentNumbers,
    completion,
  } = useAssessmentPermissions(professionalId, selectedProfessional, assessment);

  /*
   * Dono (2026-09-08): com o banco vazio esta tela mostra DOIS botões no
   * centro — "Cadastrar Profissional" e "Cadastrar Capacidade" —, e só os
   * dos assuntos que de fato faltam: cadastrar gente não é o próximo passo
   * de quem já tem gente e não tem catálogo.
   */
  const cadastrosQueFaltam = [
    ...(store.professionals.length === 0 ? [Registration.PROFESSIONAL] : []),
    ...(store.capabilities.length === 0 ? [Registration.CAPABILITY] : []),
  ];
  /*
   * A LINHA 1 é a do PRIMEIRO assunto que falta — "Nenhum profissional
   * cadastrado" quando não há gente, "Nenhuma capacidade cadastrada" quando
   * só falta o catálogo. Quem sabe a frase é o assunto; a tela só sabe qual
   * assunto está vazio.
   */
  const primeiroQueFalta = cadastrosQueFaltam[0];

  const transition = (nextStatus: Assessment["status"]) => {
    if (!assessment) return;
    setTransitionError(null);
    setTransitioning(true);
    store
      .setAssessmentStatus(assessment.id, nextStatus)
      .catch((error: unknown) =>
        setTransitionError(
          error instanceof UserFacingError
            ? error.message
            : t(nextStatus === "Completed" ? "asmt.completeError" : "asmt.reopenError"),
        ),
      )
      .finally(() => setTransitioning(false));
  };

  const completionBlocked = incompleteSelf || incompleteLeaderFinal;

  return (
    <>
      <PageHeader
        title={t("asmt.title")}
        description={t("asmt.subtitle")}
        help={help}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PersonCombobox
              picker={PersonPicker.oneFor(user, assessable, professionalId)}
              onChange={([id]) => setProfessionalId(id ?? "")}
              label={t("asmt.professional")}
              className="w-56"
            />
            {canComplete && (
              <Button
                size="sm"
                disabled={transitioning || completionBlocked}
                title={incompleteSelf ? t("asmt.incompleteSelf") : undefined}
                onClick={() => setConfirmingCompletion(true)}
              >
                {transitioning ? t("asmt.completing") : t("asmt.complete")}
              </Button>
            )}
            {canReopen && (
              <Button
                size="sm"
                variant="outline"
                disabled={transitioning}
                onClick={() => transition("Draft")}
              >
                {transitioning ? t("asmt.reopening") : t("asmt.reopen")}
              </Button>
            )}
          </div>
        }
      />

      {!isActiveCycle && (
        <p className="mb-3 text-xs text-muted-foreground">
          {t("asmt.historicalCycle", { cycle: viewedCycle?.name ?? cycleId })}
        </p>
      )}

      {/*
       * O QUE FALTA PARA CONCLUIR fica ao lado do que se conclui — sem selo de
       * estado e sem moldura própria. É a única linha do antigo bloco de
       * situação que dizia algo que a pessoa não conseguia ver sozinha.
       */}
      {canComplete && incompleteSelf && (
        <p className="mb-3 text-xs text-muted-foreground">{t("asmt.incompleteSelf")}</p>
      )}
      {canComplete && !incompleteSelf && incompleteLeaderFinal && (
        <p className="mb-3 text-xs text-muted-foreground">
          {t("asmt.incompleteLeaderFinal.pending", {
            lista: completion.pendingLeaderFinal.map((competency) => competency.name).join(", "),
          })}
        </p>
      )}
      {transitionError && (
        <p className="mb-3 text-xs text-destructive" role="alert">
          {transitionError}
        </p>
      )}

      {assessment && canComplete && (
        <ConfirmDialog
          open={confirmingCompletion}
          destructive={false}
          title={t("asmt.completeConfirm.title", { nome: selectedProfessional?.name ?? "" })}
          description={t("asmt.completeConfirm.summary", {
            nome: selectedProfessional?.name ?? "",
            competencias:
              completion.competencyCount === 1
                ? t("asmt.competencyCount.one")
                : t("asmt.competencyCount.many", { n: completion.competencyCount }),
            divergencia:
              completion.divergentCount === 0
                ? t("asmt.completeConfirm.divergence.none")
                : t("asmt.completeConfirm.divergence.some", { d: completion.divergentCount }),
          })}
          confirmLabel={t("asmt.completeConfirm.confirm")}
          onConfirm={() => {
            setConfirmingCompletion(false);
            transition("Completed");
          }}
          onCancel={() => setConfirmingCompletion(false)}
        />
      )}

      {primeiroQueFalta ? (
        <EmptyStateCallToAction
          subject={primeiroQueFalta.emptySubject}
          hint={t("asmt.empty.hint")}
          registrations={cadastrosQueFaltam}
        />
      ) : !assessment ? (
        /*
         * Dono (2026-09-08): *"acessando como profissional, não posso ver um
         * botão de 'Abrir avaliação do ciclo'; consequentemente não verei a
         * mensagem em vermelho acima. Verei dados de avaliação nesta tela
         * quando estas forem realizadas."* Para quem não abre, as duas linhas
         * do vazio dizem só isso — sem convite, e sem o vermelho, que é a
         * recusa do serviço a um ato que nunca deveria ter sido oferecido.
         */
        <SectionCard
          title={EmptySubject.ASSESSMENT.titleIn(t, "empty.context.inThisCycle")}
          description={canOpen ? t("asmt.noAssessment.subtitle") : t("asmt.noAssessment.readOnly")}
        >
          {selectedProfessional && !selectedProfessional.active ? (
            <p className="text-sm text-muted-foreground">{t("asmt.noAssessment.inactive")}</p>
          ) : !isActiveCycle ? (
            <p className="text-sm text-muted-foreground">
              {t("asmt.noAssessment.historicalCycle", { cycle: viewedCycle?.name ?? cycleId })}
            </p>
          ) : !canOpen ? null : (
            <>
              <p className="text-sm text-muted-foreground">{t("asmt.noAssessment.openExplain")}</p>
              {openError && <p className="mt-2 text-sm text-destructive">{openError}</p>}
              <Button
                className="mt-4"
                disabled={opening || !professionalId || !store.activeCycleId}
                onClick={() => {
                  setOpenError(null);
                  setOpening(true);
                  store
                    .openAssessment(professionalId, store.activeCycleId)
                    .catch((error: unknown) =>
                      setOpenError(
                        error instanceof UserFacingError ? error.message : t("asmt.openError"),
                      ),
                    )
                    .finally(() => setOpening(false));
                }}
              >
                {opening ? t("asmt.opening") : t("asmt.open")}
              </Button>
            </>
          )}
        </SectionCard>
      ) : (
        <ScrollPane
          label={t("asmt.allCapabilities")}
          height={PaneHeight.restOfPage()}
          className="space-y-4"
        >
          {store.capabilities.map((capability) => (
            <CapabilityAssessmentCard
              key={capability.id}
              capability={capability}
              assessment={assessment}
              status={status}
              canEditSelf={canEditSelf}
              canEditLeaderFinal={canEditLeaderFinal}
              canComment={canComment}
              seesAssessmentNumbers={seesAssessmentNumbers}
              openComment={openComment}
              onToggleComment={(id) => setOpenComment((prev) => (prev === id ? null : id))}
            />
          ))}
        </ScrollPane>
      )}
    </>
  );
}
