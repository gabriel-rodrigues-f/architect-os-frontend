import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Bar, GapBadge, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ACTION_TYPES, type ActionType, type PdiStatus } from "@/lib/domain";
import { actionTypeLabel, planItemStatusLabel, priorityLabel } from "@/lib/labels";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/development-plans")({
  head: () => ({
    meta: [
      { title: "Planos de Desenvolvimento — Architect OS" },
      {
        name: "description",
        content: "PDI gerado a partir de gaps, SWOT e avaliação do líder, com metas SMART.",
      },
      { property: "og:title", content: "Planos de Desenvolvimento — Architect OS" },
      {
        property: "og:description",
        content:
          "Planos de desenvolvimento individual com ações Learn, Practice, Apply, Teach, Mentor e Lead.",
      },
    ],
  }),
  component: PlansPage,
});

const STATUSES: PdiStatus[] = ["Not Started", "In Progress", "Blocked", "Completed"];

function PlansPage() {
  const store = useStore();
  const sel = useSelectors();
  const [architectId, setArchitectId] = useState(store.architects[0]?.id ?? "");
  const architect = sel.architectById(architectId);
  const plan = sel.planFor(architectId);
  const gaps = sel.gapsFor(architectId).filter((g) => g.gap > 0);
  const swot = sel.swotFor(architectId);

  const suggestions = gaps
    .filter((g) => !plan?.items.some((i) => i.competencyId === g.item.competencyId))
    .slice(0, 5);

  const addSuggestion = (competencyId: string) => {
    const g = gaps.find((x) => x.item.competencyId === competencyId);
    if (!g || !g.competency || !architect) return;
    store.addPlanItem(architectId, {
      id: `pdi-${architectId}-${competencyId}-${Date.now()}`,
      competencyId,
      currentLevel: g.item.final,
      targetLevel: g.item.target,
      objective: `Evoluir ${g.competency.name} do nível ${g.item.final} para o nível ${g.item.target}`,
      actionType: "Learn",
      actionPlan: "",
      startDate: "2026-08-11",
      targetDate: "2026-12-15",
      priority: g.gap >= 3 ? "Critical" : g.gap === 2 ? "High" : "Medium",
      owner: architect.name,
      status: "Not Started",
      progress: 0,
      evidenceIds: [],
    });
  };

  return (
    <>
      <PageHeader
        title="Plano de Desenvolvimento"
        description="O sistema sugere competências a partir da análise de lacunas, SWOT, nível esperado e avaliação do líder."
        actions={
          <select
            className="rounded-md border border-input bg-card px-3 py-2 text-sm"
            value={architectId}
            onChange={(e) => setArchitectId(e.target.value)}
          >
            {store.architects.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {(plan?.items ?? []).map((item) => {
            const comp = sel.competencyById(item.competencyId);
            return (
              <div key={item.id} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold">{comp?.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.objective}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LevelBadge level={item.currentLevel} />
                    <span className="text-muted-foreground">→</span>
                    <LevelBadge level={item.targetLevel} />
                    <GapBadge gap={item.targetLevel - item.currentLevel} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Field label="Tipo de ação">
                    <select
                      className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                      value={item.actionType}
                      onChange={(e) =>
                        store.updatePlanItem(plan!.id, item.id, {
                          actionType: e.target.value as ActionType,
                        })
                      }
                    >
                      {ACTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {actionTypeLabel[t]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                      value={item.status}
                      onChange={(e) =>
                        store.updatePlanItem(plan!.id, item.id, {
                          status: e.target.value as PdiStatus,
                        })
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {planItemStatusLabel[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Prioridade">
                    <p className="py-1.5 text-sm">{priorityLabel[item.priority]}</p>
                  </Field>
                  <Field label="Prazo">
                    <p className="py-1.5 text-sm tabular-nums">{item.targetDate}</p>
                  </Field>
                </div>

                <div className="mt-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Plano de ação
                  </p>
                  <Textarea
                    value={item.actionPlan}
                    onChange={(e) =>
                      store.updatePlanItem(plan!.id, item.id, { actionPlan: e.target.value })
                    }
                    placeholder="Aprender, Praticar, Aplicar, Ensinar, Mentorar, Liderar — descreva as atividades práticas"
                  />
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progresso</span>
                    <span className="tabular-nums">{item.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={item.progress}
                    onChange={(e) =>
                      store.updatePlanItem(plan!.id, item.id, { progress: Number(e.target.value) })
                    }
                    className="w-full accent-[var(--primary)]"
                  />
                  <Bar value={item.progress} />
                </div>

                {item.smart && (
                  <div className="mt-4 rounded-lg border border-border bg-secondary/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      SMART Goal
                    </p>
                    <p className="mt-2 text-sm">{item.smart.statement}</p>
                    <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        <dt className="font-medium text-foreground">Specific</dt>
                        <dd>{item.smart.specific}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Measurable</dt>
                        <dd>{item.smart.measurable}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Achievable</dt>
                        <dd>{item.smart.achievable}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Relevant</dt>
                        <dd>{item.smart.relevant}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Time-bound</dt>
                        <dd>{item.smart.timeBound}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                {!item.smart && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() =>
                      store.updatePlanItem(plan!.id, item.id, {
                        smart: {
                          specific: `Desenvolver ${comp?.name} até o nível ${item.targetLevel}`,
                          measurable: "Duas entregas arquiteturais, um ADR e uma sessão técnica",
                          achievable: "Compatível com a alocação atual em projetos",
                          relevant: `${comp?.name} é prioridade no roadmap técnico do time`,
                          timeBound: `Até ${item.targetDate}`,
                          statement: `Até ${item.targetDate}, aplicar ${comp?.name} em ao menos dois contextos reais, documentar as decisões em ADRs e apresentar os trade-offs ao time.`,
                        },
                      })
                    }
                  >
                    Transformar em meta SMART
                  </Button>
                )}
              </div>
            );
          })}
          {!plan?.items.length && (
            <SectionCard
              title="Nenhum item de PDI"
              description="Adicione competências sugeridas ao lado."
            >
              <p className="text-sm text-muted-foreground">O plano deste ciclo ainda está vazio.</p>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Sugestões automáticas"
            description="Baseadas em gap, SWOT e nível esperado do cargo."
          >
            <ul className="space-y-2">
              {suggestions.map((g) => (
                <li key={g.item.competencyId} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{g.competency?.name}</p>
                    <GapBadge gap={g.gap} />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 px-0"
                    onClick={() => addSuggestion(g.item.competencyId)}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Adicionar ao PDI
                  </Button>
                </li>
              ))}
              {!suggestions.length && (
                <p className="text-sm text-muted-foreground">Todos os gaps já estão no plano.</p>
              )}
            </ul>
          </SectionCard>

          <SectionCard title="SWOT Individual" description="Insumo qualitativo do ciclo.">
            {swot ? (
              <div className="grid gap-3 text-sm">
                <SwotBlock title="Forças" items={swot.strengths} />
                <SwotBlock title="Fraquezas" items={swot.weaknesses} />
                <SwotBlock title="Oportunidades" items={swot.opportunities} />
                <SwotBlock title="Ameaças" items={swot.threats} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">SWOT não preenchida neste ciclo.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Modelo de Ações de Desenvolvimento"
            description="Progressão de maturidade da ação."
          >
            <div className="flex flex-wrap gap-1.5">
              {ACTION_TYPES.map((t, i) => (
                <span key={t} className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium">
                  {i + 1}. {t}
                </span>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function SwotBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
