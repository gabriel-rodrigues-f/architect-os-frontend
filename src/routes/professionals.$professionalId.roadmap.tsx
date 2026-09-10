import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  AdherenceSummary,
  EmptyState,
  GapBadge,
  LearningPathCoverageList,
  LevelBadge,
  PersonAdviceSection,
  ProfileBackLink,
  ProfileHeading,
  QuerySection,
} from "@/components/app";
import { api, personAssistantsApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { CareerLevel } from "@/lib/domain";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { defaultCareerFileReach } from "@/lib/person-listing";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCareerLevelsByRank, useSelectors, useStore } from "@/lib/store";
import {
  CareerRoadmapViewModel,
  LearningPathsViewModel,
  type MissingCompetencyView,
} from "@/lib/view-models";

export const Route = createFileRoute("/professionals/$professionalId/roadmap")({
  head: () => ({
    meta: [
      { title: "Roteiro de Carreira — Synapse" },
      {
        name: "description",
        content:
          "Roteiro para o próximo nível: aderência à régua do time, competências abaixo do exigido e trilhas que as cobrem.",
      },
    ],
  }),
  component: RoadmapOfProfessional,
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

function RoadmapOfProfessional() {
  const { professionalId } = Route.useParams();
  const sel = useSelectors();
  const store = useStore();
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("professionalRoadmap");
  const vm = useCareerRoadmapViewModel();
  const professional = sel.professionalById(professionalId);

  const canExplainReadiness = defaultUiAuthorizationPolicy.isLeadOf(user, professional);
  const learningPaths = defaultCareerFileReach.listingOf(user, professional, store.learningPaths);
  const currentLevel = vm.levelOf(professional?.careerLevelId);
  const nextLevel = currentLevel ? vm.nextLevelFor(currentLevel.id) : null;

  const currentQuery = useQuery({
    queryKey: ["professional-adherence", professionalId, currentLevel?.id ?? null],
    queryFn: () => api.professionalAdherence(professionalId, currentLevel?.id ?? ""),
    enabled: professional !== undefined && currentLevel !== null,
  });
  const nextQuery = useQuery({
    queryKey: ["professional-adherence", professionalId, nextLevel?.id ?? null],
    queryFn: () => api.professionalAdherence(professionalId, nextLevel?.id ?? ""),
    enabled: professional !== undefined && nextLevel !== null,
  });

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

  const header = (
    <>
      <ProfileHeading
        help={help}
        title={t("roadmap.title", { nome: professional.name })}
        description={t("roadmap.description")}
        actions={<ProfileBackLink professionalId={professional.id} to="overview" />}
      />
    </>
  );

  if (!currentLevel) {
    return (
      <>
        {header}
        <EmptyState
          title={EmptySubject.CAREER_LEVEL.titleIn(t, "empty.context.forThisPerson")}
          hint={t("roadmap.noCurrentLevel")}
        />
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
                missingCount={data.adherence.missingCompetencies.length}
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
                  missingCount={data.adherence.missingCompetencies.length}
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

      {canExplainReadiness && (
        <PersonAdviceSection
          className="mb-6"
          title={t("ai.readiness.title")}
          description={t("ai.readiness.subtitle")}
          actionLabel={t("ai.readiness.action")}
          transcriptHeadline={t("ai.readiness.title")}
          queryKey={["assistants", "career-readiness-explanation", professionalId]}
          ask={() => personAssistantsApi.explainCareerReadiness(professionalId)}
        />
      )}

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
                <MissingCompetencyList missing={vm.missingCompetencies(data)} />
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
                    professionalId,
                    vm.missingCompetencies(data),
                    learningPaths.items,
                  )}
                  professionalId={professionalId}
                  pathsAreKnown={learningPaths.isKnown}
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
          <p className="min-w-0 break-words text-sm font-medium">{item.name}</p>
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
