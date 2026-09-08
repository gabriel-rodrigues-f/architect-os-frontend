import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavItem } from "@/lib/navigation-catalog";
import { cn } from "@/lib/utils";

/**
 * O ITEM DO MENU — um renderizador só para a coluna e para a gaveta móvel
 * ([N-01], [FA-12]: eram dois, com markup divergente e sem `aria-current` no
 * móvel). Decisão do dono (2026-09-08, referência FIAP, "no nosso azul"):
 *
 *  - o ÍCONE é sempre azul (`sidebar-emphasis`), o texto neutro;
 *  - no HOVER o texto pinta de azul, sobre um fundo sutil;
 *  - ATIVO = texto azul + fundo sutil + indicador lateral de 2 px em azul.
 *
 *
 * TODO item é ROTA (dono, 2026-09-08). A âncora externa `target="_blank"`
 * morreu com o item das Métricas da Plataforma: ela não mudava a rota, e por
 * isso o menu ficava com dois itens acesos — o da tela onde a pessoa estava e
 * o das Métricas. Com uma forma só, `aria-current` e o item aceso voltam a
 * ser a mesma verdade; quem precisa de aba nova a reserva no clique
 * (`opensInNewTab`) e desenha a transição numa tela de verdade.
 */
export class NavLinkStyle {
  static readonly base =
    "relative flex items-center rounded-md py-2 text-sm transition-base before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-sidebar-emphasis before:opacity-0 before:transition-opacity before:content-['']";

  static readonly icon = "size-4 shrink-0 text-sidebar-emphasis";

  static readonly rest =
    "text-sidebar-foreground/75 hover:bg-sidebar-emphasis-subtle hover:text-sidebar-emphasis";

  static readonly active =
    "bg-sidebar-emphasis-subtle font-medium text-sidebar-emphasis before:opacity-100";
}

export function NavLinkItem({
  item,
  label,
  active,
  collapsed = false,
  hint,
  badge = null,
  onNavigate,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  /** Coluna recolhida ao trilho: só o ícone, o rótulo vira tooltip. */
  collapsed?: boolean;
  hint?: string | undefined;
  badge?: ReactNode;
  onNavigate?: (() => void) | undefined;
}) {
  const className = cn(
    NavLinkStyle.base,
    collapsed ? "justify-center px-0" : "gap-2.5 px-3",
    active ? NavLinkStyle.active : NavLinkStyle.rest,
  );
  const conteudo = (
    <>
      <item.icon className={NavLinkStyle.icon} aria-hidden />
      <span
        data-nav-label
        className={cn(
          "overflow-hidden whitespace-nowrap transition-slow",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
        )}
      >
        {label}
      </span>
      {!collapsed && badge}
    </>
  );
  const link = (
    <Link
      to={item.to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={hint}
      data-active={active}
      onClick={onNavigate}
      className={className}
    >
      {conteudo}
    </Link>
  );

  return collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  ) : (
    <div>{link}</div>
  );
}
