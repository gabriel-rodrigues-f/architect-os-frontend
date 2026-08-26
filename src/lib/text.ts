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

export class DateFormatter {
  formatDate(iso: string | null | undefined, locale: string): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(DATE_ONLY.test(iso) ? { timeZone: "UTC" } : {}),
    }).format(date);
  }

  todayIso(): string {
    const now = new Date();
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    const dia = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${mes}-${dia}`;
  }

  isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  daysAgoIso(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${dia}`;
  }
}

export const defaultNameFormatter = new NameFormatter();
export const defaultDateFormatter = new DateFormatter();
