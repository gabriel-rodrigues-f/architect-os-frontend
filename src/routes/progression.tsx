import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  CapabilityHeatmap,
  EmptyState,
  GapTable,
  OutOfReachScreen,
  PageAction,
  PageHeader,
  PersonCombobox,
  SectionCard,
  useGapAnalysisData,
} from "@/components/app";
import { useSelectionEmptyState } from "@/components/app/EmptySelection";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";
import { PersonPicker } from "@/lib/person-selection";
import { ContextScope, type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireTeamAnalysisReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { Registration } from "@/lib/registration";
import { useGapSeverityRuler, useSelectors } from "@/lib/store";
import { exportTeamReportCsv } from "@/lib/team-report-csv";

export const Route = createFileRoute("/progression")({
  head: () => ({
    meta: [
      { title: "Prontidão para Progressão — Synapse" },
      {
        name: "description",
        content: "Mapa de calor de níveis e tabela de competências em evolução do time.",
      },
      { property: "og:title", content: "Prontidão para Progressão — Synapse" },
      {
        property: "og:description",
        content: "Mapa de calor e tabela de competências em evolução do time.",
      },
    ],
  }),
  beforeLoad: requireTeamAnalysisReach,
  component: ProgressionPage,
});

const PROGRESSION_CONTEXTS: readonly ContextScopeRequest[] = [...SELECTOR_CONTEXTS];

function ProgressionPage() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("progression");
  // Análise do time: quem lidera com vínculo — gerente e tech lead (dono, 2026-09-06: "o gerente vê o que o tech lead vê").
  const canAnalyzeTeam = defaultUiAuthorizationPolicy.canAnalyzeTeam(user);

  if (!canAnalyzeTeam) {
    return (
      <OutOfReachScreen
        title={t("progression.title")}
        help={help}
        reason={t("cap.teamAnalysisOnly")}
        hint={t("cap.teamAnalysisOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={PROGRESSION_CONTEXTS}>
      <TeamProgression />
    </ContextScope>
  );
}

function TeamProgression() {
  const { t } = useI18n();
  const help = usePageHelp("progression");
  const sel = useSelectors();

  const ruler = useGapSeverityRuler();
  const { store, selected, setSelected, professionals, priorities, mastery, scopeLabel } =
    useGapAnalysisData();
  const [exportingPdf, setExportingPdf] = useState(false);
  const cadastroDePessoa = useSelectionEmptyState(Registration.PROFESSIONAL);
  const semNinguem = store.professionals.length === 0;

  const reportInput = () => ({
    scopeLabel,
    generatedAt: new Date(),
    professionals,
    capabilities: store.capabilities,
    capabilityAveragesFor: sel.capabilityAverages,
    priorities,
    mastery,
  });

  const exportCsv = () => {
    try {
      exportTeamReportCsv(t, reportInput(), ruler);
    } catch {
      toast.error(t("gap.export.error"));
    }
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const { exportTeamReportPdf } = await import("@/lib/team-report-pdf");
      await exportTeamReportPdf(t, reportInput(), ruler);
    } catch {
      toast.error(t("gap.export.error"));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("progression.title")}
        description={t("progression.subtitle")}
        help={help}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/*
             * Dono (2026-09-08, item 3): o filtro NÃO some mais quando não há
             * ninguém — ele passa a dizer "Nenhum profissional cadastrado —
             * clique para cadastrar" e a levar ao cadastro. Quem não cadastra
             * gente lê a frase e não recebe porta nenhuma; a régua é da
             * `PersonCombobox`, e esta tela não a repete.
             */}
            <PersonCombobox
              picker={PersonPicker.many(store.professionals, selected)}
              onChange={setSelected}
              label={t("person.label")}
              className="w-64"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={professionals.length === 0}
              onClick={exportCsv}
            >
              {t("gap.export.csv")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={professionals.length === 0 || exportingPdf}
              onClick={() => void exportPdf()}
            >
              {exportingPdf ? t("gap.export.generating") : t("gap.export.pdf")}
            </Button>
          </div>
        }
      />

      {professionals.length === 0 ? (
        <EmptyState
          title={semNinguem ? t("person.none") : t("gap.empty")}
          hint={semNinguem ? t("gap.empty.noProfessionals") : t("gap.empty.filterHint")}
          /*
           * Dono (2026-09-08, item 3): mais um botão de cadastrar o primeiro
           * profissional NO CENTRO da tela, e SÓ quando não houver nenhum —
           * com filtro que não achou ninguém, cadastrar não é o próximo passo.
           */
          action={
            semNinguem && cadastroDePessoa.registration ? (
              <PageAction className="mt-4" label={t("team.empty.cta")} asChild>
                <Link
                  to={cadastroDePessoa.registration.to}
                  {...(cadastroDePessoa.registration.search
                    ? { search: cadastroDePessoa.registration.search }
                    : {})}
                />
              </PageAction>
            ) : undefined
          }
        />
      ) : (
        <>
          <SectionCard
            title={t("gap.heatmap.title")}
            description={t("gap.heatmap.subtitle", { escopo: scopeLabel })}
          >
            <CapabilityHeatmap
              professionals={professionals}
              capabilities={store.capabilities}
              capabilityAveragesFor={sel.capabilityAverages}
              linkToProfile
            />
          </SectionCard>

          <SectionCard
            className="mt-6"
            title={t("gap.table.title")}
            description={t("gap.table.subtitle", { escopo: scopeLabel })}
          >
            <GapTable rows={priorities} capabilities={store.capabilities} />
          </SectionCard>

          {mastery.length > 0 && (
            <SectionCard
              className="mt-6"
              title={t("gap.mastery.title")}
              description={t("gap.mastery.subtitle", { escopo: scopeLabel })}
            >
              <GapTable rows={mastery} capabilities={store.capabilities} mastery />
            </SectionCard>
          )}
        </>
      )}
    </>
  );
}
