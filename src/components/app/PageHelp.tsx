import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { HelpPopover } from "@/components/app/HelpPopover";
import { SectionHeading } from "@/components/app/SectionHeading";
import { SentenceBlock } from "@/components/app/SentenceBlock";

export interface PageHelpContent {
  title: string;
  what: string;
  comesFrom: string;
  nextStep: string;
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
  const persona = defaultUiAuthorizationPolicy.isLeadership(user) ? content.lead : content.member;

  return (
    <HelpPopover label={t("pageHelp.ariaLabel", { tela: persona.title })} title={persona.title}>
      <HelpField label={t("pageHelp.what")} text={persona.what} />
      <HelpField label={t("pageHelp.comesFrom")} text={persona.comesFrom} />
      <HelpField label={t("pageHelp.nextStep")} text={persona.nextStep} />
    </HelpPopover>
  );
}
