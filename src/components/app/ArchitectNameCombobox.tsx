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
import type { Architect } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { byName } from "@/lib/text";

/**
 * R2-UX-06 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, Anexo B) — clone estrutural
 * de `CapabilityCombobox`: substitui a busca livre por nome do Time por
 * seleção múltipla pesquisável, mesmo padrão de composição por caixinha já
 * usado no resto da tela (evolui/substitui B-43). `nameSelection` nasce com
 * TODOS os ids (nenhuma filtragem de fato) — sem isto a tela nasceria
 * escondendo gente por engano, o mesmo cuidado de `MultiSelectFilter`.
 *
 * Igual ao `CapabilityCombobox`: caixas decorativas (`pointer-events-none`),
 * quem trata o clique é a linha (`CommandItem`) inteira.
 */
export function ArchitectNameCombobox({
  architects,
  selected,
  onChange,
}: {
  architects: readonly Architect[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ordered = [...architects].sort(byName);

  const todosMarcados = ordered.length > 0 && selected.length === ordered.length;
  const algumMarcado = selected.length > 0;

  const summary = !algumMarcado
    ? t("team.nameCombobox.none")
    : todosMarcados
      ? t("team.nameCombobox.all", { n: ordered.length })
      : selected.length === 1
        ? (ordered.find((a) => a.id === selected[0])?.name ?? "")
        : t("team.nameCombobox.count", { n: selected.length });

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div>
      <label className="block text-xs text-muted-foreground" htmlFor="architect-name-combobox">
        {t("team.nameCombobox.label")}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id="architect-name-combobox"
            type="button"
            role="combobox"
            aria-label={t("team.nameCombobox.label")}
            aria-expanded={open}
            title={summary}
            className="mt-1 flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm sm:w-64"
          >
            <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={t("team.nameCombobox.searchPlaceholder")} />
            <CommandList className="max-h-72">
              <CommandEmpty>{t("team.nameCombobox.empty")}</CommandEmpty>

              {ordered.length > 0 && (
                <>
                  <CommandGroup>
                    <CommandItem
                      value="__todos__"
                      onSelect={() => onChange(todosMarcados ? [] : ordered.map((a) => a.id))}
                    >
                      <Checkbox
                        checked={todosMarcados ? true : algumMarcado ? "indeterminate" : false}
                        aria-hidden="true"
                        tabIndex={-1}
                        className="pointer-events-none mr-2"
                      />
                      <span className="font-medium">{t("team.nameCombobox.allRecords")}</span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              <CommandGroup>
                {ordered.map((a) => {
                  const marcado = selected.includes(a.id);
                  return (
                    <CommandItem key={a.id} value={a.name} onSelect={() => toggle(a.id)}>
                      <Checkbox
                        checked={marcado}
                        aria-hidden="true"
                        tabIndex={-1}
                        className="pointer-events-none mr-2"
                      />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
