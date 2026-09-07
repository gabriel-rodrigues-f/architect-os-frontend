import { HelpCircle } from "lucide-react";
import type { ComponentProps } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isLeadCapable } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { SectionHeading } from "@/components/app/SectionHeading";
import { SentenceBlock } from "@/components/app/SentenceBlock";

export interface PageHelpContent {
  title: string;
  what: string;
  comesFrom: string;
  nextStep: string;
}

export function HelpTrigger({
  label,
  ...rest
}: Omit<ComponentProps<"button">, "type" | "aria-label" | "aria-haspopup"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      className="grid h-6 w-6 shrink-0 place-content-center rounded-full text-muted-foreground transition-base hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      {...rest}
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  );
}

export function HelpField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <SectionHeading as="p" muted>
        {label}
      </SectionHeading>
      <p className="mt-0.5">
        <SentenceBlock text={text} />
      </p>
    </div>
  );
}

export function PageHelp({
  content,
}: {
  content: { lead: PageHelpContent; member: PageHelpContent };
}) {
  const user = useCurrentUser();
  const { t } = useI18n();
  const persona = isLeadCapable(user.role) ? content.lead : content.member;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <HelpTrigger label={t("pageHelp.ariaLabel", { tela: persona.title })} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-sm">
        <p className="font-display font-semibold">{persona.title}</p>
        <HelpField label={t("pageHelp.what")} text={persona.what} />
        <HelpField label={t("pageHelp.comesFrom")} text={persona.comesFrom} />
        <HelpField label={t("pageHelp.nextStep")} text={persona.nextStep} />
      </PopoverContent>
    </Popover>
  );
}
