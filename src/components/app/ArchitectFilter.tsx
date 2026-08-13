import { Check, ChevronDown, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Architect } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * Filtro de arquitetos com seleção múltipla. Lista vazia = todo o time, para
 * que a tela nunca fique sem dados por engano.
 */
export function ArchitectFilter({
  architects,
  selected,
  onChange,
  label = "Arquitetos",
}: {
  architects: Architect[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
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

  const summary =
    selected.length === 0
      ? `Todo o time (${architects.length})`
      : selected.length === 1
        ? (architects.find((a) => a.id === selected[0])?.name ?? "1 arquiteto")
        : `${selected.length} arquitetos`;

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
          aria-label={label}
          className="absolute right-0 z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
          >
            <span>Todo o time</span>
            {selected.length === 0 && <Check className="h-3.5 w-3.5" />}
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
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
                  active && "font-medium",
                )}
              >
                <span className="truncate">{a.name}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
          {architects.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              Nenhum arquiteto cadastrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Aplica a seleção: vazio significa "todos". */
export const applyArchitectFilter = <T extends { id: string }>(
  architects: T[],
  selected: string[],
): T[] => (selected.length === 0 ? architects : architects.filter((a) => selected.includes(a.id)));
