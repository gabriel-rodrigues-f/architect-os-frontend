import type {
  ArchitectEvolutionResult,
  CareerLevelTransition,
  DevelopmentPlanEvent,
  Evidence,
  MentoringSession,
} from "../domain";
import type { TeamTransitionRecord } from "../gateways/reports.gateway";
import type { MessageKey } from "../i18n";
import { defaultDateFormatter } from "../text";

export type StatementEntryKind =
  "transition" | "teamTransition" | "competencyStep" | "evidence" | "pdi" | "mentoring";

export interface StatementEntry {
  id: string;
  kind: StatementEntryKind;
  date: string;
  title: string;
  detail: string | null;
  link: string | null;
}

export interface StatementYearGroup {
  year: string;
  entries: StatementEntry[];
}

export type StatementCompetencyEvent = ArchitectEvolutionResult["events"][number];

export interface StatementSources {
  architectId: string;
  transitions: readonly CareerLevelTransition[];
  teamTransitions: readonly TeamTransitionRecord[];
  competencyEvents: readonly StatementCompetencyEvent[];
  evidences: readonly Evidence[];
  planEvents: readonly DevelopmentPlanEvent[];
  mentoringSessions: readonly MentoringSession[];
}

export interface StatementRange {
  from: string;
  to: string;
}

export type StatementPeriodPreset = "90" | "180" | "365" | "all";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const PLAN_EVENT_TITLE_KEY: Record<DevelopmentPlanEvent["eventType"], MessageKey> = {
  PlanApproved: "statement.entry.pdi.approved",
  PlanReturnedToDraft: "statement.entry.pdi.returnedToDraft",
  PlanCompleted: "statement.entry.pdi.completed",
  PlanReopened: "statement.entry.pdi.reopened",
};

const EVIDENCE_STATUS_KEY: Record<Evidence["status"], MessageKey> = {
  Pending: "evidence.status.pending",
  Accepted: "evidence.status.accepted",
  "Needs Improvement": "evidence.status.needsImprovement",
  Rejected: "evidence.status.rejected",
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const STATEMENT_EPOCH = "2000-01-01";

export class CareerStatementViewModel {
  constructor(
    private readonly translate: Translate,
    private readonly competencyName: (id: string) => string | undefined,
  ) {}

  entries(sources: StatementSources): StatementEntry[] {
    const profileLink = `/architects/${sources.architectId}`;
    const all: StatementEntry[] = [
      ...sources.transitions.map((transition) => ({
        id: `transition-${transition.id}`,
        kind: "transition" as const,
        date: transition.occurredAt,
        title: this.translate("statement.entry.transition", {
          from: transition.fromRole,
          to: transition.toRole,
        }),
        detail: transition.reason || null,
        link: profileLink,
      })),
      ...sources.teamTransitions.map((transition) =>
        this.teamTransitionEntry(transition, profileLink),
      ),
      ...sources.competencyEvents.map((event) =>
        this.competencyStepEntry(event, sources.architectId),
      ),
      ...sources.evidences.map((evidence) => ({
        id: `evidence-${evidence.id}`,
        kind: "evidence" as const,
        date: evidence.date,
        title: this.translate("statement.entry.evidence", { title: evidence.title }),
        detail: this.translate(EVIDENCE_STATUS_KEY[evidence.status]),
        link: profileLink,
      })),
      ...sources.planEvents.map((event) => ({
        id: `pdi-${event.id}`,
        kind: "pdi" as const,
        date: event.occurredAt,
        title: this.translate(PLAN_EVENT_TITLE_KEY[event.eventType]),
        detail: event.reason,
        link: `/development-plans?architectId=${sources.architectId}`,
      })),
      ...sources.mentoringSessions.map((session) => ({
        id: `mentoring-${session.id}`,
        kind: "mentoring" as const,
        date: session.date,
        title: this.translate("statement.entry.mentoring", { topic: session.topic }),
        detail: session.mentor || null,
        link: "/mentoring",
      })),
    ];
    return all.sort((left, right) => right.date.localeCompare(left.date));
  }

  teamTransitionEntry(transition: TeamTransitionRecord, link: string): StatementEntry {
    return {
      id: `team-transition-${transition.id}`,
      kind: "teamTransition",
      date: transition.occurredOn,
      title:
        transition.fromTeamName === null
          ? this.translate("statement.entry.teamTransitionFirst", { to: transition.toTeamName })
          : this.translate("statement.entry.teamTransition", {
              from: transition.fromTeamName,
              to: transition.toTeamName,
            }),
      detail: transition.reason || null,
      link,
    };
  }

  competencyStepEntry(event: StatementCompetencyEvent, architectId: string): StatementEntry {
    const competency = this.competencyName(event.competencyId) ?? event.competencyId;
    return {
      id: `step-${event.id}`,
      kind: "competencyStep",
      date: event.effectiveDate,
      title:
        event.fromLevel === null
          ? this.translate("statement.entry.competencyStepFirst", {
              competency,
              to: event.toLevel,
            })
          : this.translate("statement.entry.competencyStep", {
              competency,
              from: event.fromLevel,
              to: event.toLevel,
            }),
      detail: event.note,
      link: `/architects/${architectId}/evolution`,
    };
  }

  groupByYear(entries: readonly StatementEntry[]): StatementYearGroup[] {
    const groups: StatementYearGroup[] = [];
    for (const entry of entries) {
      const year = this.dayOf(entry.date).slice(0, 4);
      const group = groups.at(-1);
      if (group && group.year === year) group.entries.push(entry);
      else groups.push({ year, entries: [entry] });
    }
    return groups;
  }

  filterByKinds(
    entries: readonly StatementEntry[],
    kinds: readonly StatementEntryKind[],
  ): StatementEntry[] {
    if (kinds.length === 0) return [...entries];
    return entries.filter((entry) => kinds.includes(entry.kind));
  }

  filterByRange(entries: readonly StatementEntry[], range: StatementRange): StatementEntry[] {
    return entries.filter((entry) => {
      const day = this.dayOf(entry.date);
      return day >= range.from && day <= range.to;
    });
  }

  rangeForPreset(preset: StatementPeriodPreset): StatementRange {
    if (preset === "all") {
      return { from: STATEMENT_EPOCH, to: defaultDateFormatter.todayIso() };
    }
    return {
      from: defaultDateFormatter.daysAgoIso(Number(preset)),
      to: defaultDateFormatter.todayIso(),
    };
  }

  private dayOf(date: string): string {
    return DATE_ONLY.test(date) ? date : defaultDateFormatter.localDayIso(date);
  }
}
