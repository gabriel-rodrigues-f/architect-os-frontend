import { useEffect, useState, type CSSProperties } from "react";

import type { PageHelpContent } from "@/components/app/PageHelp";
import { PageHeader } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks";
import { usePlatformMetricsTab, useSynapseSignals } from "@/lib/dependencies";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { ObservabilityAddress } from "@/lib/platform-metrics";

/**
 * A FASE DA ABERTURA — o que a tela desenha, e o único lugar onde a ordem das
 * perguntas está escrita: enquanto a aba não foi tentada é ABERTURA; depois
 * ela está ABERTA em outra aba, ou BLOQUEADA pelo navegador.
 *
 * Não há mais fase de recusa nem de indisponibilidade aqui (regressão da tela
 * branca, 2026-09-08): as duas nasciam de LER a resposta da porta por `fetch`
 * cross-origin, coisa que o navegador não permite. A recusa por alcance é da
 * política, antes desta tela (`OutOfReachScreen`); a recusa por sessão e a
 * queda do serviço são da porta, dentro da aba, onde elas têm resposta de
 * verdade para mostrar.
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

  private constructor(
    readonly name: "opening" | "opened" | "blocked",
    readonly headline: MessageKey,
    readonly hint: MessageKey,
  ) {}

  static of(shown: boolean | null): MetricsOpening {
    if (shown === null) return MetricsOpening.OPENING;
    return shown ? MetricsOpening.OPENED : MetricsOpening.BLOCKED;
  }

  /** Só depois de a aba ter sido tentada faz sentido oferecer "Abrir de novo". */
  get offersAnotherTry(): boolean {
    return this.name !== "opening";
  }
}

/**
 * A TELA DE TRANSIÇÃO DAS MÉTRICAS — pedido literal do dono (2026-09-08):
 * "quando clico para abrir Métricas da Plataforma ele abre de qualquer jeito,
 * sem elegância; quero que essa tela seja aberta de forma controlada, com um
 * efeito elegante".
 *
 * A elegância aqui não é decoração: é a ORDEM. O item do menu deixou de ser
 * uma âncora `target="_blank"` e virou rota; a rota pulsa a rede, leva a aba
 * que o clique já reservou até a porta das métricas e diz onde ela ficou.
 *
 * O QUE ESTA TELA NÃO FAZ MAIS (mesma data, "não consigo mais visualizar o
 * grafana, tela branca"): bater na porta por `fetch` antes de navegar. A
 * porta responde 302 para outra origem, o `fetch` esbarra em CORS e rejeita,
 * e a tela lia isso como serviço fora do ar — a aba reservada nunca era
 * navegada e ficava branca. A conferência que sobra é a da MESMA ORIGEM: o
 * alcance vem do `/auth/me` e é a rota que o aplica antes de desenhar aqui.
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
  const [shown, setShown] = useState<boolean | null>(null);

  // A transição é da REDE: um pulso primary enquanto a aba vai para a porta.
  useEffect(() => {
    if (reducedMotion) return;
    signals?.pulseWith("primary");
  }, [signals, reducedMotion]);

  useEffect(() => {
    if (shown !== null) return;
    setShown(tab?.show(ObservabilityAddress.grafana) ?? false);
  }, [shown, tab]);

  const opening = MetricsOpening.of(shown);

  const openAgain = () => setShown(tab?.show(ObservabilityAddress.grafana) ?? false);

  return (
    <>
      <PageHeader title={t("metrics.title")} help={help} />
      <section
        data-testid="platform-metrics-gate"
        data-phase={opening.name}
        className="auth-rise mx-auto max-w-prose py-12 text-center"
        style={{ "--auth-delay": "80ms", "--rise-distance": "8px" } as CSSProperties}
      >
        <div role="status">
          <p className="text-section font-semibold text-foreground">{t(opening.headline)}</p>
          <p className="mt-2 text-body text-muted-foreground">{t(opening.hint)}</p>
        </div>
        {opening.offersAnotherTry ? (
          <Button className="mt-6" onClick={openAgain}>
            {t("metrics.openAgain")}
          </Button>
        ) : null}
      </section>
    </>
  );
}
