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
 * há ciclos cadastrados'"*.
 *
 * `registration` é OPCIONAL de propósito: o caminho do cadastro só existe
 * para quem alcança a tela de cadastro. Quem não alcança lê só a frase —
 * mandar alguém para uma porta fechada é pior do que não oferecer porta
 * nenhuma. Desde a troca de desenho de 2026-09-08 quem usa esse caminho é o
 * `EmptyStateCallToAction`, no centro do quadro principal, e o hiperlink em
 * meio a texto (o corpo de um diálogo); o FILTRO não o usa mais.
 */
export interface SelectionEmptyState {
  /** A LINHA 1, no formato único do `EmptySubject`: "Nenhum ciclo cadastrado". */
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
  const message = registration.emptyTitle(t);
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
 * O HIPERLINK DE CADASTRO EM MEIO A TEXTO — o corpo de um diálogo cuja lista
 * de pessoas ainda não tem ninguém para listar, onde a frase e o caminho
 * cabem numa linha só.
 *
 * Onde ele NÃO pode aparecer é num FILTRO — nem solto abaixo do campo, nem
 * como linha clicável dentro do painel (dono, 2026-09-08): filtro sem opções
 * é filtro bloqueado, e o botão de cadastro vive no centro do quadro
 * principal, no `EmptyStateCallToAction`.
 */
export function RegistrationLink({
  registration,
  className,
  onNavigate,
}: {
  registration: NonNullable<SelectionEmptyState["registration"]>;
  className?: string | undefined;
  /** Quem abriu um painel para mostrar este convite o fecha ao navegar. */
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <Link
      to={registration.to}
      {...(registration.search ? { search: registration.search } : {})}
      className={className}
      {...(onNavigate ? { onClick: onNavigate } : {})}
    >
      {registration.label}
    </Link>
  );
}

/**
 * O CAMPO DE DIÁLOGO SEM NADA PARA MARCAR — a linha 1 do assunto e, para quem
 * alcança o cadastro, o convite no MESMO componente.
 *
 * Dono (2026-09-08, item 2): o campo "Atribuída a" vazio já convidava; o
 * campo "Competências" dizia só "Nenhuma competência encontrada." e não
 * levava a lugar nenhum. *"Ele passa a convidar do mesmo jeito, pelo MESMO
 * componente"* — então quem escolhe é a TELA (qual assunto falta), e o
 * desenho é um só. Este é o uso legítimo do hiperlink em meio a texto: corpo
 * de diálogo, não filtro e não botão central.
 */
export function EmptyFieldInvite({ registration }: { registration: Registration }) {
  const vazio = useSelectionEmptyState(registration);
  return (
    <p className="text-body text-muted-foreground">
      {vazio.message}{" "}
      {vazio.registration ? (
        <RegistrationLink
          registration={vazio.registration}
          className="text-primary underline underline-offset-2"
        />
      ) : null}
    </p>
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
 * FILTRO SEM OPÇÕES É FILTRO BLOQUEADO (dono, 2026-09-08, substituindo o
 * desenho do convite dentro do painel): *"Ao invés de aparecer como linha
 * clicável no filtro, vamos bloquear o filtro e disponibilizamos o botão de
 * criação mais abaixo, dentro do quadro principal e centralizado na tela."*
 *
 * Então aqui não há `Popover`, não há linha clicável e não há hiperlink —
 * para TODOS, inclusive para quem alcança o cadastro. Só a moldura, a frase e
 * o gatilho desabilitado. O convite mudou de lugar, não de existência: quem o
 * desenha é o `EmptyStateCallToAction`, no centro do quadro principal.
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
  const Icone = icon ?? ChevronDown;

  /*
   * O gatilho é `<button>`, então o `<label for>` do `FilterField` já o nomeia
   * — o campo continua se chamando "Ciclo" para quem usa leitor de tela. Sem
   * rótulo visível, o nome viaja no `aria-label`, como no seletor cheio.
   */
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
        <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </FilterTriggerButton>
    </FilterField>
  );
}
