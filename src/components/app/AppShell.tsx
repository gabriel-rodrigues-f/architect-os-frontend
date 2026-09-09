import { useRouterState } from "@tanstack/react-router";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { WelcomeNoticeToast } from "@/components/app/WelcomeNoticeToast";
import { useSelectionEmptyState } from "@/components/app/EmptySelection";
import { NavGroupSection } from "@/components/app/NavGroupSection";
import { NavLinkItem } from "@/components/app/NavLinkItem";
import { NoticeBell } from "@/components/app/NoticeBell";
import { PageFrame } from "@/components/app/PageFrame";
import { PreferencesMenu } from "@/components/app/PreferencesMenu";
import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import { SynapseBackground } from "@/components/app/SynapseBackground";
import { semanticTone } from "@/components/app/ui-bits";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePendingTeamTransfers, useReducedMotion } from "@/hooks";
import { useAuth } from "@/lib/auth";
import { useCycleSelection } from "@/lib/context-scope";
import { usePlatformMetricsTab, useSynapseSignals } from "@/lib/dependencies";
import { ShellHeader } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import {
  NAV_GROUPS,
  filterNavGroups,
  isNavItemActive,
  type NavItem,
} from "@/lib/navigation-catalog";
import { Registration } from "@/lib/registration";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { SidebarPreferences, defaultSidebarPreferences } from "@/lib/sidebar-preferences";
import { SessionEndReason } from "@/lib/session-end-reason";
import { useIdleSession } from "@/lib/use-idle-session";
import { cn } from "@/lib/utils";

const PAGE_CONTAINER = "mx-auto w-full max-w-page";

/**
 * Literal de propósito: o Tailwind só compila classes que enxerga no fonte —
 * `h-[${n}px]` montado em tempo de execução não vira CSS, e o bloco da marca
 * perdia a altura (dono, 2026-09-07: "Desenvolvimento de Capacidades está
 * comprimido"). A altura é o token `--shell-header-h` ([N-02]); o teste
 * `marca-na-coluna` cobra que a classe seja a do `ShellHeader`.
 */
export const BRAND_HEADER_HEIGHT = ShellHeader.heightClass;

/** O alvo do skip link e do foco após navegar ([A-02]). */
export const MAIN_CONTENT_ID = "conteudo";

const clampWidth = SidebarPreferences.clampWidth;

/**
 * A CASCA da aplicação: coluna de navegação, cabeçalho fixo e a moldura da
 * página. O que ela desenha vem do catálogo (`lib/navigation-catalog`); o que
 * ela lembra vem das `SidebarPreferences`; cada item é um `NavLinkItem`, na
 * coluna e na gaveta móvel.
 *
 * A REDE DE SINAPSES NO FUNDO (dono, 2026-09-08: "o mesmo efeito da tela de
 * login, quero no fundo da aplicação como um todo"). Ela mora aqui, fora do
 * `StoreProvider`, pela mesma razão do `AppToaster`: não desmonta quando o
 * miolo carrega. É a composição INTERIOR — discreta, em toda a viewport e
 * ATRÁS do conteúdo (`z-0` contra o `z-10` da coluna e do miolo): ela aparece
 * nos vãos, e os cartões, opacos, a escondem onde há leitura.
 *
 * Ela fica VIVA, e não PISCA (dono, 2026-09-08: *"vamos manter a sinapse
 * dentro da aplicação pós usuário logado, mas remova a piscada, tanto azul
 * quanto vermelha"*): o movimento é o próprio dos nós; nenhuma escrita,
 * recusa ou transição de dentro da aplicação pede pulso.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Sem container por perto (uma casca montada sozinha num teste), não há rede — e nada quebra.
  const synapseSignals = useSynapseSignals();
  const platformMetricsTab = usePlatformMetricsTab();
  const { cycles, activeCycleId, setActiveCycle } = useCycleSelection();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const cicloVazio = useSelectionEmptyState(Registration.CYCLE);

  // PR 9 ([FA-01]): o encerramento por inatividade leva a razão — o login explica.
  const idlePhase = useIdleSession({
    active: user !== null,
    onEnd: () => {
      void logout(SessionEndReason.idle);
    },
  });

  const navGroups = filterNavGroups(NAV_GROUPS, user ?? undefined);
  const navItems = navGroups.flatMap((group) => group.items);
  const reducedMotion = useReducedMotion();

  const transfers = usePendingTeamTransfers(user);
  const pendingToDecide = user ? transfers.viewModel.countToDecide(user, transfers.requests) : 0;
  const pendingBadgeOf = (item: NavItem) =>
    item.countsPendingTeamTransfers && pendingToDecide > 0 ? (
      <span
        aria-label={t("team.transfers.nav.badge", { n: pendingToDecide })}
        title={t("team.transfers.nav.badge", { n: pendingToDecide })}
        className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-meta font-semibold tabular-nums text-primary-foreground"
      >
        {pendingToDecide > 99 ? "99+" : pendingToDecide}
      </span>
    ) : null;

  const preferences = defaultSidebarPreferences;
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(SidebarPreferences.DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setCollapsed(preferences.collapsed);
    const escolhida = preferences.chosenWidth;
    if (escolhida !== null) setWidth(escolhida);
  }, [preferences]);

  // Dono (2026-09-06): o menu acompanha a rota — ao ir para Usuários por um
  // atalho da tela, a barra rola até o item marcado, mesmo lá embaixo.
  useEffect(() => {
    const ativo = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (ativo && typeof ativo.scrollIntoView === "function") {
      ativo.scrollIntoView({ block: "nearest" });
    }
  }, [pathname]);

  useEffect(() => {
    if (collapsed || preferences.chosenWidth !== null) return;
    const nav = navRef.current;
    if (!nav) return;

    const rotulos = [...nav.querySelectorAll<HTMLElement>("[data-nav-label]")];
    const maior = Math.max(0, ...rotulos.map((rotulo) => rotulo.scrollWidth));

    setWidth(clampWidth(Math.ceil(maior) + 90));
  }, [collapsed, t, preferences]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      preferences.rememberCollapsed(!prev);
      return !prev;
    });
  };

  const chooseWidth = (next: number) => {
    const largura = clampWidth(next);
    setWidth(largura);
    preferences.rememberWidth(largura);
  };

  useEffect(() => {
    if (!resizing) return;

    const onMove = (event: MouseEvent) => setWidth(clampWidth(event.clientX));
    const onUp = () => {
      setResizing(false);
      setWidth((atual) => {
        preferences.rememberWidth(atual);
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
  }, [resizing, preferences]);

  const onHandleKeyDown = (event: KeyboardEvent) => {
    const passo = event.shiftKey ? 32 : 8;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      chooseWidth(width - passo);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      chooseWidth(width + passo);
    }
  };

  /**
   * O que o clique no item faz ALÉM de navegar: fechar a gaveta móvel e, no
   * item que abre em aba nova, RESERVAR a aba (dono, 2026-09-08). A reserva
   * mora no clique porque o navegador só deixa abrir aba durante o gesto —
   * pedida depois da resposta da porta, ela viraria pop-up bloqueado.
   */
  const onNavigateFrom = (item: NavItem, variant: "sidebar" | "sheet") => () => {
    if (item.opensInNewTab) platformMetricsTab?.reserve();
    if (variant === "sheet") setMobileNavOpen(false);
  };

  const renderNavItem = (variant: "sidebar" | "sheet") => (item: NavItem) => (
    <NavLinkItem
      key={item.to}
      item={item}
      label={t(item.labelKey)}
      active={isNavItemActive(item, pathname, navItems)}
      collapsed={variant === "sidebar" && collapsed}
      hint={item.hintKey ? t(item.hintKey) : undefined}
      badge={pendingBadgeOf(item)}
      onNavigate={onNavigateFrom(item, variant)}
    />
  );
  const renderDesktopNavItem = renderNavItem("sidebar");
  const renderSheetNavItem = renderNavItem("sheet");

  return (
    <TooltipProvider delayDuration={150}>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only z-30 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t("shell.skipToContent")}
      </a>
      {/* O canvas é fixo ao viewport e fica atrás de tudo; o `body` pinta o fundo. */}
      {synapseSignals && <SynapseBackground signals={synapseSignals} scene="interior" />}
      <div className="relative z-10 flex min-h-screen w-full">
        <aside
          style={{ width: collapsed ? SidebarPreferences.RAIL_WIDTH : width }}
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex",

            resizing ? "" : "transition-[width] duration-(--motion-slow) ease-standard",
          )}
        >
          {!collapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Ajustar largura do menu"
              aria-valuenow={width}
              aria-valuemin={SidebarPreferences.MIN_WIDTH}
              aria-valuemax={SidebarPreferences.MAX_WIDTH}
              tabIndex={0}
              onMouseDown={() => setResizing(true)}
              onDoubleClick={() => chooseWidth(SidebarPreferences.DEFAULT_WIDTH)}
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
                "flex justify-end pt-5 transition-[padding] duration-(--motion-slow) ease-standard",
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
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </button>
            </div>
            <p
              className={cn(
                "absolute whitespace-nowrap font-display font-semibold leading-none",
                "transition-slow",
                reducedMotion && "transition-none",
                collapsed
                  ? "left-1/2 top-[52px] -translate-x-1/2 text-meta"
                  : "left-5 top-[22px] text-sm",
              )}
            >
              Synapse
            </p>
            <p
              className={cn(
                "absolute left-5 top-[42px] whitespace-nowrap text-[length:var(--text-meta)] text-sidebar-foreground/60",
                "transition-opacity duration-(--motion-slow) ease-standard",
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
              "scroll-visible [--scroll-thumb:var(--sidebar-emphasis)] flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden pb-4",
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
                  groupLabel={t(group.labelKey)}
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
                    onClick={() => void logout()}
                    aria-label={t("shell.logout")}
                    className="flex w-full justify-center rounded-md p-1.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <LogOut className="size-4" />
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
                  onClick={() => void logout()}
                  className="mt-2 flex items-center gap-1.5 text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="size-3.5" />
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
                  <Menu className="size-5" />
                </button>
                <p className="hidden truncate text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:block">
                  {t("shell.flow")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {user && defaultUiAuthorizationPolicy.operatesTheSystem(user) ? (
                  <>
                    <label className="text-xs text-muted-foreground" htmlFor="cycle">
                      {t("shell.cycle")}
                    </label>
                    <SingleSelectFilter
                      id="cycle"
                      ariaLabel={t("shell.cycle")}
                      value={activeCycleId}
                      onChange={setActiveCycle}
                      options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
                      // Dono (2026-09-08, reincidente): sem ciclo, o seletor do
                      // cabeçalho DIZ que não há e leva a quem pode cadastrar.
                      // A frase, o destino e a pergunta de alcance vêm do
                      // `Registration` — a tela não repete nenhuma das três.
                      empty={cicloVazio}
                      triggerClassName="h-8 w-auto min-w-0 px-2.5 py-1.5 text-sm shadow-none"
                    />
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    {t("shell.cycle")}
                    <span className="text-sm font-medium text-foreground">
                      {cycles.find((cycle) => cycle.id === activeCycleId)?.name ?? "—"}
                    </span>
                  </p>
                )}
                <NoticeBell />
                <PreferencesMenu />
              </div>
            </div>
          </header>

          <WelcomeNoticeToast />

          <PageFrame
            id={MAIN_CONTENT_ID}
            pathname={pathname}
            className={cn(PAGE_CONTAINER, "flex-1 px-5 py-6 lg:px-8 lg:py-8")}
          >
            {children}
          </PageFrame>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="flex w-[85vw] max-w-xs flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs"
        >
          <SheetHeader className="border-b border-sidebar-border px-5 py-4 text-left">
            <SheetTitle className="font-display text-sm font-semibold text-sidebar-foreground">
              Synapse
            </SheetTitle>
            <p className="text-meta text-sidebar-foreground/60">{t("shell.subtitle")}</p>
          </SheetHeader>
          <nav className="scroll-visible [--scroll-thumb:var(--sidebar-emphasis)] flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
            {navGroups.map((group, groupIndex) => (
              <NavGroupSection
                key={group.labelKey ?? `mobile-group-${groupIndex}`}
                group={group}
                groupIndex={groupIndex}
                groupLabel={group.labelKey ? t(group.labelKey) : ""}
                renderItem={renderSheetNavItem}
              />
            ))}
          </nav>
          <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/70">
            <p className="truncate font-medium text-sidebar-foreground">{user?.name}</p>
            <p className="truncate">{user?.email}</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-2 flex items-center gap-1.5 transition-colors hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-3.5" />
              {t("shell.logout")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
