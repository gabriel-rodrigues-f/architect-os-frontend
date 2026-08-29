export type NoticeTone = "info" | "warning" | "success";

export type NoticeIcon = "deadline" | "stalled" | "review" | "completed" | "mentoring" | "generic";

interface NoticeDecoration {
  tone: NoticeTone;
  icon: NoticeIcon;
}

const DECORATION_BY_EVENT_TYPE: Record<string, NoticeDecoration> = {
  "pdi.item.dueSoon": { tone: "warning", icon: "deadline" },
  "assessment.stalled": { tone: "warning", icon: "stalled" },
  "evidence.awaitingReview": { tone: "info", icon: "review" },
  "assessment.completed": { tone: "success", icon: "completed" },
  "mentoring.recorded": { tone: "info", icon: "mentoring" },
};

const FALLBACK: NoticeDecoration = { tone: "info", icon: "generic" };

export class NoticeRoutingPolicy {
  toneOf(eventType: string): NoticeTone {
    return (DECORATION_BY_EVENT_TYPE[eventType] ?? FALLBACK).tone;
  }

  iconOf(eventType: string): NoticeIcon {
    return (DECORATION_BY_EVENT_TYPE[eventType] ?? FALLBACK).icon;
  }
}

export const defaultNoticeRoutingPolicy = new NoticeRoutingPolicy();
