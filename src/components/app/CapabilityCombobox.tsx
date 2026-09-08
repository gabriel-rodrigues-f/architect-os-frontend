import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { EmptySelectionField, useSelectionEmptyState } from "@/components/app/EmptySelection";
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
import { Registration } from "@/lib/registration";

/**
 * O FILTRO DE CAPACIDADES DA AVALIAÇÃO DE DESEMPENHO.
 *
 * Dono (2026-09-08, item 1): *"o filtro de CAPACIDADES sem capacidades
 * cadastradas precisa ficar bloqueado, exatamente como o de profissionais"*.
 * Ele escapou da catraca porque não é o seletor da casa nem um `<select>`
 * nativo — é uma combobox própria, e desenhava um `Popover` com uma lista de
 * nada, dizendo "Selecione capacidades" sobre um catálogo vazio.
 *
 * O conserto não é uma frase a mais aqui: é delegar o vazio ao MESMO
 * `EmptySelectionField` da combobox de pessoa, que já sabe o desenho (moldura,
 * frase e gatilho desabilitado) e pergunta a frase ao `Registration`.
 */
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
  const vazio = useSelectionEmptyState(Registration.CAPABILITY);

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

  if (capabilities.length === 0) {
    return (
      <EmptySelectionField
        id="capability-combobox"
        ariaLabel={label}
        empty={vazio}
        triggerClassName={className}
        icon={ChevronsUpDown}
      />
    );
  }

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
