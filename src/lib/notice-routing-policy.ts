export type NoticeTone = "info" | "warning" | "success";

export type NoticeIcon = "deadline" | "stalled" | "review" | "completed" | "mentoring" | "generic";

interface NoticeDecoration {
  tone: NoticeTone;
  icon: NoticeIcon;
}

const DECORATION_BY_EVENT_TYPE: Record<string, NoticeDecoration> = {
  "pdi.item.dueSoon": { tone: "warning", icon: "deadline" },
  // Fatia PRAZOS: o aviso de 15 e 5 dias antes do prazo do compromisso do PDI.
  "development-item.deadline-approaching": { tone: "warning", icon: "deadline" },
  "assessment.stalled": { tone: "warning", icon: "stalled" },
  "evidence.awaitingReview": { tone: "info", icon: "review" },
  "assessment.completed": { tone: "success", icon: "completed" },
  "mentoring.recorded": { tone: "info", icon: "mentoring" },
  "support.access-opened": { tone: "warning", icon: "review" },
  "team-transfer.requested": { tone: "info", icon: "review" },
  "team-transfer.approved": { tone: "success", icon: "completed" },
  "team-transfer.refused": { tone: "warning", icon: "generic" },
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
