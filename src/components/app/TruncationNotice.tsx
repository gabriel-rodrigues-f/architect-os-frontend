import { useI18n, type MessageKey } from "@/lib/i18n";

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
