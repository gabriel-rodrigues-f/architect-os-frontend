import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ArchitectFilter, applyArchitectFilter } from "@/components/app/ArchitectFilter";
import { CapabilitiesTabs } from "@/components/app/CapabilitiesTabs";
import { CapabilityRadar } from "@/components/app/charts";
import { Badge } from "@/components/ui/badge";
import { GapBadge, LevelCell, PageHeader, SectionCard } from "@/components/app/ui-bits";
import type { Architect } from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { averageWithCoverage, type Gap } from "@/lib/selectors";
import { canActFor } from "@/lib/scope";
import { useSelectors, useStore } from "@/lib/store";

/**
 * ORIENTACAO-NONA-RODADA ENT-09-012 — uma linha consolidada por competência
 * com todos os números secundários (Seção 33): quantas pessoas, gap médio e
 * máximo, e as médias que compõem esse gap — nunca só o pior caso.
 * `requirementType` vem junto porque separar bloqueante de oportunidade é a
 * própria reestruturação pedida, não um detalhe da tabela.
 */
interface ConsolidatedGapRow {
  competencyId: string;
  name: string;
  capabilityId: string;
  requirementType: "RESTRICTIVE" | "NON_RESTRICTIVE";
  people: number;
  /** Nomes de quem tem essa lacuna — a lista de prioridades mostrava só a contagem, e quem lê queria saber quem. */
  architectNames: string[];
  totalGap: number;
  maxGap: number;
  avgGap: number;
  avgFinal: number;
  avgTarget: number;
}

function consolidateGaps(architects: Architect[], gapsFor: (architectId: string) => Gap[]): ConsolidatedGapRow[] {
  const map = new Map<
    string,
    {
      competencyId: string;
      name: string;
      capabilityId: string;
      requirementType: "RESTRICTIVE" | "NON_RESTRICTIVE";
      people: number;
      architectNames: string[];
      totalGap: number;
      maxGap: number;
      sumFinal: number;
      sumTarget: number;
    }
  >();

  for (const architect of architects) {
    for (const gap of gapsFor(architect.id)) {
      if (gap.gap <= 0 || !gap.competency) continue;
      const current = map.get(gap.competency.id) ?? {
        competencyId: gap.competency.id,
        name: gap.competency.name,
        capabilityId: gap.competency.capabilityId,
        requirementType: gap.competency.requirementType,
        people: 0,
        architectNames: [],
        totalGap: 0,
        maxGap: 0,
        sumFinal: 0,
        sumTarget: 0,
      };
      map.set(gap.competency.id, {
        ...current,
        people: current.people + 1,
        architectNames: [...current.architectNames, architect.name],
        totalGap: current.totalGap + gap.gap,
        maxGap: Math.max(current.maxGap, gap.gap),
        sumFinal: current.sumFinal + gap.item.final,
        sumTarget: current.sumTarget + gap.item.target,
      });
    }
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      avgFinal: Number((row.sumFinal / row.people).toFixed(1)),
      avgTarget: Number((row.sumTarget / row.people).toFixed(1)),
      avgGap: Number((row.totalGap / row.people).toFixed(1)),
    }))
    .sort((a, b) => b.totalGap - a.totalGap || b.maxGap - a.maxGap);
}

export const Route = createFileRoute("/gap-analysis")({
  head: () => ({
    meta: [
      { title: "Análise de Lacunas — Synapse" },
      {
        name: "description",
        content: "Análise automática de gaps entre nível atual e nível esperado por competência.",
      },
      { property: "og:title", content: "Análise de Lacunas — Synapse" },
      {
        property: "og:description",
        content: "Tabela, radar, heatmap e ranking de prioridades de desenvolvimento.",
      },
    ],
  }),
  component: GapPage,
});

function GapPage() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const { t } = useI18n();
  /**
   * Nasce com o time que este viewer de fato enxerga (`canActFor`) — quem já
   * saiu não conta como lacuna do time ativo, e quem está fora do escopo não
   * conta como "sem lacuna" só por não ter registro visível (roster é dado
   * de diretório sem filtro; ver `auth/scope.ts`). Depois disso `selected` é
   * sempre explícito (ver `ArchitectFilter`): selecionar alguém fora desse
   * recorte inicial (gente inativa ou fora do escopo) ainda funciona — a
   * lista de opções do filtro continua sendo `store.architects` inteiro; a
   * própria falta de dado visível já degrada de forma transparente via
   * `coverage`. Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-
   * SYNAPSE.md, EPIC E, e ANA-001, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-
   * 08-19.md.
   */
  const [selected, setSelected] = useState<string[]>(() =>
    sel.activeArchitects.filter((a) => canActFor(user, a)).map((a) => a.id),
  );

  /** Toda a tela lê deste recorte. */
  const architects = applyArchitectFilter(store.architects, selected);

  /**
   * Radar: média por capacidade só entre quem tem assessment oficial cobrindo
   * aquela capacidade — quem não tem simplesmente não entra na média, em vez de
   * puxá-la para baixo como um nível 0 fictício faria. `coverage` guarda
   * quantos de quantos contribuíram, para a legenda avisar quando a média é
   * de uma fração pequena do grupo. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-
   * SYNAPSE.md, Seção 9.
   */
  const radar = useMemo(
    () =>
      store.capabilities.map((cat) => {
        const rows = architects.map((a) =>
          sel.capabilityAverages(a.id).find((d) => d.capability.id === cat.id),
        );
        const atual = averageWithCoverage(rows.map((r) => r?.avg));
        const alvo = averageWithCoverage(rows.map((r) => r?.target));
        return {
          capability: cat.short,
          atual: Number((atual.avg ?? 0).toFixed(2)),
          alvo: Number((alvo.avg ?? 0).toFixed(2)),
          covered: atual.covered,
          total: atual.total,
        };
      }),
    [architects, store.capabilities, sel],
  );

  /** Pior cobertura entre as capacidades do radar — sinaliza quando a leitura é de poucos. */
  const radarCoverage = radar.reduce(
    (min, r) => (r.covered < min.covered ? r : min),
    radar[0] ?? { covered: 0, total: 0 },
  );

  /**
   * ORIENTACAO-NONA-RODADA ENT-09-012 — bloqueante (RESTRICTIVE: impede a
   * progressão enquanto não fechar) e oportunidade (NON_RESTRICTIVE: entra
   * na média, mas nunca bloqueia sozinha) nunca aparecem na mesma lista —
   * misturar os dois é exatamente o problema que a Seção 33 aponta, porque
   * esconde qual lacuna de fato trava alguém.
   */
  const progression = useMemo(
    () => consolidateGaps(architects, (id) => sel.progressionGapsFor(id)),
    [architects, sel],
  );
  const blocking = useMemo(
    () => progression.filter((r) => r.requirementType === "RESTRICTIVE"),
    [progression],
  );
  const opportunity = useMemo(
    () => progression.filter((r) => r.requirementType === "NON_RESTRICTIVE"),
    [progression],
  );

  /**
   * Nível III (topo da carreira): nunca "gap para o Nível IV" — não existe
   * próximo nível para essa régua. `masteryOpportunitiesFor` já isola esses
   * itens (Seção 17.1/18 de `selectors.ts`); aqui só consolidam por
   * competência, com a mesma forma da tabela de progressão, para reaproveitar
   * o mesmo componente de exibição sem herdar a linguagem de "bloqueio".
   */
  const mastery = useMemo(
    () => consolidateGaps(architects, (id) => sel.masteryOpportunitiesFor(id)),
    [architects, sel],
  );

  const scopeLabel =
    selected.length === 0
      ? "todo o time"
      : architects.map((a) => a.name.split(" ")[0]).join(", ") || "seleção vazia";

  return (
    <>
      <CapabilitiesTabs />
      <PageHeader
        title={t("gap.title")}
        description={t("gap.subtitle")}
        actions={
          <ArchitectFilter
            architects={store.architects}
            selected={selected}
            onChange={setSelected}
          />
        }
      />

      {architects.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("gap.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {store.architects.length === 0
              ? "Cadastre arquitetos em Time e abra uma avaliação do ciclo para ver as lacunas aqui."
              : t("gap.empty.filterHint")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard
              title={t("gap.radar.title")}
              description={t("gap.radar.subtitle", { escopo: scopeLabel })}
            >
              <CapabilityRadar data={radar} />
              {radarCoverage.total > 0 && radarCoverage.covered < radarCoverage.total && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("gap.radar.coverage", {
                    covered: radarCoverage.covered,
                    total: radarCoverage.total,
                  })}
                </p>
              )}
            </SectionCard>

            <SectionCard
              title={t("gap.priorities.title")}
              description={t("gap.priorities.subtitle", { n: architects.length })}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                    {t("gap.priorities.blocking.title")}
                  </h3>
                  <GapPriorityList rows={blocking} emptyLabel={t("gap.priorities.blocking.none")} />
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("gap.priorities.opportunity.title")}
                  </h3>
                  <GapPriorityList
                    rows={opportunity}
                    emptyLabel={t("gap.priorities.opportunity.none")}
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            className="mt-6"
            title={t("gap.heatmap.title")}
            description={t("gap.heatmap.subtitle", { escopo: scopeLabel })}
          >
            {/* ENT-09-016 — cabeçalho fixo: o heatmap cresce uma linha por arquiteto do time. */}
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 w-44 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                      {t("col.architect")}
                    </th>
                    {store.capabilities.map((c) => (
                      <th
                        key={c.id}
                        className="sticky top-0 z-10 bg-card text-center text-[11px] text-muted-foreground"
                      >
                        {c.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {architects.map((a) => (
                    <tr key={a.id}>
                      <td className="text-sm font-medium">{a.name}</td>
                      {sel.capabilityAverages(a.id).map((d) => (
                        <td key={d.capability.id} className="min-w-[52px]">
                          <LevelCell level={d.avg === undefined ? undefined : Math.round(d.avg)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            className="mt-6"
            title={t("gap.table.title")}
            description={t("gap.table.subtitle", { escopo: scopeLabel })}
          >
            <GapTable rows={[...blocking, ...opportunity]} capabilities={store.capabilities} />
          </SectionCard>

          {mastery.length > 0 && (
            <SectionCard
              className="mt-6"
              title={t("gap.mastery.title")}
              description={t("gap.mastery.subtitle", { escopo: scopeLabel })}
            >
              <GapTable rows={mastery} capabilities={store.capabilities} mastery />
            </SectionCard>
          )}
        </>
      )}
    </>
  );
}

/**
 * ORIENTACAO-NONA-RODADA ENT-09-012 — os números secundários que compõem o
 * gap (médio, máximo, atual, alvo, pessoas afetadas) sempre juntos: o
 * `GapBadge` sozinho só mostra o pior caso, e a Seção 33 pede que a média
 * apareça lado a lado, nunca escondida atrás do máximo.
 */
function GapPriorityList({ rows, emptyLabel }: { rows: ConsolidatedGapRow[]; emptyLabel: string }) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ol className="space-y-2">
      {rows.slice(0, 8).map((row, i) => (
        <li
          key={row.competencyId}
          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
        >
          <span className="text-sm">
            <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
            {row.name}
            <span className="ml-2 text-xs text-muted-foreground">
              {t("gap.priorities.peopleAndAvg", { n: row.people, avg: row.avgGap })}
            </span>
            {/* Quem tem essa lacuna, por nome — a contagem sozinha não dizia quem tratar no PDI. */}
            <span className="block text-xs text-muted-foreground">
              {row.architectNames.join(", ")}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <GapBadge gap={row.maxGap} />
            {/* Diagnóstico precisa levar a algum lugar: daqui se vai tratar a lacuna. */}
            <Link
              to="/development-plans"
              className="whitespace-nowrap text-xs text-primary hover:underline"
            >
              {t("gap.priorities.action")}
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Tabela compartilhada por progressão (bloqueante + oportunidade, com coluna
 * de tipo) e por maestria (Nível III, sem coluna de tipo — a distinção
 * bloqueante/oportunidade só faz sentido quando existe um próximo nível para
 * travar).
 */
function GapTable({
  rows,
  capabilities,
  mastery = false,
}: {
  rows: ConsolidatedGapRow[];
  capabilities: { id: string; name: string }[];
  mastery?: boolean;
}) {
  const { t } = useI18n();
  /**
   * ORIENTACAO-NONA-RODADA ENT-09-016 — cabeçalho fixo dentro de uma altura
   * máxima: esta tabela cresce com o time e o catálogo (uma linha por
   * competência com gap), e sem isto rolar a lista perde de vista qual
   * coluna é qual. `sticky` fica em cada `<th>`, não em `<thead>` — suporte
   * mais consistente entre navegadores.
   */
  return (
    <div className="max-h-[480px] overflow-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky top-0 z-10 bg-card py-2">{t("col.competency")}</th>
            <th className="sticky top-0 z-10 bg-card py-2">{t("col.capability")}</th>
            {!mastery && <th className="sticky top-0 z-10 bg-card py-2">{t("col.type")}</th>}
            <th className="sticky top-0 z-10 bg-card py-2 text-center">{t("col.people")}</th>
            <th className="sticky top-0 z-10 bg-card py-2 text-center">{t("col.currentAvg")}</th>
            <th className="sticky top-0 z-10 bg-card py-2 text-center">{t("col.targetAvg")}</th>
            <th className="sticky top-0 z-10 bg-card py-2 text-center">{t("col.avgGap")}</th>
            <th className="sticky top-0 z-10 bg-card py-2">{t("col.classification")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.competencyId} className="border-b border-border/60 last:border-0">
              <td className="py-2 font-medium">{row.name}</td>
              <td className="py-2 text-muted-foreground">
                {capabilities.find((c) => c.id === row.capabilityId)?.name}
              </td>
              {!mastery && (
                <td className="py-2">
                  <Badge variant={row.requirementType === "RESTRICTIVE" ? "outline" : "secondary"}>
                    {row.requirementType === "RESTRICTIVE"
                      ? t("gap.type.blocking")
                      : t("gap.type.opportunity")}
                  </Badge>
                </td>
              )}
              <td
                className="py-2 text-center tabular-nums"
                title={row.architectNames.join(", ")}
              >
                {row.people}
              </td>
              <td className="py-2 text-center tabular-nums">{row.avgFinal}</td>
              <td className="py-2 text-center tabular-nums">{row.avgTarget}</td>
              <td className="py-2 text-center tabular-nums">{row.avgGap}</td>
              <td className="py-2">
                {mastery ? (
                  <Badge variant="outline">{t("gap.mastery.badge", { n: row.maxGap })}</Badge>
                ) : (
                  <GapBadge gap={row.maxGap} />
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={mastery ? 6 : 7} className="py-3 text-sm text-muted-foreground">
                {t("gap.table.empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
