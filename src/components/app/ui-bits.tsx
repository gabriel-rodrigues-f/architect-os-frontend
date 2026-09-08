import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { useCurrentUser } from "@/lib/auth";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { ChevronDown, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RoleName } from "@/lib/domain";
import { useGapSeverityRuler, useSelectors } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { useSeniorityReading } from "@/lib/seniority";
import { defaultSectionVisibilityMemory } from "@/lib/section-visibility";
import { defaultNameFormatter } from "@/lib/text";
import { SectionHeading } from "@/components/app/SectionHeading";
import { SentenceBlock } from "@/components/app/SentenceBlock";
import { PageHelp, type PageHelpContent } from "@/components/app/PageHelp";
import { Chip } from "@/components/app/Chip";
import { KeyFigureCard, type StatTone } from "@/components/app/KeyFigure";
import { Button } from "@/components/ui/button";

export { SectionHeading };
export { StatTones, statToneStyles, type StatTone } from "@/components/app/KeyFigure";

const levelBg: Record<number, string> = {
  0: "bg-level-0 text-muted-foreground",
  1: "bg-level-1 text-[var(--level-1-fg)]",
  2: "bg-level-2 text-[var(--level-2-fg)]",
  3: "bg-level-3 text-[var(--level-3-fg)]",
  4: "bg-level-4 text-[var(--level-4-fg)]",
  5: "bg-level-5 text-[var(--level-5-fg)]",
};

/**
 * O nível como chip ([F-03]); o nome do nível vai no `Tooltip` acessível e,
 * quando não está visível (`showName`), numa cópia só para leitor de tela —
 * o `title=` nativo era a única forma de lê-lo ([F-02]).
 */
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
      <Chip className={cn("tabular-nums", levelBg[0])} tooltip={t("level.cellTooltip.none")}>
        —
      </Chip>
    );
  }
  const nome = labels.levelName[level as keyof typeof labels.levelName] ?? "—";
  return (
    <Chip
      className={cn("tabular-nums", levelBg[level] ?? levelBg[0])}
      tooltip={t("level.tooltip", { n: level, nome })}
    >
      L{level}
      {showName && <span className="font-normal opacity-80">{nome}</span>}
    </Chip>
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
      <Chip tone="neutral" tooltip={t("level.cellTooltip.none")}>
        —
      </Chip>
    );
  }

  const tone = ruler.severityOf(gap);
  const label = t(ruler.messageKey[tone]);
  return (
    <Chip className={gapTone[tone]}>{t("gap.badge", { n: Math.max(0, gap), rotulo: label })}</Chip>
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
  return <Chip className={statusTone[tone]}>{label}</Chip>;
}

export type SemanticTone = "warning" | "success";

export const semanticTone: Record<SemanticTone, string> = {
  warning: "bg-warning text-warning-fg",
  success: "bg-success text-success-fg",
};

export type CalloutTone = "info" | SemanticTone | "danger";

/**
 * O que cada tom do `Callout` carrega ([D-02]): o par faixa+tinta dos
 * tokens, o ícone lucide e o papel ARIA que o tom sugere — só `danger`
 * interrompe (`alert`); os outros são caixa estática na página, e virar
 * live region em 20 avisos de rota seria ruído para o leitor de tela. Quem
 * chama pede `role="status"` quando o aviso NASCE de uma ação.
 */
class CalloutToneStyle {
  private static readonly POR_TOM: Record<CalloutTone, CalloutToneStyle> = {
    info: new CalloutToneStyle("bg-info text-info-fg", Info, undefined),
    success: new CalloutToneStyle(semanticTone.success, CircleCheck, undefined),
    warning: new CalloutToneStyle(semanticTone.warning, TriangleAlert, undefined),
    danger: new CalloutToneStyle("bg-danger-subtle text-destructive", CircleAlert, "alert"),
  };

  private constructor(
    readonly className: string,
    readonly Icon: typeof Info,
    readonly role: "alert" | "status" | undefined,
  ) {}

  static of(tone: CalloutTone): CalloutToneStyle {
    return CalloutToneStyle.POR_TOM[tone];
  }
}

/**
 * O aviso em caixa da casa, em quatro tons. Ícone à esquerda, escondido do
 * leitor de tela (o texto já diz). Texto simples é filho DIRETO do bloco —
 * quem procura a frase encontra o próprio alerta (o leitor de tela e o
 * teste); conteúdo composto (parágrafo + lista, texto + botão) vai num
 * bloco próprio para correr ao lado do ícone. `compact` é a versão das
 * telas de porta (`AuthAlert`): menos respiro.
 */
export function Callout({
  tone,
  role,
  compact = false,
  children,
  className,
}: {
  tone: CalloutTone;
  role?: "alert" | "status" | undefined;
  compact?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const estilo = CalloutToneStyle.of(tone);
  const papel = role ?? estilo.role;
  return (
    <div
      {...(papel ? { role: papel } : {})}
      className={cn(
        "flex items-start gap-2 rounded-md text-body",
        compact ? "px-3 py-2" : "p-3",
        estilo.className,
        className,
      )}
    >
      <estilo.Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {typeof children === "string" ? children : <div className="min-w-0 flex-1">{children}</div>}
    </div>
  );
}

/**
 * O cartão de contagem: um apelido de `KeyFigureCard size="sm"` ([D-01] — um
 * só cartão de KPI). Fica até os 17 usos nas rotas migrarem (PR 10); quem
 * escreve tela nova usa `KeyFigureCard` direto.
 * @deprecated use `KeyFigureCard size="sm"`.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  help,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  /** O "?" do próprio card — fica dentro dele, ao lado do rótulo. */
  help?: ReactNode;
}) {
  return (
    <KeyFigureCard
      size="sm"
      label={label}
      value={value}
      caption={hint}
      icon={icon}
      tone={tone}
      help={help}
    />
  );
}

export function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-(--motion-base) ease-standard"
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
  description?: string | undefined;
  actions?: ReactNode;

  help?: { lead: PageHelpContent; member: PageHelpContent } | undefined;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="page-heading">
        <div className="flex items-center gap-1.5">
          <h1 className="page-title">{title}</h1>
          {help && <PageHelp content={help} />}
        </div>
        {description && (
          <p className="mt-1 line-clamp-3 max-w-prose text-sm text-muted-foreground md:line-clamp-2">
            {description}
          </p>
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

/**
 * O "Voltar" da ficha (dono, 2026-09-06): na PRÓPRIA ficha não existe — o
 * grupo "Minha carreira" do menu já leva a cada aba, e não há para onde
 * voltar. Quem lidera, olhando a ficha de outra pessoa, continua com ele:
 * para o Time (na Visão geral) ou para a Visão geral (nas abas).
 */
export function ProfileBackLink({
  professionalId,
  to,
}: {
  professionalId: string;
  to: "team" | "overview";
}) {
  const { t } = useI18n();
  const user = useCurrentUser();
  if (defaultUiAuthorizationPolicy.readsOwn(user, professionalId)) return null;
  const className = "rounded-md border border-input px-3 py-2 text-sm hover:bg-accent";
  return to === "team" ? (
    <Link to="/team" className={className}>
      {t("arch.back")}
    </Link>
  ) : (
    <Link to="/professionals/$professionalId" params={{ professionalId }} className={className}>
      {t("arch.back")}
    </Link>
  );
}

export function ProfileTabs({
  professionalId,
  active,
}: {
  professionalId: string;
  active: "overview" | "evolution" | "statement" | "roadmap";
}) {
  const { t } = useI18n();
  const user = useCurrentUser();
  const professional = useSelectors().professionalById(professionalId);
  // Revisão de papéis (2026-09-05): Evolução e Roteiro são da própria pessoa e
  // de quem a lidera; o Extrato carrega a ficha funcional — própria pessoa,
  // gerente designado e admin em suporte. O tech lead não vê o Extrato.
  // Dono (2026-09-07): na PRÓPRIA ficha a navegação é só pelo grupo "Minha
  // Carreira" da coluna — as abas horizontais eram redundantes e fora do padrão.
  if (user.professionalId === professionalId) return null;
  const careerTabs = defaultUiAuthorizationPolicy.canOpenCareerTabsOf(user, professional);
  const statementTab = defaultUiAuthorizationPolicy.canOpenStatementOf(user, professional);
  const tabClass = (isActive: boolean) =>
    cn(
      "border-b-2 px-1 pb-2 text-sm font-medium transition-base",
      isActive
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );
  return (
    <nav className="scroll-visible -mx-5 mb-6 flex gap-6 overflow-x-auto border-b border-border px-5 lg:-mx-8 lg:px-8">
      <Link
        to="/professionals/$professionalId"
        params={{ professionalId }}
        aria-current={active === "overview" ? "page" : undefined}
        className={tabClass(active === "overview")}
      >
        {t("arch.tabs.overview")}
      </Link>
      {careerTabs && (
        <>
          <Link
            to="/professionals/$professionalId/evolution"
            params={{ professionalId }}
            aria-current={active === "evolution" ? "page" : undefined}
            className={tabClass(active === "evolution")}
          >
            {t("arch.tabs.evolution")}
          </Link>
          {statementTab && (
            <Link
              to="/professionals/$professionalId/statement"
              params={{ professionalId }}
              aria-current={active === "statement" ? "page" : undefined}
              className={tabClass(active === "statement")}
            >
              {t("arch.tabs.statement")}
            </Link>
          )}
          <Link
            to="/professionals/$professionalId/roadmap"
            params={{ professionalId }}
            aria-current={active === "roadmap" ? "page" : undefined}
            className={tabClass(active === "roadmap")}
          >
            {t("arch.tabs.roadmap")}
          </Link>
        </>
      )}
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

function useSectionVisibility(
  storageKey: string | undefined,
  defaultOpen: boolean,
): { open: boolean; toggle: () => void } {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (storageKey === undefined) return;
    const remembered = defaultSectionVisibilityMemory.recall(storageKey);
    if (remembered !== null) setOpen(remembered);
  }, [storageKey]);
  const toggle = () => {
    const next = !open;
    if (storageKey !== undefined) defaultSectionVisibilityMemory.remember(storageKey, next);
    setOpen(next);
  };
  return { open, toggle };
}

function SectionToggle({
  title,
  open,
  contentId,
  onToggle,
}: {
  title: string;
  open: boolean;
  contentId: string;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-expanded={open}
      aria-controls={contentId}
      aria-label={t(open ? "section.hideNamed" : "section.showNamed", { nome: title })}
      onClick={onToggle}
    >
      {t(open ? "section.hide" : "section.show")}
      <ChevronDown
        className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")}
        aria-hidden="true"
      />
    </Button>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  id,
  collapsible = false,
  defaultOpen = true,
  storageKey,
  help,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  storageKey?: string;
  help?: ReactNode;
}) {
  const titleId = useId();
  const contentId = useId();
  const Heading = SECTION_HEADING_TAG[useContext(SectionHeadingLevelContext)];
  const { open, toggle } = useSectionVisibility(storageKey, defaultOpen);
  const shown = !collapsible || open;
  const heading = (
    <SectionHeading as={Heading} id={titleId}>
      {title}
    </SectionHeading>
  );
  return (
    <section id={id} aria-labelledby={titleId} className={cn("surface-card p-5", className)}>
      <div className={cn("flex flex-wrap items-start justify-between gap-3", shown && "mb-4")}>
        <div>
          {help ? (
            <div className="flex items-center gap-1.5">
              {heading}
              {help}
            </div>
          ) : (
            heading
          )}
          {description && (
            <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {(actions || collapsible) && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {collapsible && (
              <SectionToggle title={title} open={open} contentId={contentId} onToggle={toggle} />
            )}
          </div>
        )}
      </div>
      {collapsible ? open && <div id={contentId}>{children}</div> : children}
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
        <p className={cn("text-sm text-muted-foreground", title !== undefined && "mt-1")}>
          {typeof hint === "string" ? <SentenceBlock text={hint} /> : hint}
        </p>
      )}
      {action}
    </div>
  );
}

export { FieldLabel } from "@/components/app/FieldLabel";

/**
 * A senioridade como RÓTULO — coluna do Time, cartão, quadro do time. Quando
 * a pessoa não tem senioridade (gerente e tech lead, onda 37), sai o travessão
 * da ausência, com o significado no `title` para quem não vê o símbolo.
 */
export function Seniority({
  role,
  className,
}: {
  role: RoleName | null | undefined;
  className?: string;
}) {
  const seniority = useSeniorityReading();
  return (
    <span className={className} title={seniority.titleOf(role)}>
      {seniority.labelOf(role)}
    </span>
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
