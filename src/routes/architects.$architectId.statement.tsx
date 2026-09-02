import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  Callout,
  CareerEventTimeline,
  EmptyState,
  MultiSelectFilter,
  OutOfReachScreen,
  PageHeader,
  ProfileTabs,
  SingleSelectFilter,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useToastSubmit } from "@/hooks";
import { api, evolutionApi, reportsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadBlob } from "@/lib/download";
import type { EvolutionFilters } from "@/lib/domain";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireCareerFileReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { Selection } from "@/lib/selection";
import { useSelectors, useStore } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import {
  CareerStatementViewModel,
  type StatementEntryKind,
  type StatementPeriodPreset,
} from "@/lib/view-models";

export const Route = createFileRoute("/architects/$architectId/statement")({
  head: () => ({
    meta: [
      { title: "Extrato de Carreira — Synapse" },
      {
        name: "description",
        content:
          "Extrato de carreira: transições, degraus, evidências, PDIs e mentorias em ordem cronológica, gerado pelo líder.",
      },
    ],
  }),
  beforeLoad: requireCareerFileReach,
  component: ArchitectStatement,
});

function ArchitectStatement() {
  const { architectId } = Route.useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const help = usePageHelp("architectStatement");
  const canOpenCareerFile =
    user !== null && defaultUiAuthorizationPolicy.canOpenCareerFileOf(user, architectId);

  if (!canOpenCareerFile) {
    return (
      <OutOfReachScreen
        title={t("arch.tabs.statement")}
        help={help}
        reason={t("arch.careerFile.ownOutOfReach")}
        hint={t("arch.careerFile.ownOutOfReachHint")}
      />
    );
  }

  return <StatementOfArchitect architectId={architectId} />;
}

const STATEMENT_KINDS: readonly StatementEntryKind[] = [
  "transition",
  "competencyStep",
  "evidence",
  "pdi",
  "mentoring",
];

const KIND_LABEL_KEY: Record<StatementEntryKind, MessageKey> = {
  transition: "statement.kind.transition",
  competencyStep: "statement.kind.competencyStep",
  evidence: "statement.kind.evidence",
  pdi: "statement.kind.pdi",
  mentoring: "statement.kind.mentoring",
};

const PERIOD_OPTION_KEY: Record<StatementPeriodPreset, MessageKey> = {
  "90": "evolution.period.last90",
  "180": "evolution.period.last180",
  "365": "evolution.period.last365",
  all: "evolution.period.all",
};

const FEED_SKELETON = <div className="h-40 animate-pulse rounded-md bg-secondary" />;

function useCareerStatementViewModel(): CareerStatementViewModel {
  const sel = useSelectors();
  const { t } = useI18n();
  return useMemo(
    () => new CareerStatementViewModel(t, (id) => sel.competencyById(id)?.name),
    [t, sel],
  );
}

function StatementOfArchitect({ architectId }: { architectId: string }) {
  const store = useStore();
  const sel = useSelectors();
  const { t, locale } = useI18n();
  const help = usePageHelp("architectStatement");
  const { user } = useAuth();
  const router = useRouter();
  const vm = useCareerStatementViewModel();
  const architect = sel.architectById(architectId);

  const [preset, setPreset] = useState<StatementPeriodPreset>("all");
  const [kinds, setKinds] = useState<string[]>([...STATEMENT_KINDS]);

  const allTimeFilters = useMemo(
    (): EvolutionFilters => ({
      range: vm.rangeForPreset("all"),
      capabilities: Selection.allVisible().toScope(),
      competencies: Selection.allVisible().toScope(),
      source: "ALL",
    }),
    [vm],
  );

  const transitionsQuery = useQuery({
    queryKey: ["career-level-transitions", architectId],
    queryFn: () => api.careerLevelTransitions(architectId),
    enabled: architect !== undefined,
  });
  const stepsQuery = useQuery({
    queryKey: ["statement-steps", architectId],
    queryFn: () => evolutionApi.architect(architectId, allTimeFilters),
    enabled: architect !== undefined,
  });
  const plans = store.plans.filter((plan) => plan.architectId === architectId);
  const planEventsQuery = useQuery({
    queryKey: ["statement-plan-events", architectId, plans.map((plan) => plan.id).join(",")],
    queryFn: () =>
      Promise.all(plans.map((plan) => api.planEvents(plan.id))).then((lists) => lists.flat()),
    enabled: architect !== undefined,
  });

  const { submitting: exporting, run: runExport } = useToastSubmit(t("evolution.export.error"));

  const entries = useMemo(
    () =>
      vm.entries({
        architectId,
        transitions: transitionsQuery.data ?? [],
        competencyEvents: stepsQuery.data?.events ?? [],
        evidences: store.evidences.filter((evidence) => evidence.architectId === architectId),
        planEvents: planEventsQuery.data ?? [],
        mentoringSessions: store.mentoringSessions.filter(
          (session) => session.menteeId === architectId,
        ),
      }),
    [vm, architectId, transitionsQuery.data, stepsQuery.data, planEventsQuery.data, store],
  );

  if (!architect) {
    return (
      <div className="surface-card p-6 text-sm">
        {t("arch.notFound")}{" "}
        <Link to="/team" className="text-primary underline">
          {t("arch.back")}
        </Link>
      </div>
    );
  }

  const canGenerate = user !== null && defaultUiAuthorizationPolicy.isLeadOf(user, architect);

  const exportPdf = async () => {
    const result = await runExport(() =>
      reportsApi.exportEvolutionPdf(architectId, allTimeFilters),
    );
    if (!result.ok) return;
    downloadBlob(result.value.blob, result.value.filename);
  };

  const filtered = vm.filterByRange(
    vm.filterByKinds(entries, kinds as StatementEntryKind[]),
    vm.rangeForPreset(preset),
  );
  const groups = vm.groupByYear(filtered);

  const sources = [
    { query: transitionsQuery, labelKey: "statement.source.transitions" as const },
    { query: stepsQuery, labelKey: "statement.source.steps" as const },
    { query: planEventsQuery, labelKey: "statement.source.pdiEvents" as const },
  ];
  const pending = sources.some((source) => source.query.isPending);
  const failures = sources.filter((source) => source.query.isError);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          help={help}
          title={t("statement.title", { nome: architect.name })}
          description={t("statement.description")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canGenerate && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => window.print()}>
                    {t("statement.print")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={exporting}
                    onClick={() => void exportPdf()}
                  >
                    {exporting ? t("evolution.export.generating") : t("evolution.export.button")}
                  </Button>
                </>
              )}
              <Link
                to="/architects/$architectId"
                params={{ architectId }}
                className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
              >
                {t("arch.back")}
              </Link>
            </div>
          }
        />
        <ProfileTabs architectId={architect.id} active="statement" />

        <div className="mb-6 flex flex-wrap items-end gap-4">
          <SingleSelectFilter
            id="statement-period"
            label={t("evolution.filters.period")}
            value={preset}
            onChange={(value) => setPreset(value as StatementPeriodPreset)}
            options={Object.entries(PERIOD_OPTION_KEY).map(([value, labelKey]) => ({
              value,
              label: t(labelKey),
            }))}
          />
          <MultiSelectFilter
            id="statement-kinds"
            label={t("statement.filters.kinds")}
            options={STATEMENT_KINDS.map((kind) => ({
              id: kind,
              label: t(KIND_LABEL_KEY[kind]),
            }))}
            selected={kinds}
            onChange={setKinds}
            selectAllLabel={t("statement.filters.all")}
            allSummaryLabel={t("statement.filters.all")}
            noneSummaryLabel={t("statement.filters.none")}
          />
        </div>

        {failures.map((source) => (
          <Callout key={source.labelKey} tone="warning" className="mb-3">
            <span>{t("statement.partialError", { source: t(source.labelKey) })}</span>{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => void source.query.refetch()}
            >
              {t("common.retry")}
            </button>
          </Callout>
        ))}
      </div>

      {pending && FEED_SKELETON}
      {!pending && groups.length === 0 ? (
        <EmptyState title={t("statement.empty")} hint={t("statement.emptyHint")} />
      ) : (
        <CareerEventTimeline
          groups={groups}
          metaOf={(entry) => defaultDateFormatter.formatDate(entry.date, locale) ?? undefined}
          onOpen={(entry) => {
            if (entry.link !== null) router.history.push(entry.link);
          }}
        />
      )}
    </>
  );
}
