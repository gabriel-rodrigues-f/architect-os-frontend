import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  CapabilityRadar,
  EmptyState,
  EmptyStateCallToAction,
  GapBadge,
  GapClosureSection,
  KeyFigureCard,
  NameList,
  OutOfReachScreen,
  PageHeader,
  PersonCombobox,
  ScrollPane,
  SectionCard,
  TreatGapInPlanAction,
  useGapAnalysisData,
} from "@/components/app";
import type { ConsolidatedGapRow } from "@/lib/selectors";
import { useCurrentUser } from "@/lib/auth";
import { PersonPicker } from "@/lib/person-selection";
import { ContextScope, type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { PaneHeight, PaneRhythm } from "@/lib/design";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { Registration } from "@/lib/registration";
import { requireTeamAnalysisReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { KeyFigureFormatter } from "@/lib/key-figure-format";
import { useSelectors } from "@/lib/store";
import { FurthestFromTarget } from "@/lib/view-models";

export const Route = createFileRoute("/gap-analysis")({
  head: () => ({
    meta: [
      { title: "Prioridades de Desenvolvimento — Synapse" },
      {
        name: "description",
        content: "Radar de capacidades e ranking de prioridades de desenvolvimento por pessoa.",
      },
      { property: "og:title", content: "Prioridades de Desenvolvimento — Synapse" },
      { property: "og:description", content: "Radar e prioridades de desenvolvimento." },
    ],
  }),
  beforeLoad: requireTeamAnalysisReach,
  component: GapPage,
});

const GAP_ANALYSIS_CONTEXTS: readonly ContextScopeRequest[] = [...SELECTOR_CONTEXTS];

function GapPage() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("gapAnalysis");
  const canAnalyzeTeam = defaultUiAuthorizationPolicy.canAnalyzeTeam(user);

  if (!canAnalyzeTeam) {
    return (
      <OutOfReachScreen
        title={t("gap.title")}
        help={help}
        reason={t("cap.teamAnalysisOnly")}
        hint={t("cap.teamAnalysisOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={GAP_ANALYSIS_CONTEXTS}>
      <TeamPriorities />
    </ContextScope>
  );
}

function TeamPriorities() {
  const { t } = useI18n();
  const help = usePageHelp("gapAnalysis");
  const sel = useSelectors();
  const {
    store,
    selected,
    setSelected,
    professionals,
    radar,
    radarCoverage,
    priorities,
    scopeLabel,
  } = useGapAnalysisData();

  const furthestFromTarget = useMemo(
    () => new FurthestFromTarget(professionals, sel.progressionGapsFor),
    [professionals, sel],
  );
  // Números como afirmação (referência FIAP 2026-09-06, §2 item 2): a distância
  // média por pessoa × competência em evolução, no recorte escolhido.
  //
  // INTEIRA, E PARA BAIXO (dono, 2026-09-10): *"arredonde para baixo e quero
  // número inteiro, sem vírgula."* A conta não mudou — soma das distâncias
  // sobre soma das pessoas; o que mudou é a apresentação, e ela desce ao piso
  // em `wholeRatio` porque o formato `integer` sozinho arredondaria 1,8 para
  // 2 e anunciaria um time mais longe do alvo do que a medida diz.
  const averageGap = KeyFigureFormatter.wholeRatio(
    priorities.reduce((sum, row) => sum + row.totalGap, 0),
    priorities.reduce((sum, row) => sum + row.people, 0),
  );

  return (
    <>
      <PageHeader
        title={t("gap.title")}
        description={t("gap.subtitle")}
        help={help}
        actions={
          // Dono (2026-09-06): sem ninguém no alcance, só a mensagem do corpo.
          store.professionals.length > 0 ? (
            <PersonCombobox
              picker={PersonPicker.many(store.professionals, selected)}
              onChange={setSelected}
              label={t("person.label")}
              className="w-64"
            />
          ) : undefined
        }
      />

      {professionals.length === 0 ? (
        // Dono (2026-09-08): sem ninguém cadastrado, o botão de cadastro no
        // CENTRO do quadro; com filtro que não achou ninguém, só a mensagem.
        store.professionals.length === 0 ? (
          <EmptyStateCallToAction
            subject={EmptySubject.PROFESSIONAL}
            hint={t("gap.empty.noProfessionals")}
            registrations={[Registration.PROFESSIONAL]}
          />
        ) : (
          <EmptyState title={t("gap.empty")} hint={t("gap.empty.filterHint")} />
        )
      ) : (
        <>
          <KeyFigureCard
            className="mb-6"
            label={t("gap.figure.avgGap")}
            value={averageGap}
            format="integer"
            caption={t("gap.figure.caption", {
              competencies: priorities.length,
              people: professionals.length,
            })}
          />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SectionCard
              title={t("gap.radar.title")}
              description={t("gap.radar.subtitle", { escopo: scopeLabel })}
            >
              {/*
                UMA figura, não três itens. A caixa pedia `items(3)` do ritmo
                genérico — 276px — para hospedar um radar que declara 320 de
                altura: sobrava barra de rolagem para 44px que ninguém queria
                rolar. O ritmo da FIGURA vale o que a figura mede.
              */}
              <ScrollPane
                label={t("pane.gapRadar.label")}
                height={PaneHeight.items(1, PaneRhythm.FIGURE)}
              >
                <CapabilityRadar data={radar} />
              </ScrollPane>
              {radarCoverage.total > 0 && radarCoverage.covered < radarCoverage.total && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("gap.radar.coverage", {
                    covered: radarCoverage.covered,
                    total: radarCoverage.total,
                  })}
                </p>
              )}
            </SectionCard>

            <SectionCard
              className="flex flex-col"
              title={t("gap.priorities.title")}
              description={t("gap.priorities.subtitle", { n: professionals.length })}
            >
              <ScrollPane
                label={t("pane.gapPriorities.label")}
                height={PaneHeight.items(5, PaneRhythm.PRIORITY)}
                className="space-y-4 pr-1"
              >
                <GapPriorityList
                  rows={priorities}
                  emptyLabel={t("gap.priorities.none")}
                  furthestFromTarget={furthestFromTarget}
                />
              </ScrollPane>
            </SectionCard>
          </div>
        </>
      )}

      <div className="mt-6">
        <GapClosureSection />
      </div>
    </>
  );
}

function GapPriorityList({
  rows,
  emptyLabel,
  furthestFromTarget,
}: {
  rows: ConsolidatedGapRow[];
  emptyLabel: string;
  furthestFromTarget: FurthestFromTarget;
}) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ol className="space-y-2">
      {rows.slice(0, 8).map((row, i) => (
        <li
          key={row.competencyId}
          className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2"
        >
          <div className="min-w-0 text-sm">
            <p>
              <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
              {row.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("gap.priorities.peopleCount", { n: row.people })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("gap.priorities.avgGapLine", { avg: row.avgGap })}
            </p>
            <p className="text-xs text-muted-foreground">
              <NameList names={row.professionalNames} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <GapBadge gap={row.maxGap} />
            <TreatGapInPlanAction
              professionalId={furthestFromTarget.professionalFor(row.competencyId)}
              competencyId={row.competencyId}
              label={t("gap.priorities.action")}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
