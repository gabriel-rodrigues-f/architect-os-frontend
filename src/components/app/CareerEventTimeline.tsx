import { SectionGroup, semanticTone } from "@/components/app/ui-bits";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { StatementEntry, StatementEntryKind, StatementYearGroup } from "@/lib/view-models";

const KIND_LABEL_KEY: Record<StatementEntryKind, MessageKey> = {
  transition: "statement.kind.transition",
  competencyStep: "statement.kind.competencyStep",
  evidence: "statement.kind.evidence",
  pdi: "statement.kind.pdi",
  mentoring: "statement.kind.mentoring",
};

const KIND_CHIP: Record<StatementEntryKind, string> = {
  transition: "bg-primary/10 text-primary",
  competencyStep: semanticTone.success,
  evidence: "bg-secondary text-secondary-foreground",
  pdi: semanticTone.warning,
  mentoring: "bg-secondary text-secondary-foreground",
};

export function EventTypeBadge({ kind }: { kind: StatementEntryKind }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        KIND_CHIP[kind],
      )}
    >
      {t(KIND_LABEL_KEY[kind])}
    </span>
  );
}

export function CareerEventItem({
  entry,
  meta,
  onOpen,
}: {
  entry: StatementEntry;
  meta?: string | undefined;
  onOpen?: ((entry: StatementEntry) => void) | undefined;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-3 py-2.5">
      <EventTypeBadge kind={entry.kind} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{entry.title}</p>
        {meta !== undefined && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
        {entry.detail !== null && (
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</p>
        )}
      </div>
      {onOpen && entry.link !== null && (
        <button
          type="button"
          className="shrink-0 text-sm text-primary hover:underline print:hidden"
          onClick={() => onOpen(entry)}
        >
          {t("statement.entry.openOrigin")}
        </button>
      )}
    </div>
  );
}

export function CareerEventTimeline({
  groups,
  metaOf,
  onOpen,
}: {
  groups: readonly StatementYearGroup[];
  metaOf: (entry: StatementEntry) => string | undefined;
  onOpen?: ((entry: StatementEntry) => void) | undefined;
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <SectionGroup key={group.year} title={group.year}>
          <div className="surface-card p-4">
            <ul className="divide-y divide-border">
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <CareerEventItem entry={entry} meta={metaOf(entry)} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </div>
        </SectionGroup>
      ))}
    </div>
  );
}
