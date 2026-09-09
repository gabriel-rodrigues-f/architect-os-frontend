import { Link } from "@tanstack/react-router";
import { ChevronDown, Info } from "lucide-react";

import { FilterField } from "@/components/app/FilterField";
import { FilterTriggerButton } from "@/components/app/FilterTriggerButton";
import { PageAction } from "@/components/app/PageAction";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHoverDisclosure } from "@/hooks";
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
  /** A LINHA 2 do assunto — a regra de negócio que explica o bloqueio. */
  readonly hint?: string | undefined;
  /** O ÍCONE do assunto, no cartão. Sem assunto declarado, o de informação. */
  readonly icon?: typeof ChevronDown | undefined;
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
  const hint = t(registration.hintKey);
  const icon = registration.icon;
  if (!registration.reachedBy(user)) return { message, hint, icon };
  return {
    message,
    hint,
    icon,
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
 * FILTRO SEM OPÇÕES É FILTRO BLOQUEADO (dono, 2026-09-08): *"Ao invés de
 * aparecer como linha clicável no filtro, vamos bloquear o filtro."* O
 * gatilho continua não escolhendo nada — não abre lista, não vira âncora.
 *
 * O QUE ENTROU DEPOIS (dono, 2026-09-08, com captura): *"não havendo ciclos
 * cadastrados, quero um estado de hover em cima do campo de ciclos que hoje
 * está bloqueado. Ao clicar em 'Cadastrar primeiro ciclo', devo ser
 * direcionado ao formulário de cadastro de ciclo."* O bloqueio deixou de ser
 * uma parede muda: ele explica. O CARTÃO nasce aqui e vale para TODO filtro
 * bloqueado, não só o de ciclo — ícone do assunto, a linha 1, a linha 2 e,
 * para quem alcança o cadastro, um botão primário de largura cheia que abre o
 * FORMULÁRIO (o `search` do `Registration`), não só a tela.
 *
 * O ABRIR E O FECHAR não moram mais aqui: moram no `useHoverDisclosure`, que
 * nasceu deste cartão e passou a servir também o "?" de toda tela (dono,
 * 2026-09-09). São o mesmo problema — hover não existe no toque nem no
 * teclado —, e duas cópias da mesma disciplina divergiriam na primeira
 * correção. O que fica aqui é o que é DESTE campo: a moldura do filtro, o
 * ícone do assunto, as duas linhas, o botão de largura cheia e o
 * `sideOffset={0}` que encosta o cartão no campo para o ponteiro atravessar
 * sem cair no vão.
 *
 * Não há dependência nova: o `Popover` da casa (`@radix-ui/react-popover`) é
 * quem posiciona; quem manda no abrir e fechar é o gancho.
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
  const IconeDoAssunto = empty?.icon ?? Info;

  const cartao = useHoverDisclosure();

  /*
   * O gatilho é `<button>`, então o `<label for>` do `FilterField` já o nomeia
   * — o campo continua se chamando "Ciclo" para quem usa leitor de tela. Sem
   * rótulo visível, o nome viaja no `aria-label`, como no seletor cheio.
   */
  return (
    <FilterField label={label} htmlFor={id}>
      <Popover open={cartao.open} onOpenChange={cartao.onOpenChange}>
        <PopoverTrigger asChild>
          <FilterTriggerButton
            ref={cartao.triggerRef}
            id={id}
            blocked
            aria-label={label ? undefined : ariaLabel}
            aria-describedby={describedBy}
            className={triggerClassName}
            {...cartao.triggerProps}
          >
            <span className="min-w-0 flex-1 truncate text-left">{message}</span>
            <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </FilterTriggerButton>
        </PopoverTrigger>
        <PopoverContent
          ref={cartao.contentRef}
          align="start"
          sideOffset={0}
          className="space-y-3"
          {...cartao.contentProps}
        >
          <div className="flex items-start gap-2">
            <IconeDoAssunto
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-label font-medium text-foreground">{message}</p>
              {empty?.hint ? <p className="text-meta text-muted-foreground">{empty.hint}</p> : null}
            </div>
          </div>
          {empty?.registration ? (
            <PageAction
              label={empty.registration.label}
              className="w-full"
              asChild
              onClick={cartao.close}
            >
              <Link
                to={empty.registration.to}
                {...(empty.registration.search ? { search: empty.registration.search } : {})}
              />
            </PageAction>
          ) : null}
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}
