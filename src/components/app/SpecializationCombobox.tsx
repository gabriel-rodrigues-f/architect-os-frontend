import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Capability, Competency } from "@/lib/domain";

/**
 * ORIENTACAO-NONA-RODADA, Seção 10 (ENT-09-008/GES-010) — "Especialização
 * principal" deixa de ser texto livre e passa a apontar para uma
 * competência real do catálogo (`primarySpecializationCompetencyId`). Só
 * competência ATIVA aparece — uma arquivada não é identidade profissional
 * válida daqui para frente (o backend também recusa, `routes/api/
 * architects.ts`; este filtro só evita oferecer uma opção que o servidor
 * rejeitaria). Nome + capacidade juntos desambiguam competências
 * homônimas em capacidades diferentes.
 */
export function SpecializationCombobox({
  competencies,
  capabilities,
  selectedId,
  onSelect,
  label = "Especialização principal",
}: {
  competencies: readonly Competency[];
  capabilities: readonly Capability[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const capabilityById = new Map(capabilities.map((c) => [c.id, c]));
  const active = competencies.filter((c) => c.active);
  const selected = active.find((c) => c.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : "Buscar competência…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar competência…" />
          <CommandList>
            <CommandEmpty>Nenhuma competência ativa encontrada.</CommandEmpty>
            {selected && (
              <CommandGroup>
                <CommandItem
                  value="__limpar__"
                  onSelect={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Remover especialização principal
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {active.map((c) => {
                const capability = capabilityById.get(c.capabilityId);
                const marked = c.id === selectedId;
                return (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${capability?.name ?? ""}`}
                    onSelect={() => {
                      onSelect(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", marked ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <p className="truncate">{c.name}</p>
                      {capability && (
                        <p className="truncate text-xs text-muted-foreground">{capability.name}</p>
                      )}
                    </div>
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
