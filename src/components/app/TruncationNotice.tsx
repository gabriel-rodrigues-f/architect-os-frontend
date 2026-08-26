import { useI18n, type MessageKey } from "@/lib/i18n";

/**
 * OO3-11/D-2 — o aviso "mostrando N de M + alternar 'mostrar todas'" existia
 * em 4 cópias: `HeatmapColumnsNotice` (`gap-analysis-shared.tsx`),
 * `RadarAxisNotice` (`charts.tsx`) e duas versões inline em
 * `training-needs.tsx`. Mesma estrutura, mudando só as chaves i18n, o
 * limiar e um `mb-*`. As variantes nomeadas viram wrappers finos disto.
 */
export function TruncationNotice({
  shown,
  total,
  showAll,
  onToggle,
  threshold,
  className = "mb-3 text-xs text-muted-foreground",
  messages,
}: {
  shown: number;
  total: number;
  showAll: boolean;
  onToggle: () => void;
  /** Só avisa quando `total > threshold` — o mesmo corte silencioso que cada cópia aplicava. */
  threshold: number;
  className?: string;
  messages: {
    showingAll: MessageKey;
    showingTopN: MessageKey;
    showAll: MessageKey;
    showTopOnly: MessageKey;
  };
}) {
  const { t } = useI18n();
  if (total <= threshold) return null;
  return (
    <p className={className}>
      {showAll ? t(messages.showingAll, { total }) : t(messages.showingTopN, { shown, total })}{" "}
      <button
        type="button"
        className="underline underline-offset-2 hover:no-underline"
        onClick={onToggle}
      >
        {showAll ? t(messages.showTopOnly) : t(messages.showAll)}
      </button>
    </p>
  );
}
