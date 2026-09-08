import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import { FilterField } from "@/components/app/FilterField";
import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { useOptionalUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Registration, RegistrationSearch } from "@/lib/registration";

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
  readonly registration?: {
    readonly label: string;
    readonly to: string;
    /** O que abre o FORMULÁRIO de cadastro, e não só a tela (dono, item 12). */
    readonly search?: RegistrationSearch | undefined;
  };
}

/**
 * A FRASE E O DESTINO DE UM ASSUNTO VAZIO, prontos — o `Registration` sabe as
 * chaves de texto e a pergunta de alcance; este gancho só as junta com o
 * idioma e a sessão. Nenhuma tela repete a tríade frase/tela/alcance.
 */
export function useSelectionEmptyState(registration: Registration): SelectionEmptyState {
  const { t } = useI18n();
  const user = useOptionalUser();
  const message = t(registration.emptyKey);
  if (!registration.reachedBy(user)) return { message };
  return {
    message,
    registration: {
      label: t(registration.registerKey),
      to: registration.to,
      search: registration.search,
    },
  };
}

/**
 * O HIPERLINK DE CADASTRO — o mesmo em toda parte: no seletor vazio, e na
 * lista de pessoas de um diálogo que ainda não tem ninguém para listar
 * (regra de reuso: dois lugares, um componente).
 */
export function RegistrationLink({
  registration,
  className,
}: {
  registration: NonNullable<SelectionEmptyState["registration"]>;
  className?: string | undefined;
}) {
  return (
    <Link
      to={registration.to}
      {...(registration.search ? { search: registration.search } : {})}
      className={className}
    >
      {registration.label}
    </Link>
  );
}

/**
 * O DESENHO DO SELETOR VAZIO — um só, do `SingleSelectFilter`, do
 * `MultiSelectFilter` e da combobox de pessoa (regra de reuso: três lugares,
 * um componente).
 *
 * Ele veste a mesma moldura do seletor cheio, para a tela não pular quando a
 * primeira opção for cadastrada; e a frase é sempre alguma — sem `empty`
 * declarado, a da casa. É por isso que a régua mora aqui e não em cada tela:
 * uma tela pode esquecer de tratar a lista vazia, este componente não.
 *
 * Dono (2026-09-08), sobre o gatilho: *"o filtro hoje obscurecido
 * (desabilitado) passa a poder ser aberto"*. Então ele só fica desabilitado
 * para quem NÃO alcança o cadastro — não há lista a abrir nem porta a
 * oferecer. Para quem alcança, o próprio gatilho é a porta: um link com a
 * frase que convida ("… — clique para cadastrar").
 */
export function EmptySelectionField({
  id,
  label,
  ariaLabel,
  empty,
  describedBy,
  triggerClassName,
  icon,
}: {
  id: string;
  label?: string | undefined;
  ariaLabel?: string | undefined;
  empty?: SelectionEmptyState | undefined;
  describedBy?: string | undefined;
  triggerClassName?: string | undefined;
  /** O ícone do gatilho; sem isto, o da lista que não abre. */
  icon?: typeof ChevronDown | undefined;
}) {
  const { t } = useI18n();
  const message = empty?.message ?? t("selector.empty");
  const registration = empty?.registration;
  const Icone = icon ?? ChevronDown;
  /*
   * O `<label for>` do `FilterField` nomeia BOTÃO, não âncora: um `<a>` não é
   * elemento rotulável. Então, quando o gatilho vira porta, o nome do campo
   * viaja no `aria-label` — o campo continua se chamando "Ciclo" para quem
   * usa leitor de tela, e a frase continua sendo o conteúdo dele.
   */
  const nomeDoCampo = label ?? ariaLabel;

  return (
    <FilterField label={label} htmlFor={id}>
      <FilterTriggerButton
        id={id}
        asChild={registration !== undefined}
        disabled={registration === undefined}
        aria-label={registration ? nomeDoCampo : label ? undefined : ariaLabel}
        aria-describedby={describedBy}
        title={message}
        className={triggerClassName}
      >
        {registration ? (
          <Link
            to={registration.to}
            {...(registration.search ? { search: registration.search } : {})}
          >
            <span className="min-w-0 flex-1 truncate text-left">{message}</span>
            <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{message}</span>
            <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </FilterTriggerButton>
      {registration ? (
        <RegistrationLink
          registration={registration}
          className="mt-1 inline-block text-meta text-primary underline underline-offset-2"
        />
      ) : null}
    </FilterField>
  );
}
