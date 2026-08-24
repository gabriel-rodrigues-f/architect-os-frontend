import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { levelName } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
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

/** `level` undefined = sem assessment oficial; mostra "—", nunca "L0" fictício. */
export function LevelBadge({
  level,
  showName = false,
}: {
  level: number | undefined;
  showName?: boolean;
}) {
  const { t } = useI18n();
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
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
        levelBg[level] ?? levelBg[0],
      )}
      title={t("level.tooltip", { n: level, nome: levelName(level) })}
    >
      L{level}
      {showName && <span className="font-medium opacity-80">{levelName(level)}</span>}
    </span>
  );
}

/**
 * `level` vem `undefined` quando a pessoa não tem assessment oficial cobrindo
 * a capacidade no ciclo — nunca `0`. A célula mostra "—" sem tooltip de nível,
 * porque não há nível nenhum para explicar (não é o mesmo caso de nível 0,
 * que a escala nem define).
 */
export function LevelCell({ level }: { level: number | undefined }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex h-9 w-full items-center justify-center rounded-md text-sm font-semibold tabular-nums",
        level === undefined ? levelBg[0] : (levelBg[level] ?? levelBg[0]),
      )}
      title={
        level === undefined
          ? t("level.cellTooltip.none")
          : t("level.cellTooltip", { nome: levelName(level), n: level })
      }
    >
      {level ?? "—"}
    </div>
  );
}

/*
  Fundo e texto vêm de tokens, sem opacidade e sem cor literal. A versão
  anterior fixava o texto em OKLCH no className — que ficava vermelho-escuro em
  qualquer tema — e pintava o fundo com 20% do token, que no escuro compunha
  com a página até virar vinho quase preto. O par ficava ilegível.
*/
const gapTone: Record<string, string> = {
  ok: "bg-gap-ok text-[var(--gap-ok-fg)]",
  low: "bg-gap-low text-[var(--gap-low-fg)]",
  high: "bg-gap-high text-[var(--gap-high-fg)]",
  critical: "bg-gap-critical text-[var(--gap-critical-fg)]",
};

/** `gap` undefined = sem nível final ainda (não avaliado); mostra "—", nunca um gap fabricado. */
export function GapBadge({ gap }: { gap: number | undefined }) {
  const { t } = useI18n();
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
  const tone = gap <= 0 ? "ok" : gap === 1 ? "low" : gap === 2 ? "high" : "critical";
  const label =
    gap <= 0
      ? t("gap.ok")
      : gap === 1
        ? t("gap.recommended")
        : gap === 2
          ? t("gap.highPriority")
          : t("gap.critical");
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
  /** R2-UX-01 — conteúdo do popover de ajuda contextual; vem do registry em `lib/page-help.ts`. */
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
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * ORIENTACAO-DECIMA-RODADA, Seção 30 — "Visão geral | Evolução" como rota
 * própria (deep link, filtros, menos scroll), não como painel escondido
 * dentro da mesma página. `<Link>`, não um componente de abas com estado —
 * é navegação de verdade entre duas rotas.
 *
 * B-30 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §10 achado #4) —
 * mesmo raciocínio de `CapabilitiesTabs`: `<nav>` + `aria-current="page"`,
 * nunca `role="tablist"`/`role="tab"` (isto navega entre rotas, não troca
 * painel na mesma página). O estado ativo já era só visual (cor da borda)
 * — `aria-current` é o que faltava para chegar a quem usa leitor de tela.
 */
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
  return (
    <section id={id} className={cn("surface-card p-5", className)}>
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

/**
 * Rótulo de campo com uma bolinha de ajuda à direita.
 *
 * Existe como componente próprio, e não como `<Label>` + `<Tooltip>` repetido
 * em cada form, porque a dúvida "o que esse campo espera" se repete em
 * qualquer formulário do app — Mentoria foi só o primeiro a pedir. Um lugar
 * só também impede que o botão de ajuda saia com foco, alvo de toque ou
 * `aria-label` levemente diferentes em cada tela.
 *
 * O botão é focável e responde a teclado (é um `<button>`, não um `<span>`
 * com `onMouseEnter`): quem navega sem mouse também precisa ler a explicação.
 *
 * Traz seu próprio `TooltipProvider`: o `AppShell` já mantém um para os
 * ícones da coluna lateral, mas este componente não deve depender de estar
 * dentro dele — um form em teste isolado, ou fora do shell no futuro, precisa
 * continuar funcionando sozinho. Providers do Radix aninham sem conflito.
 */
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
