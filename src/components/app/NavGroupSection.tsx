import type { ReactNode } from "react";

import type { NavGroup, NavItem } from "@/lib/navigation-catalog";

/**
 * O cabeçalho de grupo do menu ([T-02]): `text-meta` (11 px) a 70% sobre a
 * coluna — o mesmo nos dois menus, porque a gaveta móvel também é pintada
 * com a paleta `sidebar-*` ([N-01]).
 */
export const NAV_GROUP_HEADER_CLASS =
  "flex w-full items-center gap-2 rounded-md px-3 pb-1 pt-2 text-meta font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70";

/**
 * Um grupo do menu: o cabeçalho e os itens. Serve à coluna e à gaveta móvel —
 * quem renderiza cada item é o `renderItem` de quem chama.
 *
 * Dono (2026-09-08): *"não estou mais vendo utilidade no botão de esconder/
 * mostrar menus na coluna lateral. Remova. Vamos continuar separando por
 * grupos, mas agora sem a setinha."* O cabeçalho é SEPARADOR VISUAL, não
 * gatilho: sem `button`, sem `aria-expanded`, sem chevron e sem memória de
 * grupos recolhidos. Com isso morreram também a linha de grade animada e o
 * `isNavItemHiddenByCollapse` — nenhum item do menu fica fora de alcance.
 *
 * O botão que recolhe a COLUNA inteira, no topo, é outro e continua vivo.
 */
export function NavGroupSection({
  group,
  groupIndex,
  groupLabel,
  renderItem,
}: {
  group: NavGroup;
  groupIndex: number;
  groupLabel: string;
  renderItem: (item: NavItem) => ReactNode;
}) {
  const wrapperClassName = groupIndex > 0 ? "pt-2" : "";

  return (
    <div className={wrapperClassName}>
      {group.labelKey ? <p className={NAV_GROUP_HEADER_CLASS}>{groupLabel}</p> : null}
      <div className="space-y-0.5">{group.items.map((item) => renderItem(item))}</div>
    </div>
  );
}
