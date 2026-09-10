import { HelpPopover } from "@/components/app/HelpPopover";
import { LevelBadge } from "@/components/app/ui-bits";
import { LEVELS } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";

/**
 * A ESCALA L1–L5 COMO LEGENDA, e não como cartão.
 *
 * Ela ocupava um `SectionCard` inteiro no Catálogo de Competências: título,
 * subtítulo e cinco caixas com selo e descrição, numa grade de cinco colunas.
 * MEDIDO no navegador com o CSS compilado, em 1440×900: **218,9px** de altura,
 * mais os 24 de intervalo — 242,9 da faixa útil de 841, numa tela onde NENHUM
 * conteúdo é medido em nível (o Catálogo lista capacidades e competências; o
 * único L1–L5 da tela era o da própria legenda).
 *
 * Legenda é texto de referência: consulta-se, não se lê. E a casa já tem o
 * gesto da consulta — o "?" que abre no ponteiro, no foco e no clique
 * (`HelpPopover`, dono 2026-09-09). Então os cinco selos ficam à vista, numa
 * linha, e as DESCRIÇÕES vão para o "?".
 *
 * E ela nem sequer ganha uma linha própria: uma linha custaria 28 de altura
 * mais 16 de intervalo, e a conta do Catálogo não tinha 44 sobrando — a caixa
 * de Arquivadas ficava 37,89px abaixo do piso de três linhas dela. Os selos
 * vão para a LINHA DO TÍTULO (`PageHeader.legend`), que já mede 32 por causa
 * do `h1`: custo medido, **zero**. 242,9px viraram nada, e o documento passou
 * a caber em 1440×900 com os 48 de folga do rodapé visíveis.
 */
export function ProficiencyScaleLegend() {
  const { t } = useI18n();
  const labels = useLabels();
  return (
    <div className="ml-1 flex flex-wrap items-center gap-1">
      {LEVELS.map((nivel) => (
        <LevelBadge key={nivel.level} level={nivel.level} />
      ))}
      <HelpPopover
        label={t("scale.legend.ariaLabel")}
        title={t("matrix.levels.title")}
        align="start"
      >
        <p className="text-muted-foreground">{t("matrix.levels.subtitle")}</p>
        <dl className="space-y-2">
          {LEVELS.map((nivel) => (
            <div key={nivel.level} className="flex items-start gap-2">
              <dt className="shrink-0">
                <LevelBadge level={nivel.level} showName />
              </dt>
              <dd className="text-body text-muted-foreground">
                {labels.levelDescription[nivel.level]}
              </dd>
            </div>
          ))}
        </dl>
      </HelpPopover>
    </div>
  );
}
