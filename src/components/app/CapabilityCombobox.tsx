import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Capability } from "@/lib/domain";

export function CapabilityCombobox({
  capabilities,
  selected,
  onToggle,
  onSelectAll,
  label = "Capacidades",
  className,
}: {
  capabilities: readonly Capability[];
  selected: readonly Capability[];
  onToggle: (id: string) => void;

  onSelectAll: (ids: string[]) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const todasMarcadas = capabilities.length > 0 && selected.length === capabilities.length;
  const algumaMarcada = selected.length > 0;

  const resumo =
    selected.length === 0
      ? "Selecione capacidades"
      : todasMarcadas
        ? `Todas (${capabilities.length})`
        : selected.length === 1
          ? (selected[0]?.name ?? "")
          : `${selected.length} capacidades`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterTriggerButton
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          title={resumo}
          className={className}
        >
          <span className="min-w-0 flex-1 truncate text-left">{resumo}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </FilterTriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar capacidade…" />
          <CommandList>
            <CommandEmpty>Nenhuma capacidade encontrada.</CommandEmpty>

            {capabilities.length > 0 && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__todas__"
                    onSelect={() => onSelectAll(todasMarcadas ? [] : capabilities.map((c) => c.id))}
                  >
                    <Checkbox
                      checked={todasMarcadas ? true : algumaMarcada ? "indeterminate" : false}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none mr-2"
                    />
                    <span className="font-medium">Selecionar todas</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup>
              {capabilities.map((c) => {
                const marcada = selected.some((s) => s.id === c.id);
                return (
                  <CommandItem key={c.id} value={c.name} onSelect={() => onToggle(c.id)}>
                    <Checkbox
                      checked={marcada}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none mr-2"
                    />
                    {c.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
