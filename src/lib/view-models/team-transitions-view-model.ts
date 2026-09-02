import { UserFacingError } from "../api-errors";
import type { SessionUser } from "../gateways/auth.gateway";
import type {
  CalendarPeriod,
  LevelTransitionPair,
  TeamTransitionsRow,
} from "../gateways/team-transitions.gateway";
import type { UiAuthorizationPolicy } from "../scope";
import { DateFormatter } from "../text";

export class TeamTransitionsPeriod {
  private static readonly DAY = /^\d{4}-\d{2}-\d{2}$/;

  static lastMonths(months: number, today: Date): CalendarPeriod {
    const dates = new DateFormatter();
    const start = new Date(today);
    start.setMonth(start.getMonth() - months);
    return { from: dates.localDayIso(start), to: dates.localDayIso(today) };
  }

  static isValid(period: CalendarPeriod): boolean {
    return (
      TeamTransitionsPeriod.DAY.test(period.from) &&
      TeamTransitionsPeriod.DAY.test(period.to) &&
      period.from <= period.to
    );
  }
}

export class TeamTransitionsViewModel {
  static readonly DEFAULT_MONTHS = 12;

  constructor(private readonly policy: UiAuthorizationPolicy) {}

  canCompare(user: SessionUser): boolean {
    return this.policy.canConfigureAnyTeamRules(user);
  }

  defaultPeriod(today: Date = new Date()): CalendarPeriod {
    return TeamTransitionsPeriod.lastMonths(TeamTransitionsViewModel.DEFAULT_MONTHS, today);
  }

  periodIsValid(period: CalendarPeriod): boolean {
    return TeamTransitionsPeriod.isValid(period);
  }

  queryKey(period: CalendarPeriod): readonly ["team-transitions", string, string] {
    return ["team-transitions", period.from, period.to];
  }

  ranked(rows: readonly TeamTransitionsRow[]): TeamTransitionsRow[] {
    return [...rows].sort(
      (first, second) =>
        second.transitions - first.transitions ||
        first.teamName.localeCompare(second.teamName, "pt-BR", { sensitivity: "base" }),
    );
  }

  pairsOf(row: TeamTransitionsRow): LevelTransitionPair[] {
    return row.pairs.filter((pair) => pair.transitions > 0);
  }

  rateOf(row: TeamTransitionsRow, locale: string): string | null {
    return row.transitionsPerActiveArchitect === null
      ? null
      : this.decimal(locale, 2).format(row.transitionsPerActiveArchitect);
  }

  averageDaysOf(row: TeamTransitionsRow, locale: string): string | null {
    return row.averageDaysInOriginLevel === null
      ? null
      : this.decimal(locale, 0).format(row.averageDaysInOriginLevel);
  }

  readingFailureOf(error: unknown): string | null {
    return error instanceof UserFacingError ? error.message : null;
  }

  private decimal(locale: string, fractionDigits: number): Intl.NumberFormat {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits });
  }
}
