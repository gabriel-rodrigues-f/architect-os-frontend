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
  QuerySection,
  ScrollPane,
  SingleSelectFilter,
  StatCard,
} from "@/components/app";
import { useSelectionEmptyState } from "@/components/app/EmptySelection";
import { calibrationApi, teamsApi } from "@/lib/api";
import { Registration } from "@/lib/registration";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import { PaneHeight } from "@/lib/design";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireCalibrationReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useStore } from "@/lib/store";
import { CalibrationViewModel, TeamNames } from "@/lib/view-models";

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

/**
 * O nome do time vem de `GET /teams` — a listagem mínima que existe
 * exatamente para o frontend NOMEAR times (matriz de permissão, justificativa
 * de `GET /teams`). Antes desta fatia a tela mostrava `teamIds` cru, e o dono
 * lia `seed-completo-time-dados` no lugar de "Dados e Inteligência": os nomes
 * existiam, a tela é que não os buscava.
 *
 * Ela mora ABAIXO do ramo que nega a tela (`!canCalibrate`), e não por
 * estética: quem não calibra nunca monta o `CalibrationBoard`, então esta
 * consulta não sai em nome dele. A catraca de alcance por rota lê a ORDEM do
 * arquivo, e aqui a ordem do arquivo é a verdade da execução.
 *
 * A consulta é de apoio, não de conteúdo: se ela não responder, o cartão fica
 * sem a linha do time — o que a tela nunca faz é voltar a mostrar o
 * identificador.
 */
function useCalibrationViewModel(): CalibrationViewModel {
  const teams = useQuery({ queryKey: ["teams"], queryFn: teamsApi.teams, staleTime: 60_000 });
  const rosterOfTeams = teams.data;
  return useMemo(
    () => new CalibrationViewModel(TeamNames.of(rosterOfTeams ?? [])),
    [rosterOfTeams],
  );
}

function CalibrationBoard() {
  const { t } = useI18n();
  const help = usePageHelp("calibration");
  const vm = useCalibrationViewModel();
  const store = useStore();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
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
         * Dono (2026-09-08): o filtro desta tela fica bloqueado sem dado; o
         * cadastro de ciclo vai para o centro do quadro principal. Eram DOIS
         * até 2026-09-10, quando a leitura de apoio à calibração saiu do
         * produto e levou junto o seletor de pessoa que só existia para
         * alimentá-la (ADR-0103 do backend). O de ciclo é da tela, e fica.
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
                    <ScrollPane
                      label={t("pane.calibrationCharts.label")}
                      height={PaneHeight.restOfPage()}
                    >
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {vm.evaluators(data).map((view) => (
                          <EvaluatorDistributionCard
                            key={view.userId}
                            view={view}
                            scoreLevels={vm.scoreLevels(view.distribution)}
                            overallAverageLabel={vm.overallAverageLabel(data)}
                            thresholdLabel={vm.thresholdLabel()}
                          />
                        ))}
                      </div>
                    </ScrollPane>
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
