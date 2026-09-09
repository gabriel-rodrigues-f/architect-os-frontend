import { describe, expect, it } from "vitest";

import {
  DEMONSTRATION_TEAM_ID,
  InMemoryNoticesGateway,
  type Notice,
  type NoticesViewer,
} from "@/lib/gateways/notices.gateway";

/**
 * O backend do PRD-02 ainda não existe: a tela nasce contra esta PORTA com
 * mock tipado (spec §2). Ligar o real é trocar a implementação registrada no
 * container — zero mudança em tela/VM. O mock precisa se comportar como o
 * contrato: filtro por status, ordenação desc, unreadCount sempre do todo.
 *
 * DESTINATÁRIOS (CONTRATO.md, PRD-02, confirmado pelo dono em 2026-08-29):
 * "tech lead vê os avisos do TIME (PDI vencendo, avaliação parada,
 * transferência pedida); a própria pessoa vê SÓ os dela". O administrador NÃO é
 * destinatário — ele não tem time nem profissional vinculado, e por isso a caixa
 * dele fica vazia até a fila de administrador existir (revisão do PO,
 * 2026-08-30, item "o que está travado no processo").
 *
 * ONDA 21 — o que mudou aqui e POR QUÊ (a inversão da Central de avisos).
 * Medido na aplicação viva, com as próprias mãos, antes de escrever código:
 *  - `GET /auth/me` de `techlead@synapse.local` devolve `professionalId: null` e
 *    `memberships: [{ teamId: "time-do-lead-<uuid>", role: "tech_lead" }]` —
 *    o uuid nasce da instalação e MUDA a cada seed;
 *  - as fixtures falavam `team-integration` / `team-architecture`, literais
 *    que não existem em base nenhuma: nunca casavam, e o sino do lead abria
 *    em "Nenhum aviso" mesmo com 3 pendências reais na fila dele;
 *  - `GET /auth/me` de `admin@synapse.local` devolve `memberships: []` e
 *    `professionalId: null`, e mesmo assim ele via os 5 avisos;
 *  - `SELECT count(*) FROM development_plan_items` = **0**. Nenhum plano tem
 *    item: o aviso "Workshop de Clean Core" citava algo que não existe.
 *
 * Por isso os testes desta suíte passaram a olhar pela lente do TECH LEAD, e
 * não mais pela do admin: a lente do admin era exatamente o defeito.
 */

const REAL_TEAM_ID = "time-do-lead-eef4b11a-31be-40ca-9b97-2889851e85c3";

const techLead: NoticesViewer = {
  role: "tech_lead",
  professionalId: null,
  memberships: [{ teamId: REAL_TEAM_ID, role: "tech_lead" }],
};
const gerente: NoticesViewer = {
  role: "manager",
  professionalId: null,
  memberships: [{ teamId: REAL_TEAM_ID, role: "manager" }],
};
const administrador: NoticesViewer = { role: "admin", professionalId: null, memberships: [] };
const techLeadSemVinculo: NoticesViewer = {
  role: "tech_lead",
  professionalId: null,
  memberships: [],
};
const memberAna: NoticesViewer = { role: "member", professionalId: "demo-ana-martins" };
const memberCarla: NoticesViewer = { role: "member", professionalId: "demo-carla-souza" };
const memberWithoutProfessional: NoticesViewer = { role: "member", professionalId: null };

const gatewayFor = (viewer: NoticesViewer) =>
  new InMemoryNoticesGateway(() => Promise.resolve(viewer));

describe("InMemoryNoticesGateway", () => {
  it("nasce com fixtures dos eventTypes do contrato que a base de demonstração sustenta", async () => {
    const page = await gatewayFor(techLead).notices({ status: "all" });
    const types = new Set(page.notices.map((item) => item.eventType));
    expect(types).toEqual(
      new Set([
        "team-transfer.requested",
        "team-transfer.approved",
        "assessment.stalled",
        "assessment.completed",
        "mentoring.recorded",
      ]),
    );
  });

  it("ordena do mais recente para o mais antigo e respeita o limit", async () => {
    const page = await gatewayFor(techLead).notices({ status: "all", limit: 3 });
    expect(page.notices).toHaveLength(3);
    const dates = page.notices.map((item) => item.occurredAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("status=unread devolve só não-lidos, mas unreadCount é sempre do conjunto inteiro", async () => {
    const gateway = gatewayFor(techLead);
    const all = await gateway.notices({ status: "all" });
    const unread = await gateway.notices({ status: "unread" });
    expect(unread.notices.every((item) => item.readAt === null)).toBe(true);
    expect(unread.unreadCount).toBe(all.unreadCount);
    expect(all.notices.length).toBeGreaterThan(unread.notices.length);
  });

  it("unreadCount ignora limit: contagem do escopo, nunca da página (mutante pinado)", async () => {
    const gateway = gatewayFor(techLead);
    const full = await gateway.notices({ status: "unread" });
    const page = await gateway.notices({ status: "unread", limit: 1 });
    expect(full.unreadCount).toBeGreaterThan(1);
    expect(page.notices).toHaveLength(1);
    expect(page.unreadCount).toBe(full.unreadCount);
  });

  it("marcar um aviso como lido reflete na próxima leitura e derruba o unreadCount", async () => {
    const gateway = gatewayFor(techLead);
    const before = await gateway.notices({ status: "unread" });
    const first = before.notices[0];
    expect(first).toBeDefined();
    await gateway.markNoticeRead(first!.id);
    const after = await gateway.notices({ status: "unread" });
    expect(after.unreadCount).toBe(before.unreadCount - 1);
    expect(after.notices.some((item) => item.id === first!.id)).toBe(false);
  });

  it("marcar todos como lidos zera o unreadCount", async () => {
    const gateway = gatewayFor(techLead);
    await gateway.markAllNoticesRead();
    const page = await gateway.notices({ status: "all" });
    expect(page.unreadCount).toBe(0);
    expect(page.notices.every((item) => item.readAt !== null)).toBe(true);
  });
});

describe("InMemoryNoticesGateway — recorte por destinatário (o mock É o servidor)", () => {
  it("member vê SÓ os próprios avisos — nunca um aviso do time sobre outra pessoa", async () => {
    const page = await gatewayFor(memberAna).notices({ status: "all" });
    expect(page.notices.length).toBeGreaterThan(0);
    expect(page.notices.every((item) => item.professionalId === "demo-ana-martins")).toBe(true);
  });

  it("unreadCount do member conta só o escopo dele, não o do time", async () => {
    const anaPage = await gatewayFor(memberAna).notices({ status: "all" });
    const leadPage = await gatewayFor(techLead).notices({ status: "all" });
    expect(anaPage.unreadCount).toBe(anaPage.notices.filter((item) => item.readAt === null).length);
    expect(anaPage.unreadCount).toBeLessThan(leadPage.unreadCount);
  });

  it("member de outra pessoa não herda avisos alheios pelo time em comum", async () => {
    const page = await gatewayFor(memberCarla).notices({ status: "all" });
    expect(page.notices.every((item) => item.professionalId === "demo-carla-souza")).toBe(true);
  });

  it("member sem profissional vinculado não vê aviso nenhum", async () => {
    const page = await gatewayFor(memberWithoutProfessional).notices({ status: "all" });
    expect(page.notices).toEqual([]);
    expect(page.unreadCount).toBe(0);
  });

  it("o escopo do member é menor que o do lead, e o unreadCount vem SÓ desse escopo", async () => {
    const memberPage = await gatewayFor(memberAna).notices({ status: "all" });
    const leadPage = await gatewayFor(techLead).notices({ status: "all" });
    expect(memberPage.notices.length).toBeLessThan(leadPage.notices.length);
  });

  it("gerente do time recebe o mesmo escopo de time que o tech lead", async () => {
    const gestorPage = await gatewayFor(gerente).notices({ status: "all" });
    const leadPage = await gatewayFor(techLead).notices({ status: "all" });
    expect(gestorPage.notices.map((item) => item.id)).toEqual(
      leadPage.notices.map((item) => item.id),
    );
  });

  it("vínculo de MEMBRO não concede o escopo do time — quem não lidera não lê o time", async () => {
    const apenasMembro: NoticesViewer = {
      role: "tech_lead",
      professionalId: null,
      memberships: [{ teamId: REAL_TEAM_ID, role: "member" }],
    };
    const page = await gatewayFor(apenasMembro).notices({ status: "all" });
    expect(page.notices).toEqual([]);
    expect(page.unreadCount).toBe(0);
  });

  it("marcar todos como lidos respeita o recorte: o member não zera os avisos do time", async () => {
    let viewer = memberAna;
    const gateway = new InMemoryNoticesGateway(() => Promise.resolve(viewer));
    await gateway.markAllNoticesRead();
    const anaAfter = await gateway.notices({ status: "all" });
    expect(anaAfter.unreadCount).toBe(0);
    viewer = techLead;
    const leadAfter = await gateway.notices({ status: "all" });
    expect(leadAfter.unreadCount).toBeGreaterThan(0);
  });
});

/**
 * Ressalva 2 da onda 17 — a fixture do sino falava uma língua que o seed real
 * não fala. Os `professionalId` eram apelidos inventados (`ana`, `bruno`,
 * `carla`) enquanto o seed de demonstração do backend cadastra
 * `demo-ana-martins` e companhia. Estes testes amarram a fixture ao seed: são
 * o alarme que dispara se alguém reintroduzir apelido inventado. Os ids vêm de
 * `backend/src/scripts/seed-demo.ts` — conferidos contra a base viva
 * (`SELECT id FROM professionals`), não adivinhados.
 */
describe("InMemoryNoticesGateway — a fixture fala os ids do seed real", () => {
  const SEED_PROFESSIONAL_IDS = [
    "demo-ana-martins",
    "demo-bruno-almeida",
    "demo-carla-souza",
    "demo-diego-rocha",
    "demo-elisa-prado",
  ];

  it("todo aviso aponta para um profissional que existe no seed de demonstração", async () => {
    const page = await gatewayFor(techLead).notices({ status: "all" });
    expect(page.notices.length).toBeGreaterThan(0);
    for (const notice of page.notices) {
      expect(SEED_PROFESSIONAL_IDS).toContain(notice.professionalId);
    }
  });

  it("o member do seed (dev@synapse.local → demo-ana-martins) vê os avisos DELE, não 'Nenhum aviso'", async () => {
    const page = await gatewayFor(memberAna).notices({ status: "all" });
    expect(page.notices.length).toBeGreaterThan(0);
    expect(page.notices.every((item) => item.professionalId === "demo-ana-martins")).toBe(true);
    expect(page.unreadCount).toBeGreaterThan(0);
  });

  it("o link de cada aviso aponta para o profissional do próprio aviso", async () => {
    const page = await gatewayFor(techLead).notices({ status: "all" });
    const withProfessionalInLink = page.notices.filter((item) => item.link.includes("demo-"));
    expect(withProfessionalInLink.length).toBeGreaterThan(0);
    for (const notice of withProfessionalInLink) {
      expect(notice.link).toContain(notice.professionalId!);
    }
  });
});

/**
 * Onda 21 — a inversão da Central de avisos, consertada pelo VÍNCULO REAL.
 *
 * O sentido da falha importa: antes ela era FECHADA (o lead não via nada).
 * Consertar não pode abri-la — o lead não pode passar a ver aviso de time
 * alheio. Por isso as asserções abaixo são de CONTEÚDO (o título que não pode
 * aparecer), nunca de referência: na onda 19 o QA pegou exatamente isso, um
 * `not.toBe` que passa enquanto o dado vaza.
 */
describe("InMemoryNoticesGateway — o recorte fala o vínculo REAL da sessão", () => {
  const NOME_ALHEIO = "Fulano do Time Vizinho";

  const avisoDeOutroTime: Notice = {
    id: "aviso-de-outro-time",
    eventType: "assessment.stalled",
    wording: { subjectName: NOME_ALHEIO },
    link: "/assessments",
    occurredAt: new Date().toISOString(),
    readAt: null,
    professionalId: "profissional-de-outro-time",
    teamId: "time-que-o-lead-nao-lidera",
  };

  const avisoDoTimeEmDemonstracao: Notice = {
    id: "aviso-do-time-do-lead",
    eventType: "team-transfer.requested",
    wording: { subjectName: "Carla Souza", toTeamName: "Dados" },
    link: "/professionals/demo-carla-souza",
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    readAt: null,
    professionalId: "demo-carla-souza",
    teamId: DEMONSTRATION_TEAM_ID,
  };

  it("o tech lead do seed — uuid de time real, sem profissional — vê os avisos do time dele", async () => {
    const page = await gatewayFor(techLead).notices({ status: "all" });
    expect(page.notices.length).toBeGreaterThan(0);
    expect(page.unreadCount).toBeGreaterThan(0);
  });

  it("o aviso entregue ao lead carrega o id REAL do time dele, não um literal de fixture", async () => {
    const page = await gatewayFor(techLead).notices({ status: "all" });
    expect(page.notices.every((item) => item.teamId === REAL_TEAM_ID)).toBe(true);
  });

  it("o administrador, sem time e sem profissional, não recebe aviso de trabalho de ninguém", async () => {
    const page = await gatewayFor(administrador).notices({ status: "all" });
    expect(page.notices).toEqual([]);
    expect(page.unreadCount).toBe(0);
  });

  it("nenhum aviso cita item de PDI — a base de demonstração não tem nenhum", async () => {
    const page = await gatewayFor(techLead).notices({ status: "all" });
    expect(page.notices.length).toBeGreaterThan(0);
    expect(
      page.notices.some((item) => item.eventType === "development-item.deadline-approaching"),
    ).toBe(false);
    expect(JSON.stringify(page.notices)).not.toContain("Workshop de Clean Core");
  });

  it("aviso de time que o lead NÃO lidera não vaza — asserção pelo CONTEÚDO", async () => {
    const gateway = new InMemoryNoticesGateway(
      () => Promise.resolve(techLead),
      [avisoDeOutroTime, avisoDoTimeEmDemonstracao],
    );
    const page = await gateway.notices({ status: "all" });
    const nomes = page.notices.map((item) => item.wording.subjectName);
    expect(nomes).toContain("Carla Souza");
    expect(nomes).not.toContain(NOME_ALHEIO);
    expect(page.unreadCount).toBe(1);
  });

  it("marcar todos como lidos não alcança o aviso do time alheio", async () => {
    const doTimeVizinho: NoticesViewer = {
      role: "tech_lead",
      professionalId: null,
      memberships: [{ teamId: "time-que-o-lead-nao-lidera", role: "tech_lead" }],
    };
    let viewer = techLead;
    const gateway = new InMemoryNoticesGateway(
      () => Promise.resolve(viewer),
      [avisoDeOutroTime, avisoDoTimeEmDemonstracao],
    );
    await gateway.markAllNoticesRead();
    viewer = doTimeVizinho;
    const page = await gateway.notices({ status: "unread" });
    expect(page.notices.map((item) => item.wording.subjectName)).toContain(NOME_ALHEIO);
  });

  it("o aviso que já traz o uuid real do time alcança o lead daquele time", async () => {
    const avisoComUuidReal: Notice = {
      ...avisoDeOutroTime,
      id: "aviso-uuid",
      teamId: REAL_TEAM_ID,
    };
    const gateway = new InMemoryNoticesGateway(() => Promise.resolve(techLead), [avisoComUuidReal]);
    const page = await gateway.notices({ status: "all" });
    expect(page.notices.map((item) => item.wording.subjectName)).toContain(NOME_ALHEIO);
  });

  it("quem não lidera time nenhum não herda o escopo do time pelo papel", async () => {
    const page = await gatewayFor(techLeadSemVinculo).notices({ status: "all" });
    expect(page.notices).toEqual([]);
    expect(page.unreadCount).toBe(0);
  });

  it("sessão sem o campo memberships (backend antigo) falha FECHADA, nunca aberta", async () => {
    const sessaoAntiga: NoticesViewer = { role: "tech_lead", professionalId: null };
    const page = await gatewayFor(sessaoAntiga).notices({ status: "all" });
    expect(page.notices).toEqual([]);
    expect(page.unreadCount).toBe(0);
  });
});

/**
 * Ressalva herdada: `markNoticeRead` recebe um id CRU vindo da tela. O código
 * já procura o aviso dentro do recorte de quem chama, mas nada prendia isso —
 * trocar a busca por uma varredura na base inteira passava com a suíte verde,
 * e aí um id conhecido (eles aparecem no `link` e no DOM) marca como lido o
 * aviso de um time que não é o meu. Sumiria da caixa do lead ao lado sem que
 * ninguém do time dele tivesse lido.
 *
 * `markAllNoticesRead` já tinha essa rede; a de um aviso só, não. As
 * asserções são de CONTEÚDO — o título que precisa continuar não lido na
 * caixa do vizinho —, nunca de referência.
 */
describe("InMemoryNoticesGateway — marcar UM aviso como lido respeita o recorte", () => {
  const NOME_ALHEIO = "Fulano do Time Vizinho";
  const ID_ALHEIO = "aviso-de-outro-time";

  const avisoDeOutroTime: Notice = {
    id: ID_ALHEIO,
    eventType: "assessment.stalled",
    wording: { subjectName: NOME_ALHEIO },
    link: "/assessments",
    occurredAt: new Date().toISOString(),
    readAt: null,
    professionalId: "profissional-de-outro-time",
    teamId: "time-que-o-lead-nao-lidera",
  };

  const avisoDoTimeEmDemonstracao: Notice = {
    id: "aviso-do-time-do-lead",
    eventType: "team-transfer.requested",
    wording: { subjectName: "Carla Souza", toTeamName: "Dados" },
    link: "/professionals/demo-carla-souza",
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    readAt: null,
    professionalId: "demo-carla-souza",
    teamId: DEMONSTRATION_TEAM_ID,
  };

  const doTimeVizinho: NoticesViewer = {
    role: "tech_lead",
    professionalId: null,
    memberships: [{ teamId: "time-que-o-lead-nao-lidera", role: "tech_lead" }],
  };

  const comDoisTimes = () => {
    let viewer = techLead;
    const gateway = new InMemoryNoticesGateway(
      () => Promise.resolve(viewer),
      [avisoDeOutroTime, avisoDoTimeEmDemonstracao],
    );
    return { gateway, olharComo: (proximo: NoticesViewer) => (viewer = proximo) };
  };

  it("o lead não marca como lido o aviso de um time que não lidera, mesmo sabendo o id", async () => {
    const { gateway, olharComo } = comDoisTimes();
    await gateway.markNoticeRead(ID_ALHEIO);
    olharComo(doTimeVizinho);
    const page = await gateway.notices({ status: "unread" });
    expect(page.notices.map((item) => item.wording.subjectName)).toContain(NOME_ALHEIO);
  });

  it("o member não marca como lido o aviso do time — só alcança os próprios", async () => {
    const gateway = new InMemoryNoticesGateway(() => Promise.resolve(memberAna));
    const doTime = (await gatewayFor(techLead).notices({ status: "unread" })).notices.find(
      (item) => item.professionalId !== "demo-ana-martins",
    );
    expect(doTime).toBeDefined();
    await gateway.markNoticeRead(doTime!.id);
    const leadDepois = await gatewayFor(techLead).notices({ status: "unread" });
    expect(leadDepois.notices.map((item) => item.id)).toContain(doTime!.id);
  });

  it("dentro do recorte, marcar um aviso continua funcionando — a rede não é vácuo", async () => {
    const { gateway } = comDoisTimes();
    await gateway.markNoticeRead(avisoDoTimeEmDemonstracao.id);
    const page = await gateway.notices({ status: "unread" });
    expect(page.notices.map((item) => item.wording.subjectName)).not.toContain("Carla Souza");
  });

  it("id que não existe em base nenhuma não derruba nem inventa leitura", async () => {
    const { gateway } = comDoisTimes();
    await gateway.markNoticeRead("id-que-nao-existe");
    const page = await gateway.notices({ status: "unread" });
    expect(page.unreadCount).toBe(1);
  });
});

/**
 * O ALCANCE DE DOIS CHAPÉUS, QUE A POLÍTICA MATOU (achado da fatia AVISOS).
 *
 * `notices.gateway.ts` tinha uma lista de papéis escrita à mão —
 * `["tech_lead", "manager"]` — e ela decidia de quais times a pessoa vê aviso.
 * A lista olhava o VÍNCULO e ignorava o PAPEL de quem está lendo, e isso
 * ressuscitava, só na visibilidade, a conta de dois chapéus que o dono matou
 * em 2026-09-08 (papéis, adendo, itens 3 e 4: "um time pode ter mais de um
 * tech lead, mas nunca um tech lead pode estar em mais de um time"; o alcance
 * de quem lidera são os times do PRÓPRIO papel — `scopeGrantingTeamsOf`).
 *
 * O caso concreto: um GERENTE que ficou com um vínculo de tech lead num time
 * onde não é gerente. A régua diz que ele não alcança aquele time; a lista à
 * mão o deixava ler os avisos de lá.
 *
 * A asserção é de CONTEÚDO — o nome que não pode aparecer —, e não de
 * referência: na onda 19 o QA pegou exatamente um `not.toBe` que passava
 * enquanto o dado vazava.
 */
describe("InMemoryNoticesGateway — a visibilidade pergunta à política, não a uma lista", () => {
  const TIME_DO_OUTRO_CHAPEU = "time-onde-ele-e-tech-lead";
  const NOME_DE_LA = "Pessoa do time do outro chapeu";

  const avisoDeLa: Notice = {
    id: "aviso-do-outro-chapeu",
    eventType: "assessment.stalled",
    wording: { subjectName: NOME_DE_LA },
    link: "/assessments",
    occurredAt: new Date().toISOString(),
    readAt: null,
    professionalId: "profissional-do-outro-chapeu",
    teamId: TIME_DO_OUTRO_CHAPEU,
  };

  /** Gerente de um time, e com um vínculo de TECH LEAD sobrando noutro. */
  const gerenteComVinculoDeTechLead: NoticesViewer = {
    role: "manager",
    professionalId: null,
    memberships: [
      { teamId: REAL_TEAM_ID, role: "manager" },
      { teamId: TIME_DO_OUTRO_CHAPEU, role: "tech_lead" },
    ],
  };

  it("o gerente NÃO lê os avisos do time onde o vínculo dele é de tech lead", async () => {
    const gateway = new InMemoryNoticesGateway(
      () => Promise.resolve(gerenteComVinculoDeTechLead),
      [avisoDeLa],
    );

    const page = await gateway.notices({ status: "all" });

    expect(page.notices.map((item) => item.wording.subjectName)).not.toContain(NOME_DE_LA);
    expect(page.unreadCount).toBe(0);
  });

  it("e nem o marca como lido — o alcance é o mesmo nas duas pontas", async () => {
    let viewer: NoticesViewer = gerenteComVinculoDeTechLead;
    const gateway = new InMemoryNoticesGateway(() => Promise.resolve(viewer), [avisoDeLa]);

    await gateway.markNoticeRead(avisoDeLa.id);
    await gateway.markAllNoticesRead();

    viewer = {
      role: "tech_lead",
      professionalId: null,
      memberships: [{ teamId: TIME_DO_OUTRO_CHAPEU, role: "tech_lead" }],
    };
    const page = await gateway.notices({ status: "unread" });
    expect(page.notices.map((item) => item.wording.subjectName)).toContain(NOME_DE_LA);
  });

  /** O tech lead daquele time continua lendo — o conserto fecha, não abre. */
  it("o tech lead DAQUELE time continua alcançando o aviso de lá", async () => {
    const daquele: NoticesViewer = {
      role: "tech_lead",
      professionalId: null,
      memberships: [{ teamId: TIME_DO_OUTRO_CHAPEU, role: "tech_lead" }],
    };
    const gateway = new InMemoryNoticesGateway(() => Promise.resolve(daquele), [avisoDeLa]);

    const page = await gateway.notices({ status: "all" });

    expect(page.notices.map((item) => item.wording.subjectName)).toContain(NOME_DE_LA);
  });
});
