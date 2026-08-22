import { useMemo, useState } from "react";

import { GapBadge } from "@/components/app/ui-bits";
import { Badge } from "@/components/ui/badge";
import { applyArchitectFilter } from "@/components/app/ArchitectFilter";
import type { Architect } from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { averageWithCoverage, type Gap } from "@/lib/selectors";
import { canActFor } from "@/lib/scope";
import { useSelectors, useStore } from "@/lib/store";
import { initialSearchParam, replaceSearchParam } from "@/lib/text";

/**
 * Compartilhado entre `/gap-analysis` (Radar + Prioridades, por pessoa) e
 * `/progression` (Mapa de Calor + Tabela, consolidado por competência) —
 * as duas abas leem o mesmo recorte de arquitetos e a mesma consolidação de
 * lacunas, só apresentam de formas diferentes. Extraído pra não duplicar o
 * cálculo (e arriscar as duas telas divergirem) quando o "Progressão" saiu
 * do fim de `/gap-analysis` pra sua própria aba.
 *
 * ORIENTACAO-NONA-RODADA ENT-09-012 — uma linha consolidada por competência
 * com todos os números secundários (Seção 33): quantas pessoas, gap médio e
 * máximo, e as médias que compõem esse gap — nunca só o pior caso.
 * `requirementType` vem junto porque separar bloqueante de oportunidade é a
 * própria reestruturação pedida, não um detalhe da tabela.
 */
export interface ConsolidatedGapRow {
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

export function consolidateGaps(
  architects: Architect[],
  gapsFor: (architectId: string) => Gap[],
): ConsolidatedGapRow[] {
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

/**
 * Recorte + radar + bloqueante/oportunidade/maestria — o que as duas abas
 * têm em comum. `selected`/`setSelected` voltam pro chamador porque cada
 * aba tem seu próprio `ArchitectFilter` no `PageHeader` (a UI do filtro não
 * é compartilhada, só o cálculo que ela alimenta).
 */
export function useGapAnalysisData() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();

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
   *
   * B-12 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1) — o recorte
   * agora vive na URL (`?selected=id1,id2`), não só em memória: sem isso, dar
   * F5 depois de trocar a seleção (ou mandar o link para outra pessoa)
   * sempre voltava para o time inteiro, perdendo o filtro que a tela estava
   * mostrando. Ausência do parâmetro (primeira visita) cai no time visível
   * padrão; presente e vazio (`?selected=`) é "ninguém" de propósito, uma
   * seleção explícita, não o padrão.
   */
  const defaultSelected = useMemo(
    () => sel.activeArchitects.filter((a) => canActFor(user, a)).map((a) => a.id),
    [sel, user],
  );
  const [selected, setSelectedState] = useState<string[]>(() => {
    const fromUrl = initialSearchParam("selected");
    if (fromUrl === undefined) return defaultSelected;
    return fromUrl === "" ? [] : fromUrl.split(",");
  });
  const setSelected = (ids: string[]) => {
    setSelectedState(ids);
    replaceSearchParam("selected", ids.join(","));
  };

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

  /**
   * ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 4.2/17/36 (A1/B2) — texto
   * ficou obsoleto depois que `selected: []` passou a significar "ninguém"
   * (não mais "todo o time implícito", ver `ArchitectFilter`). Compara com
   * `architects.length` (já resolvido por `applyArchitectFilter`), não com
   * `store.architects.length` diretamente — assim um id de seleção que não
   * existe mais no roster não faz a contagem bater por acidente.
   */
  const { t } = useI18n();
  const scopeLabel =
    selected.length === 0
      ? t("gap.scope.none")
      : architects.length === store.architects.length
        ? t("gap.scope.wholeTeam")
        : architects.map((a) => a.name.split(" ")[0]).join(", ") || t("gap.scope.empty");

  return {
    store,
    selected,
    setSelected,
    architects,
    radar,
    radarCoverage,
    blocking,
    opportunity,
    mastery,
    scopeLabel,
  };
}

/**
 * Tabela compartilhada por progressão (bloqueante + oportunidade, com coluna
 * de tipo) e por maestria (Nível III, sem coluna de tipo — a distinção
 * bloqueante/oportunidade só faz sentido quando existe um próximo nível para
 * travar).
 */
export function GapTable({
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
              <td className="py-2 text-center tabular-nums" title={row.architectNames.join(", ")}>
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
