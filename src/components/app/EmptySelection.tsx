import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import { FilterField } from "@/components/app/FilterField";
import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { useI18n } from "@/lib/i18n";

/**
 * O QUE UM SELETOR SEM OPÇÕES DIZ — e, quando existe onde cadastrar, para
 * onde ele leva.
 *
 * Dono (2026-09-08, reincidente desde 2026-09-02): *"não devemos ter
 * comboboxes vazios. Quando ainda não houver ciclos cadastrados, mostrar 'Não
 * há ciclos cadastrados' + 'Cadastrar primeiro ciclo' como hiperlink para a
 * tela de cadastro"*.
 *
 * `registration` é OPCIONAL de propósito: o hiperlink só existe para quem
 * alcança a tela de cadastro. Quem não alcança lê só a frase — mandar alguém
 * para uma porta fechada é pior do que não oferecer porta nenhuma.
 */
export interface SelectionEmptyState {
  /** A frase, no vocabulário do domínio: "Não há ciclos cadastrados". */
  readonly message: string;
  /** A tela onde se cadastra a primeira opção — só para quem a alcança. */
  readonly registration?: { readonly label: string; readonly to: string };
}

/**
 * O DESENHO DO SELETOR VAZIO — um só, do `SingleSelectFilter` e do
 * `MultiSelectFilter` (regra de reuso: dois lugares, um componente).
 *
 * Ele veste a mesma moldura do seletor cheio, para a tela não pular quando a
 * primeira opção for cadastrada; o gatilho fica desabilitado, porque não há
 * lista a abrir; e a frase é sempre alguma — sem `empty` declarado, a da
 * casa. É por isso que a régua mora aqui e não em cada tela: uma tela pode
 * esquecer de tratar a lista vazia, este componente não.
 */
export function EmptySelectionField({
  id,
  label,
  ariaLabel,
  empty,
  describedBy,
  triggerClassName,
}: {
  id: string;
  label?: string | undefined;
  ariaLabel?: string | undefined;
  empty?: SelectionEmptyState | undefined;
  describedBy?: string | undefined;
  triggerClassName?: string | undefined;
}) {
  const { t } = useI18n();
  const message = empty?.message ?? t("selector.empty");
  const registration = empty?.registration;

  return (
    <FilterField label={label} htmlFor={id}>
      <FilterTriggerButton
        id={id}
        disabled
        aria-label={label ? undefined : ariaLabel}
        aria-describedby={describedBy}
        title={message}
        className={triggerClassName}
      >
        <span className="min-w-0 flex-1 truncate text-left">{message}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </FilterTriggerButton>
      {registration ? (
        <Link
          to={registration.to}
          className="mt-1 inline-block text-meta text-primary underline underline-offset-2"
        >
          {registration.label}
        </Link>
      ) : null}
    </FilterField>
  );
}
