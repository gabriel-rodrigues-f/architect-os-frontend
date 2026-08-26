import { HelpCircle } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isLeadCapable } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export interface PageHelpContent {
  title: string;
  what: string;
  comesFrom: string;
  nextStep: string;
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
        <button
          type="button"
          aria-label={t("pageHelp.ariaLabel", { tela: persona.title })}
          aria-haspopup="dialog"
          className="grid h-6 w-6 shrink-0 place-content-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-sm">
        <p className="font-display font-semibold">{persona.title}</p>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("pageHelp.what")}
          </p>
          <p className="mt-0.5">{persona.what}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("pageHelp.comesFrom")}
          </p>
          <p className="mt-0.5">{persona.comesFrom}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("pageHelp.nextStep")}
          </p>
          <p className="mt-0.5">{persona.nextStep}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
