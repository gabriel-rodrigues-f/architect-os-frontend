import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface MultiSelectFilterOption {
  id: string;
  label: string;
}

/**
 * Filtro por composição (caixinha), reutilizável para qualquer faceta de
 * pouca cardinalidade: marcar um valor, vários, ou "selecionar tudo" (mesmo
 * alternador de verdade do `ArchitectFilter` — tudo marcado → clique
 * desmarca tudo; nada ou parte marcada → clique marca tudo). `selected`
 * vazio é um estado real e explícito (filtra pra fora todo mundo), nunca um
 * atalho escondido para "sem filtro" — quem chama decide o valor inicial
 * (normalmente todas as opções, pra a tela nascer sem filtrar nada).
 *
 * Mesmo padrão de teclado do `ArchitectFilter` (Seção 80): seta para
 * navegar entre opções com wrap nas pontas, Home/End para os extremos,
 * Escape fecha e devolve o foco pro botão, Enter/Espaço funcionam nativos
 * porque cada opção já é um `<button>` de verdade.
 */
export function MultiSelectFilter({
  id,
  label,
  options,
  selected,
  onChange,
  selectAllLabel,
  allSummaryLabel,
  noneSummaryLabel,
}: {
  id: string;
  label: string;
  options: MultiSelectFilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  selectAllLabel: string;
  allSummaryLabel: string;
  noneSummaryLabel: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const optionCount = options.length + 1;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[0]?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const focusOption = (index: number) => {
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
    if (!container.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  };

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
    <div className="relative" ref={container}>
      <label className="block text-xs text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="mt-1 flex items-center gap-2 rounded-md border border-input bg-card px-2 py-2 text-sm"
      >
        <span>{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          onKeyDown={onListKeyDown}
          onBlur={onListBlur}
          className="absolute left-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg"
        >
          <button
            ref={(el) => {
              optionRefs.current[0] = el;
            }}
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
                ref={(el) => {
                  optionRefs.current[index + 1] = el;
                }}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => toggle(option.id)}
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
        </div>
      )}
    </div>
  );
}
