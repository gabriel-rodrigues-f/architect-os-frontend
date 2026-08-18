import { createFileRoute } from "@tanstack/react-router";

import { LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ACTION_TYPES, EVIDENCE_TYPES, LEVELS, ROLES, roleShort } from "@/lib/domain";
import { useLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/text";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Referência do Modelo — Synapse" },
      {
        name: "description",
        content:
          "Referência do modelo: escala de proficiência, perfis por cargo, tipos de ação e evidência.",
      },
      { property: "og:title", content: "Referência do Modelo — Synapse" },
      {
        property: "og:description",
        content: "Configuração e glossário do modelo de desenvolvimento técnico.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const store = useStore();
  const labels = useLabels();
  const { t, locale } = useI18n();

  return (
    <>
      <PageHeader
        title={t("ref.title")}
        description="Glossário do modelo: escala de proficiência, cargos, tipos de ação e de evidência. Somente leitura — o que é editável fica na tela do respectivo cadastro."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={t("ref.scale")} description="5 níveis usados em todos os assessments.">
          <ul className="space-y-2">
            {LEVELS.map((l) => (
              <li key={l.level} className="flex items-start gap-3 surface-inset p-3">
                <LevelBadge level={l.level} showName />
                <p className="text-sm text-muted-foreground">{l.description}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("ref.cycles")} description={t("ref.cycles.subtitle")}>
          <ul className="space-y-2">
            {store.cycles.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between surface-inset p-3 text-sm"
              >
                <span>
                  <strong>{c.name}</strong>{" "}
                  <span className="text-muted-foreground">
                    {formatDate(c.start, locale)} → {formatDate(c.end, locale)}
                  </span>
                </span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                  {labels.cycleStatus[c.status]}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("ref.profiles")} description={t("ref.profiles.subtitle")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">{t("ref.domain")}</th>
                  {ROLES.map((r) => (
                    <th key={r} className="py-2 text-center">
                      {roleShort(r)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {store.categories.map((cat) => {
                  const comps = store.competencies.filter((c) => c.categoryId === cat.id);
                  return (
                    <tr key={cat.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 font-medium">{cat.name}</td>
                      {ROLES.map((r) => {
                        const avg = comps.length
                          ? comps.reduce((s, c) => s + c.expected[r], 0) / comps.length
                          : 0;
                        return (
                          <td key={r} className="py-2 text-center tabular-nums">
                            {avg.toFixed(1)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Taxonomias"
          description="Tipos de ação de desenvolvimento e de evidência aceitos."
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipos de ação
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ACTION_TYPES.map((a) => (
              <span key={a} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                {labels.actionType[a]}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipos de evidência
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {EVIDENCE_TYPES.map((a) => (
              <span key={a} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                {labels.evidenceType[a]}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
