import { SectionGroup, semanticTone } from "@/components/app/ui-bits";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { StatementEntry, StatementEntryKind, StatementYearGroup } from "@/lib/view-models";

const KIND_LABEL_KEY: Record<StatementEntryKind, MessageKey> = {
  transition: "statement.kind.transition",
  teamTransition: "statement.kind.teamTransition",
  competencyStep: "statement.kind.competencyStep",
  evidence: "statement.kind.evidence",
  pdi: "statement.kind.pdi",
  mentoring: "statement.kind.mentoring",
};

/**
 * Lido em FUNÇÃO, e não numa constante de módulo.
 *
 * `semanticTone` mora em `ui-bits`, e o grafo de importação da casa tem ciclo:
 * na ordem de inicialização do pacote de SSR de produção, este módulo chegava a
 * rodar ANTES de `ui-bits` terminar, e o mapa nascia lendo `undefined.warning`.
 * O sintoma não aparecia em nenhum teste (jsdom importa noutra ordem) nem no
 * `build` — só no pod, como 500 na sonda de prontidão e canário abortado.
 *
 * Chamar na hora de desenhar tira a dependência de ORDEM: quando o componente
 * renderiza, todo módulo já terminou de carregar.
 */
class CareerEventChips {
  static byKind(): Record<StatementEntryKind, string> {
    return {
      transition: "bg-primary/10 text-primary",
      teamTransition: "bg-primary/10 text-primary",
      competencyStep: semanticTone.success,
      evidence: "bg-secondary text-secondary-foreground",
      pdi: semanticTone.warning,
      mentoring: "bg-secondary text-secondary-foreground",
    };
  }
}

export function EventTypeBadge({ kind }: { kind: StatementEntryKind }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        CareerEventChips.byKind()[kind],
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
