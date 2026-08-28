import { createContext, useContext, useId, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { useGapSeverityRuler } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { defaultNameFormatter } from "@/lib/text";
import { PageHelp, type PageHelpContent } from "@/components/app/PageHelp";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const levelBg: Record<number, string> = {
  0: "bg-level-0 text-muted-foreground",
  1: "bg-level-1 text-[var(--level-1-fg)]",
  2: "bg-level-2 text-[var(--level-2-fg)]",
  3: "bg-level-3 text-[var(--level-3-fg)]",
  4: "bg-level-4 text-[var(--level-4-fg)]",
  5: "bg-level-5 text-[var(--level-5-fg)]",
};

export function LevelBadge({
  level,
  showName = false,
}: {
  level: number | undefined;
  showName?: boolean;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  if (level === undefined) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
          levelBg[0],
        )}
        title={t("level.cellTooltip.none")}
      >
        —
      </span>
    );
  }
  const nome = labels.levelName[level as keyof typeof labels.levelName] ?? "—";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
        levelBg[level] ?? levelBg[0],
      )}
      title={t("level.tooltip", { n: level, nome })}
    >
      L{level}
      {showName && <span className="font-medium opacity-80">{nome}</span>}
    </span>
  );
}

export function LevelCell({ level }: { level: number | undefined }) {
  const { t } = useI18n();
  const labels = useLabels();
  return (
    <div
      className={cn(
        "flex h-9 w-full items-center justify-center rounded-md text-sm font-semibold tabular-nums",
        level === undefined ? levelBg[0] : (levelBg[level] ?? levelBg[0]),
      )}
      title={
        level === undefined
          ? t("level.cellTooltip.none")
          : t("level.cellTooltip", {
              nome: labels.levelName[level as keyof typeof labels.levelName] ?? "—",
              n: level,
            })
      }
    >
      {level ?? "—"}
    </div>
  );
}

export const gapTone: Record<string, string> = {
  ok: "bg-gap-ok text-[var(--gap-ok-fg)]",
  low: "bg-gap-low text-[var(--gap-low-fg)]",
  high: "bg-gap-high text-[var(--gap-high-fg)]",
  critical: "bg-gap-critical text-[var(--gap-critical-fg)]",
};

export function GapBadge({ gap }: { gap: number | undefined }) {
  const { t } = useI18n();
  const ruler = useGapSeverityRuler();
  if (gap === undefined) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground"
        title={t("level.cellTooltip.none")}
      >
        —
      </span>
    );
  }

  const tone = ruler.severityOf(gap);
  const label = t(ruler.messageKey[tone]);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        gapTone[tone],
      )}
    >
      {t("gap.badge", { n: Math.max(0, gap), rotulo: label })}
    </span>
  );
}

const statusTone: Record<"neutral" | "progress" | "done", string> = {
  neutral: "bg-status-neutral text-[var(--status-neutral-fg)]",
  progress: "bg-status-progress text-[var(--status-progress-fg)]",
  done: "bg-status-done text-[var(--status-done-fg)]",
};

export function StatusBadge({
  tone,
  label,
}: {
  tone: "neutral" | "progress" | "done";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        statusTone[tone],
      )}
    >
      {label}
    </span>
  );
}

export type SemanticTone = "warning" | "success";

export const semanticTone: Record<SemanticTone, string> = {
  warning: "bg-warning text-warning-fg",
  success: "bg-success text-success-fg",
};

export function Callout({
  tone,
  children,
  className,
}: {
  tone: SemanticTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md p-3 text-sm", semanticTone[tone], className)}>{children}</div>
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
  help,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;

  help?: { lead: PageHelpContent; member: PageHelpContent };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="page-title">{title}</h1>
          {help && <PageHelp content={help} />}
        </div>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function NameList({
  names,
  max = 5,
  emptyLabel,
}: {
  names: readonly string[];
  max?: number;

  emptyLabel?: string;
}) {
  const { t } = useI18n();
  if (names.length === 0) return <>{emptyLabel ?? t("common.none")}</>;
  const { shown, remaining } = defaultNameFormatter.truncateNames(names, max);
  return (
    <span title={names.join(", ")}>
      {shown.join(", ")}
      {remaining > 0 && ` ${t("common.andMoreCount", { n: remaining })}`}
    </span>
  );
}

export function ProfileTabs({
  architectId,
  active,
}: {
  architectId: string;
  active: "overview" | "evolution";
}) {
  const { t } = useI18n();
  const tabClass = (isActive: boolean) =>
    cn(
      "border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
      isActive
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );
  return (
    <nav className="mb-6 flex gap-6 border-b border-border">
      <Link
        to="/architects/$architectId"
        params={{ architectId }}
        aria-current={active === "overview" ? "page" : undefined}
        className={tabClass(active === "overview")}
      >
        {t("arch.tabs.overview")}
      </Link>
      <Link
        to="/architects/$architectId/evolution"
        params={{ architectId }}
        aria-current={active === "evolution" ? "page" : undefined}
        className={tabClass(active === "evolution")}
      >
        {t("arch.tabs.evolution")}
      </Link>
    </nav>
  );
}

const SECTION_HEADING_TAG = { 2: "h2", 3: "h3" } as const;

const SectionHeadingLevelContext = createContext<2 | 3>(2);

export function SectionGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={className}>
      <div className="mb-4">
        <h2 id={titleId} className="section-title">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <SectionHeadingLevelContext.Provider value={3}>
        {children}
      </SectionHeadingLevelContext.Provider>
    </section>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const titleId = useId();
  const Heading = SECTION_HEADING_TAG[useContext(SectionHeadingLevelContext)];
  return (
    <section id={id} aria-labelledby={titleId} className={cn("surface-card p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading id={titleId} className="font-display text-base font-semibold">
            {title}
          </Heading>
          {description && (
            <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title?: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card p-8 text-center">
      {title !== undefined && <p className="text-sm font-medium">{title}</p>}
      {hint !== undefined && (
        <p className={cn("text-sm text-muted-foreground", title !== undefined && "mt-1")}>{hint}</p>
      )}
      {action}
    </div>
  );
}

export function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: ReactNode;
  hint: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("field.hint", { campo: String(children) })}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64 text-center">
            {hint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

const FIRST_LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

export function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n.match(FIRST_LETTER_OR_NUMBER)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
      {initials}
    </span>
  );
}
