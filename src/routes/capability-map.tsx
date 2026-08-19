import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, SectionCard } from "@/components/app/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { canActFor } from "@/lib/scope";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/capability-map")({
  head: () => ({
    meta: [
      { title: "Mapa de Capacidades — Synapse" },
      {
        name: "description",
        content:
          "Mapa das capacidades técnicas disponíveis no time de arquitetura, com risco de concentração e lacunas de proficiência.",
      },
      { property: "og:title", content: "Mapa de Capacidades — Synapse" },
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
 * Faixas de proficiência absoluta dentro do domínio — não é a mesma coisa
 * que "gap" (que é relativo ao nível esperado do cargo da pessoa). Um
 * arquiteto júnior em nível 2 pode não ter gap nenhum (é o nível esperado
 * para o cargo dele), mesmo caindo aqui na faixa mais baixa. Por isso a
 * primeira faixa chama "Em desenvolvimento", não "Lacunas" — "lacuna" é
 * conceito de avaliação individual (`gapsFor`), não de proficiência
 * absoluta agregada por domínio. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-
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
 * um domínio com especialista de verdade), e "0 Experts + 1 Avançado" caía
 * no mesmo `else` mesmo sendo literalmente uma única pessoa segurando o
 * domínio sozinha. Cada combinação agora cai numa categoria com nome e
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

  /**
   * População: só quem este viewer de fato enxerga o registro — sem isto,
   * gente fora do escopo (dado de diretório, sempre presente no roster) caía
   * em `notAssessed` por não ter registro visível, não por realmente não ter
   * avaliação, distorcendo a classificação de risco de concentração. Ver
   * ANA-001, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
   */
  const population = sel.activeArchitects.filter((a) => canActFor(user, a));

  /**
   * Ausência de avaliação oficial não é lacuna: quem não tem `avg` para o
   * domínio simplesmente não entra em nenhuma faixa de proficiência — entra
   * na contagem separada `notAssessed`. Ver AUDITORIA-RIGIDA-SEGUNDA-
   * REVISAO-SYNAPSE.md, Seção 7.
   */
  const areas = store.categories
    .filter((cat) => cat.active)
    .map((cat) => {
      const people = population.map((a) => ({
        architect: a,
        level: sel.domainAverages(a.id).find((d) => d.category.id === cat.id)?.avg,
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

  return (
    <>
      <PageHeader title={t("cap.title")} description={t("cap.subtitle")} />

      {store.categories.length === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("cap.empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("cap.empty.hint")}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {areas.map((area) => {
          const experts = area.bands.find((b) => b.key === "experts")?.people ?? [];
          const advanced = area.bands.find((b) => b.key === "advanced")?.people ?? [];
          const references = [...experts, ...advanced];
          const risk = classifyRisk(area.assessedCount, references.length);

          return (
            <SectionCard
              key={area.cat.id}
              title={area.cat.name}
              description={t(`cap.risk.${risk}`, { n: references.length })}
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
                {t("cap.references", {
                  nomes: references.map((p) => p.architect.name).join(", ") || t("common.none"),
                })}
              </p>
              {area.notAssessed > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("cap.notAssessed", { n: area.notAssessed })}
                </p>
              )}
            </SectionCard>
          );
        })}
      </div>
    </>
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
      <p className="mt-1 text-sm">{people.join(", ") || "—"}</p>
    </div>
  );
}
