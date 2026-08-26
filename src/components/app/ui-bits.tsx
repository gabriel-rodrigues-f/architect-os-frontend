import type { ReactNode } from "react";
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

/** `level` undefined = sem assessment oficial; mostra "—", nunca "L0" fictício. */
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

/**
 * `level` vem `undefined` quando a pessoa não tem assessment oficial cobrindo
 * a capacidade no ciclo — nunca `0`. A célula mostra "—" sem tooltip de nível,
 * porque não há nível nenhum para explicar (não é o mesmo caso de nível 0,
 * que a escala nem define).
 */
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
  /** OO3-11i/CFG-02 — régua única de severidade, agora a EFETIVA (`/api/config/bands`, fallback = seed), compartilhada com o relatório do time. */
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

/**
 * R2-VIS-01 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — situação de avaliação e
 * papel de usuário pegavam emprestado `bg-level-*`, o vocabulário de
 * PROFICIÊNCIA (`LevelBadge` acima), só porque o número de estados batia por
 * coincidência. Paleta própria (`status-*`, `tokens.ts`), sem relação com
 * nível de competência — mudar a escala de proficiência não deve mexer aqui,
 * e vice-versa. `tone` é a abstração pública: cada tela mapeia o próprio
 * domínio (status de avaliação, papel de usuário, ...) para um dos três
 * estados genéricos, sem essa lib conhecer domínio nenhum.
 */
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
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * R2-ESC-05/R2-UX-09 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, regra C.2.9) —
 * lista de nomes concatenados sem teto: acima de `max` (default 5), mostra
 * só os primeiros + "e mais N", com a lista completa sempre disponível via
 * `title` (nunca corte silencioso — a informação continua alcançável).
 */
export function NameList({
  names,
  max = 5,
  emptyLabel,
}: {
  names: readonly string[];
  max?: number;
  /** Convenção de "lista vazia" varia por tela (ex.: "—" nos cards de Cobertura) — default é `common.none`. */
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
 * OO3-11/D-8 (reuso final) — o card de estado vazio (`surface-card p-8
 * text-center` + título `font-medium` + dica muted) estava copiado em 10
 * telas, com pequenas variações acidentais. As variações REAIS viram props:
 * telas de busca sem resultado só têm a dica (sem título → o `mt-1` da dica
 * também some, como nos originais); o roster vazio de /team tem um botão de
 * ação abaixo.
 */
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

/**
 * R2-VIS-11 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `n[0]` pegava o primeiro
 * CARACTERE de cada palavra, sem checar o que era: um nome com aspas ou
 * símbolo solto no início de uma palavra (`Arquiteto "R&D" <Ops>`) virava
 * `A"` no avatar em vez de `AR`. Filtra para a primeira letra ou dígito de
 * cada palavra — símbolo isolado (palavra sem nenhuma letra/dígito) é
 * pulado, não vira iniciais.
 */
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
