import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { EmptySubject } from "@/lib/empty-subject";
import type { TeamCareerLadderDraft } from "@/lib/view-models";

/**
 * A ESCADA DE CARREIRA DO TIME (dono, 2026-09-08): quais níveis da organização
 * este time usa, e em que ordem se sobe por eles.
 *
 * É um campo e não um filtro porque a ordem faz parte da resposta — nenhum
 * seletor da casa devolve ordem. Cada nível na escada mostra o DEGRAU dele
 * dentro do time (1, 2, 3…), que não é o posto do catálogo: o time que começa
 * no Pleno tem o Pleno no degrau 1.
 *
 * Usado no cadastro e na edição do time — as duas portas da mesma decisão.
 */
export function TeamCareerLadderField({
  id,
  draft,
  onChange,
  disabled = false,
}: {
  id: string;
  draft: TeamCareerLadderDraft;
  onChange: (draft: TeamCareerLadderDraft) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const rows = draft.rows;
  const chosenCount = draft.careerLevelIds.length;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t("teams.careerLadder.label")}</Label>
      <p className="text-label text-muted-foreground">{t("teams.careerLadder.hint")}</p>
      {rows.length === 0 ? (
        <div>
          <p className="text-body font-medium">{EmptySubject.CAREER_LEVEL.title(t)}</p>
          <p className="text-body text-muted-foreground">{t("teams.careerLadder.noCatalog")}</p>
        </div>
      ) : (
        <ul id={id} className="space-y-1.5">
          {rows.map((row, index) => (
            <li
              key={row.level.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <Checkbox
                id={`${id}-${row.level.id}`}
                checked={row.chosen}
                disabled={disabled}
                onCheckedChange={() => onChange(draft.toggling(row.level.id))}
                aria-label={t("teams.careerLadder.use", { nivel: row.level.name })}
              />
              <Label htmlFor={`${id}-${row.level.id}`} className="flex-1 font-normal">
                {row.level.name}
              </Label>
              {row.position !== null && (
                <span className="text-label tabular-nums text-muted-foreground">
                  {t("teams.careerLadder.step", { n: row.position })}
                </span>
              )}
              {row.chosen && (
                <span className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || index === 0}
                    aria-label={t("teams.careerLadder.moveUp", { nivel: row.level.name })}
                    onClick={() => onChange(draft.movingUp(row.level.id))}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || index === chosenCount - 1}
                    aria-label={t("teams.careerLadder.moveDown", { nivel: row.level.name })}
                    onClick={() => onChange(draft.movingDown(row.level.id))}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!draft.isValid && rows.length > 0 && (
        <p className="text-body text-destructive" role="alert">
          {t("teams.careerLadder.empty")}
        </p>
      )}
    </div>
  );
}
