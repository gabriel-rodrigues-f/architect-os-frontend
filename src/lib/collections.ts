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
