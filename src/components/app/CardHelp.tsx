import { useI18n } from "@/lib/i18n";

import { HelpPopover } from "./HelpPopover";
import { HelpField } from "./PageHelp";

/**
 * O "?" que mora DENTRO de um card ou gráfico do Painel (dono, 2026-09-05:
 * "cada gráfico deve ter seu próprio interrogação dentro dele"). Dois campos,
 * sempre os mesmos: o que o número/gráfico mostra e como ler o que ele diz.
 * A ajuda de seção (`SectionHelp`) fala de configurar; esta fala de LER.
 */
export function CardHelp({ title, what, how }: { title: string; what: string; how: string }) {
  const { t } = useI18n();
  return (
    <HelpPopover label={t("cardHelp.ariaLabel", { card: title })} title={title} align="end">
      <HelpField label={t("cardHelp.what")} text={what} />
      <HelpField label={t("cardHelp.how")} text={how} />
    </HelpPopover>
  );
}

/**
 * Os cartões do Painel que TÊM chamador. Eram quinze declarados, com texto
 * escrito em duas línguas; dez deles falavam de cartões que já não existiam
 * na tela (`painel-executivo-analise-2026-09-09.md`, A.4). Ajuda de cartão
 * sem cartão é dicionário morto: saiu daqui e saiu dos dois catálogos.
 */
export const DASHBOARD_CARDS = [
  "activePlans",
  "cycleAssessment",
  "severity",
  "memberAssessment",
  "leadActions",
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
