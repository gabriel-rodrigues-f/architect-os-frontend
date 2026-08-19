import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { GapBadge, Initials, PageHeader, SectionCard } from "@/components/app/ui-bits";
import type { Architect } from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useLabels } from "@/lib/labels";
import { useI18n, type I18nApi } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/talent-matrix")({
  head: () => ({
    meta: [
      { title: "Matriz de Talentos — Synapse" },
      {
        name: "description",
        content:
          "Matriz 9 Box de desempenho e potencial como ferramenta complementar de desenvolvimento.",
      },
      { property: "og:title", content: "Matriz de Talentos — Synapse" },
      {
        property: "og:description",
        content: "Posicione arquitetos na 9 Box e conecte a discussão ao PDI e aos gaps técnicos.",
      },
    ],
  }),
  component: TalentMatrixPage,
});

const LEVELS3 = ["High", "Medium", "Low"] as const;

/** Posição no eixo: 0 = Baixo, 2 = Alto. */
const RANK: Record<Architect["performance"], number> = { Low: 0, Medium: 1, High: 2 };

/**
 * Cor do quadrante: soma das duas posições (0 a 4), do vermelho no canto
 * inferior esquerdo ao verde no superior direito, passando pelo amarelo na
 * diagonal central — a mesma progressão "ruim → bom" que pinta lacunas e
 * níveis, para o app ter uma linguagem visual só.
 *
 * Os tokens são próprios, e não `bg-level-N/50`. Meia opacidade sobre fundo
 * variável não é cor previsível: no tema escuro os cinco quadrantes compunham
 * com a página e chegavam quase indistinguíveis entre si.
 */
const QUADRANT_TONE = [
  "bg-quadrant-1",
  "bg-quadrant-2",
  "bg-quadrant-3",
  "bg-quadrant-4",
  "bg-quadrant-5",
] as const;

function quadrantTone(
  performance: Architect["performance"],
  potential: Architect["potential"],
): string {
  return QUADRANT_TONE[RANK[performance] + RANK[potential]] ?? QUADRANT_TONE[2];
}

function TalentMatrixPage() {
  const store = useStore();
  const sel = useSelectors();
  const labels = useLabels();
  const { t } = useI18n();
  /** Calibração de talento é decisão do Tech Lead — member só visualiza. */
  const isAdmin = useCurrentUser().role === "admin";
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const architect = selected ? sel.architectById(selected) : undefined;
  const gaps = architect
    ? sel
        .gapsFor(architect.id)
        .filter((g) => g.gap > 0)
        .slice(0, 3)
    : [];
  const plan = architect ? sel.planFor(architect.id) : undefined;

  return (
    <>
      <PageHeader title={t("talent.title")} description={t("talent.subtitle")} />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <SectionCard title={t("talent.grid.title")} description={t("talent.grid.subtitle")}>
          <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-2">
            <div />
            {(["Low", "Medium", "High"] as const).map((p) => (
              <div
                key={p}
                className="pb-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {labels.rating[p]}
              </div>
            ))}
            {LEVELS3.map((potential) => (
              <Row key={potential}>
                <div className="flex items-center pr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.rating[potential]}
                </div>
                {(["Low", "Medium", "High"] as const).map((performance) => {
                  const people = store.architects.filter(
                    (a) => a.potential === potential && a.performance === performance,
                  );
                  return (
                    <div
                      key={`${potential}-${performance}`}
                      onDragOver={(e) => isAdmin && e.preventDefault()}
                      onDrop={() => {
                        if (isAdmin && dragging)
                          store.moveNineBox(dragging, performance, potential);
                        setDragging(null);
                      }}
                      className={`min-h-28 rounded-lg border border-dashed border-border p-2 ${quadrantTone(performance, potential)}`}
                    >
                      {people.map((a) => (
                        <button
                          key={a.id}
                          draggable={isAdmin}
                          onDragStart={() => setDragging(a.id)}
                          onClick={() => setSelected(a.id)}
                          className="mb-1.5 flex w-full items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-left text-xs hover:border-primary"
                        >
                          <Initials name={a.name} />
                          <span className="truncate">{a.name}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </Row>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={t("talent.detail.title")} description={t("talent.detail.subtitle")}>
          {!architect ? (
            <p className="text-sm text-muted-foreground">{t("talent.detail.none")}</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-display text-base font-semibold">{architect.name}</p>
                <p className="text-xs text-muted-foreground">{architect.role}</p>
              </div>
              <p>
                {t("talent.detail.position")}{" "}
                <strong>Desempenho {labels.rating[architect.performance]}</strong> ·{" "}
                <strong>Potencial {labels.rating[architect.potential]}</strong>
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("talent.detail.topGaps")}
                </p>
                <ul className="mt-1 space-y-1">
                  {gaps.map((g) => (
                    <li
                      key={g.item.competencyId}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{g.competency?.name}</span>
                      <GapBadge gap={g.gap} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("talent.detail.activePlan")}
                </p>
                <ul className="mt-1 list-disc pl-4">
                  {(plan?.items ?? []).map((i) => (
                    <li key={i.id}>
                      {sel.competencyById(i.competencyId)?.name} — {labels.planItemStatus[i.status]}{" "}
                      ({i.progress}%)
                    </li>
                  ))}
                </ul>
              </div>
              <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                {t("talent.detail.recommendation", { texto: recommendation(architect, t) })}
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function recommendation(a: Architect, t: I18nApi["t"]) {
  if (a.potential === "High" && a.performance === "High") return t("talent.rec.highHigh");
  if (a.potential === "High") return t("talent.rec.highPotential");
  if (a.performance === "High") return t("talent.rec.consolidate");
  return t("talent.rec.fundamentals");
}
