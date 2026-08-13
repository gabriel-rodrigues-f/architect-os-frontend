import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Grid3x3,
  LayoutDashboard,
  LogOut,
  Map,
  Settings,
  Sparkles,
  Target,
  TrendingDown,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/team", label: "Time", icon: Users },
  { to: "/capability-map", label: "Mapa de Capacidades", icon: Map },
  { to: "/competency-matrix", label: "Matriz de Competências", icon: Grid3x3 },
  { to: "/assessments", label: "Avaliações", icon: ClipboardCheck },
  { to: "/gap-analysis", label: "Análise de Lacunas", icon: TrendingDown },
  { to: "/development-plans", label: "Planos de Desenvolvimento", icon: Target },
  { to: "/learning-paths", label: "Trilhas de Aprendizagem", icon: BookOpen },
  { to: "/mentoring", label: "Mentoria", icon: GraduationCap },
  { to: "/training-needs", label: "Necessidades de Treinamento", icon: BarChart3 },
  { to: "/talent-matrix", label: "Matriz de Talentos", icon: Compass },
  { to: "/cycles", label: "Ciclos de Desenvolvimento", icon: CalendarRange },
  { to: "/settings", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { cycles, activeCycleId, setActiveCycle, philosophy } = useStore();
  const { user, logout } = useAuth();

  // O fluxo do cabeçalho vem da filosofia cadastrada no dashboard.
  const flow = philosophy.stages.map((stage) => stage.name).join(" → ");

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">Architect OS</p>
            <p className="text-[11px] text-sidebar-foreground/60">Desenvolvimento de Capacidades</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/70">
          <p className="font-medium text-sidebar-foreground">{user?.name}</p>
          <p className="truncate">{user?.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex items-center gap-1.5 text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/85 px-5 py-3 backdrop-blur lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {flow}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="cycle">
              Ciclo
            </label>
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
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-muted-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
