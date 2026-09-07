import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { PageHelpContent } from "@/components/app/PageHelp";
import { ServiceOutageScreen } from "@/components/app/ServiceOutageScreen";
import { Callout, PageHeader } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks";
import { usePlatformMetricsTab, useSynapseSignals } from "@/lib/dependencies";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  ObservabilityAddress,
  PlatformMetricsDoor,
  type MetricsRefusal,
} from "@/lib/platform-metrics";

/** A batida na porta é uma consulta só, e ela não é compartilhada com tela nenhuma. */
const PLATFORM_METRICS_DOOR_QUERY_KEY = ["platform-metrics", "door"];

/**
 * A FASE DA ABERTURA — o que a tela desenha, e o único lugar onde a ordem das
 * perguntas está escrita: sem resposta ainda é ABERTURA; sem serviço atrás da
 * porta é INDISPONIBILIDADE; recusa é RECUSA; e, com a porta aberta, ainda é
 * abertura até a aba ser levada ao painel — o que o navegador pode bloquear.
 */
class MetricsOpening {
  private static readonly OPENING = new MetricsOpening(
    "opening",
    "metrics.opening",
    "metrics.openingHint",
  );
  private static readonly OPENED = new MetricsOpening(
    "opened",
    "metrics.openedElsewhere",
    "metrics.openedElsewhereHint",
  );
  private static readonly BLOCKED = new MetricsOpening(
    "blocked",
    "metrics.blocked",
    "metrics.blockedHint",
  );
  private static readonly REFUSED = new MetricsOpening("refused");
  private static readonly OUTAGE = new MetricsOpening("outage");

  private constructor(
    readonly name: "opening" | "opened" | "blocked" | "refused" | "outage",
    private readonly headline?: MessageKey,
    private readonly hint?: MessageKey,
  ) {}

  /** O que a fase DIZ — as duas frases da tela; `null` nas fases que falam por outro componente. */
  get says(): { readonly headline: MessageKey; readonly hint: MessageKey } | null {
    if (this.headline === undefined || this.hint === undefined) return null;
    return { headline: this.headline, hint: this.hint };
  }

  static of(
    waiting: boolean,
    outage: boolean,
    refusal: MetricsRefusal | null,
    shown: boolean | null,
  ): MetricsOpening {
    if (waiting) return MetricsOpening.OPENING;
    if (outage) return MetricsOpening.OUTAGE;
    if (refusal) return MetricsOpening.REFUSED;
    if (shown === null) return MetricsOpening.OPENING;
    return shown ? MetricsOpening.OPENED : MetricsOpening.BLOCKED;
  }

  /** A frase da recusa nomeia a RAZÃO, não o status: sessão não reconhecida ou conta sem alcance. */
  static readonly REFUSAL_MESSAGE: Readonly<Record<MetricsRefusal, MessageKey>> = {
    unauthenticated: "metrics.refused.unauthenticated",
    forbidden: "metrics.refused.forbidden",
  };

  get isOutage(): boolean {
    return this.name === "outage";
  }

  get isRefused(): boolean {
    return this.name === "refused";
  }

  /** Só depois de a aba ter sido tentada faz sentido oferecer "Abrir de novo". */
  get offersAnotherTry(): boolean {
    return this.name === "opened" || this.name === "blocked";
  }
}

/**
 * A TELA DE TRANSIÇÃO DAS MÉTRICAS — pedido literal do dono (2026-09-08):
 * "quando clico para abrir Métricas da Plataforma ele abre de qualquer jeito,
 * sem elegância; quero que essa tela seja aberta de forma controlada, com um
 * efeito elegante".
 *
 * A elegância aqui não é decoração: é a ORDEM. Antes, o item do menu era uma
 * âncora `target="_blank"` que mandava a pessoa para o Grafana antes de saber
 * se a porta abria — e uma aba com um erro dentro é a forma mais deselegante
 * de responder. Agora a tela bate na porta (`GET {API}/grafana/`, que troca a
 * sessão do Synapse pelo cookie do Grafana), a rede de sinapses do interior
 * pulsa enquanto se espera, e só então a aba — a que o clique no menu já
 * reservou — é levada ao painel. Recusa vira frase com a razão; serviço fora
 * do ar vira a tela de indisponibilidade da casa, a mesma de todas as outras.
 *
 * Com movimento reduzido não há pulso, e a entrada não anima (a regra do
 * `auth-rise` vive dentro de `no-preference`): a abertura continua a mesma,
 * direta. A preferência tira a animação, nunca a função.
 */
export function PlatformMetricsGate({
  help,
}: {
  help: { lead: PageHelpContent; member: PageHelpContent };
}) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const signals = useSynapseSignals();
  const tab = usePlatformMetricsTab();
  const door = useMemo(() => new PlatformMetricsDoor(), []);
  const [shown, setShown] = useState<boolean | null>(null);

  const knock = useQuery({
    queryKey: PLATFORM_METRICS_DOOR_QUERY_KEY,
    queryFn: ({ signal }) => door.knock(signal),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // A transição é da REDE: um pulso primary enquanto a porta responde.
  useEffect(() => {
    if (reducedMotion) return;
    signals?.pulseWith("primary");
  }, [signals, reducedMotion]);

  const answer = knock.data;
  const ready = answer?.isReady === true;

  useEffect(() => {
    if (!ready || shown !== null) return;
    setShown(tab?.show(ObservabilityAddress.grafana) ?? false);
  }, [ready, shown, tab]);

  const opening = MetricsOpening.of(
    knock.isPending,
    answer?.outage ?? true,
    answer?.refusal ?? null,
    shown,
  );

  const openAgain = () => setShown(tab?.show(ObservabilityAddress.grafana) ?? false);

  if (opening.isOutage) {
    return (
      <ServiceOutageScreen
        onRetry={() => {
          setShown(null);
          tab?.release();
          void knock.refetch();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader title={t("metrics.title")} help={help} />
      <section
        data-testid="platform-metrics-gate"
        data-phase={opening.name}
        className="auth-rise mx-auto max-w-prose py-12 text-center"
        style={{ "--auth-delay": "80ms", "--rise-distance": "8px" } as CSSProperties}
      >
        {opening.says ? (
          <div role="status">
            <p className="text-section font-semibold text-foreground">{t(opening.says.headline)}</p>
            <p className="mt-2 text-body text-muted-foreground">{t(opening.says.hint)}</p>
          </div>
        ) : null}
        {opening.isRefused && answer?.refusal ? (
          <Callout tone="danger">{t(MetricsOpening.REFUSAL_MESSAGE[answer.refusal])}</Callout>
        ) : null}
        {opening.offersAnotherTry ? (
          <Button className="mt-6" onClick={openAgain}>
            {t("metrics.openAgain")}
          </Button>
        ) : null}
      </section>
    </>
  );
}
