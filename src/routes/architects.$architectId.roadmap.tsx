import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  AdherenceSummary,
  EmptyState,
  GapBadge,
  LearningPathCoverageList,
  LevelBadge,
  PageHeader,
  ProfileTabs,
  QuerySection,
} from "@/components/app";
import { api } from "@/lib/api";
import type { CareerLevel } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useCareerLevelsByRank, useSelectors, useStore } from "@/lib/store";
import {
  CareerRoadmapViewModel,
  LearningPathsViewModel,
  type MissingCompetencyView,
} from "@/lib/view-models";

export const Route = createFileRoute("/architects/$architectId/roadmap")({
  head: () => ({
    meta: [
      { title: "Roteiro de Carreira — Synapse" },
      {
        name: "description",
        content:
          "Roteiro para o próximo nível: aderência à régua do time, competências obrigatórias faltantes e trilhas que as cobrem.",
      },
    ],
  }),
  component: ArchitectRoadmap,
});

function useCareerRoadmapViewModel(): CareerRoadmapViewModel {
  const sel = useSelectors();
  const store = useStore();
  const levels = useCareerLevelsByRank();
  return useMemo(
    () => new CareerRoadmapViewModel(levels, sel.competencyById, new LearningPathsViewModel(store)),
    [levels, sel, store],
  );
}

const SUMMARY_SKELETON = <div className="h-28 animate-pulse rounded-md bg-secondary" />;
const SECTION_SKELETON = <div className="h-24 animate-pulse rounded-md bg-secondary" />;

function ArchitectRoadmap() {
  const { architectId } = Route.useParams();
  const sel = useSelectors();
  const store = useStore();
  const { t } = useI18n();
  const help = usePageHelp("architectRoadmap");
  const vm = useCareerRoadmapViewModel();
  const architect = sel.architectById(architectId);

  const currentLevel = vm.levelOf(architect?.careerLevelId);
  const nextLevel = currentLevel ? vm.nextLevelFor(currentLevel.id) : null;

  const currentQuery = useQuery({
    queryKey: ["architect-adherence", architectId, currentLevel?.id ?? null],
    queryFn: () => api.architectAdherence(architectId, currentLevel?.id ?? ""),
    enabled: architect !== undefined && currentLevel !== null,
  });
  const nextQuery = useQuery({
    queryKey: ["architect-adherence", architectId, nextLevel?.id ?? null],
    queryFn: () => api.architectAdherence(architectId, nextLevel?.id ?? ""),
    enabled: architect !== undefined && nextLevel !== null,
  });

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

  const header = (
    <>
      <PageHeader
        help={help}
        title={t("roadmap.title", { nome: architect.name })}
        description={t("roadmap.description")}
        actions={
          <Link
            to="/architects/$architectId"
            params={{ architectId }}
            className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
          >
            {t("arch.back")}
          </Link>
        }
      />
      <ProfileTabs architectId={architect.id} active="roadmap" />
    </>
  );

  if (!currentLevel) {
    return (
      <>
        {header}
        <EmptyState title={t("roadmap.noCurrentLevel")} />
      </>
    );
  }

  const semRegua = (level: CareerLevel) => (
    <EmptyState
      title={t("roadmap.semRegua.title", { nome: level.name })}
      hint={t("roadmap.semRegua.hint")}
    />
  );

  return (
    <>
      {header}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <QuerySection
          query={currentQuery}
          skeleton={SUMMARY_SKELETON}
          errorMessage={t("roadmap.error")}
        >
          {(data) =>
            data.semRegua ? (
              semRegua(currentLevel)
            ) : (
              <AdherenceSummary
                label={t("roadmap.currentLevelLabel", { nome: currentLevel.name })}
                percentage={vm.adherencePercent(data)}
                missingCount={data.adherence.missingRequired.length}
              />
            )
          }
        </QuerySection>
        {nextLevel ? (
          <QuerySection
            query={nextQuery}
            skeleton={SUMMARY_SKELETON}
            errorMessage={t("roadmap.error")}
          >
            {(data) =>
              data.semRegua ? (
                semRegua(nextLevel)
              ) : (
                <AdherenceSummary
                  label={t("roadmap.nextLevelLabel", { nome: nextLevel.name })}
                  percentage={vm.adherencePercent(data)}
                  missingCount={data.adherence.missingRequired.length}
                />
              )
            }
          </QuerySection>
        ) : (
          <EmptyState
            title={t("roadmap.top.title")}
            hint={t("roadmap.top.hint", { nome: currentLevel.name })}
          />
        )}
      </div>

      {nextLevel && (
        <>
          <QuerySection
            query={nextQuery}
            title={t("roadmap.missing.title")}
            description={t("roadmap.missing.description", { nome: nextLevel.name })}
            className="mb-6"
            skeleton={SECTION_SKELETON}
            errorMessage={t("roadmap.error")}
          >
            {(data) =>
              data.semRegua ? (
                semRegua(nextLevel)
              ) : (
                <MissingCompetencyList missing={vm.missingRequired(data)} />
              )
            }
          </QuerySection>

          <QuerySection
            query={nextQuery}
            title={t("roadmap.coverage.title")}
            description={t("roadmap.coverage.description")}
            skeleton={SECTION_SKELETON}
            errorMessage={t("roadmap.error")}
          >
            {(data) =>
              data.semRegua ? (
                semRegua(nextLevel)
              ) : (
                <LearningPathCoverageList
                  coverage={vm.coverageFor(
                    architectId,
                    vm.missingRequired(data),
                    store.learningPaths,
                  )}
                  architectId={architectId}
                />
              )
            }
          </QuerySection>
        </>
      )}
    </>
  );
}

function MissingCompetencyList({ missing }: { missing: readonly MissingCompetencyView[] }) {
  const { t } = useI18n();
  if (missing.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("roadmap.missing.empty")}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {missing.map((item) => (
        <li
          key={item.competencyId}
          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
        >
          <p className="text-sm font-medium">{item.name}</p>
          <div className="flex items-center gap-2">
            <LevelBadge level={item.currentLevel} />
            <span aria-hidden className="text-xs text-muted-foreground">
              →
            </span>
            <LevelBadge level={item.requiredLevel} />
            <GapBadge gap={item.gap} />
          </div>
        </li>
      ))}
    </ul>
  );
}
