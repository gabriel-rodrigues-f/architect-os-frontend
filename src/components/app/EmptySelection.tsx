import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { FilterField } from "@/components/app/FilterField";
import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
 * O HIPERLINK DE CADASTRO — o mesmo em toda parte: DENTRO do painel do
 * seletor vazio, e no corpo de um diálogo cuja lista de pessoas ainda não tem
 * ninguém para listar (regra de reuso: dois lugares, um componente).
 *
 * Onde ele NÃO pode aparecer é solto abaixo de um campo — recusa do dono
 * (2026-09-08): *"não podemos, do ponto de vista de UX, ter um hiperlink
 * abaixo de um botão assim"*.
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
 * oferecer.
 *
 * Para quem alcança, o gatilho ABRE UM PAINEL, como qualquer seletor cheio:
 * mesmo `Popover`, mesma largura, mesmo alinhamento. Dentro dele, a frase e o
 * convite de cadastro, desenhado como um item de lista. A primeira volta
 * desta fatia pendurou o convite ABAIXO do campo e o dono recusou, literal:
 * *"não podemos, do ponto de vista de UX, ter um hiperlink abaixo de um botão
 * assim. O texto deve aparecer quando o usuário clicar no botão do filtro.
 * Isso vale para todos."* Por isso NADA é renderizado fora do gatilho e do
 * painel — e o gatilho é botão, nunca âncora: gatilho é gatilho.
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
  const [open, setOpen] = useState(false);
  const message = empty?.message ?? t("selector.empty");
  const registration = empty?.registration;
  const Icone = icon ?? ChevronDown;
  /*
   * O gatilho é `<button>`, então o `<label for>` do `FilterField` já o nomeia
   * — o campo continua se chamando "Ciclo" para quem usa leitor de tela. Sem
   * rótulo visível, o nome viaja no `aria-label`, como no seletor cheio.
   */
  const nomeDoCampo = label ?? ariaLabel;

  const gatilho = (
    <FilterTriggerButton
      id={id}
      disabled={registration === undefined}
      aria-haspopup={registration ? "dialog" : undefined}
      aria-label={label ? undefined : ariaLabel}
      aria-describedby={describedBy}
      title={message}
      className={triggerClassName}
    >
      <span className="min-w-0 flex-1 truncate text-left">{message}</span>
      <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </FilterTriggerButton>
  );

  // Quem não alcança o cadastro não tem painel: nem lista, nem porta. Só a
  // frase, no campo obscurecido — como sempre foi.
  if (!registration)
    return (
      <FilterField label={label} htmlFor={id}>
        {gatilho}
      </FilterField>
    );

  return (
    <FilterField label={label} htmlFor={id}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
        <PopoverContent aria-label={nomeDoCampo} align="start" className="w-56 p-1">
          <p className="px-2 py-1.5 text-body text-muted-foreground">{message}</p>
          <RegistrationLink
            registration={registration}
            onNavigate={() => setOpen(false)}
            className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-body font-medium text-primary hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
          />
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}
