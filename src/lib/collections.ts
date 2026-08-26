/**
 * OO3-11/D-3 (reuso final) — o ranking "top-N por relevância preservando a
 * ordem original" existia duas vezes: privado em `charts.tsx`
 * (`topByRelevance`, corte de eixos do radar — R2-ESC-03) e reimplementado
 * byte a byte dentro de `capHeatmapColumns` em `gap-analysis-shared.tsx`
 * (corte de colunas do heatmap — R2-ESC-01, com `relevance = pior gap`).
 * Uma implementação só, sem UI: o objetivo dos dois cortes é reduzir ruído,
 * não reordenar — por isso os selecionados voltam na ORDEM original do
 * catálogo, nunca na ordem do score.
 */
export function topByRelevance<T>(
  data: readonly T[],
  relevance: (item: T) => number,
  max: number,
): T[] {
  if (data.length <= max) return [...data];
  const ranked = data
    .map((item, index) => ({ item, index, score: relevance(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
  const keep = new Set(ranked.map((r) => r.index));
  return data.filter((_, index) => keep.has(index));
}
