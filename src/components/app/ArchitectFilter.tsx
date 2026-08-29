import { ChevronDown, Users } from "lucide-react";
import { useState } from "react";

import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOptionListNavigation } from "@/hooks";
import type { Architect } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { Selection } from "@/lib/selection";
import { cn } from "@/lib/utils";

export function ArchitectFilter({
  architects,
  selected,
  onChange,
  label = undefined,
}: {
  architects: Architect[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const { optionProps, onListKeyDown, onTriggerKeyDown } = useOptionListNavigation({
    optionCount: architects.length + 1,
    openList: () => setOpen(true),
  });

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  const selectedVisible = selected.filter((id) => architects.some((a) => a.id === id));
  const allSelected = architects.length > 0 && selectedVisible.length === architects.length;

  const summary =
    selectedVisible.length === 0
      ? t("filter.none")
      : allSelected
        ? t("filter.wholeTeam", { n: architects.length })
        : selectedVisible.length === 1
          ? (architects.find((a) => a.id === selectedVisible[0])?.name ?? t("filter.oneArchitect"))
          : t("filter.nArchitects", { n: selectedVisible.length });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterTriggerButton
          onKeyDown={onTriggerKeyDown}
          aria-haspopup="listbox"
          title={summary}
          className="w-64"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </FilterTriggerButton>
      </PopoverTrigger>
      <PopoverContent
        role="listbox"
        aria-multiselectable="true"
        aria-label={label ?? t("filter.architects")}
        onKeyDown={onListKeyDown}
        align="end"
        className="w-64 max-h-72 overflow-y-auto p-1"
      >
        <button
          {...optionProps(0)}
          type="button"
          onClick={() => onChange(allSelected ? [] : architects.map((a) => a.id))}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
        >
          <Checkbox
            checked={allSelected ? true : selectedVisible.length === 0 ? false : "indeterminate"}
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none"
          />
          <span className="font-medium">{t("filter.wholeTeamOption")}</span>
        </button>
        <div className="my-1 border-t border-border" />
        {architects.map((a, index) => {
          const active = selected.includes(a.id);
          return (
            <button
              key={a.id}
              {...optionProps(index + 1)}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => toggle(a.id)}
              title={a.name}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none",
                active && "font-medium",
              )}
            >
              <Checkbox
                checked={active}
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none"
              />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
            </button>
          );
        })}
        {architects.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("filter.noArchitects")}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export const applyArchitectFilter = <T extends { id: string }>(
  architects: T[],
  selected: string[],
): T[] => Selection.explicit(selected).apply(architects);
