import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  Callout,
  DataOriginCallout,
  EmptyState,
  EmptyStateCallToAction,
  EvaluatorDistributionCard,
  PageHeader,
  PersonCombobox,
  QuerySection,
  SingleSelectFilter,
  StatCard,
  WorkAssistanceSection,
} from "@/components/app";
import { Label } from "@/components/ui/label";
import { useSelectionEmptyState } from "@/components/app/EmptySelection";
import { calibrationApi, workAssistantsApi } from "@/lib/api";
import { Registration } from "@/lib/registration";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { PersonPicker } from "@/lib/person-selection";
import { requireCalibrationReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useStore } from "@/lib/store";
import { CalibrationViewModel } from "@/lib/view-models";

export const Route = createFileRoute("/calibration")({
  head: () => ({
    meta: [
      { title: "Calibração — Synapse" },
      {
        name: "description",
        content:
          "Distribuição de notas por avaliador, lado a lado. Visível para gerentes e administradores (CONTRATO PRD-03).",
      },
    ],
  }),
  beforeLoad: requireCalibrationReach,
  component: CalibrationPage,
});

function useCalibrationViewModel(): CalibrationViewModel {
  return useMemo(() => new CalibrationViewModel(), []);
}

const CARDS_SKELETON = (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <div className="h-64 animate-pulse rounded-md bg-secondary" />
    <div className="h-64 animate-pulse rounded-md bg-secondary" />
    <div className="h-64 animate-pulse rounded-md bg-secondary" />
  </div>
);

const CALIBRATION_CONTEXTS: readonly ContextScopeRequest[] = [
  "professionals",
  "cycles",
  "activeCycle",
];

function CalibrationPage() {
  const { t } = useI18n();
  const help = usePageHelp("calibration");
  const user = useCurrentUser();
  const canCalibrate = defaultUiAuthorizationPolicy.canCalibrate(user);

  if (!canCalibrate) {
    return (
      <>
        <PageHeader
          title={t("calibration.title")}
          description={t("calibration.description")}
          help={help}
        />
        <EmptyState title={t("calibration.restricted")} hint={t("calibration.restrictedHint")} />
      </>
    );
  }

  return (
    <ContextScope contexts={CALIBRATION_CONTEXTS}>
      <CalibrationBoard />
    </ContextScope>
  );
}

function CalibrationBoard() {
  const { t } = useI18n();
  const help = usePageHelp("calibration");
  const vm = useCalibrationViewModel();
  const store = useStore();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [assistedProfessionalId, setAssistedProfessionalId] = useState<string | null>(null);
  /*
   * Bug irmão do banco vazio (dono, 2026-09-08): sem ciclo ativo o servidor
   * responde `activeCycleId: ""`, e o `??` deixava a string VAZIA passar —
   * a tela perguntava por um ciclo que não existe e recebia 404 de negócio,
   * pintado como falha de serviço. Ciclo vazio é ciclo NENHUM.
   */
  const cycleId = selectedCycleId ?? (store.activeCycleId || store.cycles[0]?.id) ?? null;
  // O convite de cadastro pergunta o ALCANCE ao `Registration` — declarar o
  // destino à mão aqui oferecia a porta a quem não a alcança.
  const cicloVazio = useSelectionEmptyState(Registration.CYCLE);

  const query = useQuery({
    queryKey: ["calibration", cycleId],
    queryFn: () => calibrationApi.calibration(cycleId ?? ""),
    enabled: cycleId !== null,
  });

  return (
    <>
      <PageHeader
        title={t("calibration.title")}
        description={t("calibration.description")}
        help={help}
      />

      {cycleId === null ? (
        /*
         * Dono (2026-09-08): os DOIS filtros desta tela ficam bloqueados sem
         * dado; o cadastro de ciclo vai para o centro do quadro principal.
         */
        <EmptyStateCallToAction
          subject={EmptySubject.CYCLE}
          hint={t("calibration.noCycle.hint")}
          registrations={[Registration.CYCLE]}
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <SingleSelectFilter
              id="calibration-cycle"
              label={t("calibration.cycle.label")}
              value={cycleId}
              onChange={setSelectedCycleId}
              options={store.cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
              empty={cicloVazio}
            />
          </div>

          <CalibrationAssistant
            selected={assistedProfessionalId}
            onSelect={setAssistedProfessionalId}
          />

          <QuerySection
            query={query}
            skeleton={CARDS_SKELETON}
            errorMessage={t("calibration.error")}
          >
            {(data) => (
              <>
                <DataOriginCallout origin={data.dataOrigin} className="mb-6" />
                {/*
                 * O aviso é do DADO, não do vazio. Ele morava dentro do ramo
                 * "nenhum avaliador" e por isso sumia justamente no caso que
                 * mais precisa dele: com dado misto, as notas órfãs saem dos
                 * cartões mas continuam contando na "Média geral" — a média
                 * dos avaliadores deixa de fechar com a média geral e nada na
                 * tela explica a diferença. Agora aparece sempre que houver
                 * nota sem autor.
                 */}
                {(data.unattributed?.itemsCount ?? 0) > 0 && (
                  <Callout tone="warning" className="mb-6">
                    <strong>{t("calibration.unattributed.title")}</strong>{" "}
                    {t("calibration.unattributed.hint", {
                      n: data.unattributed?.itemsCount ?? 0,
                    })}
                  </Callout>
                )}
                {data.evaluators.length === 0 ? (
                  (data.unattributed?.itemsCount ?? 0) > 0 ? null : (
                    <EmptyState title={t("calibration.empty")} hint={t("calibration.emptyHint")} />
                  )
                ) : (
                  <>
                    <div className="mb-6 grid gap-4 sm:grid-cols-3">
                      <StatCard
                        label={t("calibration.kpi.overallAverage")}
                        value={
                          data.overall.average === null ? "—" : data.overall.average.toFixed(2)
                        }
                      />
                      <StatCard
                        label={t("calibration.kpi.evaluators")}
                        value={String(data.evaluators.length)}
                      />
                      <StatCard
                        label={t("calibration.kpi.assessments")}
                        value={String(
                          data.evaluators.reduce((sum, entry) => sum + entry.assessmentsCount, 0),
                        )}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {vm.evaluators(data).map((view) => (
                        <EvaluatorDistributionCard
                          key={view.userId}
                          view={view}
                          scoreLevels={vm.scoreLevels(view.distribution)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </QuerySection>
        </>
      )}
    </>
  );
}

/**
 * A ponte entre uma tela POR CICLO e uma rota POR PESSOA
 * (`/professionals/:id/calibration-assistance`).
 *
 * O seletor é explícito de propósito: a tela poderia escolher alguém sozinha —
 * o primeiro do roster, o de maior divergência — e escolher a pessoa errada
 * numa tela de calibração é pior do que não sugerir nada. Enquanto ninguém
 * escolhe, não há botão: é a mesma recusa de sempre, a aplicação não desenha
 * quando não sabe.
 */
function CalibrationAssistant({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (professionalId: string | null) => void;
}) {
  const { t } = useI18n();
  const store = useStore();
  const user = useCurrentUser();
  return (
    <div className="mb-6">
      <div className="mb-4 max-w-xs">
        <Label htmlFor="calibration-assistance-professional">{t("ai.calibration.person")}</Label>
        <PersonCombobox
          id="calibration-assistance-professional"
          picker={PersonPicker.one(
            defaultUiAuthorizationPolicy.mentorableBy(user, store.professionals),
            selected,
          )}
          onChange={([id]) => onSelect(id ?? null)}
          label={t("ai.calibration.person")}
          placeholder={t("ai.calibration.personNone")}
          className="mt-1"
        />
      </div>
      {selected !== null && (
        <WorkAssistanceSection
          title={t("ai.calibration.title")}
          description={t("ai.calibration.subtitle")}
          actionLabel={t("ai.calibration.action")}
          queryKey={["assistants", "calibration-assistance", selected]}
          ask={() => workAssistantsApi.assistAssessmentCalibration(selected)}
        />
      )}
    </div>
  );
}
