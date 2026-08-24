import { ChevronDown } from "lucide-react";
import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
 *
 * R2-VIS-09 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o painel era um `<div
 * absolute>` de posição fixa, sem detecção de colisão: perto da borda da
 * viewport ele vazava para fora da tela. `Popover` do Radix (floating-ui por
 * baixo) resolve só o POSICIONAMENTO — a navegação por teclado continua toda
 * manual aqui, porque o Radix não sabe navegar entre `<button role="option">`
 * customizados; ele só reposiciona o painel. Abrir/fechar/clique fora e
 * Escape-padrão do Radix ficam redundantes com o que este componente já
 * fazia à mão, mas não conflitam: o handler manual de Escape chama
 * `preventDefault`, então o Radix respeita e não tenta fechar de novo.
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const optionCount = options.length + 1;

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

  /** Tab sai do widget inteiro num passo só — fecha quando o foco sai do painel por completo. */
  const onListBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
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
    <div>
      <label className="block text-xs text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            ref={triggerRef}
            type="button"
            onKeyDown={onTriggerKeyDown}
            aria-expanded={open}
            aria-haspopup="listbox"
            title={summary}
            className="mt-1 flex w-44 items-center justify-between gap-2 rounded-md border border-input bg-card px-2 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          onKeyDown={onListKeyDown}
          onBlur={onListBlur}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            optionRefs.current[0]?.focus();
          }}
          align="start"
          className="w-56 max-h-72 overflow-y-auto p-1"
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
