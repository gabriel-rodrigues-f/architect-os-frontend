import { useQuery } from "@tanstack/react-query";

import { CareerRunCanvas } from "@/components/app/CareerRunCanvas";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { INSTANCE_STATUS_QUERY_KEY, instanceStatusQuery } from "@/lib/session-query";

/** O pulso do serviço: pergunta de tempos em tempos se ele voltou. */
export class ServiceHeartbeat {
  static readonly INTERVAL_MS = 5000;
  static readonly QUERY_KEY = INSTANCE_STATUS_QUERY_KEY;
}

/**
 * A tela de serviço indisponível — a MESMA em toda a aplicação (dono,
 * 2026-09-06): no lugar do aviso tradicional, a corrida de carreira; um
 * pulso a cada 5 segundos pergunta ao serviço se ele voltou e, quando volta,
 * a pessoa é avisada e escolhe voltar para a aplicação.
 */
export function ServiceOutageScreen({
  onRetry,
  diagnostics,
}: {
  onRetry: () => void;
  diagnostics?: React.ReactNode;
}) {
  const { t } = useI18n();
  const heartbeat = useQuery({
    ...instanceStatusQuery,
    refetchInterval: (query) =>
      query.state.status === "success" ? false : ServiceHeartbeat.INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
  const isBack = heartbeat.isSuccess;

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-4"
      data-testid="service-outage"
    >
      <div className="w-full max-w-2xl text-center">
        <h2 className="text-lg font-semibold text-foreground">{t("outage.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isBack ? t("outage.back") : t("outage.lead")}
        </p>
        {diagnostics}
        <div className="mt-6">
          <CareerRunCanvas />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2" aria-live="polite">
          {isBack ? (
            <Button onClick={onRetry}>{t("outage.return")}</Button>
          ) : (
            <Button variant="outline" onClick={onRetry}>
              {t("outage.retry")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
