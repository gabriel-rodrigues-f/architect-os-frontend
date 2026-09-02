import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  Callout,
  type CardsOrTable,
  EmptyState,
  PageHeader,
  SectionCard,
  useCardsAndTableViews,
  ViewToggle,
} from "@/components/app";
import { Badge } from "@/components/ui/badge";
import type { Architect } from "@/lib/domain";
import { CapabilityCoveragePresenter, type RiskState } from "@/lib/presenters";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useScoringBands, useSelectors, useStore } from "@/lib/store";
import { defaultNameFormatter } from "@/lib/text";

export const Route = createFileRoute("/capability-map")({
  head: () => ({
    meta: [
      { title: "De quem o time depende — Synapse" },
      {
        name: "description",
        content:
          "Mapa das capacidades técnicas disponíveis no time de arquitetura, com risco de concentração e competências em evolução.",
      },
      { property: "og:title", content: "De quem o time depende — Synapse" },
      {
        property: "og:description",
        content:
          "Onde há concentração de conhecimento, dependência de pessoas e ausência de referência técnica.",
      },
    ],
  }),
  component: CapabilityMapPage,
});

function CapabilityMapPage() {
  const store = useStore();
  const sel = useSelectors();
  const { t } = useI18n();
  const help = usePageHelp("capabilityMap");
  const [viewOverride, setViewOverride] = useState<CardsOrTable | null>(null);
  const cardsAndTableViews = useCardsAndTableViews();

  const population = sel.activeArchitects;

  const scoringBands = useScoringBands();

  const presenter = useMemo(
    () => new CapabilityCoveragePresenter(store.capabilities, sel.capabilityAverages, scoringBands),
    [store.capabilities, sel, scoringBands],
  );
  const withRisk = presenter.areas(population);
  const exposed = withRisk.filter(
    (area) => area.risk === "concentrationRisk" || area.risk === "noReference",
  );

  const view: CardsOrTable = viewOverride ?? (withRisk.length > 8 ? "table" : "cards");

  return (
    <>
      <PageHeader title={t("cap.title")} description={t("cap.subtitle")} help={help} />

      {store.capabilities.length === 0 ? (
        <EmptyState title={t("cap.empty.title")} hint={t("cap.empty.hint")} />
      ) : population.length === 0 ? (
        <EmptyState title={t("cap.empty.noScope.title")} hint={t("cap.empty.noScope.hint")} />
      ) : (
        <>
          {exposed.length > 0 && <NextStepCallout exposedCount={exposed.length} />}

          <div className="mb-3 flex justify-end">
            <ViewToggle view={view} onChange={setViewOverride} options={cardsAndTableViews} />
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {view === "table" ? (
              <div className="surface-card overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-4 py-3">
                        {t("col.capability")}
                      </th>
                      {presenter.bands.map((band) => (
                        <th key={band.key} scope="col" className="px-4 py-3 text-center">
                          {t(band.labelKey)}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-3 text-center">
                        {t("cap.table.col.notAssessed")}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t("cap.table.col.risk")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {withRisk.map((area) => (
                      <tr key={area.cat.id} className="border-b border-border/60 last:border-0">
                        <td
                          className="max-w-[220px] truncate px-4 py-3 font-medium"
                          title={area.cat.name}
                        >
                          {area.cat.name}
                        </td>
                        {area.bands.map((band) => (
                          <td key={band.key} className="px-4 py-3 text-center tabular-nums">
                            {band.people.length}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center tabular-nums">{area.notAssessed}</td>
                        <td className="px-4 py-3">
                          <RiskBadge risk={area.risk} referenceCount={area.references.length} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {withRisk.map((area) => (
                  <SectionCard
                    key={area.cat.id}
                    title={area.cat.name}
                    description={t(`cap.risk.${area.risk}`, { n: area.references.length })}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {area.bands.map((band) => (
                        <Group
                          key={band.key}
                          label={t(band.labelKey)}
                          people={band.people.map((p) => p.architect)}
                          tone={band.tone}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t("cap.references.label")}{" "}
                      <ProfileLinkList people={area.references.map((p) => p.architect)} />
                    </p>
                    {area.notAssessed > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("cap.notAssessed", { n: area.notAssessed })}
                      </p>
                    )}
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function RiskBadge({ risk, referenceCount }: { risk: RiskState; referenceCount: number }) {
  const { t } = useI18n();
  const variant =
    risk === "concentrationRisk"
      ? "destructive"
      : risk === "noReference" || risk === "insufficientData"
        ? "secondary"
        : "outline";
  return (
    <Badge variant={variant} title={t(`cap.risk.${risk}`, { n: referenceCount })}>
      {t(`cap.risk.badge.${risk}`)}
    </Badge>
  );
}

function Group({
  label,
  people,
  tone,
}: {
  label: string;
  people: readonly Architect[];
  tone: string;
}) {
  return (
    <div className="surface-inset p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className={`rounded-md px-1.5 text-xs font-semibold tabular-nums ${tone}`}>
          {people.length}
        </span>
      </div>
      <p className="mt-1 text-sm">
        <ProfileLinkList people={people} emptyLabel="—" />
      </p>
    </div>
  );
}

function ProfileLinkList({
  people,
  max = 5,
  emptyLabel,
}: {
  people: readonly Architect[];
  max?: number;
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  if (people.length === 0) return <>{emptyLabel ?? t("common.none")}</>;
  const { shown, remaining } = defaultNameFormatter.truncateNames(
    people.map((architect) => architect.name),
    max,
  );
  return (
    <span title={people.map((architect) => architect.name).join(", ")}>
      {people.slice(0, shown.length).map((architect, index) => (
        <span key={architect.id}>
          {index > 0 && ", "}
          <Link
            to="/architects/$architectId"
            params={{ architectId: architect.id }}
            className="underline-offset-2 hover:text-primary hover:underline"
          >
            {architect.name}
          </Link>
        </span>
      ))}
      {remaining > 0 && ` ${t("common.andMoreCount", { n: remaining })}`}
    </span>
  );
}

function NextStepCallout({ exposedCount }: { exposedCount: number }) {
  const { t } = useI18n();
  return (
    <Callout tone="warning" className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p>{t("cap.nextStep.exposed", { n: exposedCount })}</p>
      <span className="flex flex-wrap items-center gap-3 font-medium">
        <Link to="/mentoring" className="underline underline-offset-2">
          {t("cap.nextStep.mentoring")}
        </Link>
        <Link to="/training-needs" className="underline underline-offset-2">
          {t("cap.nextStep.trainingNeeds")}
        </Link>
      </span>
    </Callout>
  );
}
