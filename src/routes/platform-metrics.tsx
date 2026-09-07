import { createFileRoute } from "@tanstack/react-router";

import { OutOfReachScreen } from "@/components/app";
import { PlatformMetricsGate } from "@/components/app/PlatformMetricsGate";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requirePlatformMetricsReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";

/**
 * MÉTRICAS DA PLATAFORMA — uma rota como as outras (dono, 2026-09-08).
 *
 * Era um item de menu com `target="_blank"` para o Grafana, e o dono mediu os
 * dois defeitos disso na mesma frase: a tela "abre de qualquer jeito, sem
 * elegância", e "quando estou em Estrutura de Times e clico em Métricas, a
 * seleção continua em Estrutura de Times e vejo os dois selecionados". Uma
 * âncora externa não muda a rota; sem rota, não há item aceso nem
 * `aria-current` que digam a verdade.
 *
 * Com rota, os dois defeitos morrem juntos: o menu acende UM item, e a tela
 * (`PlatformMetricsGate`) conduz a abertura — bate na porta do Grafana e só
 * então leva a aba que o clique reservou.
 *
 * O alcance é o mesmo de sempre (adendo do dono, 2026-09-08, item 5): todos
 * menos o member. A guarda fecha a URL; a tela nega o desenho, porque o
 * `beforeLoad` é cego à sessão no SSR (a lição da onda 17).
 */
export const Route = createFileRoute("/platform-metrics")({
  head: () => ({
    meta: [
      { title: "Métricas da Plataforma — Synapse" },
      {
        name: "description",
        content:
          "Abertura controlada do painel de métricas da plataforma: a porta é conferida antes de a aba ser levada ao painel.",
      },
      { property: "og:title", content: "Métricas da Plataforma — Synapse" },
      {
        property: "og:description",
        content: "O painel de observabilidade da plataforma, aberto em outra aba.",
      },
    ],
  }),
  beforeLoad: requirePlatformMetricsReach,
  component: PlatformMetricsPage,
});

function PlatformMetricsPage() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("platformMetrics");
  const readsPlatformMetrics = defaultUiAuthorizationPolicy.readsPlatformMetrics(user);

  if (!readsPlatformMetrics) {
    return (
      <OutOfReachScreen
        title={t("metrics.title")}
        help={help}
        reason={t("metrics.outOfReach")}
        hint={t("metrics.outOfReachHint")}
      />
    );
  }

  return <PlatformMetricsGate help={help} />;
}
