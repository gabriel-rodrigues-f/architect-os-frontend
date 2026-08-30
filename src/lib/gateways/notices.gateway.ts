import { noticesResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";
import type { SessionUser } from "./auth.gateway";

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

export type NoticesViewer = Pick<SessionUser, "role" | "architectId">;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const fixtureNotices = (now: number): Notice[] => [
  {
    id: "notice-pdi-due-soon",
    eventType: "pdi.item.dueSoon",
    title: "Item de PDI de Ana Martins vence em 3 dias: Workshop de Clean Core",
    link: "/development-plans?architectId=ana",
    occurredAt: new Date(now - 2 * HOUR_MS).toISOString(),
    readAt: null,
    architectId: "ana",
    teamId: "team-integration",
  },
  {
    id: "notice-assessment-stalled",
    eventType: "assessment.stalled",
    title: "Avaliação de Bruno Costa está parada há 14 dias",
    link: "/assessments",
    occurredAt: new Date(now - 6 * HOUR_MS).toISOString(),
    readAt: null,
    architectId: "bruno",
    teamId: "team-integration",
  },
  {
    id: "notice-evidence-awaiting-review",
    eventType: "evidence.awaitingReview",
    title: "Evidência de Ana Martins espera revisão: Certificação BTP",
    link: "/architects/ana",
    occurredAt: new Date(now - 1 * DAY_MS).toISOString(),
    readAt: null,
    architectId: "ana",
    teamId: "team-integration",
  },
  {
    id: "notice-assessment-completed",
    eventType: "assessment.completed",
    title: "Avaliação de Carla Dias foi concluída",
    link: "/assessments",
    occurredAt: new Date(now - 2 * DAY_MS).toISOString(),
    readAt: new Date(now - 1 * DAY_MS).toISOString(),
    architectId: "carla",
    teamId: "team-architecture",
  },
  {
    id: "notice-mentoring-recorded",
    eventType: "mentoring.recorded",
    title: "Mentoria registrada para Bruno Costa: Arquitetura de Eventos",
    link: "/mentoring",
    occurredAt: new Date(now - 3 * DAY_MS).toISOString(),
    readAt: new Date(now - 2 * DAY_MS).toISOString(),
    architectId: "bruno",
    teamId: "team-integration",
  },
];

export class InMemoryNoticesGateway implements NoticesGateway {
  private readonly store: Notice[];
  private readonly architectTeams: Record<string, string>;

  constructor(
    private readonly viewer: () => Promise<NoticesViewer>,
    seed: Notice[] = fixtureNotices(Date.now()),
    architectTeams?: Record<string, string>,
  ) {
    this.store = seed.map((notice) => ({ ...notice }));
    this.architectTeams = architectTeams ?? InMemoryNoticesGateway.fixtureArchitectTeams();
  }

  notices = async (filter: NoticesFilter): Promise<NoticesPage> => {
    const scoped = await this.scopedNotices();
    const ordered = [...scoped].sort((left, right) =>
      right.occurredAt.localeCompare(left.occurredAt),
    );
    const byStatus =
      filter.status === "unread" ? ordered.filter((notice) => notice.readAt === null) : ordered;
    const byCursor =
      filter.before === undefined
        ? byStatus
        : byStatus.filter((notice) => notice.occurredAt < filter.before!);
    const limited = filter.limit === undefined ? byCursor : byCursor.slice(0, filter.limit);
    return {
      notices: limited.map((notice) => ({ ...notice })),
      unreadCount: scoped.filter((notice) => notice.readAt === null).length,
    };
  };

  markNoticeRead = async (noticeId: string): Promise<void> => {
    const scoped = await this.scopedNotices();
    const found = scoped.find((notice) => notice.id === noticeId);
    if (found && found.readAt === null) found.readAt = new Date().toISOString();
  };

  markAllNoticesRead = async (): Promise<void> => {
    const readAt = new Date().toISOString();
    for (const notice of await this.scopedNotices()) {
      if (notice.readAt === null) notice.readAt = readAt;
    }
  };

  private async scopedNotices(): Promise<Notice[]> {
    const viewer = await this.viewer();
    if (viewer.role === "admin") return this.store;
    if (viewer.role === "lead") {
      const teamId = this.viewerTeamId(viewer);
      return this.store.filter(
        (notice) =>
          (teamId !== null && notice.teamId === teamId) ||
          (viewer.architectId !== null && notice.architectId === viewer.architectId),
      );
    }
    if (viewer.architectId === null) return [];
    return this.store.filter((notice) => notice.architectId === viewer.architectId);
  }

  private viewerTeamId(viewer: NoticesViewer): string | null {
    if (viewer.architectId === null) return null;
    return this.architectTeams[viewer.architectId] ?? null;
  }

  private static fixtureArchitectTeams(): Record<string, string> {
    return { ana: "team-integration", bruno: "team-integration", carla: "team-architecture" };
  }
}
