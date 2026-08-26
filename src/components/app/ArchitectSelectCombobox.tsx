import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

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
import type { Architect } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { defaultNameFormatter } from "@/lib/text";
import { cn } from "@/lib/utils";

/**
 * R2-ESC-04 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — regra "mais de 15 opções
 * vira combobox pesquisável" aplicada ao seletor de UMA pessoa (Avaliações,
 * PDI, Ciclos, Mentoria). Seleção única, sem opção "Todo o time"; sempre uma
 * pessoa de verdade. `inactiveArchitects` é opcional: telas que já restringem
 * a lista a quem está ativo (PDI, mentorado de uma sessão nova) não precisam
 * da seção de inativos. OO3-18/F-3 — `MenteeFilterCombobox`
 * (mentoring-shared.tsx), que era o clone com inativos sempre visíveis,
 * virou um adaptador fino por cima deste componente.
 */
export function ArchitectSelectCombobox({
  architects,
  inactiveArchitects = [],
  selectedId,
  onChange,
  label,
  invalid = false,
  className,
  id,
}: {
  architects: readonly Architect[];
  inactiveArchitects?: readonly Architect[];
  selectedId: string;
  onChange: (id: string) => void;
  label: string;
  invalid?: boolean;
  className?: string;
  /** Pareia com um `<Label htmlFor>` externo — sem isto, clicar no rótulo não abre o combobox. */
  id?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ordered = [...architects].sort(defaultNameFormatter.byName);
  const inactiveOrdered = [...inactiveArchitects].sort(defaultNameFormatter.byName);
  const selected = [...ordered, ...inactiveOrdered].find((a) => a.id === selectedId);

  const select = (architectId: string) => {
    onChange(architectId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-invalid={invalid}
          title={selected?.name}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm",
            invalid && "border-destructive ring-1 ring-destructive",
            className,
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? selected.name : t("architectCombobox.placeholder")}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("architectCombobox.search")} />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("architectCombobox.empty")}</CommandEmpty>
            <CommandGroup>
              {ordered.map((a) => (
                <CommandItem key={a.id} value={a.name} onSelect={() => select(a.id)}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      a.id === selectedId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {inactiveOrdered.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  {inactiveOrdered.map((a) => (
                    <CommandItem key={a.id} value={a.name} onSelect={() => select(a.id)}>
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          a.id === selectedId ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {t("architectCombobox.inactiveName", { nome: a.name })}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
