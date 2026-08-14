import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Bar, GapBadge, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ACTION_TYPES, type ActionType, type PdiStatus } from "@/lib/domain";
import { useLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";
import { formatDate, monthsFromTodayIso, todayIso } from "@/lib/text";

export const Route = createFileRoute("/development-plans")({
  head: () => ({
    meta: [
      { title: "Planos de Desenvolvimento — Architect OS" },
      {
        name: "description",
        content: "PDI gerado a partir de gaps, SWOT e avaliação do Tech Lead, com metas SMART.",
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

/** Os quatro quadrantes da SWOT, na ordem clássica. */
const SWOT_FIELDS = [
  { key: "strengths", titleKey: "swot.strengths" },
  { key: "weaknesses", titleKey: "swot.weaknesses" },
  { key: "opportunities", titleKey: "swot.opportunities" },
  { key: "threats", titleKey: "swot.threats" },
] as const;

function PlansPage() {
  const store = useStore();
  const sel = useSelectors();
  const labels = useLabels();
  const [architectId, setArchitectId] = useState(store.architects[0]?.id ?? "");
  const { t, locale } = useI18n();
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
      startDate: todayIso(),
      targetDate: monthsFromTodayIso(4),
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
        title={t("pdi.title")}
        description="O sistema sugere competências a partir da análise de lacunas, SWOT, nível esperado e avaliação do Tech Lead."
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
            /*
              A competência pode ter sido removida da matriz depois que o item
              do PDI foi criado — o gap que o gerou já não existe mais para
              recalcular o nome. Sem este retorno, `comp?.name` vira
              `undefined` e a string literal "undefined" vazava para dentro de
              frases inteiras (título, SMART goal), que é o bug relatado.
            */
            const competencyName = comp?.name ?? t("pdi.unknownCompetency");
            return (
              <div key={item.id} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold">{competencyName}</h3>
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
                  <Field label={t("pdi.field.actionType")}>
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
                          {labels.actionType[t]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("pdi.field.status")}>
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
                          {labels.planItemStatus[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("pdi.field.priority")}>
                    <p className="py-1.5 text-sm">{labels.priority[item.priority]}</p>
                  </Field>
                  <Field label={t("pdi.field.deadline")}>
                    <p className="py-1.5 text-sm tabular-nums">
                      {formatDate(item.targetDate, locale)}
                    </p>
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
                    <span>{t("pdi.progress")}</span>
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
                          specific: `Desenvolver ${competencyName} até o nível ${item.targetLevel}`,
                          measurable: "Duas entregas arquiteturais, um ADR e uma sessão técnica",
                          achievable: "Compatível com a alocação atual em projetos",
                          relevant: `${competencyName} é prioridade no roadmap técnico do time`,
                          timeBound: `Até ${formatDate(item.targetDate, locale)}`,
                          statement: `Até ${formatDate(item.targetDate, locale)}, aplicar ${competencyName} em ao menos dois contextos reais, documentar as decisões em ADRs e apresentar os trade-offs ao time.`,
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
            <SectionCard title={t("pdi.empty.title")} description={t("pdi.empty.subtitle")}>
              <p className="text-sm text-muted-foreground">O plano deste ciclo ainda está vazio.</p>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard
            title={t("pdi.suggestions.title")}
            description={t("pdi.suggestions.subtitle")}
          >
            <ul className="space-y-2">
              {suggestions.map((g) => (
                <li key={g.item.competencyId} className="surface-inset p-3">
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
                <p className="text-sm text-muted-foreground">{t("pdi.suggestions.none")}</p>
              )}
            </ul>
          </SectionCard>

          <SectionCard title={t("pdi.swot.title")} description={t("pdi.swot.subtitle")}>
            <div className="grid gap-3 text-sm">
              {SWOT_FIELDS.map(({ key, titleKey }) => (
                <SwotBlock
                  key={key}
                  title={t(titleKey)}
                  items={swot?.[key] ?? []}
                  onChange={(items) =>
                    store.updateSwot(architectId, store.activeCycleId, { [key]: items })
                  }
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title={t("pdi.actionModel.title")}
            description={t("pdi.actionModel.subtitle")}
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

/**
 * Um quadrante da SWOT. A lista é editada como texto — uma linha por item —
 * porque é assim que as pessoas escrevem SWOT numa reunião; um formulário com
 * "adicionar item" cobraria um clique por linha sem ganho nenhum.
 *
 * A gravação acontece no blur, não a cada tecla: salvar por caractere geraria
 * uma escrita por letra digitada.
 */
function SwotBlock({
  title,
  items,
  onChange,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const texto = draft ?? items.join("\n");

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <Textarea
        className="mt-1 min-h-16"
        aria-label={title}
        placeholder={t("pdi.swot.placeholder")}
        value={texto}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === null) return;
          onChange(
            draft
              .split("\n")
              .map((linha) => linha.trim())
              .filter(Boolean),
          );
          setDraft(null);
        }}
      />
    </div>
  );
}
