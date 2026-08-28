import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOptionListNavigation } from "@/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface MultiSelectFilterOption {
  id: string;
  label: string;

  isPlaceholder?: boolean;
}

export function MultiSelectFilter({
  id,
  label,
  options,
  selected,
  onChange,
  selectAllLabel,
  allSummaryLabel,
  noneSummaryLabel,
  emptyLabel,
}: {
  id: string;
  label: string;
  options: MultiSelectFilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  selectAllLabel: string;
  allSummaryLabel: string;
  noneSummaryLabel: string;

  emptyLabel?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const isEmpty = options.filter((o) => !o.isPlaceholder).length === 0;

  const { optionProps, onListKeyDown, onTriggerKeyDown } = useOptionListNavigation({
    optionCount: options.length + 1,
    openList: () => {
      if (!isEmpty) setOpen(true);
    },
  });

  const toggle = (optionId: string) =>
    onChange(
      selected.includes(optionId)
        ? selected.filter((s) => s !== optionId)
        : [...selected, optionId],
    );

  const allSelected = options.length > 0 && selected.length === options.length;
  const summary =
    selected.length === 0
      ? noneSummaryLabel
      : allSelected
        ? allSummaryLabel
        : selected.length === 1
          ? (options.find((o) => o.id === selected[0])?.label ?? t("filter.multi.count", { n: 1 }))
          : t("filter.multi.count", { n: selected.length });

  return (
    <div>
      <label className="block text-sm text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterTriggerButton
            id={id}
            disabled={isEmpty}
            onKeyDown={onTriggerKeyDown}
            aria-haspopup="listbox"
            title={isEmpty ? (emptyLabel ?? t("filter.multi.empty")) : summary}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {isEmpty ? (emptyLabel ?? t("filter.multi.empty")) : summary}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </FilterTriggerButton>
        </PopoverTrigger>
        <PopoverContent
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          onKeyDown={onListKeyDown}
          align="start"
          className="w-56 max-h-72 overflow-y-auto p-1"
        >
          <button
            {...optionProps(0)}
            type="button"
            onClick={() => onChange(allSelected ? [] : options.map((o) => o.id))}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
          >
            <Checkbox
              checked={allSelected ? true : selected.length === 0 ? false : "indeterminate"}
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none"
            />
            <span className="font-medium">{selectAllLabel}</span>
          </button>
          <div className="my-1 border-t border-border" />
          {options.map((option, index) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                {...optionProps(index + 1)}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => toggle(option.id)}
                title={option.label}
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
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("filter.multi.empty")}</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
