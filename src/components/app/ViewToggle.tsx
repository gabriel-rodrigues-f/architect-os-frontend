import { LayoutGrid, Table2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function ViewToggle({
  view,
  onChange,
  cardsLabel,
  tableLabel,
}: {
  view: "cards" | "table";
  onChange: (view: "cards" | "table") => void;
  cardsLabel: string;
  tableLabel: string;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-input p-0.5">
      <button
        type="button"
        aria-label={cardsLabel}
        aria-pressed={view === "cards"}
        title={cardsLabel}
        onClick={() => onChange("cards")}
        className={cn(
          "rounded p-1.5 transition-colors",
          view === "cards"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={tableLabel}
        aria-pressed={view === "table"}
        title={tableLabel}
        onClick={() => onChange("table")}
        className={cn(
          "rounded p-1.5 transition-colors",
          view === "table"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Table2 className="h-4 w-4" />
      </button>
    </div>
  );
}
