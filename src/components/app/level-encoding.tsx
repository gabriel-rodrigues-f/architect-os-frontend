import { LevelCell } from "@/components/app/ui-bits";
import { useDisplayPreferences } from "@/hooks";
import { levelPatternImage, PATTERN_INK } from "@/lib/accessibility";
import { LEVELS, type Level } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";

function isLevel(value: number | undefined): value is Level {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 5;
}

function usePatternInk(): number {
  const { needsStrongerEncoding } = useDisplayPreferences();
  return needsStrongerEncoding ? PATTERN_INK.strong : PATTERN_INK.subtle;
}

export function LevelHeatCell({ level }: { level: number | undefined }) {
  const intensidade = usePatternInk();

  return (
    <div className="relative">
      <LevelCell level={level} />
      {isLevel(level) && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-md"
          style={{ backgroundImage: levelPatternImage(level, intensidade) }}
        />
      )}
    </div>
  );
}

export function LevelScaleKey() {
  const { t } = useI18n();
  const labels = useLabels();
  const intensidade = usePatternInk();

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
            style={{
              backgroundColor: `var(--level-${String(level)})`,
              backgroundImage: levelPatternImage(level, intensidade),
            }}
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
