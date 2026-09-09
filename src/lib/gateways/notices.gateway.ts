import { noticesResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";
import type { NoticeWording } from "../notice-phrase";
import { defaultUiAuthorizationPolicy } from "../scope";
import type { SessionUser } from "./auth.gateway";
import type { DataOrigin, OriginatedData } from "./data-origin";

/**
 * O aviso como ele viaja (dono, 2026-09-08): o TIPO do evento e as PEÇAS da
 * frase — nunca a frase. Quem a compõe é `NoticePhrase`, no idioma de quem
 * lê; o servidor não sabe esse idioma e por isso não escreve mais o título.
 */
export interface Notice {
  id: string;
  eventType: string;
  wording: NoticeWording;
  link: string;
  occurredAt: string;
  readAt: string | null;
  professionalId: string | null;
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

export type NoticesViewer = Pick<SessionUser, "role" | "professionalId" | "memberships">;

export const DEMONSTRATION_TEAM_ID = "time-em-demonstracao";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Os avisos de demonstração. Dois deles falavam de evidência esperando revisão
 * e saíram com ela (dono, 2026-09-08, regra 17); no lugar entraram dois de
 * transferência de time — tipo de evento que o backend EMITE de verdade — para
 * a lista de demonstração não encolher e continuar exercitando o aviso que
 * aponta para a ficha de uma pessoa.
 *
 * Desde 2026-09-08 eles carregam PEÇAS, não títulos: a frase é montada na
 * tela, e a caixa de demonstração troca de idioma junto com o resto.
 *
 * A saudação de primeiro acesso (`welcome.first-access`) NÃO entra aqui de
 * propósito: ela nasce no login, no servidor, e a demonstração não tem login.
 */
const fixtureNotices = (now: number): Notice[] => [
  {
    id: "notice-team-transfer-carla-requested",
    eventType: "team-transfer.requested",
    wording: {
      subjectName: "Carla Souza",
      actorName: "Helena Prado",
      fromTeamName: "Plataforma",
      toTeamName: "Dados",
    },
    link: "/professionals/demo-carla-souza",
    occurredAt: new Date(now - 2 * HOUR_MS).toISOString(),
    readAt: null,
    professionalId: "demo-carla-souza",
    teamId: DEMONSTRATION_TEAM_ID,
  },
  {
    id: "notice-team-transfer-elisa-approved",
    eventType: "team-transfer.approved",
    wording: {
      subjectName: "Elisa Prado",
      actorName: "Helena Prado",
      fromTeamName: "Dados",
      toTeamName: "Plataforma",
    },
    link: "/professionals/demo-elisa-prado",
    occurredAt: new Date(now - 6 * HOUR_MS).toISOString(),
    readAt: null,
    professionalId: "demo-elisa-prado",
    teamId: DEMONSTRATION_TEAM_ID,
  },
  {
    id: "notice-assessment-diego-stalled",
    eventType: "assessment.stalled",
    wording: { subjectName: "Diego Rocha" },
    link: "/assessments",
    occurredAt: new Date(now - 1 * DAY_MS).toISOString(),
    readAt: null,
    professionalId: "demo-diego-rocha",
    teamId: DEMONSTRATION_TEAM_ID,
  },
  {
    id: "notice-assessment-ana-completed",
    eventType: "assessment.completed",
    wording: { subjectName: "Ana Martins" },
    link: "/assessments",
    occurredAt: new Date(now - 2 * DAY_MS).toISOString(),
    readAt: null,
    professionalId: "demo-ana-martins",
    teamId: DEMONSTRATION_TEAM_ID,
  },
  {
    id: "notice-mentoring-bruno-recorded",
    eventType: "mentoring.recorded",
    wording: { subjectName: "Bruno Almeida" },
    link: "/mentoring",
    occurredAt: new Date(now - 3 * DAY_MS).toISOString(),
    readAt: new Date(now - 2 * DAY_MS).toISOString(),
    professionalId: "demo-bruno-almeida",
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
    if (viewer.professionalId !== null && notice.professionalId === viewer.professionalId)
      return true;
    if (ledTeamIds.length === 0) return false;
    if (notice.teamId === DEMONSTRATION_TEAM_ID) return true;
    return notice.teamId !== null && ledTeamIds.includes(notice.teamId);
  }

  private teamAddressed(notice: Notice, ledTeamIds: string[]): string | null {
    if (notice.teamId !== DEMONSTRATION_TEAM_ID) return notice.teamId;
    return ledTeamIds[0] ?? notice.teamId;
  }

  /**
   * O ALCANCE PERGUNTA À POLÍTICA (achado da fatia AVISOS, 2026-09-08).
   *
   * Aqui morava uma lista de papéis escrita à mão — tech lead e gerente, os
   * dois nomes técnicos num vetor — e ela RESSUSCITAVA o alcance de dois
   * chapéus que a política matou de
   * propósito (papéis, adendo do dono de 2026-09-08, itens 3 e 4: "a conta de
   * dois chapéus morreu"). Um gerente com vínculo de tech lead num time via os
   * avisos daquele time, que a régua diz que ele não alcança.
   *
   * Isto é VISIBILIDADE, não ação oferecida: uma lista à mão aqui não some da
   * tela nem quebra nada, ela só mostra o que não devia. `teamsBoundAsOwnRole`
   * é a mesma pergunta que o resto da casa faz — os times em que a pessoa
   * exerce o PRÓPRIO papel.
   */
  private ledTeamIds(viewer: NoticesViewer): string[] {
    return [...defaultUiAuthorizationPolicy.teamsBoundAsOwnRole(viewer)];
  }
}
