import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AiExplanation } from "@/components/app/AiExplanation";
import { DataOriginCallout } from "@/components/app/DataOriginCallout";
import { QuerySection } from "@/components/app/QuerySection";
import { EmptyState, SectionCard, SectionHeading, StatCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { analyticsApi } from "@/lib/api";
import type {
  GapClosureVelocity,
  GapClosureWaterfall,
  GapCycleTotal,
} from "@/lib/gateways/analytics.gateway";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { GapClosureViewModel, type GapMovementRow } from "@/lib/view-models";

const GAP_CLOSURE_QUERY_KEY = ["analytics", "gap-closure"];
const GAP_CLOSURE_EXPLANATION_QUERY_KEY = [...GAP_CLOSURE_QUERY_KEY, "explanation"];

/**
 * A EVOLUÇÃO ENTRE CICLOS SÓ PERGUNTA QUANDO EXISTE CICLO.
 *
 * Bug irmão do banco vazio (dono, 2026-09-08): a seção chamava
 * `gapClosure({})` sem ciclo, o servidor tentava resolver "o ciclo vigente",
 * não havia nenhum e devolvia 404 — e a tela pintava "Não foi possível
 * carregar a evolução entre ciclos" em VERMELHO, como se o serviço tivesse
 * caído. A rota existe (sem sessão responde 401): é 404 de NEGÓCIO, e negócio
 * ausente não é falha de serviço.
 *
 * Sem ciclo, então, nada é perguntado: entra o estado vazio no vocabulário da
 * casa. Com ciclo, a pergunta é a de sempre — e o ciclo viaja EXPLÍCITO, para
 * o servidor não ter que adivinhar qual é o vigente.
 */
export function GapClosureSection() {
  const { t } = useI18n();
  const store = useStore();
  const vm = useMemo(() => new GapClosureViewModel(), []);
  const cycleId = store.activeCycleId;
  const semCiclo = cycleId === "";
  const closure = useQuery({
    queryKey: [...GAP_CLOSURE_QUERY_KEY, cycleId],
    queryFn: () => analyticsApi.gapClosure({ cycleId }),
    enabled: !semCiclo,
  });

  if (semCiclo)
    return (
      <SectionCard title={t("gapClosure.title")} description={t("gapClosure.subtitle")}>
        <EmptyState title={t("gapClosure.noCycle")} hint={t("gapClosure.noCycle.hint")} />
      </SectionCard>
    );

  return (
    <QuerySection
      query={closure}
      title={t("gapClosure.title")}
      description={t("gapClosure.subtitle")}
      skeleton={<div className="h-40 animate-pulse rounded-md bg-secondary" />}
      errorMessage={t("gapClosure.error")}
    >
      {(data) => (
        <SectionCard title={t("gapClosure.title")} description={t("gapClosure.subtitle")}>
          <DataOriginCallout origin={data.dataOrigin} className="mb-4" />
          {vm.comparable(data) ? (
            <>
              <GapClosureFigures
                waterfall={data.waterfall}
                velocity={data.velocity}
                percent={vm.closureRatePercent(data.velocity)}
              />
              <GapMovementList rows={vm.movements(data.waterfall)} />
              <GapClosureExplanationBlock />
            </>
          ) : (
            <EmptyState
              title={t("gapClosure.noPreviousCycle")}
              hint={t("gapClosure.noPreviousCycle.hint")}
            />
          )}
        </SectionCard>
      )}
    </QuerySection>
  );
}

function GapClosureExplanationBlock() {
  const { t } = useI18n();
  const [asked, setAsked] = useState(false);
  const explanation = useQuery({
    queryKey: GAP_CLOSURE_EXPLANATION_QUERY_KEY,
    queryFn: () => analyticsApi.explainGapClosure({}),
    enabled: asked,
    staleTime: Infinity,
  });

  return (
    <div className="mt-5 border-t border-border pt-4">
      {asked ? (
        <QuerySection
          query={explanation}
          skeleton={<div className="h-20 animate-pulse rounded-md bg-secondary" />}
          errorMessage={t("gapClosure.explain.error")}
        >
          {(data) => <AiExplanation text={data.text} />}
        </QuerySection>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={() => setAsked(true)}>
            {t("gapClosure.explain.action")}
          </Button>
          <p className="mt-2 max-w-prose text-xs text-muted-foreground">
            {t("gapClosure.explain.hint")}
          </p>
        </>
      )}
    </div>
  );
}

function GapClosureFigures({
  waterfall,
  velocity,
  percent,
}: {
  waterfall: GapClosureWaterfall;
  velocity: GapClosureVelocity;
  percent: number | null;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <GapCycleTotalCard label={t("gapClosure.cycle.from")} total={waterfall.from} />
        <GapCycleTotalCard label={t("gapClosure.cycle.to")} total={waterfall.to} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("gapClosure.stat.closed")} value={velocity.gapsClosed} />
        <StatCard label={t("gapClosure.stat.opened")} value={velocity.gapsOpened} />
        <StatCard label={t("gapClosure.stat.net")} value={velocity.netClosed} />
        <StatCard
          label={t("gapClosure.stat.rate")}
          value={percent === null ? t("gapClosure.stat.rate.none") : `${percent}%`}
          hint={t("gapClosure.stat.rate.hint", { days: velocity.elapsedDays })}
        />
      </div>
    </>
  );
}

function GapCycleTotalCard({ label, total }: { label: string; total: GapCycleTotal }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border p-3">
      <SectionHeading as="p" muted>
        {label}
      </SectionHeading>
      <p className="mt-1 font-display text-base font-semibold">{total.cycleName}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("gapClosure.cycle.total", { steps: total.totalGap, pairs: total.pairCount })}
      </p>
    </div>
  );
}

function GapMovementList({ rows }: { rows: GapMovementRow[] }) {
  const { t } = useI18n();
  if (rows.length === 0) return null;
  return (
    <ul className="mt-4 space-y-1.5">
      {rows.map((row) => (
        <li
          key={row.kind}
          className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-1.5 text-sm last:border-0"
        >
          <span>{t(row.labelKey)}</span>
          <span className="tabular-nums text-muted-foreground">
            {row.amount === 0
              ? t("gapClosure.movement.pairsOnly", { pairs: row.pairCount })
              : t("gapClosure.movement.pairsAndSteps", {
                  pairs: row.pairCount,
                  steps: Math.abs(row.amount),
                })}
          </span>
        </li>
      ))}
    </ul>
  );
}
