import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { levelName } from "@/lib/domain";

const levelBg: Record<number, string> = {
  0: "bg-level-0 text-muted-foreground",
  1: "bg-level-1 text-[var(--level-1-fg)]",
  2: "bg-level-2 text-[var(--level-2-fg)]",
  3: "bg-level-3 text-[var(--level-3-fg)]",
  4: "bg-level-4 text-[var(--level-4-fg)]",
  5: "bg-level-5 text-[var(--level-5-fg)]",
};

export function LevelBadge({ level, showName = false }: { level: number; showName?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
        levelBg[level] ?? levelBg[0],
      )}
      title={`Nível ${level} — ${levelName(level)}`}
    >
      L{level}
      {showName && <span className="font-medium opacity-80">{levelName(level)}</span>}
    </span>
  );
}

export function LevelCell({ level }: { level: number }) {
  return (
    <div
      className={cn(
        "flex h-9 w-full items-center justify-center rounded-md text-sm font-semibold tabular-nums",
        levelBg[level] ?? levelBg[0],
      )}
      title={`${levelName(level)} (nível ${level})`}
    >
      {level || "—"}
    </div>
  );
}

const gapTone: Record<string, string> = {
  ok: "bg-gap-ok/15 text-[oklch(0.4_0.12_155)]",
  low: "bg-gap-low/20 text-[oklch(0.42_0.11_95)]",
  high: "bg-gap-high/20 text-[oklch(0.44_0.14_55)]",
  critical: "bg-gap-critical/20 text-[oklch(0.45_0.18_25)]",
};

export function GapBadge({ gap }: { gap: number }) {
  const tone = gap <= 0 ? "ok" : gap === 1 ? "low" : gap === 2 ? "high" : "critical";
  const label =
    gap <= 0 ? "Adequado" : gap === 1 ? "Recomendado" : gap === 2 ? "Prioridade alta" : "Crítico";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        gapTone[tone],
      )}
    >
      Gap {Math.max(0, gap)} · {label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        {icon && <span className="rounded-lg bg-secondary p-2 text-primary">{icon}</span>}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
      {initials}
    </span>
  );
}
