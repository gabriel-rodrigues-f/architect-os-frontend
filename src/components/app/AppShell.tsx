import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarRange,
  ChevronDown,
  ClipboardCheck,
  Compass,
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
  Ruler,
  Scale,
  Settings,
  Sun,
  Target,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { NoticeBell } from "@/components/app/NoticeBell";
import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import { semanticTone } from "@/components/app/ui-bits";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useReducedMotion } from "@/hooks";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { readMigratedItem } from "@/lib/storage";
import { useCycleSelection } from "@/lib/context-scope";
import { useIdleSession } from "@/lib/use-idle-session";
import { useTheme, type Theme } from "@/lib/theme";

interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;

  activePrefixes?: string[];

  adminOnly?: boolean;

  teamRuleReachOnly?: boolean;

  calibrationReachOnly?: boolean;

  teamCompositionReachOnly?: boolean;

  teamAnalysisOnly?: boolean;

  leadershipOnly?: boolean;

  ownCareerOnly?: boolean;

  external?: boolean;

  hintKey?: MessageKey;
}

const OWN_ARCHITECT_PARAM = "$architectId";

interface NavGroup {
  labelKey?: MessageKey;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        to: `/architects/${OWN_ARCHITECT_PARAM}/roadmap`,
        labelKey: "nav.myCareer",
        icon: Compass,
        activePrefixes: [`/architects/${OWN_ARCHITECT_PARAM}`],
        ownCareerOnly: true,
      },
    ],
  },
  {
    labelKey: "nav.group.operation",
    items: [
      { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
      {
        to: "/team",
        labelKey: "nav.team",
        icon: Users,
        activePrefixes: ["/architects"],
        leadershipOnly: true,
      },
      { to: "/assessments", labelKey: "nav.assessments", icon: ClipboardCheck },
    ],
  },
  {
    labelKey: "nav.capabilities",
    items: [
      { to: "/capability-map", labelKey: "cap.tabs.coverage", icon: Map, teamAnalysisOnly: true },
      {
        to: "/gap-analysis",
        labelKey: "cap.tabs.priorities",
        icon: ListOrdered,
        teamAnalysisOnly: true,
      },
      {
        to: "/progression",
        labelKey: "cap.tabs.progression",
        icon: TrendingUp,
        teamAnalysisOnly: true,
      },
      {
        to: "/training-needs",
        labelKey: "cap.tabs.collective",
        icon: Layers,
        teamAnalysisOnly: true,
      },
      {
        to: "/compare",
        labelKey: "cap.tabs.comparison",
        icon: GitCompare,
        teamAnalysisOnly: true,
      },
    ],
  },
  {
    labelKey: "nav.group.development",
    items: [
      { to: "/development-plans", labelKey: "nav.developmentPlans", icon: Target },
      { to: "/learning-paths", labelKey: "nav.learningPaths", icon: BookOpen },
      { to: "/mentoring", labelKey: "nav.mentoring", icon: GraduationCap },
      { to: "/cycles", labelKey: "nav.cycles", icon: CalendarRange, leadershipOnly: true },
    ],
  },
  {
    labelKey: "nav.group.ruler",
    items: [
      {
        to: "/team-rules",
        labelKey: "nav.teamRules",
        icon: Ruler,
        teamRuleReachOnly: true,
      },
      { to: "/settings", labelKey: "nav.settings", icon: Scale, leadershipOnly: true },
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
      {
        to: "/calibration",
        labelKey: "nav.calibration",
        icon: BarChart3,
        calibrationReachOnly: true,
      },
      { to: "/teams", labelKey: "nav.teams", icon: Building2, teamCompositionReachOnly: true },
      {
        to: "/grafana",
        labelKey: "nav.grafana",
        icon: Activity,
        adminOnly: true,
        external: true,
        hintKey: "nav.grafanaHint",
      },
      { to: "/users", labelKey: "nav.users", icon: UserCog, leadershipOnly: true },
    ],
  },
];

class NavigationOfUser {
  constructor(
    private readonly user: SessionUser | undefined,
    private readonly policy = defaultUiAuthorizationPolicy,
  ) {}

  reaches(item: NavItem): boolean {
    const user = this.user;
    if (item.adminOnly && !(user && this.policy.isAdmin(user))) return false;
    if (item.teamRuleReachOnly && !(user && this.policy.canConfigureAnyTeamRules(user))) {
      return false;
    }
    if (item.calibrationReachOnly && !(user && this.policy.canCalibrate(user))) return false;
    if (item.teamCompositionReachOnly && !(user && this.policy.canComposeAnyTeam(user))) {
      return false;
    }
    if (item.teamAnalysisOnly && !(user && this.policy.canAnalyzeTeam(user))) return false;
    if (item.leadershipOnly && !(user && this.policy.isLeadership(user))) return false;
    return !item.ownCareerOnly || this.reachesOwnCareer();
  }

  private reachesOwnCareer(): boolean {
    const architectId = this.ownArchitectId;
    if (!this.user || architectId === null) return false;
    return this.policy.canOpenCareerFileOf(this.user, architectId);
  }

  addressed(item: NavItem): NavItem {
    const architectId = this.ownArchitectId;
    if (!item.ownCareerOnly || architectId === null) return item;
    const resolve = (path: string) => path.replace(OWN_ARCHITECT_PARAM, architectId);
    return {
      ...item,
      to: resolve(item.to),
      ...(item.activePrefixes ? { activePrefixes: item.activePrefixes.map(resolve) } : {}),
    };
  }

  private get ownArchitectId(): string | null {
    return this.user?.architectId ?? null;
  }
}

export function filterNavGroups(groups: NavGroup[], user: SessionUser | undefined): NavGroup[] {
  const navigation = new NavigationOfUser(user);
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => navigation.reaches(item))
        .map((item) => navigation.addressed(item)),
    }))
    .filter((group) => group.items.length > 0);
}

class NavRouteMatch {
  constructor(private readonly pathname: string) {}

  specificityOf(item: NavItem): number {
    if (item.to === "/") return this.pathname === "/" ? 1 : -1;
    return [item.to, ...(item.activePrefixes ?? [])].reduce(
      (best, prefix) => (this.covers(prefix) ? Math.max(best, prefix.length) : best),
      -1,
    );
  }

  private covers(prefix: string): boolean {
    return this.pathname === prefix || this.pathname.startsWith(`${prefix}/`);
  }
}

export function isNavItemActive(
  item: NavItem,
  pathname: string,
  siblings: readonly NavItem[] = [],
): boolean {
  const match = new NavRouteMatch(pathname);
  const own = match.specificityOf(item);
  if (own < 0) return false;
  return siblings.every((sibling) => sibling === item || match.specificityOf(sibling) <= own);
}

export function isNavItemHiddenByCollapse(
  item: NavItem,
  pathname: string,
  isGroupCollapsed: boolean,
  siblings: readonly NavItem[] = [],
): boolean {
  return isGroupCollapsed && !isNavItemActive(item, pathname, siblings);
}

const navGroupPanelId = (labelKey: string) => `nav-group-${labelKey.replace(/\./g, "-")}`;

const outOfReachProps = (hidden: boolean) =>
  hidden ? ({ tabIndex: -1, "aria-hidden": true } as const) : {};

const SIDEBAR_STORAGE_KEY = "synapse:sidebar-collapsed";
const LEGACY_SIDEBAR_STORAGE_KEY = "architect-os:sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "synapse:sidebar-width";
const LEGACY_SIDEBAR_WIDTH_KEY = "architect-os:sidebar-width";
const NAV_COLLAPSED_GROUPS_KEY = "synapse:nav-collapsed-groups";

const PAGE_CONTAINER = "mx-auto w-full max-w-page";

const SIDEBAR_DEFAULT = 264;
const SIDEBAR_MIN = 208;
const SIDEBAR_MAX = 420;
const SIDEBAR_RAIL = 64;

const BRAND_HEADER_HEIGHT = "h-[74px]";

const clampWidth = (value: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, value));

const THEME_OPTIONS: { value: Theme; labelKey: MessageKey; icon: typeof Sun }[] = [
  { value: "light", labelKey: "prefs.theme.light", icon: Sun },
  { value: "dark", labelKey: "prefs.theme.dark", icon: Moon },
  { value: "system", labelKey: "prefs.theme.system", icon: Monitor },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { cycles, activeCycleId, setActiveCycle } = useCycleSelection();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const idlePhase = useIdleSession({
    active: user !== null,
    onEnd: () => {
      void logout();
    },
  });

  const navGroups = filterNavGroups(NAV_GROUPS, user ?? undefined);
  const navItems = navGroups.flatMap((group) => group.items);
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

  const renderDesktopNavItem = (item: NavItem, hidden = false) => {
    const active = !item.external && isNavItemActive(item, pathname, navItems);
    const label = t(item.labelKey);
    const className = cn(
      "flex items-center rounded-lg py-2 text-sm transition-colors",
      collapsed ? "justify-center px-0" : "gap-2.5 px-3",
      active
        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
    );
    const conteudo = (
      <>
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
      </>
    );
    const link = item.external ? (
      <a
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={item.hintKey ? t(item.hintKey) : undefined}
        {...outOfReachProps(hidden)}
        className={className}
      >
        {conteudo}
      </a>
    ) : (
      <Link to={item.to} aria-label={label} {...outOfReachProps(hidden)} className={className}>
        {conteudo}
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
        <aside
          style={{ width: collapsed ? SIDEBAR_RAIL : width }}
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex",

            resizing ? "" : "transition-[width] duration-300 ease-in-out",
          )}
        >
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
          <div className={cn("relative shrink-0 overflow-hidden", BRAND_HEADER_HEIGHT)}>
            <div
              className={cn(
                "flex justify-end pt-5 transition-[padding] duration-300",
                reducedMotion && "transition-none",
                collapsed ? "px-[18px]" : "px-3.5",
              )}
            >
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={collapsed ? t("shell.showMenu") : t("shell.hideMenu")}
                title={collapsed ? t("shell.showMenu") : t("shell.hideMenu")}
                aria-expanded={!collapsed}
                className={cn(
                  "shrink-0 rounded-md p-1.5 text-sidebar-foreground/70 transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>
            <p
              className={cn(
                "absolute whitespace-nowrap font-display font-semibold leading-none",
                "transition-all duration-300 ease-in-out",
                reducedMotion && "transition-none",
                collapsed
                  ? "left-1/2 top-[52px] -translate-x-1/2 text-[10px]"
                  : "left-5 top-[22px] text-sm",
              )}
            >
              Synapse
            </p>
            <p
              className={cn(
                "absolute left-5 top-[42px] whitespace-nowrap text-[length:var(--text-meta)] text-sidebar-foreground/60",
                "transition-opacity duration-300",
                reducedMotion && "transition-none",
                collapsed ? "pointer-events-none opacity-0" : "opacity-100",
              )}
              aria-hidden={collapsed}
            >
              {t("shell.subtitle")}
            </p>
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
                    <div className="space-y-0.5">
                      {group.items.map((item) => renderDesktopNavItem(item))}
                    </div>
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
                  siblings={navItems}
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
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
            {idlePhase === "warning" ? (
              <div
                role="alert"
                className={cn(
                  semanticTone.warning,
                  "border-b border-border px-5 py-2 text-sm font-medium lg:px-8",
                )}
              >
                {t("shell.idleWarning")}
              </div>
            ) : null}
            <div
              className={cn(
                PAGE_CONTAINER,
                "flex flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8",
              )}
            >
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
                <p className="hidden truncate text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:block">
                  {t("shell.flow")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {user?.role === "admin" ? (
                  <>
                    <label className="text-xs text-muted-foreground" htmlFor="cycle">
                      {t("shell.cycle")}
                    </label>
                    <SingleSelectFilter
                      id="cycle"
                      ariaLabel={t("shell.cycle")}
                      value={activeCycleId}
                      onChange={setActiveCycle}
                      options={cycles.map((c) => ({ value: c.id, label: c.name }))}
                      triggerClassName="h-8 w-auto min-w-0 px-2.5 py-1.5 text-sm shadow-none"
                    />
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    {t("shell.cycle")}
                    <span className="text-sm font-medium text-foreground">
                      {cycles.find((c) => c.id === activeCycleId)?.name ?? "—"}
                    </span>
                  </p>
                )}
                <NoticeBell />
                <PreferencesMenu />
              </div>
            </div>
          </header>

          <main className={cn(PAGE_CONTAINER, "flex-1 px-5 py-6 lg:px-8 lg:py-8")}>{children}</main>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex w-[85vw] max-w-xs flex-col gap-0 p-0 sm:max-w-xs">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle className="font-display text-sm font-semibold">Synapse</SheetTitle>
            <p className="text-meta text-muted-foreground">{t("shell.subtitle")}</p>
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
                siblings={navItems}
                headerClassName="flex w-full items-center justify-between gap-2 rounded-md px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 transition-colors hover:text-foreground/80"
                renderItem={(item, hidden) =>
                  item.external ? (
                    <a
                      key={item.to}
                      href={item.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.hintKey ? t(item.hintKey) : undefined}
                      onClick={() => setMobileNavOpen(false)}
                      {...outOfReachProps(hidden)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {t(item.labelKey)}
                    </a>
                  ) : (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileNavOpen(false)}
                      {...outOfReachProps(hidden)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        isNavItemActive(item, pathname, navItems)
                          ? "bg-secondary font-medium text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {t(item.labelKey)}
                    </Link>
                  )
                }
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
  headerClassName: string;
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
          const hidden = isNavItemHiddenByCollapse(item, pathname, isGroupCollapsed, siblings);
          return (
            <div
              key={item.to}
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
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
      <PopoverContent align="end" className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("prefs.theme")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={theme === option.value}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-sm transition-colors",
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
