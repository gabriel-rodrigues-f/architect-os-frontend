import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { FilterField } from "@/components/app/FilterField";
import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOptionListNavigation } from "@/hooks";
import { cn } from "@/lib/utils";

interface SingleSelectFilterOption {
  value: string;
  label: string;
}

export function SingleSelectFilter({
  id,
  label,
  ariaLabel,
  options,
  value,
  onChange,
  disabled,
  triggerClassName,
}: {
  id: string;

  label?: string;

  ariaLabel?: string;
  options: SingleSelectFilterOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;

  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  const { optionProps, onListKeyDown, onTriggerKeyDown } = useOptionListNavigation({
    optionCount: options.length,
    entryIndex: options.findIndex((o) => o.value === value),
    openList: () => {
      if (!disabled) setOpen(true);
    },
  });

  const select = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const accessibleLabel = label ?? ariaLabel;

  return (
    <FilterField label={label} htmlFor={id}>
      <Popover open={disabled ? false : open} onOpenChange={(next) => !disabled && setOpen(next)}>
        <PopoverTrigger asChild>
          <FilterTriggerButton
            id={id}
            disabled={disabled}
            onKeyDown={onTriggerKeyDown}
            aria-haspopup="listbox"
            aria-label={label ? undefined : ariaLabel}
            title={selectedLabel}
            className={triggerClassName}
          >
            <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </FilterTriggerButton>
        </PopoverTrigger>
        <PopoverContent
          role="listbox"
          aria-label={accessibleLabel}
          onKeyDown={onListKeyDown}
          align="start"
          className="w-56 max-h-72 overflow-y-auto p-1"
        >
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                {...optionProps(index)}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(option.value)}
                title={option.label}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none",
                  active && "font-medium",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}
