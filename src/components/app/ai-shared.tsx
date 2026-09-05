import { Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";

import { SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAssistantRun } from "@/hooks/use-assistant-run";
import {
  AdviceAbsences,
  AdviceTranscript,
  CareerReadinessReading,
  GenerationProfileChoice,
  type AssistantRunState,
  type CareerReadinessFigures,
  type GenerationProfileName,
  type WrittenByPerson,
} from "@/lib/assistants";
import type { PersonAdvice } from "@/lib/gateways/person-assistants.gateway";
import type { StagnationAlert, WorkAssistance } from "@/lib/gateways/work-assistants.gateway";
import { useI18n } from "@/lib/i18n";

/**
 * A casa de vidro dos oito assistentes: o que TODA sugestão de IA desenha,
 * escrito uma vez.
 *
 * A régua que estes componentes impõem, e que nenhuma tela pode afrouxar por
 * conta própria:
 *
 *  1. **o determinístico vem primeiro e sempre.** Os fatos apurados, o roteiro
 *     e o veredito são desenhados antes de qualquer parágrafo do provedor, e
 *     continuam desenhados quando o parágrafo não vem;
 *  2. **a sugestão se declara sugestão** com a frase que o backend manda no
 *     corpo (`notice`) — não com uma frase que cada tela inventa. Já
 *     produzimos N frases para a mesma ideia nesta casa;
 *  3. **o próximo passo é oferecido**: copiar, e o caminho para a operação
 *     que realmente grava. Nada aqui grava nada.
 */
export function GenerationProfileField({
  value,
  onChange,
  disabled,
}: {
  value: GenerationProfileName;
  onChange: (profile: GenerationProfileName) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div>
      <Label htmlFor="ai-generation-profile">{t("ai.profile.legend")}</Label>
      <select
        id="ai-generation-profile"
        className="mt-1 w-full max-w-xs rounded-md border border-input bg-card px-3 py-2 text-sm"
        value={value}
        disabled={disabled === true}
        onChange={(event) => {
          const chosen = event.target.value;
          if (GenerationProfileChoice.isKnown(chosen)) onChange(chosen);
        }}
      >
        {GenerationProfileChoice.NAMES.map((profile) => (
          <option key={profile} value={profile}>
            {t(GenerationProfileChoice.labelKeyOf(profile))}
          </option>
        ))}
      </select>
      <p className="mt-1 max-w-prose text-xs text-muted-foreground">
        {t(GenerationProfileChoice.hintKeyOf(value))}
      </p>
    </div>
  );
}

export function AiGenerateButton({
  label,
  running,
  disabled,
  onGenerate,
}: {
  label: string;
  running: boolean;
  disabled?: boolean;
  onGenerate: () => void;
}) {
  const { t } = useI18n();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={running || disabled === true}
      onClick={onGenerate}
    >
      {running ? t("ai.action.generating") : label}
    </Button>
  );
}

/**
 * Os quatro estados que a regra 19 do pedido exige, e nenhum a mais: não
 * pedido, carregando, falhou (com "tentar novamente") e pronto. O erro é
 * `role="alert"` porque quem clicou está esperando — e a frase vem da classe,
 * que já decidiu entre repetir o serviço e usar o dicionário.
 */
export function AiRunResult<P, T>({
  run,
  children,
}: {
  run: AssistantRunState<P, T>;
  children: (advice: T) => ReactNode;
}) {
  const { t } = useI18n();
  if (!run.started) return null;

  if (run.running) {
    return (
      <div aria-busy="true" aria-live="polite" className="mt-4">
        <span className="sr-only">{t("ai.action.generating")}</span>
        <div className="h-20 animate-pulse rounded-md bg-secondary" />
      </div>
    );
  }

  const failure = run.failure;
  if (failure) {
    return (
      <div className="mt-4">
        <p role="alert" className="text-sm text-destructive">
          {failure.sentence((key) => t(key))}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => {
            run.retry();
          }}
        >
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const advice = run.advice;
  if (advice === undefined) return null;
  return <div className="mt-4">{children(advice)}</div>;
}

/**
 * O texto da IA chega em linhas: um título de bloco termina em dois-pontos,
 * um tópico começa com travessão, o resto é parágrafo. Foi o combinado com
 * o narrador (`FORMAT` em `anthropic-ai-narrator.ts`) no dia em que o dono
 * viu cerquilha e asterisco crus na tela — a tela não interpreta markdown
 * de propósito (o texto entra como filho de JSX, inerte), então o formato
 * que ela entende é este, e só este.
 */
export class AdviceLine {
  private static readonly HEADING_LIMIT = 80;

  private constructor(
    readonly kind: "heading" | "item" | "paragraph",
    readonly text: string,
  ) {}

  static of(raw: string): AdviceLine {
    const line = raw.trim();
    if (/^[–—-]\s+/u.test(line)) return new AdviceLine("item", line.replace(/^[–—-]\s+/u, ""));
    if (line.endsWith(":") && line.length <= AdviceLine.HEADING_LIMIT) {
      return new AdviceLine("heading", line.slice(0, -1));
    }
    return new AdviceLine("paragraph", line);
  }

  static allOf(text: string): AdviceLine[] {
    return text
      .split("\n")
      .map((raw) => raw.trim())
      .filter((raw) => raw !== "")
      .map((raw) => AdviceLine.of(raw));
  }
}

export function AdviceText({ text, className }: { text: string; className?: string }) {
  const lines = AdviceLine.allOf(text);
  return (
    <div className={className ?? "mt-2 max-w-prose text-sm"}>
      {lines.map((line, index) =>
        line.kind === "heading" ? (
          <p key={index} className="mt-3 font-medium first:mt-0">
            {line.text}
          </p>
        ) : line.kind === "item" ? (
          <p key={index} className="mt-1 pl-4 before:mr-2 before:content-['–']">
            {line.text}
          </p>
        ) : (
          <p key={index} className="mt-2 first:mt-0">
            {line.text}
          </p>
        ),
      )}
    </div>
  );
}

export function AiSuggestionFrame({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles aria-hidden="true" className="size-3.5" />
        {t("ai.suggestion.badge")}
      </p>
      {children}
    </div>
  );
}

export function PersonAdviceBody({
  advice,
  transcriptHeadline,
  header,
  nextStep,
}: {
  advice: PersonAdvice & { outline?: string[] };
  transcriptHeadline: string;
  header?: ReactNode;
  nextStep?: ReactNode;
}) {
  const { t } = useI18n();
  const outline = advice.outline ?? [];
  return (
    <AiSuggestionFrame>
      {header}
      {outline.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {outline.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {advice.narration !== null && <AdviceText text={advice.narration} />}
      {advice.narrationUnavailable !== null && (
        <p role="status" className="mt-2 max-w-prose text-sm text-muted-foreground">
          {advice.narrationUnavailable}
        </p>
      )}
      <AdviceFactList label={t("ai.suggestion.facts")} items={advice.facts} />
      <AdviceWrittenList items={advice.written} />
      <AdviceAbsenceList absences={advice.absences} />
      <p className="mt-3 max-w-prose text-xs text-muted-foreground">{advice.notice}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <CopyAdviceButton text={AdviceTranscript.of(advice, transcriptHeadline)} />
        {nextStep}
      </div>
    </AiSuggestionFrame>
  );
}

export function AdviceFactList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="mt-1 space-y-1 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ADR-0093 na tela — o que uma PESSOA escreveu, ao lado dos fatos e nunca
 * dentro deles.
 *
 * A separação é a mesma que o backend acabou de fazer no briefing, e ela não é
 * estética: um bloco diz o que o SISTEMA apurou, o outro diz o que alguém
 * DIGITOU. Quem lê a tela precisa saber qual é qual — uma frase escrita por
 * gente pode dizer qualquer coisa, inclusive se parecer com um fato nosso, e
 * misturada à lista de fatos ela pegaria emprestada a credibilidade que a
 * lista tem. Daí o rótulo próprio, a régua à esquerda que marca a citação e o
 * rótulo por item, que diz de quem é aquele texto.
 *
 * O texto entra como FILHO de JSX, e é isso que o mantém inerte: o React
 * escapa, e uma tag digitada no formulário chega ao leitor como as letras que
 * ela é. Nada aqui usa `dangerouslySetInnerHTML` nem passa por renderizador de
 * markdown — o dia em que alguém achar que o texto "ficaria melhor formatado"
 * é o dia em que o formulário vira porta de entrada de HTML. Também não há
 * `whitespace-pre-line`: o backend já achatou tudo numa linha só, e reabrir
 * quebras aqui devolveria à pessoa que digita a chance de forjar uma lista.
 */
export function AdviceWrittenList({ items }: { items: readonly WrittenByPerson[] }) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <div className="mt-3 border-l-2 border-border pl-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("ai.suggestion.written")}
      </p>
      <dl className="mt-1 space-y-2">
        {items.map((one) => (
          <div key={one.label}>
            <dt className="text-xs text-muted-foreground">{one.label}</dt>
            <dd className="max-w-prose break-words text-sm">{one.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function AdviceAbsenceList({ absences }: { absences: string[] }) {
  const { t } = useI18n();
  const nomeadas = absences
    .map((absence) => AdviceAbsences.labelKeyOf(absence))
    .filter((key): key is NonNullable<typeof key> => key !== null)
    .map((key) => t(key));
  if (nomeadas.length === 0) return null;
  return (
    <p className="mt-2 max-w-prose text-xs text-muted-foreground">
      {t("ai.suggestion.absences")} {nomeadas.join(" · ")}
    </p>
  );
}

export function CopyAdviceButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-auto px-0 text-xs"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
          })
          .catch(() => {
            setCopied(false);
          });
      }}
    >
      {copied ? t("ai.action.copied") : t("ai.action.copy")}
    </Button>
  );
}

/**
 * O veredito determinístico, desenhado ANTES do parágrafo e independente
 * dele: é a exigência literal do dono de que ele *"continua aparecendo
 * SOZINHO quando a IA cai"*. Por isso ele mora aqui e não dentro do bloco de
 * narração — quem edita este arquivo não consegue acoplar os dois sem
 * perceber.
 */
export function CareerReadinessVerdictLines({ verdict }: { verdict: CareerReadinessFigures }) {
  const { t } = useI18n();
  const reading = new CareerReadinessReading(verdict);
  const transition = reading.transition;
  const eligibilityKey = reading.eligibilityKey;
  const qualified = reading.qualified;
  return (
    <dl className="mt-2 space-y-1 text-sm">
      {transition && (
        <div>
          <dt className="sr-only">{t("ai.readiness.transition")}</dt>
          <dd className="font-medium">{`${transition.from} → ${transition.to}`}</dd>
        </div>
      )}
      {eligibilityKey !== null && (
        <div>
          <dt className="sr-only">{t("ai.readiness.verdict")}</dt>
          <dd>{t(eligibilityKey)}</dd>
        </div>
      )}
      {qualified && (
        <div>
          <dt className="sr-only">{t("ai.readiness.qualifiedLabel")}</dt>
          <dd className="text-muted-foreground">
            {t("ai.readiness.qualified", { n: qualified.count, min: qualified.minimum })}
          </dd>
        </div>
      )}
    </dl>
  );
}

/**
 * O assistente de uma pessoa, montado inteiro: o botão, os quatro estados e o
 * corpo da sugestão. Cinco telas precisam exatamente disto (regra de reuso),
 * e a única coisa que muda entre elas é O QUE se pede e o que se oferece
 * depois — por isso `ask`, `label` e `nextStep` são parâmetros e o resto não.
 */
export function PersonAdviceSection<T extends PersonAdvice & { outline?: string[] }>({
  title,
  description,
  actionLabel,
  transcriptHeadline,
  queryKey,
  ask,
  className,
  nextStep,
  beforeNarration,
}: {
  title: string;
  description: string;
  actionLabel: string;
  transcriptHeadline: string;
  queryKey: readonly unknown[];
  ask: () => Promise<T>;
  className?: string;
  nextStep?: (advice: T) => ReactNode;
  beforeNarration?: (advice: T) => ReactNode;
}) {
  const run = useAssistantRun<true, T>(queryKey, () => ask());
  return (
    <SectionCard
      title={title}
      description={description}
      {...(className === undefined ? {} : { className })}
    >
      <AiGenerateButton
        label={actionLabel}
        running={run.running}
        onGenerate={() => {
          run.generate(true);
        }}
      />
      <AiRunResult run={run}>
        {(advice) => (
          <PersonAdviceBody
            advice={advice}
            transcriptHeadline={transcriptHeadline}
            {...(beforeNarration === undefined ? {} : { header: beforeNarration(advice) })}
            {...(nextStep === undefined ? {} : { nextStep: nextStep(advice) })}
          />
        )}
      </AiRunResult>
    </SectionCard>
  );
}

/**
 * ADR-0088 — o que um assistente do TRABALHO desenha, e a ausência que é o
 * produto: **não há veredito**. Nenhum destes quatro aprova, rejeita, nota ou
 * classifica; quem decide é o humano, pela operação que já existe ao lado.
 *
 * `observations` (o que o sistema apurou por consulta) vem ANTES de `reading`
 * (a interpretação, a única parte que a IA escreve), e é assim que a tela
 * repete a primeira regra da casa sem precisar de uma frase explicando-a.
 */
export function WorkAssistanceBody({ assistance }: { assistance: WorkAssistance }) {
  const { t } = useI18n();
  return (
    <AiSuggestionFrame>
      <AdviceFactList label={t("ai.work.observations")} items={assistance.observations} />
      <AdviceText text={assistance.reading} className="mt-3 max-w-prose text-sm" />
      <p className="mt-3 max-w-prose text-xs text-muted-foreground">{t("ai.work.disclosure")}</p>
    </AiSuggestionFrame>
  );
}

export function WorkAssistanceRun({
  actionLabel,
  queryKey,
  ask,
}: {
  actionLabel: string;
  queryKey: readonly unknown[];
  ask: () => Promise<WorkAssistance>;
}) {
  const run = useAssistantRun<true, WorkAssistance>(queryKey, () => ask());
  return (
    <>
      <AiGenerateButton
        label={actionLabel}
        running={run.running}
        onGenerate={() => {
          run.generate(true);
        }}
      />
      <AiRunResult run={run}>
        {(assistance) => <WorkAssistanceBody assistance={assistance} />}
      </AiRunResult>
    </>
  );
}

export function WorkAssistanceSection({
  title,
  description,
  actionLabel,
  queryKey,
  ask,
  className,
}: {
  title: string;
  description: string;
  actionLabel: string;
  queryKey: readonly unknown[];
  ask: () => Promise<WorkAssistance>;
  className?: string;
}) {
  return (
    <SectionCard
      title={title}
      description={description}
      {...(className === undefined ? {} : { className })}
    >
      <WorkAssistanceRun actionLabel={actionLabel} queryKey={queryKey} ask={ask} />
    </SectionCard>
  );
}

/**
 * IA-05, e a PROIBIÇÃO literal do dono junto: a expressão é **"Requer
 * atenção"**, e classificar a pessoa como "baixo desempenho" é proibido. A
 * palavra proibida tem rede própria em
 * `tests/architecture/vocabulario-positivo.test.ts`; o que este componente
 * garante é o outro lado — quando NÃO há o que avisar, a tela diz isso com
 * todas as letras em vez de deixar um silêncio que cada gestor interpreta
 * como quiser.
 *
 * `requiresAttention` é determinístico: quando é falso o provedor sequer foi
 * chamado, e o que sobra na tela são os sinais que o sistema detectou.
 */
export function StagnationAlertSection({
  title,
  description,
  actionLabel,
  queryKey,
  ask,
  className,
}: {
  title: string;
  description: string;
  actionLabel: string;
  queryKey: readonly unknown[];
  ask: () => Promise<StagnationAlert>;
  className?: string;
}) {
  const { t } = useI18n();
  const run = useAssistantRun<true, StagnationAlert>(queryKey, () => ask());
  return (
    <SectionCard
      title={title}
      description={description}
      {...(className === undefined ? {} : { className })}
    >
      <AiGenerateButton
        label={actionLabel}
        running={run.running}
        onGenerate={() => {
          run.generate(true);
        }}
      />
      <AiRunResult run={run}>
        {(alert) => (
          <AiSuggestionFrame>
            <p
              className={
                alert.requiresAttention
                  ? "mt-2 text-sm font-semibold text-destructive"
                  : "mt-2 text-sm font-medium"
              }
            >
              {alert.requiresAttention
                ? t("ai.stagnation.requiresAttention")
                : t("ai.stagnation.clear")}
            </p>
            {alert.alert !== null && <AdviceText text={alert.alert} />}
            <AdviceFactList label={t("ai.stagnation.signals")} items={alert.signals} />
            <p className="mt-3 max-w-prose text-xs text-muted-foreground">
              {t("ai.stagnation.disclosure")}
            </p>
          </AiSuggestionFrame>
        )}
      </AiRunResult>
    </SectionCard>
  );
}
