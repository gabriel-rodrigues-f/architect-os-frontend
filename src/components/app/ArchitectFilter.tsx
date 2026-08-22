import { ChevronDown, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import type { Architect } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Filtro de arquitetos com seleção múltipla. `selected` é sempre explícito:
 * lista vazia significa "ninguém selecionado" (a tela mostra o estado vazio
 * dela), e "Todo o time" marcado é a lista inteira de `architects` escrita
 * por extenso — nunca um vazio-como-atalho. Isso é o que torna o clique em
 * "Todo o time" um alternador de verdade (marca tudo → clique de novo
 * desmarca tudo), em vez de um clique morto quando já estava tudo marcado.
 *
 * Quem chama decide o valor inicial de `selected` (normalmente "todo mundo
 * que este viewer pode ver" — nunca a tela nasce mostrando ninguém por
 * engano); este componente só reflete e altera o que já está ali.
 */
export function ArchitectFilter({
  architects,
  selected,
  onChange,
  label = undefined,
}: {
  architects: Architect[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  /**
   * ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 28 — `selected.length ===
   * architects.length` por si só pressupõe que todo id de `selected`
   * pertence à lista atual de `architects`. Depois de uma desativação, uma
   * resposta assíncrona atrasada, ou uma seleção persistida de uma sessão
   * anterior, `selected` pode ter um id que já saiu do roster — nesse caso
   * as duas contagens podem coincidir por acidente (um id a menos de gente
   * real, um id a mais de gente que não está mais na lista) e "Todo o
   * time" apareceria marcado sem estar. Contar só quem de fato está
   * visível evita esse falso positivo.
   */
  const selectedVisible = selected.filter((id) => architects.some((a) => a.id === id));
  const allSelected = architects.length > 0 && selectedVisible.length === architects.length;

  const summary =
    selectedVisible.length === 0
      ? t("filter.none")
      : allSelected
        ? t("filter.wholeTeam", { n: architects.length })
        : selectedVisible.length === 1
          ? (architects.find((a) => a.id === selectedVisible[0])?.name ?? t("filter.oneArchitect"))
          : t("filter.nArchitects", { n: selectedVisible.length });

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"
      >
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label ?? t("filter.architects")}
          className="absolute right-0 z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg"
        >
          {/*
            Alternador de verdade: tudo já marcado → clique desmarca tudo;
            nada ou parte marcada → clique marca todo mundo. Sem isto, clicar
            em "Todo o time" já marcado não tinha efeito nenhum visível — o
            clique parecia morto.
          */}
          <button
            type="button"
            onClick={() => onChange(allSelected ? [] : architects.map((a) => a.id))}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
          >
            <Checkbox
              checked={allSelected ? true : selectedVisible.length === 0 ? false : "indeterminate"}
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none"
            />
            <span className="font-medium">{t("filter.wholeTeamOption")}</span>
          </button>
          <div className="my-1 border-t border-border" />
          {architects.map((a) => {
            const active = selected.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => toggle(a.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
                  active && "font-medium",
                )}
              >
                <Checkbox
                  checked={active}
                  aria-hidden="true"
                  tabIndex={-1}
                  className="pointer-events-none"
                />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
              </button>
            );
          })}
          {architects.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("filter.noArchitects")}</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Aplica a seleção: sempre por pertencimento explícito. Vazio significa
 * "ninguém" — quem chama decide o valor inicial de `selected` para a tela
 * nunca nascer mostrando ninguém por engano (ver doc do componente acima).
 */
export const applyArchitectFilter = <T extends { id: string }>(
  architects: T[],
  selected: string[],
): T[] => architects.filter((a) => selected.includes(a.id));
