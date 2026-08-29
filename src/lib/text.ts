export class NameFormatter {
  slug(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  byName = <T extends { name: string }>(a: T, b: T): number =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

  matchesSearch(name: string, term: string): boolean {
    return term === "" || name.toLowerCase().includes(term);
  }

  truncateNames(names: readonly string[], max = 5): { shown: string[]; remaining: number } {
    if (names.length <= max) return { shown: [...names], remaining: 0 };
    return { shown: names.slice(0, max), remaining: names.length - max };
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

export function dateTimeFormatFor(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  const cached = dateTimeFormatters.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, options);
  dateTimeFormatters.set(key, formatter);
  return formatter;
}

const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const DAY_MONTH_YEAR_UTC: Intl.DateTimeFormatOptions = { ...DAY_MONTH_YEAR, timeZone: "UTC" };

export class DateFormatter {
  formatDate(iso: string | null | undefined, locale: string): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return dateTimeFormatFor(
      locale,
      DATE_ONLY.test(iso) ? DAY_MONTH_YEAR_UTC : DAY_MONTH_YEAR,
    ).format(date);
  }

  todayIso(): string {
    return this.localDayIso(new Date());
  }

  localDayIso(moment: Date | string): string {
    const date = typeof moment === "string" ? new Date(moment) : moment;
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  formatRelative(
    iso: string | null | undefined,
    locale: string,
    now: Date = new Date(),
  ): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const elapsedMs = now.getTime() - date.getTime();
    const elapsedSeconds = Math.round(elapsedMs / 1000);
    if (Math.abs(elapsedSeconds) > THIRTY_DAYS_SECONDS) return this.formatDate(iso, locale);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
    const unit = RELATIVE_UNITS.find((candidate) => Math.abs(elapsedSeconds) < candidate.limit);
    if (!unit) return this.formatDate(iso, locale);
    return rtf.format(-Math.round(elapsedSeconds / unit.seconds), unit.name);
  }

  daysAgoIso(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.localDayIso(date);
  }
}

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

const RELATIVE_UNITS: { name: Intl.RelativeTimeFormatUnit; seconds: number; limit: number }[] = [
  { name: "second", seconds: 1, limit: 60 },
  { name: "minute", seconds: 60, limit: 60 * 60 },
  { name: "hour", seconds: 60 * 60, limit: 24 * 60 * 60 },
  { name: "day", seconds: 24 * 60 * 60, limit: Number.POSITIVE_INFINITY },
];

export const defaultNameFormatter = new NameFormatter();
export const defaultDateFormatter = new DateFormatter();
