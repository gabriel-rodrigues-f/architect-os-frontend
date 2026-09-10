import { Link } from "@tanstack/react-router";

import { KeyFigureCard } from "@/components/app/KeyFigure";
import { QuerySection } from "@/components/app/QuerySection";
import { RevealBlock } from "@/components/app/RevealBlock";
import { SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { operationsApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { useQuery } from "@tanstack/react-query";

/**
 * A VISÃO DO SISTEMA — a tela de quem OPERA o produto (onda 3 do Painel
 * Executivo).
 *
 * Ela já existia, mas escondida atrás do mesmo item de menu do Painel: `/`
 * despachava por papel, e o administrador que abria "Painel Executivo" caía
 * aqui. Isso confundia duas telas com públicos e perguntas diferentes — o
 * dono abriu esta e reclamou de "muitos números absolutos", que é exatamente
 * o que ela é POR DESENHO. Agora ela tem endereço próprio, e o Painel de
 * negócio passa a existir também para o administrador.
 *
 * O que ela responde: o SISTEMA está andando? Pessoas, times, contas, ciclo
 * vigente, avaliações e PDIs por estado. Nunca um nome ao lado de uma nota.
 */
export function SystemOverview() {
  const { t } = useI18n();
  const labels = useLabels();
  const overview = useQuery({
    queryKey: ["operations", "overview"],
    queryFn: operationsApi.overview,
    staleTime: 30_000,
  });

  const sumOf = (counts: Record<string, number>) =>
    Object.values(counts).reduce((total, count) => total + count, 0);

  return (
    <QuerySection
      query={overview}
      errorMessage={t("dash.ops.error")}
      skeleton={<div className="h-24 animate-pulse rounded-md bg-secondary" />}
    >
      {(data) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <RevealBlock order={0}>
              <KeyFigureCard
                label={t("dash.ops.people")}
                value={data.people.active}
                caption={t("dash.ops.peopleHint", { n: data.people.deactivated })}
              />
            </RevealBlock>
            <RevealBlock order={1}>
              <KeyFigureCard label={t("dash.ops.teams")} value={data.teams.active} />
            </RevealBlock>
            <RevealBlock order={2}>
              <KeyFigureCard
                label={t("dash.ops.accounts")}
                value={data.accounts.active}
                caption={t("dash.ops.accountsHint", { n: data.accounts.disabled })}
              />
            </RevealBlock>
            <RevealBlock order={3}>
              <KeyFigureCard
                label={t("dash.ops.cycle")}
                value={data.cycle?.name ?? t("dash.ops.noCycle")}
                tone={data.cycle ? "neutral" : "attention"}
              />
            </RevealBlock>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <RevealBlock order={4}>
              <KeyFigureCard
                label={t("dash.ops.assessments.title")}
                value={sumOf(data.assessments)}
                caption={t("dash.ops.assessments.caption")}
              >
                <CountList
                  entries={Object.entries(data.assessments).map(([status, count]) => [
                    labels.assessmentStatus[status as keyof typeof labels.assessmentStatus] ??
                      status,
                    count,
                  ])}
                  emptyLabel={t("dash.ops.none")}
                />
              </KeyFigureCard>
            </RevealBlock>
            <RevealBlock order={4}>
              <KeyFigureCard
                label={t("dash.ops.plans.title")}
                value={sumOf(data.plans)}
                caption={t("dash.ops.plans.caption")}
              >
                <CountList
                  entries={Object.entries(data.plans).map(([status, count]) => [
                    labels.planStatus[status as keyof typeof labels.planStatus] ?? status,
                    count,
                  ])}
                  emptyLabel={t("dash.ops.none")}
                />
              </KeyFigureCard>
            </RevealBlock>
            <RevealBlock order={4}>
              <KeyFigureCard
                label={t("dash.ops.accountsByRole.title")}
                value={sumOf(data.accounts.byRole)}
                caption={t("dash.ops.accountsByRole.caption")}
              >
                <CountList
                  entries={Object.entries(data.accounts.byRole).map(([role, count]) => [
                    t(`users.role.${role}` as Parameters<typeof t>[0]),
                    count,
                  ])}
                  emptyLabel={t("dash.ops.none")}
                />
              </KeyFigureCard>
            </RevealBlock>
          </div>

          <RevealBlock order={4} className="mt-6">
            <SectionCard title={t("dash.ops.shortcuts")}>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/users">{t("nav.users")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/teams">{t("nav.teams")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/cycles">{t("nav.cycles")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/competency-matrix">{t("nav.competencyMatrix")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/eligibility">{t("eligibility.title")}</Link>
                </Button>
              </div>
            </SectionCard>
          </RevealBlock>
        </>
      )}
    </QuerySection>
  );
}

function CountList({
  entries,
  emptyLabel,
}: {
  entries: Array<[string, number]>;
  emptyLabel: string;
}) {
  if (entries.length === 0) return <p className="text-body text-muted-foreground">{emptyLabel}</p>;
  return (
    <dl className="space-y-2 text-body">
      {entries.map(([label, count]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-display text-body font-semibold tabular-nums">{count}</dd>
        </div>
      ))}
    </dl>
  );
}
