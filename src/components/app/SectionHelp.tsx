import { useI18n } from "@/lib/i18n";
import { useSectionHelp, type SectionHelpKey } from "@/lib/page-help";

import { HelpPopover } from "./HelpPopover";
import { HelpField } from "./PageHelp";

export interface SectionHelpContent {
  title: string;
  purpose: string;
  how: string;
}

export function SectionHelp({ section }: { section: SectionHelpKey }) {
  const { t } = useI18n();
  const content = useSectionHelp(section);

  return (
    <HelpPopover label={t("sectionHelp.ariaLabel", { secao: content.title })} title={content.title}>
      <HelpField label={t("sectionHelp.purpose")} text={content.purpose} />
      <HelpField label={t("sectionHelp.how")} text={content.how} />
    </HelpPopover>
  );
}
