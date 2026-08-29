import type { Notice } from "../gateways/notices.gateway";
import { defaultDateFormatter } from "../text";

export interface NoticeDayGroup {
  day: string;
  notices: Notice[];
}

export class NoticesViewModel {
  groupByDay(notices: readonly Notice[]): NoticeDayGroup[] {
    const ordered = this.newestFirst(notices);
    const groups: NoticeDayGroup[] = [];
    for (const notice of ordered) {
      const day = defaultDateFormatter.localDayIso(notice.occurredAt);
      const group = groups.at(-1);
      if (group && group.day === day) group.notices.push(notice);
      else groups.push({ day, notices: [notice] });
    }
    return groups;
  }

  latest(notices: readonly Notice[], count: number): Notice[] {
    return this.newestFirst(notices).slice(0, count);
  }

  isUnread(notice: Pick<Notice, "readAt">): boolean {
    return notice.readAt === null;
  }

  private newestFirst(notices: readonly Notice[]): Notice[] {
    return [...notices].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }
}
