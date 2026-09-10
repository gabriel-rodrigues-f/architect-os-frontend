import { Bar, GapBadge } from "@/components/app/ui-bits";
import { useI18n } from "@/lib/i18n";
import type { ReadinessReading } from "@/lib/readiness";
import { cn } from "@/lib/utils";

/**
 * A RÉGUA DA LINHA — o pedido do dono (2026-09-09, com referência visual):
 * *"uma régua que muda de cor dentro da linha de cada profissional"*, com o
 * rótulo "Distância N" ao lado.
 *
 * O que a peça desenha vem inteiro de `ReadinessReading`, que não inventa
 * corte nenhum: o comprimento é a fração de competências já no alvo, e a cor
 * é a faixa da maior distância — a MESMA que o `GapBadge` ao lado nomeia. Por
 * isso o selo é o componente que já existe, e não um segundo rótulo: se a cor
 * e a frase pudessem discordar, uma delas estaria mentindo.
 *
 * SEM DADOS não é zero. Quem não tem avaliação concluída no ciclo recebe uma
 * pista TRACEJADA e vazia, visivelmente diferente de uma barra em 0% — e o
 * selo diz por quê, com a mesma frase que o resto da tela usa para a ausência
 * de avaliação oficial.
 */
export function ReadinessBar({
  reading,
  className,
}: {
  reading: ReadinessReading;
  className?: string;
}) {
  const { t } = useI18n();

  if (reading.bucket === "unknown") {
    return (
      <div
        data-testid="readiness-bar"
        data-readiness="unknown"
        className={cn("flex items-center gap-2", className)}
      >
        <span
          aria-hidden="true"
          className="h-2 min-w-16 flex-1 rounded-full border border-dashed border-border"
        />
        {/*
          O selo da ausência é o MESMO do resto da tela — o travessão do
          `GapBadge` sem distância, com a frase "Nenhuma avaliação oficial
          neste ciclo" no balão. Escrever aqui um rótulo próprio seria uma
          segunda maneira de dizer a mesma coisa, e o travessão é o símbolo
          único da ausência nesta casa.
        */}
        <GapBadge gap={undefined} />
      </div>
    );
  }

  return (
    <div
      data-testid="readiness-bar"
      data-readiness={reading.bucket}
      className={cn("flex items-center gap-2", className)}
    >
      <Bar
        value={reading.percentageOnTarget ?? 0}
        {...(reading.tone === null ? {} : { tone: reading.tone })}
        label={t("team.readiness.aria", { alvo: reading.onTarget, total: reading.measured })}
        className="min-w-16 flex-1"
      />
      <GapBadge gap={reading.worstGap ?? undefined} />
    </div>
  );
}
