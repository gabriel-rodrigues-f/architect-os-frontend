import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  GraduationCap,
  Grid3x3,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useTheme, type Theme } from "@/lib/theme";

interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;
  /** Rotas extras que também contam como "este item está ativo" (abas internas). */
  activePrefixes?: string[];
  /** Só aparece para quem administra o sistema — Member/Lead nem veem o destino. */
  adminOnly?: boolean;
}

interface NavGroup {
  /** `undefined` = grupo de um item só, sem cabeçalho (Home, Pessoas, Avaliações). */
  labelKey?: MessageKey;
  items: NavItem[];
}

/**
 * Home / Pessoas / Capacidades / Avaliações / Desenvolvimento / Administração
 * — os seis agrupamentos substituem a lista plana de páginas que a barra
 * lateral tinha antes. Cada URL continua a mesma (nenhuma página mudou de
 * rota, só de posição no menu), então não há redirecionamento para manter.
 * Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC F.
 *
 * FASE 2 (quinta rodada) — Mapa de Capacidades, Análise de Lacunas e
 * Necessidades de Treinamento eram três itens de primeiro nível para o
 * mesmo momento de decisão; a auditoria chamava Training Needs de
 * "redundante como tela standalone" e recomendava consolidar em
 * "Capacidades". Os três viram um item só aqui — a navegação entre eles
 * agora é por abas dentro da própria tela (`CapabilitiesTabs`), não mais
 * três entradas concorrendo no menu. Ver AUDITORIA-QUINTA-RODADA-360-
 * SYNAPSE-2026-08-19.md, Seção 6 e 33.
 *
 * QW-01/QW-02 (Seção 32, Quick Wins) — "esconder destinos administrativos"
 * e "remover `/settings` da navegação primária". Antes, Competência,
 * Usuários e Referência apareciam pra qualquer papel, mesmo sem
 * conseguir fazer nada ali (as próprias telas já recusavam a ação, só a
 * navegação não escondia o link) — Member/Lead viam destinos que não são
 * deles. Ciclos continua visível a todos: a tela já é "Admin + leitura"
 * (comparar evolução entre ciclos é legítimo pra qualquer papel), só a
 * criação/edição é admin-only, resolvida dentro da própria tela.
 * Referência (`/settings`) sai da navegação primária de vez, não só pra
 * quem não administra — era um glossário read-only competindo por espaço
 * com o resto do menu sem ganhar nada em troca.
 *
 * B-15 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-14) — essa
 * mesma rota volta aqui, porque deixou de ser só glossário: desde a nona
 * rodada ela também é a única tela onde a Política de Progressão (mínimo de
 * capacidades qualificadas por nível de carreira) existe, e nenhum
 * profissional consegue descobrir o critério da própria progressão sem
 * digitar a URL de cabeça. Mesmo tratamento que `/cycles` já tinha: item
 * visível a todos os papéis (não `adminOnly`), porque ler a política é
 * legítimo pra qualquer um — só editar é restrito a admin, resolvido dentro
 * da própria tela (`settings.tsx`, `CareerPolicySection`).
 */
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard }] },
  { items: [{ to: "/team", labelKey: "nav.team", icon: Users }] },
  {
    items: [
      {
        to: "/capability-map",
        labelKey: "nav.capabilities",
        icon: Map,
        activePrefixes: ["/gap-analysis", "/progression", "/training-needs"],
      },
    ],
  },
  { items: [{ to: "/assessments", labelKey: "nav.assessments", icon: ClipboardCheck }] },
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
      { to: "/settings", labelKey: "nav.settings", icon: Settings },
      { to: "/users", labelKey: "nav.users", icon: UserCog, adminOnly: true },
    ],
  },
];

/**
 * QW-01 (Seção 32, Quick Wins, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-
 * 08-19.md) — destinos `adminOnly` somem do menu pra quem não administra;
 * um grupo que fica sem item nenhum (nada restou pra este papel) some
 * junto, em vez de mostrar um cabeçalho sem conteúdo debaixo. Função pura
 * — sem depender de montar o componente — pra poder testar o recorte por
 * papel sem precisar de um `RouterProvider` real (`useRouterState`, usado
 * no resto do componente, exige um).
 */
export function filterNavGroups(groups: NavGroup[], role: string | undefined): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || role === "admin"),
    }))
    .filter((group) => group.items.length > 0);
}

const SIDEBAR_STORAGE_KEY = "architect-os:sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "architect-os:sidebar-width";

/**
 * 264px é o mínimo que acomoda "Desenvolvimento de Capacidades" numa linha ao
 * lado do logo e do botão de recolher — abaixo disso o subtítulo era cortado no
 * meio da palavra.
 */
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

  /**
   * Começa expandida e só lê a preferência depois da montagem: no SSR não há
   * `localStorage`, e decidir no primeiro render quebraria a hidratação.
   */
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(SIDEBAR_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  /**
   * REVISAO-360-FRONTEND, Seção 15 — a faixa horizontal de abas (`navFlat`,
   * sem grupos) obrigava rolagem lateral pra achar itens do fim da lista e
   * escondia a hierarquia por seção que a barra lateral do desktop mostra.
   * O drawer mobile reusa `navGroups` (a mesma fonte, com seção/rótulo) em
   * vez de uma lista achatada à parte.
   */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    const salva = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(salva) && salva > 0) setWidth(clampWidth(salva));
  }, []);

  /**
   * Ajusta a largura ao rótulo mais longo, se a pessoa ainda não escolheu uma.
   * Largura fixa não serve: um rótulo que cabe em português pode estourar em
   * inglês, e o texto ficava cortado na abertura.
   *
   * Roda também quando o idioma muda, porque os rótulos mudam de tamanho junto.
   */
  useEffect(() => {
    if (collapsed || window.localStorage.getItem(SIDEBAR_WIDTH_KEY)) return;
    const nav = navRef.current;
    if (!nav) return;

    const rotulos = [...nav.querySelectorAll<HTMLElement>("[data-nav-label]")];
    const maior = Math.max(0, ...rotulos.map((el) => el.scrollWidth));
    // ícone (16) + gap (10) + padding do link (24) + padding do nav (24) + folga
    setWidth(clampWidth(Math.ceil(maior) + 90));
  }, [collapsed, t]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!prev));
      return !prev;
    });
  };

  /**
   * Arrasto da borda. Os listeners ficam no documento, não na alça: o ponteiro
   * costuma sair dos 4px da borda no meio do gesto, e presos à alça o arrasto
   * morreria no primeiro movimento rápido.
   */
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

    // Sem isto o arrasto seleciona o texto do menu enquanto se move.
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

  /** Teclado: a alça também responde às setas, senão só o mouse ajusta. */
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

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen w-full bg-background">
        {/*
          Minimizada a coluna vira uma trilha de ícones (w-16), não some: a
          navegação continua acessível com um clique. A transição anima só a
          largura — animar `display` daria o salto que a barra tinha antes.
        */}
        <aside
          style={{ width: collapsed ? SIDEBAR_RAIL : width }}
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex",
            // Durante o arrasto a transição é desligada: animar cada pixel do
            // gesto faria a barra "perseguir" o ponteiro com atraso.
            resizing ? "" : "transition-[width] duration-300 ease-in-out",
          )}
        >
          {/*
            Alça de 4px sobre a borda, com área de clique maior que o traço
            visível. Só aparece expandida — na trilha de ícones a largura é fixa.
          */}
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
          {/*
            AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-41 (§41,
            Fase 4/5) — antes eram DOIS botões em dois pontos do layout:
            expandida, `PanelLeftClose` vivia dentro desta linha; ao
            recolher, esse botão desmontava e um segundo (`PanelLeftOpen`)
            montava num bloco novo ABAIXO do cabeçalho — que ficava com a
            altura intacta (o texto só perde largura via `w-0 opacity-0`,
            nunca altura), então o botão "descia" exatamente a altura do
            cabeçalho a cada alternância. Efeito colateral: o botão focado
            era desmontado, perdendo o foco de teclado (cai pro `body`).
            Um único botão sempre montado, trocando só ícone/rótulo,
            desliza horizontalmente junto com a animação de largura da
            coluna — sem deslocamento vertical, sem remontagem, foco
            preservado. `gap-2.5` só quando expandida: recolhida, o bloco
            de texto (largura zero) não deveria empurrar o botão para fora
            do centro.
          */}
          <div
            className={cn(
              "flex items-center py-5 transition-[padding] duration-300",
              collapsed ? "justify-center px-0" : "gap-2.5 px-5",
            )}
          >
            {/*
              Sem marca gráfica — só o nome. Recolhida, a coluna não tem onde
              pôr "Synapse" por extenso, então o nome some junto com o texto
              (opacidade e largura, não `hidden`, para acompanhar a animação
              da coluna em vez de piscar): a trilha de ícones fica só com o
              botão de reabrir, sem nada no lugar da marca.
            */}
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
            {navGroups.map((group, groupIndex) => (
              <div
                key={group.labelKey ?? `group-${groupIndex}`}
                className={groupIndex > 0 ? "pt-2" : ""}
              >
                {group.labelKey && !collapsed && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                    {t(group.labelKey)}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active =
                      item.to === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.to) ||
                          (item.activePrefixes?.some((p) => pathname.startsWith(p)) ?? false);
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

                    // Minimizada, o nome aparece ao passar o mouse — é o que devolve
                    // a legibilidade que o rótulo dava.
                    return collapsed ? (
                      <Tooltip key={item.to}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <div key={item.to}>{link}</div>
                    );
                  })}
                </div>
              </div>
            ))}
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
              <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t("shell.flow")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground" htmlFor="cycle">
                {t("shell.cycle")}
              </label>
              {user?.role === "admin" ? (
                <select
                  id="cycle"
                  value={activeCycleId}
                  onChange={(e) => setActiveCycle(e.target.value)}
                  className="rounded-md border border-input bg-card px-2.5 py-1.5 text-sm"
                >
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
              <div
                key={group.labelKey ?? `mobile-group-${groupIndex}`}
                className={groupIndex > 0 ? "pt-2" : ""}
              >
                {group.labelKey && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                    {t(group.labelKey)}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active =
                      item.to === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.to) ||
                          (item.activePrefixes?.some((p) => pathname.startsWith(p)) ?? false);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                          active
                            ? "bg-secondary font-medium text-foreground"
                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {t(item.labelKey)}
                      </Link>
                    );
                  })}
                </div>
              </div>
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

/** Tema e idioma — preferências da pessoa, não do dado; ficam no cabeçalho. */
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
          <label
            htmlFor="locale"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {t("prefs.language")}
          </label>
          <select
            id="locale"
            value={locale}
            disabled={loading}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm disabled:opacity-60"
          >
            {locales.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
