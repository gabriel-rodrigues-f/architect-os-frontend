import { LevelCell } from "@/components/app/ui-bits";
import { useDisplayPreferences } from "@/hooks";
import { LEVELS } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function LevelHeatCell({ level }: { level: number | undefined }) {
  const { needsStrongerEncoding } = useDisplayPreferences();

  return (
    <div
      className={cn(
        "rounded-md",
        needsStrongerEncoding && "outline-1 outline-offset-[-1px] outline-foreground",
      )}
    >
      <LevelCell level={level} />
    </div>
  );
}

export function LevelScaleKey() {
  const { t } = useI18n();
  const labels = useLabels();

  return (
    <ul
      aria-label={t("level.scale.label")}
      className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
    >
      {LEVELS.map(({ level }) => (
        <li key={level} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-border"
            style={{ backgroundColor: `var(--level-${String(level)})` }}
          />
          {t("level.scale.item", { n: level, nome: labels.levelName[level] })}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-border"
          style={{ backgroundColor: "var(--level-0)" }}
        />
        {t("level.scale.none")}
      </li>
    </ul>
  );
}
