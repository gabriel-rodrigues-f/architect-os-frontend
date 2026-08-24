import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CapabilitiesTabs } from "@/components/app/CapabilitiesTabs";
import { NameList, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Badge } from "@/components/ui/badge";
import { ViewToggle } from "@/components/app/ViewToggle";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { canActFor } from "@/lib/scope";
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

/**
 * Faixas de proficiência absoluta dentro da capacidade — não é a mesma coisa
 * que "gap" (que é relativo ao nível esperado do cargo da pessoa). Um
 * arquiteto júnior em nível 2 pode não ter gap nenhum (é o nível esperado
 * para o cargo dele), mesmo caindo aqui na faixa mais baixa. Por isso a
 * primeira faixa chama "Em desenvolvimento", não "Lacunas" — "lacuna" é
 * conceito de avaliação individual (`gapsFor`), não de proficiência
 * absoluta agregada por capacidade. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-
 * ATUAL-SYNAPSE.md, EPIC 6.
 *
 * A ordem é crescente — da menor proficiência para a maior — para a leitura
 * ocidental da esquerda para a direita acompanhar a evolução do time.
 */
const BANDS = [
  {
    key: "developing",
    labelKey: "cap.band.developing",
    tone: "bg-level-1/60",
    min: -Infinity,
    max: 2.5,
  },
  {
    key: "practitioners",
    labelKey: "cap.band.practitioners",
    tone: "bg-level-3/60",
    min: 2.5,
    max: 3.5,
  },
  { key: "advanced", labelKey: "cap.band.advanced", tone: "bg-level-4/60", min: 3.5, max: 4.5 },
  { key: "experts", labelKey: "cap.band.experts", tone: "bg-level-5/60", min: 4.5, max: Infinity },
] as const;

/**
 * Estados explícitos de risco de concentração — antes um `else` genérico
 * classificava "0 Experts + 3 Avançados" como "healthy" (mesma etiqueta de
 * uma capacidade com especialista de verdade), e "0 Experts + 1 Avançado" caía
 * no mesmo `else` mesmo sendo literalmente uma única pessoa segurando a
 * capacidade sozinha. Cada combinação agora cai numa categoria com nome e
 * critério explícitos. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-
 * SYNAPSE.md, EPIC 6.
 */
type RiskState = "insufficientData" | "noReference" | "concentrationRisk" | "distributedCoverage";

function classifyRisk(assessedCount: number, referenceCount: number): RiskState {
  if (assessedCount === 0) return "insufficientData";
  if (referenceCount === 0) return "noReference";
  if (referenceCount === 1) return "concentrationRisk";
  return "distributedCoverage";
}

function CapabilityMapPage() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("capabilityMap");
  const [viewOverride, setViewOverride] = useState<"cards" | "table" | null>(null);

  /**
   * População: só quem este viewer de fato enxerga o registro — sem isto,
   * gente fora do escopo (dado de diretório, sempre presente no roster) caía
   * em `notAssessed` por não ter registro visível, não por realmente não ter
   * avaliação, distorcendo a classificação de risco de concentração. Ver
   * ANA-001, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
   */
  const population = sel.activeArchitects.filter((a) => canActFor(user, a));

  /**
   * Ausência de avaliação oficial não é lacuna: quem não tem `avg` para a
   * capacidade simplesmente não entra em nenhuma faixa de proficiência — entra
   * na contagem separada `notAssessed`. Ver AUDITORIA-RIGIDA-SEGUNDA-
   * REVISAO-SYNAPSE.md, Seção 7.
   */
  const areas = store.capabilities
    .filter((cat) => cat.active)
    .map((cat) => {
      const people = population.map((a) => ({
        architect: a,
        level: sel.capabilityAverages(a.id).find((d) => d.capability.id === cat.id)?.avg,
      }));
      const assessed = people.filter(
        (p): p is { architect: (typeof people)[number]["architect"]; level: number } =>
          p.level !== undefined,
      );
      const notAssessed = people.length - assessed.length;
      const bands = BANDS.map((band) => ({
        ...band,
        people: assessed.filter((p) => p.level >= band.min && p.level < band.max),
      }));
      return { cat, bands, assessedCount: assessed.length, notAssessed };
    });

  /** R2-UX-09 — mesmo default do Time: acima de 8 capacidades, tabela em vez de cards. */
  const view: "cards" | "table" = viewOverride ?? (areas.length > 8 ? "table" : "cards");

  const withRisk = areas.map((area) => {
    const experts = area.bands.find((b) => b.key === "experts")?.people ?? [];
    const advanced = area.bands.find((b) => b.key === "advanced")?.people ?? [];
    const references = [...experts, ...advanced];
    const risk = classifyRisk(area.assessedCount, references.length);
    return { ...area, references, risk };
  });

  return (
    <>
      <CapabilitiesTabs />
      <PageHeader title={t("cap.title")} description={t("cap.subtitle")} help={help} />

      {store.capabilities.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("cap.empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("cap.empty.hint")}</p>
        </div>
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
            R2-UX-09(b) — título e tabs (CapabilitiesTabs/PageHeader, acima)
            ficam fixos; só o conteúdo rola. `100vh-260px` é o mesmo cálculo
            de "o que sobra abaixo do cabeçalho fixo do app" já usado no
            heatmap de Progressão/Painel (R2-ESC-01), aqui aplicado à
            página inteira porque não há um heatmap único, e sim N cards.
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
