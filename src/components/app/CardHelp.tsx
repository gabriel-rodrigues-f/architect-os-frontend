import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";

import { HelpField, HelpTrigger } from "./PageHelp";

/**
 * O "?" que mora DENTRO de um card ou gráfico do Painel (dono, 2026-09-05:
 * "cada gráfico deve ter seu próprio interrogação dentro dele"). Dois campos,
 * sempre os mesmos: o que o número/gráfico mostra e como ler o que ele diz.
 * A ajuda de seção (`SectionHelp`) fala de configurar; esta fala de LER.
 */
export function CardHelp({ title, what, how }: { title: string; what: string; how: string }) {
  const { t } = useI18n();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <HelpTrigger label={t("cardHelp.ariaLabel", { card: title })} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-sm">
        <p className="font-display font-semibold">{title}</p>
        <HelpField label={t("cardHelp.what")} text={what} />
        <HelpField label={t("cardHelp.how")} text={how} />
      </PopoverContent>
    </Popover>
  );
}

export const DASHBOARD_CARDS = [
  "architects",
  "activePlans",
  "criticalGaps",
  "goalsInProgress",
  "goalsDone",
  "mentoring",
  "paths",
  "priorities",
  "cycleAssessment",
  "severity",
  "memberAssessment",
  "memberEvidence",
  "leadPeople",
  "leadCalibration",
  "leadEvidence",
  "leadApproval",
] as const;
export type DashboardCard = (typeof DASHBOARD_CARDS)[number];

/** A ajuda de um card do Painel pelo prefixo das chaves (`dash.help.<card>`). */
export function DashboardCardHelp({ card }: { card: DashboardCard }) {
  const { t } = useI18n();
  return (
    <CardHelp
      title={t(`dash.help.${card}.title`)}
      what={t(`dash.help.${card}.what`)}
      how={t(`dash.help.${card}.how`)}
    />
  );
}
