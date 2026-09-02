import type { PageHelpContent } from "@/components/app/PageHelp";
import { EmptyState, PageHeader } from "@/components/app/ui-bits";

export function OutOfReachScreen({
  title,
  help,
  reason,
  hint,
}: {
  title: string;
  help: { lead: PageHelpContent; member: PageHelpContent };
  reason: string;
  hint: string;
}) {
  return (
    <>
      <PageHeader title={title} help={help} />
      <EmptyState title={reason} hint={hint} />
    </>
  );
}
