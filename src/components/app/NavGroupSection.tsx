import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { isNavItemHiddenByCollapse, type NavGroup, type NavItem } from "@/lib/navigation-catalog";
import { cn } from "@/lib/utils";

const navGroupPanelId = (labelKey: string) => `nav-group-${labelKey.replace(/\./g, "-")}`;

/**
 * O cabeçalho de grupo do menu ([T-02]): `text-meta` (11 px) a 70% sobre a
 * coluna — o mesmo nos dois menus, porque a gaveta móvel também é pintada
 * com a paleta `sidebar-*` ([N-01]).
 */
export const NAV_GROUP_HEADER_CLASS =
  "flex w-full items-center justify-between gap-2 rounded-md px-3 pb-1 pt-2 text-meta font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground";

/**
 * Um grupo do menu: o cabeçalho que recolhe e os itens, com o item ATIVO
 * sempre à vista mesmo com o grupo recolhido. Serve à coluna e à gaveta
 * móvel — quem renderiza cada item é o `renderItem` de quem chama.
 */
export function NavGroupSection({
  group,
  groupIndex,
  pathname,
  collapsedGroups,
  onToggleGroup,
  reducedMotion,
  groupLabel,
  idPrefix = "",
  renderItem,
  siblings,
}: {
  group: NavGroup;
  groupIndex: number;
  pathname: string;
  collapsedGroups: Set<string>;
  onToggleGroup: (labelKey: string) => void;
  reducedMotion: boolean;
  groupLabel: string;
  idPrefix?: string;
  renderItem: (item: NavItem, hidden: boolean) => ReactNode;
  siblings: readonly NavItem[];
}) {
  const wrapperClassName = groupIndex > 0 ? "pt-2" : "";

  if (!group.labelKey) {
    return (
      <div className={wrapperClassName}>
        <div className="space-y-0.5">{group.items.map((item) => renderItem(item, false))}</div>
      </div>
    );
  }

  const labelKey = group.labelKey;
  const isGroupCollapsed = collapsedGroups.has(labelKey);
  const panelId = `${idPrefix}${navGroupPanelId(labelKey)}`;

  return (
    <div className={wrapperClassName}>
      <button
        type="button"
        onClick={() => onToggleGroup(labelKey)}
        aria-expanded={!isGroupCollapsed}
        aria-controls={panelId}
        className={NAV_GROUP_HEADER_CLASS}
      >
        <span>{groupLabel}</span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 transition-transform duration-(--motion-base) ease-standard",
            reducedMotion && "transition-none",
            !isGroupCollapsed && "rotate-180",
          )}
        />
      </button>
      <div id={panelId} className="space-y-0.5">
        {group.items.map((item) => {
          const hidden = isNavItemHiddenByCollapse(item, pathname, isGroupCollapsed, siblings);
          return (
            <div
              key={item.to}
              className={cn(
                "grid transition-[grid-template-rows] duration-(--motion-base) ease-standard",
                reducedMotion && "transition-none",
              )}
              style={{ gridTemplateRows: hidden ? "0fr" : "1fr" }}
            >
              <div className="overflow-hidden">{renderItem(item, hidden)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
