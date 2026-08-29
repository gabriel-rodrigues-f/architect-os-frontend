import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  GraduationCap,
} from "lucide-react";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import { semanticTone } from "@/components/app/ui-bits";
import type { Notice } from "@/lib/gateways/notices.gateway";
import { useI18n } from "@/lib/i18n";
import {
  defaultNoticeRoutingPolicy,
  type NoticeIcon,
  type NoticeTone,
} from "@/lib/notice-routing-policy";
import { defaultDateFormatter } from "@/lib/text";
import { cn } from "@/lib/utils";

const ICON_BY_KIND: Record<NoticeIcon, typeof Bell> = {
  deadline: CalendarClock,
  stalled: CircleAlert,
  review: FileSearch,
  completed: CheckCircle2,
  mentoring: GraduationCap,
  generic: Bell,
};

const CHIP_BY_TONE: Record<NoticeTone, string> = {
  info: "bg-secondary text-secondary-foreground",
  warning: semanticTone.warning,
  success: semanticTone.success,
};

export function NoticeList({
  notices,
  unreadOf,
  onOpen,
  itemWrapper = (element) => element,
}: {
  notices: readonly Notice[];
  unreadOf: (notice: Notice) => boolean;
  onOpen: (notice: Notice) => void;
  itemWrapper?: (element: ReactElement) => ReactNode;
}) {
  return (
    <ul className="divide-y divide-border">
      {notices.map((notice) => (
        <li key={notice.id}>
          {itemWrapper(<NoticeItem notice={notice} unread={unreadOf(notice)} onOpen={onOpen} />)}
        </li>
      ))}
    </ul>
  );
}

export function NoticeItem({
  notice,
  unread,
  onOpen,
  ...buttonProps
}: {
  notice: Notice;
  unread: boolean;
  onOpen: (notice: Notice) => void;
} & ComponentPropsWithoutRef<"button">) {
  const { t, locale } = useI18n();
  const Icon = ICON_BY_KIND[defaultNoticeRoutingPolicy.iconOf(notice.eventType)];
  const chip = CHIP_BY_TONE[defaultNoticeRoutingPolicy.toneOf(notice.eventType)];
  return (
    <button
      type="button"
      {...buttonProps}
      onClick={(event) => {
        buttonProps.onClick?.(event);
        onOpen(notice);
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-secondary/60",
        buttonProps.className,
      )}
    >
      <span className={cn("mt-0.5 rounded-md p-1.5", chip)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", unread && "font-medium")}>{notice.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {defaultDateFormatter.formatRelative(notice.occurredAt, locale)}
        </span>
      </span>
      {unread && (
        <span
          aria-label={t("notices.unread")}
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
        />
      )}
    </button>
  );
}
