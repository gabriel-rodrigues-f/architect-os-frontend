import { Bar } from "@/components/app/ui-bits";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AdherenceSummary({
  label,
  percentage,
  missingCount,
  className,
}: {
  label: string;
  percentage: number;
  missingCount: number;
  className?: string;
}) {
  const { t } = useI18n();
  const missingText =
    missingCount === 0
      ? t("adherence.missing.none")
      : missingCount === 1
        ? t("adherence.missing.one")
        : t("adherence.missing.many", { n: missingCount });
  return (
    <div className={cn("surface-card p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">
        {Math.round(percentage)}%
      </p>
      <Bar value={percentage} className="mt-2" />
      <p
        className={cn(
          "mt-2 text-sm font-semibold",
          missingCount === 0 && "font-normal text-muted-foreground",
        )}
      >
        {missingText}
      </p>
    </div>
  );
}
