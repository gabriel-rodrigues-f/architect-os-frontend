import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { GapBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { authErrorMessage, useCurrentUser } from "@/lib/auth";
import { capabilityShortLabels } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/training-needs")({
  head: () => ({
    meta: [
      { title: "Necessidades de Treinamento — Synapse" },
      {
        name: "description",
        content:
          "Análise agregada de necessidades de treinamento do time (LNT) a partir dos gaps individuais.",
      },
      { property: "og:title", content: "Necessidades de Treinamento — Synapse" },
      {
        property: "og:description",
        content: "Treinamentos recomendados que atendem várias pessoas simultaneamente.",
      },
    ],
  }),
  component: TrainingNeedsPage,
});

function TrainingNeedsPage() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("trainingNeeds");
  /**
   * População da análise: quem este viewer de fato enxerga o registro
   * (própria pessoa, ou quem está sob a liderança dela) — nunca o roster
   * inteiro da empresa, que chega sem filtro por ser dado de diretório, não
   * de carreira. Sem isto, quem está fora do escopo entrava na conta como
   * "sem lacuna" (ausência de dado, não ausência de lacuna). Ver ANA-001,
   * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
   */
  const population = sel.activeArchitects.filter((a) =>
    defaultUiAuthorizationPolicy.canActFor(user, a),
  );
  const needs = sel.teamTrainingNeeds(population);
  /**
   * R2-ESC-08 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — os dois cortes (15 e 6)
   * eram silenciosos: nada avisava que a lista continuava além do que
   * aparecia. Mesmo padrão de `HeatmapColumnsNotice` (R2-ESC-01) — aviso com
   * contagem + alternância "mostrar todas" em vez de um link para outro
   * lugar, já que não existe uma tela dedicada só a esta lista derivada.
   */
  const [showAllTop, setShowAllTop] = useState(false);
  const top = showAllTop ? needs : needs.slice(0, 15);
  const collectiveEligible = needs.filter((n) => n.people >= 3);
  const [showAllCollective, setShowAllCollective] = useState(false);
  const collective = showAllCollective ? collectiveEligible : collectiveEligible.slice(0, 6);
  /** R2-ESC-02 — dedup do rótulo compacto enquanto o catálogo tiver siglas duplicadas legadas. */
  const shortLabels = capabilityShortLabels(store.capabilities);

  /**
   * "Intervenção coletiva" não é uma entidade nova — é a mesma Trilha de
   * Aprendizagem que já existe, atribuída de uma vez a todo mundo com a
   * mesma lacuna. Isso evita inventar um conceito/tabela nova só para
   * reembalar o que a Trilha já faz, e mantém a lista de pessoas real (os
   * mesmos ids que `teamTrainingNeeds` já contou, não um número solto). Ver
   * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC K.
   */
  /**
   * Sem id local nem sucesso otimista: o servidor gera o id de verdade — ver
   * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, IDOR-001.
   */
  const createIntervention = async (need: (typeof needs)[number]) => {
    if (!need.competency) return;
    try {
      await store.addLearningPath({
        id: "",
        name: t("needs.intervention.pathName", { competencia: need.competency.name }),
        description: t("needs.intervention.pathDescription", { n: need.people }),
        competencyIds: [need.competency.id],
        assignedTo: need.architectIds,
        items: [],
        progress: [],
        createdBy: user.email,
        createdByUserId: user.id,
        createdAt: new Date().toISOString(),
      });
      toast.success(t("needs.intervention.toast", { competencia: need.competency.name }));
    } catch (error) {
      toast.error(authErrorMessage(error));
    }
  };

  /**
   * Antes checava só se a competência aparecia em QUALQUER trilha, alguma
   * vez — uma trilha antiga, para outras pessoas, de outro ciclo, já
   * concluída, bloqueava para sempre uma intervenção nova para o grupo
   * atual. Agora só considera "já existe" quando a trilha cobre a
   * competência E está atribuída a pelo menos uma das pessoas que têm essa
   * lacuna agora. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md,
   * EPIC 6.
   */
  const interventionExists = (need: (typeof needs)[number]) =>
    store.learningPaths.some(
      (p) =>
        p.competencyIds.includes(need.competency!.id) &&
        p.assignedTo.some((id) => need.architectIds.includes(id)),
    );

  return (
    <>
      <PageHeader title={t("needs.title")} description={t("needs.subtitle")} help={help} />

      {/* R2-UX-04 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — minmax(0,Nfr): sem
          isto a pista nunca encolhe abaixo da tabela/heatmap interno, e a
          página inteira rola horizontal em vez do overflow-x-auto ativar. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard
          title={t("needs.aggregated.title")}
          description={t("needs.aggregated.subtitle")}
        >
          {needs.length > 15 && (
            <p className="mb-3 text-xs text-muted-foreground">
              {showAllTop
                ? t("needs.aggregated.showingAll", { total: needs.length })
                : t("needs.aggregated.showingTopN", {
                    shown: top.length,
                    total: needs.length,
                  })}{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:no-underline"
                onClick={() => setShowAllTop((v) => !v)}
              >
                {showAllTop ? t("needs.showTopOnly") : t("needs.showAll")}
              </button>
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2">
                    {t("col.competency")}
                  </th>
                  <th scope="col" className="py-2">
                    {t("col.capability")}
                  </th>
                  <th scope="col" className="py-2 text-center">
                    {t("needs.col.peopleWithGap")}
                  </th>
                  <th scope="col" className="py-2 text-center">
                    {t("needs.col.avgGap")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {top.map((n) => (
                  <tr key={n.competency!.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 font-medium">{n.competency!.name}</td>
                    <td className="py-2 text-muted-foreground">
                      {shortLabels.get(n.competency!.capabilityId) ??
                        store.capabilities.find((c) => c.id === n.competency!.capabilityId)?.short}
                    </td>
                    <td className="py-2 text-center tabular-nums">{n.people}</td>
                    <td className="py-2 text-center tabular-nums">{n.avgGap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title={t("needs.recommended.title")}
          description={t("needs.recommended.subtitle")}
        >
          {collectiveEligible.length > 6 && (
            <p className="mb-3 text-xs text-muted-foreground">
              {showAllCollective
                ? t("needs.recommended.showingAll", { total: collectiveEligible.length })
                : t("needs.recommended.showingTopN", {
                    shown: collective.length,
                    total: collectiveEligible.length,
                  })}{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:no-underline"
                onClick={() => setShowAllCollective((v) => !v)}
              >
                {showAllCollective ? t("needs.showTopOnly") : t("needs.showAll")}
              </button>
            </p>
          )}
          <ul className="space-y-3">
            {collective.map((n) => (
              <li key={n.competency!.id} className="surface-inset p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{n.competency!.name}</p>
                  <GapBadge gap={Math.round(n.avgGap)} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("needs.recommended.summary", { n: n.people })}
                </p>
                <div className="mt-2">
                  {interventionExists(n) ? (
                    <Link to="/learning-paths" className="text-xs text-primary hover:underline">
                      {t("needs.intervention.view")}
                    </Link>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => createIntervention(n)}>
                      {t("needs.intervention.create")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {!collective.length && (
              <p className="text-sm text-muted-foreground">{t("needs.recommended.none")}</p>
            )}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
