export type NoticeTone = "info" | "warning" | "success";

export type NoticeIcon = "deadline" | "stalled" | "review" | "completed" | "mentoring" | "generic";

interface NoticeDecoration {
  tone: NoticeTone;
  icon: NoticeIcon;
}

const DECORATION_BY_EVENT_TYPE: Record<string, NoticeDecoration> = {
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

  /**
   * Os tipos que esta política sabe decorar. Existe para a catraca
   * (`decoracao-de-aviso-tem-emissor.test.ts`) poder perguntar à política o
   * que ela promete, em vez de reler a tabela por fora: decoração de um tipo
   * que ninguém emite não quebra nada — cai no genérico e some do radar.
   */
  decoratedEventTypes(): string[] {
    return Object.keys(DECORATION_BY_EVENT_TYPE);
  }
}

export const defaultNoticeRoutingPolicy = new NoticeRoutingPolicy();
