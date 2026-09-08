import { Check, ChevronsUpDown } from "lucide-react";
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
import { useI18n } from "@/lib/i18n";
import type { PersonPicker } from "@/lib/person-selection";
import { Registration } from "@/lib/registration";
import { cn } from "@/lib/utils";

/**
 * A combobox de pessoa — a ÚNICA da aplicação (dono, 2026-09-06). A forma
 * (uma pessoa, várias com "Todo o time", várias com teto) vem do
 * `PersonPicker`; este componente só desenha o que o objeto decide.
 *
 * Com alcance vazio não há lista: o gatilho vira a própria frase do vazio —
 * não existe "Todo o time" de ninguém. E, desde 2026-09-08 (pedido literal do
 * dono), ele deixa de ser um campo obscurecido para quem CADASTRA gente: a
 * frase vira "Nenhum profissional cadastrado — clique para cadastrar" e o
 * gatilho leva ao cadastro. Quem não cadastra continua lendo só a frase. A
 * busca que não acha ninguém diz "Nenhuma pessoa encontrada.".
 *
 * Na forma "só eu" (dono, 2026-09-06) não há combobox: o profissional não
 * busca outros membros em parte nenhuma — a tela mostra o nome dele, e só.
 */
export function PersonCombobox({
  picker,
  onChange,
  label,
  placeholder = undefined,
  id = undefined,
  className = undefined,
  invalid = false,
}: {
  picker: PersonPicker;
  onChange: (ids: string[]) => void;
  label: string;
  /** Texto do gatilho na forma "uma pessoa" enquanto ninguém foi escolhido. */
  placeholder?: string | undefined;
  id?: string | undefined;
  className?: string | undefined;
  invalid?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const vazio = useSelectionEmptyState(Registration.PROFESSIONAL);

  const summaryText = (): string => {
    const summary = picker.summary;
    switch (summary.kind) {
      case "empty":
        return vazio.message;
      case "none":
        return picker.many ? t("person.noneSelected") : (placeholder ?? t("person.placeholder"));
      case "wholeTeam":
        return t("person.wholeTeamCount", { n: summary.n });
      case "one":
        return summary.name;
      case "count":
        return t("person.count", { n: summary.n });
    }
  };
  const summary = summaryText();
  const muted = picker.summary.kind !== "one" && picker.summary.kind !== "wholeTeam";

  // Dono (2026-09-07): na forma "só eu" não há NADA — nem o nome. O
  // profissional só vê a si; a tela não precisa dizer isso.
  if (picker.fixed) return null;

  if (picker.isEmpty) {
    return (
      <EmptySelectionField
        id={id ?? "person-combobox"}
        ariaLabel={label}
        empty={vazio}
        triggerClassName={className}
        icon={ChevronsUpDown}
      />
    );
  }

  const choose = (personId: string) => {
    onChange(picker.pick(personId));
    if (!picker.many) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterTriggerButton
          id={id}
          role="combobox"
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={invalid}
          title={summary}
          className={cn(invalid && "border-destructive ring-1 ring-destructive", className)}
        >
          <span
            className={cn("min-w-0 flex-1 truncate text-left", muted && "text-muted-foreground")}
          >
            {summary}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </FilterTriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command loop>
          <CommandInput placeholder={t("person.search")} />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("person.notFound")}</CommandEmpty>

            {picker.offersWholeTeam && (
              <>
                <CommandGroup>
                  <CommandItem
                    value={t("person.wholeTeam")}
                    onSelect={() => onChange(picker.toggleWholeTeam())}
                  >
                    <Checkbox
                      checked={
                        picker.wholeTeamMark === "checked"
                          ? true
                          : picker.wholeTeamMark === "unchecked"
                            ? false
                            : "indeterminate"
                      }
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none mr-2"
                    />
                    <span className="font-medium">{t("person.wholeTeam")}</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup>
              {picker.people.map((person) => {
                const picked = picker.isPicked(person.id);
                const blocked = !picked && !picker.canPick(person.id);
                return (
                  <CommandItem
                    key={person.id}
                    value={person.name}
                    disabled={blocked}
                    onSelect={() => choose(person.id)}
                    title={blocked ? t("person.maxReached", { n: picker.max ?? 0 }) : person.name}
                    className={cn(blocked && "cursor-not-allowed opacity-40")}
                  >
                    {picker.many ? (
                      <Checkbox
                        checked={picked}
                        aria-hidden="true"
                        tabIndex={-1}
                        className="pointer-events-none mr-2"
                      />
                    ) : (
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          picked ? "opacity-100" : "opacity-0",
                        )}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{person.name}</span>
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
