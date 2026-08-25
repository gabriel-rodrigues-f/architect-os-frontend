import { ChevronDown } from "lucide-react";
import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Formato genérico de opção — estruturalmente igual ao `SortOption` de
 * `DataView.tsx`, mas declarado aqui pra este componente não depender
 * daquele módulo (R3-008). Quem já passa `SortOption[]` (ex.: `team.tsx`,
 * via `useTeamRoster`) continua funcionando sem mudança nenhuma: os dois
 * tipos são estruturalmente idênticos, o TypeScript aceita um no lugar do
 * outro.
 */
export interface SingleSelectFilterOption {
  value: string;
  label: string;
}

/**
 * R3-006 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — "Ordenar por" era um
 * `<select>` nativo (chrome do navegador/SO), visualmente diferente dos
 * outros filtros da mesma linha, todos `MultiSelectFilter`. `SingleSelectFilter`
 * é o irmão de seleção única: mesmo `Popover`/`FilterTriggerButton` (visual
 * garantido idêntico por construção, não por classes copiadas), mas sem
 * busca, sem checkbox, sem "selecionar tudo" — cada opção é um
 * `<button role="option">`, clicar seleciona e fecha, mesmo padrão de
 * teclado do `MultiSelectFilter` (Seção 80) reduzido ao que faz sentido sem
 * estado de seleção múltipla: Arrow navega com wrap, Home/End vão pros
 * extremos, Escape fecha e devolve o foco pro botão.
 *
 * Sem conceito de `isEmpty`/placeholder aqui: as opções de ordenação nascem
 * de uma lista fixa (`sortOptions` em `useTeamRoster`), nunca vazias por
 * construção — diferente das facetas de Especialização/Capacidade que podem
 * legitimamente não ter opção real nenhuma.
 *
 * R3-008 — além da linha de filtro cheia (rótulo em bloco acima, gatilho
 * `w-full min-w-48 h-10`, o uso original de "Ordenar por"), este mesmo
 * componente agora também cobre lugares apertados/inline (seletor de Ciclo
 * no cabeçalho, tamanho de página da paginação): `label` fica opcional —
 * sem ele, nada de `<label>` é renderizado, porque quem chama já tem o
 * próprio rótulo externo (ex.: o `<label htmlFor="cycle">` que já existia ao
 * lado do `<select>` no `AppShell`) — e `triggerClassName` deixa
 * sobrescrever a classe do `FilterTriggerButton` (via `cn()`, então
 * `w-full`/`h-10`/`mt-1.5` padrão somem quando o chamador pede algo mais
 * compacto). `ariaLabel` supre o nome acessível do gatilho e do `listbox`
 * quando não há `label` visível.
 */
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
  /** Rótulo visível, renderizado em bloco acima do gatilho. Omitir para uso compacto/inline (quem chama cuida do próprio rótulo). */
  label?: string;
  /** Nome acessível do gatilho/listbox quando `label` não é renderizado aqui. */
  ariaLabel?: string;
  options: SingleSelectFilterOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Sobrescreve/estende a classe do `FilterTriggerButton` — usado pelos usos compactos para trocar `w-full min-w-48 h-10` por algo que caiba inline. */
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

  /** Tab sai do widget inteiro num passo só — fecha quando o foco sai do painel por completo. */
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
