import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";

/**
 * Rótulo de campo com a dica no ícone. Saiu de `ui-bits` (PR 2, pista A)
 * para ter arquivo próprio; o botão da dica ganhou o anel da casa por
 * `focus-visible` no lugar do anel particular de 2 px que trazia ([A-01]).
 * `Label` fica em 14 (decisão UX-a do dono): rótulo de campo é corpo.
 */
export function FieldLabel({
  htmlFor,
  labelId,
  children,
  hint,
}: {
  htmlFor?: string;
  labelId?: string;
  children: ReactNode;
  hint: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5">
      <Label {...(htmlFor ? { htmlFor } : {})} {...(labelId ? { id: labelId } : {})}>
        {children}
      </Label>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-fast hover:text-foreground focus-visible:focus-ring"
              aria-label={t("field.hint", { campo: String(children) })}
            >
              <Info className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64 text-center">
            {hint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
