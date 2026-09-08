import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import { useI18n } from "@/lib/i18n";
import type { TeamChoice } from "@/lib/team-choice";

/**
 * O SELETOR DE TIME que sabe ficar travado.
 *
 * Dono (2026-09-06): *"O time atual deve ser fixado e deve aparecer um
 * bloqueio ao passar o mouse por cima."* Quem decide é o `TeamChoice`; este
 * componente só desenha: com escolha, o seletor da casa; travado, o mesmo
 * seletor fixado no único time, sem clique, com a explicação no `title` (o
 * passar do mouse) e embaixo do campo (quem não passa o mouse também lê, e
 * o leitor de tela chega por `aria-describedby`).
 *
 * Usado em Cadastrar pessoa, Régua do Time e Política de Progressão.
 */
export function TeamChoiceField({
  id,
  label,
  choice,
  value,
  onChange,
  emptyOption,
  lockedExplanation,
  describedBy,
  className,
}: {
  id: string;
  label: string;
  choice: TeamChoice;
  value: string;
  onChange: (value: string) => void;
  /** A opção que não é time nenhum — "Escolha o time", "Todos os times". Some quando travado. */
  emptyOption?: { value: string; label: string } | undefined;
  lockedExplanation: string;
  describedBy?: string | undefined;
  className?: string | undefined;
}) {
  const { t } = useI18n();
  const explanationId = `${id}-locked`;
  const { lockedTeam } = choice;
  const options = lockedTeam
    ? [{ value: lockedTeam.id, label: lockedTeam.name }]
    : [
        ...(emptyOption ? [emptyOption] : []),
        ...choice.teams.map((team) => ({ value: team.id, label: team.name })),
      ];

  return (
    <div className={className} title={lockedTeam ? lockedExplanation : undefined}>
      <SingleSelectFilter
        id={id}
        label={label}
        options={options}
        value={lockedTeam ? lockedTeam.id : value}
        onChange={onChange}
        disabled={lockedTeam !== null}
        title={lockedTeam ? lockedExplanation : undefined}
        describedBy={lockedTeam ? explanationId : describedBy}
        empty={{ message: t("teamChoice.empty") }}
      />
      {lockedTeam && (
        <p id={explanationId} className="mt-1 text-xs text-muted-foreground">
          {lockedExplanation}
        </p>
      )}
    </div>
  );
}
