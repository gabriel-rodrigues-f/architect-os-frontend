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
  /** Rotas extras que também contam como "este item está ativo" (abas internas). */
  activePrefixes?: string[];
  /** Só aparece para quem administra o sistema — Member/Lead nem veem o destino. */
  adminOnly?: boolean;
}

interface NavGroup {
  /**
   * Opcional só pelo tipo — hoje todo grupo declarado em `NAV_GROUPS` tem
   * `labelKey` (R2-UX-13 uniu os antigos grupos de item só em "Operação").
   * Sem `labelKey` não há cabeçalho pra virar botão, e o grupo nasce sempre
   * expandido, sem entrar no colapso/persistência de R2-UX-14.
   */
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
 * "Capacidades", navegando entre elas por abas dentro da própria tela
 * (`CapabilitiesTabs`). Ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md,
 * Seção 6 e 33.
 *
 * Feedback ao vivo do product owner (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md,
 * Bloco 7) reverteu essa consolidação por abas: as 5 sub-telas (Cobertura/
 * Prioridades/Progressão/Necessidades de Treinamento/Comparativo do Time)
 * viram um GRUPO próprio na barra lateral, igual a "Operação"/
 * "Desenvolvimento"/"Administração" — cada uma com seu item de menu direto,
 * sem abas dentro da página. `CapabilitiesTabs` foi removido; a barra de
 * abas empurrava o conteúdo de toda tela de Capacidades um degrau abaixo do
 * cabeçalho, inconsistente com o resto do app.
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
  {
    // R2-UX-13 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — os 4 primeiros itens
    // eram cada um seu próprio grupo de item só (sem cabeçalho); ganham um
    // título só pra contrastar com "Desenvolvimento"/"Administração" abaixo.
    labelKey: "nav.group.operation",
    items: [
      { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { to: "/team", labelKey: "nav.team", icon: Users },
      { to: "/assessments", labelKey: "nav.assessments", icon: ClipboardCheck },
    ],
  },
  {
    // `nav.capabilities` já existia como rótulo do item único antigo
    // ("Capacidades") — reaproveitado aqui como rótulo do GRUPO, sem chave
    // nova, já que o texto continua exatamente o mesmo.
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
      // R2-VIS-04 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — este item aponta pra
      // "Política de Progressão", não pra preferências: usava o mesmo ícone
      // de engrenagem do menu de tema/idioma no cabeçalho, dois significados
      // diferentes sob o mesmo símbolo. `Scale` (balança) combina com
      // "critério/política" e libera `Settings` só para configuração de
      // verdade.
      { to: "/settings", labelKey: "nav.settings", icon: Scale },
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

/** Extraído do que antes era recomputado inline em cada render de item, no desktop e no mobile. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  return (
    pathname.startsWith(item.to) ||
    (item.activePrefixes?.some((p) => pathname.startsWith(p)) ?? false)
  );
}

/**
 * Feedback ao vivo do product owner (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md,
 * Bloco 7) — antes, `isGroupExpanded` forçava `isNavGroupActive(...)` como
 * um `OR` que sempre vencia: o grupo da rota ativa nunca podia ser
 * recolhido de verdade, `collapsedGroups` era ignorado pra ele. O pedido
 * não foi remover a proteção sem mais — é manter SEMPRE visível o item da
 * rota atual (fixo, fora do colapso) e deixar só os IRMÃOS dele
 * recolherem/expandirem como qualquer outro grupo.
 *
 * `collapsible` é sempre "todos os itens menos o ativo" — um conjunto
 * ESTÁVEL entre renders, independente do grupo estar recolhido ou não.
 * Isso é o que preserva a animação de `grid-template-rows` já existente
 * (0fr/1fr sobre um `overflow-hidden`): os MESMOS nós DOM continuam
 * montados o tempo todo, só a altura do wrapper ao redor deles muda — trocar
 * QUAIS itens entram nesse conjunto conforme o estado de colapso quebraria
 * a animação (React desmontaria/remontaria nós em vez de só redimensionar
 * o wrapper).
 *
 * Sem rota ativa no grupo: `pinned` vazio, `collapsible` = todos os itens —
 * comportamento idêntico ao de antes desta correção.
 */
export function partitionGroupItems(
  group: NavGroup,
  pathname: string,
): { pinned: NavItem[]; collapsible: NavItem[] } {
  const activeItem = group.items.find((item) => isNavItemActive(item, pathname));
  if (!activeItem) return { pinned: [], collapsible: group.items };
  return { pinned: [activeItem], collapsible: group.items.filter((item) => item !== activeItem) };
}

/** `labelKey` tem pontos ("nav.group.admin"); id de elemento aceita, mas o `aria-controls` fica mais limpo sem. */
const navGroupPanelId = (labelKey: string) => `nav-group-${labelKey.replace(/\./g, "-")}`;

const SIDEBAR_STORAGE_KEY = "synapse:sidebar-collapsed";
const LEGACY_SIDEBAR_STORAGE_KEY = "architect-os:sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "synapse:sidebar-width";
const LEGACY_SIDEBAR_WIDTH_KEY = "architect-os:sidebar-width";
const NAV_COLLAPSED_GROUPS_KEY = "synapse:nav-collapsed-groups";

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
  const reducedMotion = useReducedMotion();

  /**
   * Começa expandida e só lê a preferência depois da montagem: no SSR não há
   * `localStorage`, e decidir no primeiro render quebraria a hidratação.
   */
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(SIDEBAR_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  /**
   * R2-UX-14 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — nasce vazio (tudo
   * aberto) pelo mesmo motivo do `collapsed` acima: sem isto, o SSR
   * renderiza expandido e o cliente colapsaria no primeiro efeito, um
   * flash de conteúdo pulando. É "o que a pessoa pediu" de verdade agora
   * (ver `partitionGroupItems`) — recolher o grupo da rota ativa some com
   * os irmãos, só o item ativo continua fixo e visível.
   */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_COLLAPSED_GROUPS_KEY);
      if (raw) setCollapsedGroups(new Set(JSON.parse(raw) as string[]));
    } catch {
      // localStorage indisponível (modo privado) ou JSON corrompido — nasce tudo aberto.
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
        // localStorage indisponível — a preferência só não sobrevive a um reload.
      }
      return next;
    });
  };

  /**
   * REVISAO-360-FRONTEND, Seção 15 — a faixa horizontal de abas (`navFlat`,
   * sem grupos) obrigava rolagem lateral pra achar itens do fim da lista e
   * escondia a hierarquia por seção que a barra lateral do desktop mostra.
   * O drawer mobile reusa `navGroups` (a mesma fonte, com seção/rótulo) em
   * vez de uma lista achatada à parte.
   */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setCollapsed(readMigratedItem(SIDEBAR_STORAGE_KEY, LEGACY_SIDEBAR_STORAGE_KEY) === "true");
    const salva = Number(readMigratedItem(SIDEBAR_WIDTH_KEY, LEGACY_SIDEBAR_WIDTH_KEY));
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

  /**
   * Único renderizador de item pra sidebar desktop, usado tanto na trilha
   * de ícones (sidebar inteira recolhida, `collapsed === true`, item plano
   * com `Tooltip`) quanto dentro de `NavGroupSection` (sidebar expandida,
   * `collapsed === false` sempre nesse caso — os ramos `collapsed ? ... :`
   * abaixo nunca tomam o lado "recolhido" ali, não é código morto, é a
   * mesma função cobrindo os dois contextos por construção).
   */
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
              {/*
                R2-RESP-05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o texto do
                fluxo é longo demais para caber ao lado do menu hambúrguer e
                do seletor de ciclo em telas estreitas; truncado virava
                "AVALIAR → PRIO…", pior que não mostrar nada. Some abaixo de
                `md`, volta quando sobra espaço.
              */}
              <p className="hidden truncate text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:block">
                {t("shell.flow")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground" htmlFor="cycle">
                {t("shell.cycle")}
              </label>
              {user?.role === "admin" ? (
                /*
                  R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — era um
                  `<select>` nativo dentro de uma barra de cabeçalho apertada
                  (`flex items-center gap-2`, ao lado do botão hambúrguer e
                  do menu de preferências), não uma linha de filtro. Sem
                  `label` aqui — o `<label htmlFor="cycle">` acima já cumpre
                  esse papel — e `triggerClassName` troca o tamanho padrão de
                  filtro (`w-full min-w-48 h-10`, com sombra) pelo mesmo peso
                  visual que o `<select>` nativo tinha nesta barra: só altura/
                  padding compactos, sem sombra, largura pelo conteúdo.
                */
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

/**
 * Feedback ao vivo do product owner (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md,
 * Bloco 7) — o bloco "cabeçalho-botão + chevron + wrapper animado" de um
 * grupo de menu era quase idêntico entre a barra lateral desktop e o
 * drawer mobile (duas cópias de ~90 linhas cada, sem motivo de design
 * documentado pra divergirem — só cresceram separadas). Como os dois
 * precisam da mesma correção de `partitionGroupItems` (item ativo fixo,
 * irmãos recolhem), esta é a extração natural: um componente local só
 * deste arquivo (mesmo nível de `PreferencesMenu` abaixo), não um arquivo
 * `*-shared.tsx` — essa convenção é para compartilhar entre ARQUIVOS de
 * rota, não dentro do próprio `AppShell.tsx`.
 *
 * Só recebe o que realmente diverge entre desktop e mobile: a classe do
 * cabeçalho do grupo, um prefixo pro `id` do painel (evita colisão de
 * `aria-controls` entre as duas navs desenhadas na mesma página) e como
 * cada item vira link (desktop tem o modo "trilha de ícones" da sidebar
 * inteira recolhida — um estado diferente, `collapsed`, sem relação com
 * colapso de GRUPO — mobile fecha o Sheet ao navegar). O modo trilha de
 * ícones nunca passa por aqui: continua reto no `AppShell`, sem cabeçalho
 * de grupo nem colapso por grupo fazem sentido com a coluna reduzida a
 * ícones.
 */
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
  const expanded = !collapsedGroups.has(labelKey);
  const { pinned, collapsible } = partitionGroupItems(group, pathname);
  const panelId = `${idPrefix}${navGroupPanelId(labelKey)}`;

  return (
    <div className={wrapperClassName}>
      <button
        type="button"
        onClick={() => onToggleGroup(labelKey)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={headerClassName}
      >
        <span>{groupLabel}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            reducedMotion && "transition-none",
            expanded && "rotate-180",
          )}
        />
      </button>
      <div className="space-y-0.5">
        {pinned.map(renderItem)}
        <div
          id={panelId}
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            reducedMotion && "transition-none",
          )}
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="space-y-0.5">{collapsible.map(renderItem)}</div>
          </div>
        </div>
      </div>
    </div>
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
          {/*
            R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — era um `<select>`
            nativo. O rótulo próprio (uppercase/tracking-wide) que já
            combinava com o título "Tema" acima fica como está — só o
            controle vira `SingleSelectFilter` sem `label` interno (evita
            duplicar rótulo), com o tamanho cheio padrão (`w-full h-10`) que
            já é o mesmo dos outros filtros de linha completa.
          */}
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
