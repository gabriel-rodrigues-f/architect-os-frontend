import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";

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
import type { CompetencyCategory } from "@/lib/domain";

/**
 * Seleção múltipla de capacidades. Diferente de um `<select multiple>`, permite
 * buscar por nome e alternar itens sem depender de Ctrl/Cmd + clique.
 *
 * As caixas são decorativas (`pointer-events-none`): quem trata o clique é o
 * `CommandItem` da linha inteira. Um checkbox interativo dentro do item criaria
 * dois alvos de clique concorrentes e a linha alternaria duas vezes.
 *
 * Recebe `label` porque a tela pode ter outro seletor com `role="combobox"` — o
 * `<select>` nativo também expõe esse papel — e sem nome acessível os dois
 * ficam indistinguíveis para leitor de tela.
 */
export function CapabilityCombobox({
  categories,
  selected,
  onToggle,
  onSelectAll,
  label = "Capacidades",
}: {
  categories: readonly CompetencyCategory[];
  selected: readonly CompetencyCategory[];
  onToggle: (id: string) => void;
  /** Recebe todos os ids quando marca, e lista vazia quando desmarca. */
  onSelectAll: (ids: string[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  const todasMarcadas = categories.length > 0 && selected.length === categories.length;
  const algumaMarcada = selected.length > 0;

  const resumo =
    selected.length === 0
      ? "Selecione capacidades"
      : todasMarcadas
        ? `Todas (${categories.length})`
        : selected.length === 1
          ? (selected[0]?.name ?? "")
          : `${selected.length} capacidades`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          className="flex min-w-56 max-w-72 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          <span className="truncate">{resumo}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar capacidade…" />
          <CommandList>
            <CommandEmpty>Nenhuma capacidade encontrada.</CommandEmpty>

            {categories.length > 0 && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__todas__"
                    onSelect={() => onSelectAll(todasMarcadas ? [] : categories.map((c) => c.id))}
                  >
                    <Checkbox
                      // Meio-marcada quando há seleção parcial: comunica que
                      // clicar vai marcar o resto, não desmarcar o que já está.
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
              {categories.map((c) => {
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
