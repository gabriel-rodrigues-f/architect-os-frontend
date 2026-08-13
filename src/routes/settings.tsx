import { createFileRoute } from "@tanstack/react-router";

import { LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ACTION_TYPES, EVIDENCE_TYPES, LEVELS, ROLES, roleShort } from "@/lib/domain";
import { actionTypeLabel, cycleStatusLabel, evidenceTypeLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — Architect OS" },
      {
        name: "description",
        content:
          "Referência do modelo: escala de proficiência, perfis por cargo, tipos de ação e evidência.",
      },
      { property: "og:title", content: "Configurações — Architect OS" },
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

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Parâmetros do modelo de avaliação e desenvolvimento técnico."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Escala de proficiência"
          description="5 níveis usados em todos os assessments."
        >
          <ul className="space-y-2">
            {LEVELS.map((l) => (
              <li
                key={l.level}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <LevelBadge level={l.level} showName />
                <p className="text-sm text-muted-foreground">{l.description}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Ciclos" description="Períodos de desenvolvimento configurados.">
          <ul className="space-y-2">
            {store.cycles.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
              >
                <span>
                  <strong>{c.name}</strong>{" "}
                  <span className="text-muted-foreground">
                    {c.start} → {c.end}
                  </span>
                </span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                  {cycleStatusLabel[c.status]}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Perfis de Competência por Cargo"
          description="Níveis esperados por cargo (média por domínio)."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Domínio</th>
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
                {actionTypeLabel[a]}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipos de evidência
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {EVIDENCE_TYPES.map((a) => (
              <span key={a} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                {evidenceTypeLabel[a]}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
