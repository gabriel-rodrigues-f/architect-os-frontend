import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  Callout,
  CareerEventTimeline,
  EmptyState,
  MultiSelectFilter,
  ProfileBackLink,
  ProfileHeading,
  SingleSelectFilter,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useToastSubmit } from "@/hooks";
import { api, evolutionApi, reportsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadBlob } from "@/lib/download";
import type { EvolutionFilters } from "@/lib/domain";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { defaultCareerFileReach } from "@/lib/person-listing";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { Selection } from "@/lib/selection";
import { useSelectors, useStore } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import {
  CareerStatementViewModel,
  type StatementEntryKind,
  type StatementPeriodPreset,
} from "@/lib/view-models";

export const Route = createFileRoute("/professionals/$professionalId/statement")({
  head: () => ({
    meta: [
      { title: "Extrato de Carreira — Synapse" },
      {
        name: "description",
        content:
          "Extrato de carreira: transições de nível e de time, degraus, PDIs e mentorias em ordem cronológica, gerado pelo líder.",
      },
    ],
  }),
  component: StatementOfProfessional,
});

const STATEMENT_KINDS: readonly StatementEntryKind[] = [
  "transition",
  "teamTransition",
  "competencyStep",
  "pdi",
  "mentoring",
];

const KIND_LABEL_KEY: Record<StatementEntryKind, MessageKey> = {
  transition: "statement.kind.transition",
  teamTransition: "statement.kind.teamTransition",
  competencyStep: "statement.kind.competencyStep",
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

function StatementOfProfessional() {
  const { professionalId } = Route.useParams();
  const store = useStore();
  const sel = useSelectors();
  const { t, locale } = useI18n();
  const help = usePageHelp("professionalStatement");
  const { user } = useAuth();
  const router = useRouter();
  const vm = useCareerStatementViewModel();
  const professional = sel.professionalById(professionalId);

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
    queryKey: ["career-level-transitions", professionalId],
    queryFn: () => api.careerLevelTransitions(professionalId),
    enabled: professional !== undefined,
  });
  const teamTransitionsQuery = useQuery({
    queryKey: ["statement-team-transitions", professionalId],
    queryFn: () => reportsApi.teamTransitionsOf(professionalId, allTimeFilters.range),
    enabled: professional !== undefined,
  });
  const stepsQuery = useQuery({
    queryKey: ["statement-steps", professionalId],
    queryFn: () => evolutionApi.professional(professionalId, allTimeFilters),
    enabled: professional !== undefined,
  });
  /*
   * AS DUAS FONTES QUE VÊM DO ESTADO DO CLIENTE, e não de uma consulta desta
   * tela: o PDI e a mentoria. As duas são listagens por pessoa, e elas passaram
   * a responder `200 []` a quem não alcança a pessoa. Vazias, sumiam da linha
   * do tempo em SILÊNCIO — o `Promise.all([])` do PDI resolve sem erro, então
   * o aviso de falha parcial nunca disparava, e a mentoria nem consulta tem.
   * Metade da história virava a história inteira.
   */
  const ownPlans = useMemo(
    () => store.plans.filter((plan) => plan.professionalId === professionalId),
    [store.plans, professionalId],
  );
  const ownMentoring = useMemo(
    () => store.mentoringSessions.filter((session) => session.menteeId === professionalId),
    [store.mentoringSessions, professionalId],
  );
  const plansListing = defaultCareerFileReach.listingOf(user, professional, ownPlans);
  const mentoringListing = defaultCareerFileReach.listingOf(user, professional, ownMentoring);
  const plans = plansListing.items;
  const planEventsQuery = useQuery({
    queryKey: ["statement-plan-events", professionalId, plans.map((plan) => plan.id).join(",")],
    queryFn: () =>
      Promise.all(plans.map((plan) => api.planEvents(plan.id))).then((lists) => lists.flat()),
    enabled: professional !== undefined,
  });

  const { submitting: exporting, run: runExport } = useToastSubmit(t("evolution.export.error"));

  const entries = useMemo(
    () =>
      vm.entries({
        professionalId,
        transitions: transitionsQuery.data ?? [],
        teamTransitions: teamTransitionsQuery.data ?? [],
        competencyEvents: stepsQuery.data?.events ?? [],
        planEvents: planEventsQuery.data ?? [],
        mentoringSessions: ownMentoring,
      }),
    [
      vm,
      professionalId,
      transitionsQuery.data,
      teamTransitionsQuery.data,
      stepsQuery.data,
      planEventsQuery.data,
      ownMentoring,
    ],
  );

  if (!professional) {
    return (
      <div className="surface-card p-6 text-sm">
        {t("arch.notFound")}{" "}
        <Link to="/team" className="text-primary underline">
          {t("arch.back")}
        </Link>
      </div>
    );
  }

  // O extrato carrega a ficha funcional: a própria pessoa, o gerente designado,
  // o admin em suporte (revisão de papéis, 2026-09-05). O tech lead não.
  const canGenerate =
    user !== null && defaultUiAuthorizationPolicy.canOpenStatementOf(user, professional);

  const exportPdf = async () => {
    const result = await runExport(() =>
      reportsApi.exportEvolutionPdf(professionalId, allTimeFilters),
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
    { query: teamTransitionsQuery, labelKey: "statement.source.teamTransitions" as const },
    { query: stepsQuery, labelKey: "statement.source.steps" as const },
    { query: planEventsQuery, labelKey: "statement.source.pdiEvents" as const },
  ];
  const pending = sources.some((source) => source.query.isPending);
  const failures = sources.filter((source) => source.query.isError);
  /** As fontes que a tela não pode garantir — vazias sem que ela saiba por quê. */
  const unconfirmed = [
    { listing: plansListing, labelKey: "statement.source.pdiEvents" as const },
    { listing: mentoringListing, labelKey: "statement.source.mentoring" as const },
  ].filter((source) => !source.listing.isKnown);

  return (
    <>
      <div>
        <ProfileHeading
          help={help}
          title={t("statement.title", { nome: professional.name })}
          description={t("statement.description")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canGenerate && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={exporting}
                  onClick={() => void exportPdf()}
                >
                  {exporting ? t("evolution.export.generating") : t("evolution.export.button")}
                </Button>
              )}
              <ProfileBackLink professionalId={professional.id} to="overview" />
            </div>
          }
        />

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
            empty={{ message: t("statement.filters.period.empty") }}
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
            empty={{ message: t("statement.filters.kinds.empty") }}
          />
        </div>

        {unconfirmed.length > 0 && (
          <Callout tone="warning" className="mb-3">
            {t("statement.outOfReach", {
              fontes: unconfirmed.map((source) => t(source.labelKey)).join(", "),
            })}
          </Callout>
        )}

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
        <EmptyState
          title={EmptySubject.EVENT.titleIn(t, "empty.context.inPeriod")}
          hint={t("statement.emptyHint")}
        />
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
