import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarRange,
  ChevronDown,
  ClipboardCheck,
  GitCompare,
  GraduationCap,
  Grid3x3,
  LayoutDashboard,
  Layers,
  ListOrdered,
  LogOut,
  Map,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Settings,
  Sun,
  Target,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { readMigratedItem } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { useTheme, type Theme } from "@/lib/theme";

interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;

  activePrefixes?: string[];

  adminOnly?: boolean;
}

interface NavGroup {
  labelKey?: MessageKey;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "nav.group.operation",
    items: [
      { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { to: "/team", labelKey: "nav.team", icon: Users },
      { to: "/assessments", labelKey: "nav.assessments", icon: ClipboardCheck },
    ],
  },
  {
    labelKey: "nav.capabilities",
    items: [
      { to: "/capability-map", labelKey: "cap.tabs.coverage", icon: Map },
      { to: "/gap-analysis", labelKey: "cap.tabs.priorities", icon: ListOrdered },
      { to: "/progression", labelKey: "cap.tabs.progression", icon: TrendingUp },
      { to: "/training-needs", labelKey: "cap.tabs.collective", icon: Layers },
      { to: "/compare", labelKey: "cap.tabs.comparison", icon: GitCompare },
    ],
  },
  {
    labelKey: "nav.group.development",
    items: [
      { to: "/development-plans", labelKey: "nav.developmentPlans", icon: Target },
      { to: "/learning-paths", labelKey: "nav.learningPaths", icon: BookOpen },
      { to: "/mentoring", labelKey: "nav.mentoring", icon: GraduationCap },
    ],
  },
  {
    labelKey: "nav.group.admin",
    items: [
      {
        to: "/competency-matrix",
        labelKey: "nav.competencyMatrix",
        icon: Grid3x3,
        adminOnly: true,
      },
      { to: "/cycles", labelKey: "nav.cycles", icon: CalendarRange },

      { to: "/settings", labelKey: "nav.settings", icon: Scale },
      { to: "/users", labelKey: "nav.users", icon: UserCog, adminOnly: true },
    ],
  },
];

export function filterNavGroups(groups: NavGroup[], role: string | undefined): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || role === "admin"),
    }))
    .filter((group) => group.items.length > 0);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  return (
    pathname.startsWith(item.to) ||
    (item.activePrefixes?.some((p) => pathname.startsWith(p)) ?? false)
  );
}

export function isNavItemHiddenByCollapse(
  item: NavItem,
  pathname: string,
  isGroupCollapsed: boolean,
): boolean {
  return isGroupCollapsed && !isNavItemActive(item, pathname);
}

const navGroupPanelId = (labelKey: string) => `nav-group-${labelKey.replace(/\./g, "-")}`;

const SIDEBAR_STORAGE_KEY = "synapse:sidebar-collapsed";
const LEGACY_SIDEBAR_STORAGE_KEY = "architect-os:sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "synapse:sidebar-width";
const LEGACY_SIDEBAR_WIDTH_KEY = "architect-os:sidebar-width";
const NAV_COLLAPSED_GROUPS_KEY = "synapse:nav-collapsed-groups";

const SIDEBAR_DEFAULT = 264;
const SIDEBAR_MIN = 208;
const SIDEBAR_MAX = 420;
const SIDEBAR_RAIL = 64;

const clampWidth = (value: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, value));

const THEME_OPTIONS: { value: Theme; labelKey: MessageKey; icon: typeof Sun }[] = [
  { value: "light", labelKey: "prefs.theme.light", icon: Sun },
  { value: "dark", labelKey: "prefs.theme.dark", icon: Moon },
  { value: "system", labelKey: "prefs.theme.system", icon: Monitor },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { cycles, activeCycleId, setActiveCycle } = useStore();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const navGroups = filterNavGroups(NAV_GROUPS, user?.role);
  const reducedMotion = useReducedMotion();

  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(SIDEBAR_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_COLLAPSED_GROUPS_KEY);
      if (raw) setCollapsedGroups(new Set(JSON.parse(raw) as string[]));
    } catch {
      return;
    }
  }, []);

  const toggleGroup = (labelKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(labelKey)) next.delete(labelKey);
      else next.add(labelKey);
      try {
        window.localStorage.setItem(NAV_COLLAPSED_GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        return next;
      }
      return next;
    });
  };

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setCollapsed(readMigratedItem(SIDEBAR_STORAGE_KEY, LEGACY_SIDEBAR_STORAGE_KEY) === "true");
    const salva = Number(readMigratedItem(SIDEBAR_WIDTH_KEY, LEGACY_SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(salva) && salva > 0) setWidth(clampWidth(salva));
  }, []);

  useEffect(() => {
    if (collapsed || window.localStorage.getItem(SIDEBAR_WIDTH_KEY)) return;
    const nav = navRef.current;
    if (!nav) return;

    const rotulos = [...nav.querySelectorAll<HTMLElement>("[data-nav-label]")];
    const maior = Math.max(0, ...rotulos.map((el) => el.scrollWidth));

    setWidth(clampWidth(Math.ceil(maior) + 90));
  }, [collapsed, t]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!prev));
      return !prev;
    });
  };

  useEffect(() => {
    if (!resizing) return;

    const onMove = (event: MouseEvent) => setWidth(clampWidth(event.clientX));
    const onUp = () => {
      setResizing(false);
      setWidth((atual) => {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(atual));
        return atual;
      });
    };

    const cursorAnterior = document.body.style.cursor;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = cursorAnterior;
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  const onHandleKeyDown = (event: KeyboardEvent) => {
    const passo = event.shiftKey ? 32 : 8;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setWidth((w) => {
        const proximo = clampWidth(w - passo);
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(proximo));
        return proximo;
      });
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setWidth((w) => {
        const proximo = clampWidth(w + passo);
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(proximo));
        return proximo;
      });
    }
  };

  const renderDesktopNavItem = (item: NavItem) => {
    const active = isNavItemActive(item, pathname);
    const label = t(item.labelKey);
    const link = (
      <Link
        to={item.to}
        aria-label={label}
        className={cn(
          "flex items-center rounded-lg py-2 text-sm transition-colors",
          collapsed ? "justify-center px-0" : "gap-2.5 px-3",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span
          data-nav-label
          className={cn(
            "overflow-hidden whitespace-nowrap transition-all duration-300",
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
          )}
        >
          {label}
        </span>
      </Link>
    );

    return collapsed ? (
      <Tooltip key={item.to}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      <div key={item.to}>{link}</div>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen w-full bg-background">
        {}
        <aside
          style={{ width: collapsed ? SIDEBAR_RAIL : width }}
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex",

            resizing ? "" : "transition-[width] duration-300 ease-in-out",
          )}
        >
          {}
          {!collapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Ajustar largura do menu"
              aria-valuenow={width}
              aria-valuemin={SIDEBAR_MIN}
              aria-valuemax={SIDEBAR_MAX}
              tabIndex={0}
              onMouseDown={() => setResizing(true)}
              onDoubleClick={() => {
                setWidth(SIDEBAR_DEFAULT);
                window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(SIDEBAR_DEFAULT));
              }}
              onKeyDown={onHandleKeyDown}
              title="Arraste para ajustar · duplo clique restaura"
              className={cn(
                "absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors",
                "after:absolute after:-left-1 after:h-full after:w-3 after:content-['']",
                "hover:bg-sidebar-ring focus-visible:bg-sidebar-ring focus-visible:outline-none",
                resizing && "bg-sidebar-ring",
              )}
            />
          )}
          {}
          <div
            className={cn(
              "flex items-center py-5 transition-[padding] duration-300",
              collapsed ? "justify-center px-0" : "gap-2.5 px-5",
            )}
          >
            {}
            <div
              className={cn(
                "min-w-0 overflow-hidden leading-tight transition-all duration-300",
                collapsed ? "w-0 opacity-0" : "w-auto flex-1 opacity-100",
              )}
            >
              <p className="whitespace-nowrap font-display text-sm font-semibold">Synapse</p>
              <p className="whitespace-nowrap text-[11px] text-sidebar-foreground/60">
                {t("shell.subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? t("shell.showMenu") : t("shell.hideMenu")}
              title={collapsed ? t("shell.showMenu") : t("shell.hideMenu")}
              aria-expanded={!collapsed}
              className={cn(
                "shrink-0 rounded-md p-1.5 text-sidebar-foreground/70 transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                !collapsed && "-mr-1.5",
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          <nav
            ref={navRef}
            className={cn(
              "flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden pb-4",
              collapsed ? "px-2" : "px-3",
            )}
          >
            {navGroups.map((group, groupIndex) => {
              if (!group.labelKey || collapsed) {
                return (
                  <div
                    key={group.labelKey ?? `group-${groupIndex}`}
                    className={groupIndex > 0 ? "pt-2" : ""}
                  >
                    <div className="space-y-0.5">{group.items.map(renderDesktopNavItem)}</div>
                  </div>
                );
              }

              return (
                <NavGroupSection
                  key={group.labelKey}
                  group={group}
                  groupIndex={groupIndex}
                  pathname={pathname}
                  collapsedGroups={collapsedGroups}
                  onToggleGroup={toggleGroup}
                  reducedMotion={reducedMotion}
                  groupLabel={t(group.labelKey)}
                  headerClassName="flex w-full items-center justify-between gap-2 rounded-md px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground/80"
                  renderItem={renderDesktopNavItem}
                />
              );
            })}
          </nav>

          <div
            className={cn(
              "border-t border-sidebar-border py-4 text-xs text-sidebar-foreground/70",
              collapsed ? "px-2" : "px-5",
            )}
          >
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={logout}
                    aria-label={t("shell.logout")}
                    className="flex w-full justify-center rounded-md p-1.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {user?.name} · {t("shell.logout")}
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <p className="truncate font-medium text-sidebar-foreground">{user?.name}</p>
                <p className="truncate">{user?.email}</p>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-2 flex items-center gap-1.5 text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t("shell.logout")}
                </button>
              </>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/85 px-5 py-3 backdrop-blur lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label={t("shell.openMenu")}
                title={t("shell.openMenu")}
                className="-ml-1.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              {}
              <p className="hidden truncate text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:block">
                {t("shell.flow")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground" htmlFor="cycle">
                {t("shell.cycle")}
              </label>
              {user?.role === "admin" ? (
                <SingleSelectFilter
                  id="cycle"
                  ariaLabel={t("shell.cycle")}
                  value={activeCycleId}
                  onChange={setActiveCycle}
                  options={cycles.map((c) => ({ value: c.id, label: c.name }))}
                  triggerClassName="mt-0 h-8 w-auto min-w-0 px-2.5 py-1.5 text-sm shadow-none"
                />
              ) : (
                <span id="cycle" className="px-1 text-sm font-medium">
                  {cycles.find((c) => c.id === activeCycleId)?.name ?? "—"}
                </span>
              )}
              <PreferencesMenu />
            </div>
          </header>

          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex w-[85vw] max-w-xs flex-col gap-0 p-0 sm:max-w-xs">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle className="font-display text-sm font-semibold">Synapse</SheetTitle>
            <p className="text-[11px] text-muted-foreground">{t("shell.subtitle")}</p>
          </SheetHeader>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
            {navGroups.map((group, groupIndex) => (
              <NavGroupSection
                key={group.labelKey ?? `mobile-group-${groupIndex}`}
                group={group}
                groupIndex={groupIndex}
                pathname={pathname}
                collapsedGroups={collapsedGroups}
                onToggleGroup={toggleGroup}
                reducedMotion={reducedMotion}
                groupLabel={group.labelKey ? t(group.labelKey) : ""}
                idPrefix="mobile-"
                headerClassName="flex w-full items-center justify-between gap-2 rounded-md px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 transition-colors hover:text-foreground/80"
                renderItem={(item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      isNavItemActive(item, pathname)
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {t(item.labelKey)}
                  </Link>
                )}
              />
            ))}
          </nav>
          <div className="border-t border-border px-5 py-4 text-xs text-muted-foreground">
            <p className="truncate font-medium text-foreground">{user?.name}</p>
            <p className="truncate">{user?.email}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-2 flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("shell.logout")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function NavGroupSection({
  group,
  groupIndex,
  pathname,
  collapsedGroups,
  onToggleGroup,
  reducedMotion,
  groupLabel,
  idPrefix = "",
  headerClassName,
  renderItem,
}: {
  group: NavGroup;
  groupIndex: number;
  pathname: string;
  collapsedGroups: Set<string>;
  onToggleGroup: (labelKey: string) => void;
  reducedMotion: boolean;
  groupLabel: string;
  idPrefix?: string;
  headerClassName: string;
  renderItem: (item: NavItem) => ReactNode;
}) {
  const wrapperClassName = groupIndex > 0 ? "pt-2" : "";

  if (!group.labelKey) {
    return (
      <div className={wrapperClassName}>
        <div className="space-y-0.5">{group.items.map(renderItem)}</div>
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
        className={headerClassName}
      >
        <span>{groupLabel}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            reducedMotion && "transition-none",
            !isGroupCollapsed && "rotate-180",
          )}
        />
      </button>
      <div id={panelId} className="space-y-0.5">
        {group.items.map((item) => {
          const hidden = isNavItemHiddenByCollapse(item, pathname, isGroupCollapsed);
          return (
            <div
              key={item.to}
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                reducedMotion && "transition-none",
              )}
              style={{ gridTemplateRows: hidden ? "0fr" : "1fr" }}
            >
              <div className="overflow-hidden">{renderItem(item)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreferencesMenu() {
  const { theme, setTheme } = useTheme();
  const { locale, locales, loading, setLocale, t } = useI18n();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("prefs.title")}
          title={t("prefs.title")}
          className="rounded-md border border-input bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("prefs.theme")}
          </p>
          <div className="grid grid-cols-3 gap-1">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={theme === option.value}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition-colors",
                  theme === option.value
                    ? "border-primary bg-secondary font-medium text-foreground"
                    : "border-input text-muted-foreground hover:bg-secondary",
                )}
              >
                <option.icon className="h-4 w-4" />
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          {}
          <label
            htmlFor="locale"
            className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {t("prefs.language")}
          </label>
          <SingleSelectFilter
            id="locale"
            ariaLabel={t("prefs.language")}
            value={locale}
            disabled={loading}
            onChange={setLocale}
            options={locales.map((l) => ({ value: l.code, label: l.label }))}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
