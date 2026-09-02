import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { useSectionHelp, type SectionHelpKey } from "@/lib/page-help";

import { HelpField, HelpTrigger } from "./PageHelp";

export interface SectionHelpContent {
  title: string;
  purpose: string;
  how: string;
}

export function SectionHelp({ section }: { section: SectionHelpKey }) {
  const { t } = useI18n();
  const content = useSectionHelp(section);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <HelpTrigger label={t("sectionHelp.ariaLabel", { secao: content.title })} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-sm">
        <p className="font-display font-semibold">{content.title}</p>
        <HelpField label={t("sectionHelp.purpose")} text={content.purpose} />
        <HelpField label={t("sectionHelp.how")} text={content.how} />
      </PopoverContent>
    </Popover>
  );
}
