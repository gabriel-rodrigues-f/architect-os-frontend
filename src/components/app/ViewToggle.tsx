import type { LucideIcon } from "lucide-react";
import { LayoutGrid, Table2 } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface ViewOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

export type CardsOrTable = "cards" | "table";

export function useCardsAndTableViews(): readonly ViewOption<CardsOrTable>[] {
  const { t } = useI18n();
  return [
    { value: "cards", label: t("team.view.cards"), icon: LayoutGrid },
    { value: "table", label: t("team.view.table"), icon: Table2 },
  ];
}

export function ViewToggle<T extends string>({
  view,
  onChange,
  options,
}: {
  view: T;
  onChange: (view: T) => void;
  options: readonly ViewOption<T>[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-input p-0.5">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={view === value}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            "rounded p-1.5 transition-colors",
            view === value
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
