import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { EmptyState, NameList, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Badge } from "@/components/ui/badge";
import { ViewToggle } from "@/components/app/ViewToggle";
import { useCurrentUser } from "@/lib/auth";
import {
  BANDS,
  CapabilityCoveragePresenter,
  type RiskState,
} from "@/lib/presenters/capability-coverage-presenter";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/capability-map")({
  head: () => ({
    meta: [
      { title: "Cobertura de Capacidades — Synapse" },
      {
        name: "description",
        content:
          "Mapa das capacidades técnicas disponíveis no time de arquitetura, com risco de concentração e lacunas de proficiência.",
      },
      { property: "og:title", content: "Cobertura de Capacidades — Synapse" },
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
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("capabilityMap");
  const [viewOverride, setViewOverride] = useState<"cards" | "table" | null>(null);

  /** População visível ao viewer — ver o docstring de `ArchitectSelectors.visibleTo` (ANA-001). */
  const population = sel.visibleArchitects(user);

  /** OO3-11h — faixas + risco de concentração moram no `CapabilityCoveragePresenter` (`lib/presenters/`). */
  const presenter = useMemo(
    () => new CapabilityCoveragePresenter(store.capabilities, sel.capabilityAverages),
    [store.capabilities, sel],
  );
  const withRisk = presenter.areas(population);

  /** R2-UX-09 — mesmo default do Time: acima de 8 capacidades, tabela em vez de cards. */
  const view: "cards" | "table" = viewOverride ?? (withRisk.length > 8 ? "table" : "cards");

  return (
    <>
      <PageHeader title={t("cap.title")} description={t("cap.subtitle")} help={help} />

      {store.capabilities.length === 0 ? (
        <EmptyState title={t("cap.empty.title")} hint={t("cap.empty.hint")} />
      ) : population.length === 0 ? (
        /*
          R2-VIS-12 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — sem ninguém visível
          no escopo, TODA capacidade cai em "insufficientData" por definição
          (assessedCount é sempre 0) — a tela virava N repetições da mesma
          frase, uma por card/linha, quando o problema é um só: não há
          ninguém para avaliar aqui, não uma lacuna de dado por capacidade.
        */
        <EmptyState title={t("cap.empty.noScope.title")} hint={t("cap.empty.noScope.hint")} />
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <ViewToggle
              view={view}
              onChange={setViewOverride}
              cardsLabel={t("team.view.cards")}
              tableLabel={t("team.view.table")}
            />
          </div>

          {/*
            R2-UX-09(b) — título (PageHeader, acima) fica fixo; só o
            conteúdo rola. `100vh-260px` é o mesmo cálculo de "o que sobra
            abaixo do cabeçalho fixo do app" já usado no heatmap de
            Progressão/Painel (R2-ESC-01), aqui aplicado à página inteira
            porque não há um heatmap único, e sim N cards.
          */}
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {view === "table" ? (
              <div className="surface-card overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-4 py-3">
                        {t("col.capability")}
                      </th>
                      {BANDS.map((band) => (
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
                          people={band.people.map((p) => p.architect.name)}
                          tone={band.tone}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t("cap.references.label")}{" "}
                      <NameList names={area.references.map((p) => p.architect.name)} />
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

/** R2-UX-09(a) — badge compacto pra tabela; a frase completa (já usada nos cards) vira `title`. */
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

function Group({ label, people, tone }: { label: string; people: string[]; tone: string }) {
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
        <NameList names={people} emptyLabel="—" />
      </p>
    </div>
  );
}
