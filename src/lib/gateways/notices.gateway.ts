import { noticesResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";

export interface Notice {
  id: string;
  eventType: string;
  title: string;
  link: string;
  occurredAt: string;
  readAt: string | null;
  architectId: string | null;
  teamId: string | null;
}

export interface NoticesPage {
  notices: Notice[];
  unreadCount: number;
}

export type NoticeStatusFilter = "unread" | "all";

export interface NoticesFilter {
  status: NoticeStatusFilter;
  limit?: number;
  before?: string;
}

export interface NoticesGateway {
  notices(filter: NoticesFilter): Promise<NoticesPage>;
  markNoticeRead(noticeId: string): Promise<void>;
  markAllNoticesRead(): Promise<void>;
}

export class HttpNoticesGateway implements NoticesGateway {
  constructor(private readonly client: ApiClient) {}

  notices = (filter: NoticesFilter): Promise<NoticesPage> => {
    const query = new URLSearchParams({ status: filter.status });
    if (filter.limit !== undefined) query.set("limit", String(filter.limit));
    if (filter.before !== undefined) query.set("before", filter.before);
    return this.client
      .request<NoticesPage>(`/notices?${query.toString()}`)
      .then((data) => noticesResponseSchema.parse(data));
  };

  markNoticeRead = (noticeId: string): Promise<void> =>
    this.client.post<void>(`/notices/${noticeId}/read`, {});

  markAllNoticesRead = (): Promise<void> => this.client.post<void>("/notices/read-all", {});
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const fixtureNotices = (now: number): Notice[] => [
  {
    id: "aviso-pdi-vencendo",
    eventType: "pdi.item.dueSoon",
    title: "Item de PDI de Ana Martins vence em 3 dias: Workshop de Clean Core",
    link: "/development-plans?architectId=ana",
    occurredAt: new Date(now - 2 * HOUR_MS).toISOString(),
    readAt: null,
    architectId: "ana",
    teamId: "time-integracao",
  },
  {
    id: "aviso-avaliacao-parada",
    eventType: "assessment.stalled",
    title: "Avaliação de Bruno Costa está parada há 14 dias",
    link: "/assessments",
    occurredAt: new Date(now - 6 * HOUR_MS).toISOString(),
    readAt: null,
    architectId: "bruno",
    teamId: "time-integracao",
  },
  {
    id: "aviso-evidencia-revisao",
    eventType: "evidence.awaitingReview",
    title: "Evidência de Ana Martins espera revisão: Certificação BTP",
    link: "/architects/ana",
    occurredAt: new Date(now - 1 * DAY_MS).toISOString(),
    readAt: null,
    architectId: "ana",
    teamId: "time-integracao",
  },
  {
    id: "aviso-avaliacao-concluida",
    eventType: "assessment.completed",
    title: "Avaliação de Carla Dias foi concluída",
    link: "/assessments",
    occurredAt: new Date(now - 2 * DAY_MS).toISOString(),
    readAt: new Date(now - 1 * DAY_MS).toISOString(),
    architectId: "carla",
    teamId: "time-arquitetura",
  },
  {
    id: "aviso-mentoria-registrada",
    eventType: "mentoring.recorded",
    title: "Mentoria registrada para Bruno Costa: Arquitetura de Eventos",
    link: "/mentoring",
    occurredAt: new Date(now - 3 * DAY_MS).toISOString(),
    readAt: new Date(now - 2 * DAY_MS).toISOString(),
    architectId: "bruno",
    teamId: "time-integracao",
  },
];

export class InMemoryNoticesGateway implements NoticesGateway {
  private readonly store: Notice[];

  constructor(seed: Notice[] = fixtureNotices(Date.now())) {
    this.store = seed.map((notice) => ({ ...notice }));
  }

  notices = (filter: NoticesFilter): Promise<NoticesPage> => {
    const ordered = [...this.store].sort((um, outro) =>
      outro.occurredAt.localeCompare(um.occurredAt),
    );
    const byStatus =
      filter.status === "unread" ? ordered.filter((notice) => notice.readAt === null) : ordered;
    const byCursor =
      filter.before === undefined
        ? byStatus
        : byStatus.filter((notice) => notice.occurredAt < filter.before!);
    const limited = filter.limit === undefined ? byCursor : byCursor.slice(0, filter.limit);
    return Promise.resolve({
      notices: limited.map((notice) => ({ ...notice })),
      unreadCount: this.store.filter((notice) => notice.readAt === null).length,
    });
  };

  markNoticeRead = (noticeId: string): Promise<void> => {
    const found = this.store.find((notice) => notice.id === noticeId);
    if (found && found.readAt === null) found.readAt = new Date().toISOString();
    return Promise.resolve();
  };

  markAllNoticesRead = (): Promise<void> => {
    const readAt = new Date().toISOString();
    for (const notice of this.store) {
      if (notice.readAt === null) notice.readAt = readAt;
    }
    return Promise.resolve();
  };
}
