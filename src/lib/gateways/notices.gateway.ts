import { noticesResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";
import type { SessionUser } from "./auth.gateway";
import type { DataOrigin, OriginatedData } from "./data-origin";

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

export interface NoticesPage extends OriginatedData {
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
  readonly dataOrigin: DataOrigin;
  notices(filter: NoticesFilter): Promise<NoticesPage>;
  markNoticeRead(noticeId: string): Promise<void>;
  markAllNoticesRead(): Promise<void>;
}

export class HttpNoticesGateway implements NoticesGateway {
  readonly dataOrigin: DataOrigin = "organization";

  constructor(private readonly client: ApiClient) {}

  notices = (filter: NoticesFilter): Promise<NoticesPage> => {
    const query = new URLSearchParams({ status: filter.status });
    if (filter.limit !== undefined) query.set("limit", String(filter.limit));
    if (filter.before !== undefined) query.set("before", filter.before);
    return this.client
      .request<unknown>(`/notices?${query.toString()}`)
      .then((data) => ({ ...noticesResponseSchema.parse(data), dataOrigin: this.dataOrigin }));
  };

  markNoticeRead = (noticeId: string): Promise<void> =>
    this.client.post<void>(`/notices/${noticeId}/read`, {});

  markAllNoticesRead = (): Promise<void> => this.client.post<void>("/notices/read-all", {});
}

export type NoticesViewer = Pick<SessionUser, "role" | "architectId" | "memberships">;

export const DEMONSTRATION_TEAM_ID = "time-em-demonstracao";

const LEADING_TEAM_ROLES = ["tech_lead", "manager"];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const fixtureNotices = (now: number): Notice[] => [
  {
    id: "notice-evidence-carla-awaiting-review",
    eventType: "evidence.awaitingReview",
    title: "Evidência de Carla Souza espera revisão: Desenho do data mart de logística",
    link: "/architects/demo-carla-souza",
    occurredAt: new Date(now - 2 * HOUR_MS).toISOString(),
    readAt: null,
    architectId: "demo-carla-souza",
    teamId: DEMONSTRATION_TEAM_ID,
  },
  {
    id: "notice-evidence-elisa-awaiting-review",
    eventType: "evidence.awaitingReview",
    title: "Evidência de Elisa Prado espera revisão: Contrato v2 do serviço de catálogo",
    link: "/architects/demo-elisa-prado",
    occurredAt: new Date(now - 6 * HOUR_MS).toISOString(),
    readAt: null,
    architectId: "demo-elisa-prado",
    teamId: DEMONSTRATION_TEAM_ID,
  },
  {
    id: "notice-assessment-diego-stalled",
    eventType: "assessment.stalled",
    title: "Avaliação de Diego Rocha segue em rascunho, sem envio",
    link: "/assessments",
    occurredAt: new Date(now - 1 * DAY_MS).toISOString(),
    readAt: null,
    architectId: "demo-diego-rocha",
    teamId: DEMONSTRATION_TEAM_ID,
  },
  {
    id: "notice-assessment-ana-completed",
    eventType: "assessment.completed",
    title: "Avaliação de Ana Martins foi concluída",
    link: "/assessments",
    occurredAt: new Date(now - 2 * DAY_MS).toISOString(),
    readAt: null,
    architectId: "demo-ana-martins",
    teamId: DEMONSTRATION_TEAM_ID,
  },
  {
    id: "notice-mentoring-bruno-recorded",
    eventType: "mentoring.recorded",
    title: "Mentoria registrada para Bruno Almeida: Modelagem do data mart de logística",
    link: "/mentoring",
    occurredAt: new Date(now - 3 * DAY_MS).toISOString(),
    readAt: new Date(now - 2 * DAY_MS).toISOString(),
    architectId: "demo-bruno-almeida",
    teamId: DEMONSTRATION_TEAM_ID,
  },
];

export class InMemoryNoticesGateway implements NoticesGateway {
  readonly dataOrigin: DataOrigin = "demonstration";

  private readonly store: Notice[];

  constructor(
    private readonly viewer: () => Promise<NoticesViewer>,
    seed: Notice[] = fixtureNotices(Date.now()),
  ) {
    this.store = seed.map((notice) => ({ ...notice }));
  }

  notices = async (filter: NoticesFilter): Promise<NoticesPage> => {
    const { ledTeamIds, notices: scoped } = await this.inbox();
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
      dataOrigin: this.dataOrigin,
      notices: limited.map((notice) => ({
        ...notice,
        teamId: this.teamAddressed(notice, ledTeamIds),
      })),
      unreadCount: scoped.filter((notice) => notice.readAt === null).length,
    };
  };

  markNoticeRead = async (noticeId: string): Promise<void> => {
    const { notices: scoped } = await this.inbox();
    const found = scoped.find((notice) => notice.id === noticeId);
    if (found && found.readAt === null) found.readAt = new Date().toISOString();
  };

  markAllNoticesRead = async (): Promise<void> => {
    const readAt = new Date().toISOString();
    const { notices: scoped } = await this.inbox();
    for (const notice of scoped) {
      if (notice.readAt === null) notice.readAt = readAt;
    }
  };

  private async inbox(): Promise<{ ledTeamIds: string[]; notices: Notice[] }> {
    const viewer = await this.viewer();
    const ledTeamIds = this.ledTeamIds(viewer);
    return {
      ledTeamIds,
      notices: this.store.filter((notice) => this.reaches(notice, viewer, ledTeamIds)),
    };
  }

  private reaches(notice: Notice, viewer: NoticesViewer, ledTeamIds: string[]): boolean {
    if (viewer.architectId !== null && notice.architectId === viewer.architectId) return true;
    if (ledTeamIds.length === 0) return false;
    if (notice.teamId === DEMONSTRATION_TEAM_ID) return true;
    return notice.teamId !== null && ledTeamIds.includes(notice.teamId);
  }

  private teamAddressed(notice: Notice, ledTeamIds: string[]): string | null {
    if (notice.teamId !== DEMONSTRATION_TEAM_ID) return notice.teamId;
    return ledTeamIds[0] ?? notice.teamId;
  }

  private ledTeamIds(viewer: NoticesViewer): string[] {
    return (viewer.memberships ?? [])
      .filter((membership) => LEADING_TEAM_ROLES.includes(membership.role))
      .map((membership) => membership.teamId);
  }
}
