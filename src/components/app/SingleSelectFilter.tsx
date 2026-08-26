import { ChevronDown } from "lucide-react";
import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SingleSelectFilterOption {
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const optionCount = options.length;

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const focusOption = (index: number) => {
    if (optionCount === 0) return;
    const clamped = (index + optionCount) % optionCount;
    optionRefs.current[clamped]?.focus();
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = optionRefs.current.findIndex((el) => el === document.activeElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption(currentIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusOption(currentIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        focusOption(0);
        break;
      case "End":
        event.preventDefault();
        focusOption(optionCount - 1);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
    }
  };

  const onListBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const select = (optionValue: string) => {
    onChange(optionValue);
    close();
  };

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const accessibleLabel = label ?? ariaLabel;

  return (
    <div>
      {label && (
        <label className="block text-sm text-muted-foreground" htmlFor={id}>
          {label}
        </label>
      )}
      <Popover open={disabled ? false : open} onOpenChange={(next) => !disabled && setOpen(next)}>
        <PopoverTrigger asChild>
          <FilterTriggerButton
            id={id}
            ref={triggerRef}
            disabled={disabled}
            onKeyDown={onTriggerKeyDown}
            aria-expanded={open}
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
          onBlur={onListBlur}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const selectedIndex = options.findIndex((o) => o.value === value);
            optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0]?.focus();
          }}
          align="start"
          className="w-56 max-h-72 overflow-y-auto p-1"
        >
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
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
    </div>
  );
}
