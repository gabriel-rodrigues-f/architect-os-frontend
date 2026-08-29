import { describe, expect, it } from "vitest";

import { InMemoryNoticesGateway, type NoticesViewer } from "@/lib/gateways/notices.gateway";

/**
 * O backend do PRD-02 ainda não existe: a tela nasce contra esta PORTA com
 * mock tipado (spec §2). Ligar o real é trocar a implementação registrada no
 * container — zero mudança em tela/VM. O mock precisa se comportar como o
 * contrato: filtro por status, ordenação desc, unreadCount sempre do todo.
 *
 * Ressalvas da Fase A cobertas aqui:
 *  - o RECORTE por papel é do SERVIDOR, e o mock faz o papel do servidor:
 *    member vê SÓ os próprios avisos (nunca os do time), lead vê os do time,
 *    admin vê tudo — exatamente o destinatário confirmado no CONTRATO PRD-02;
 *  - mutante do unreadCount pinado: a contagem vem do ESCOPO INTEIRO do
 *    usuário, nunca da página filtrada/limitada — computá-la da lista após
 *    status/limit sobrevivia a todos os testes anteriores.
 */
const admin: NoticesViewer = { role: "admin", architectId: null };
const leadViewer: NoticesViewer = { role: "lead", architectId: null };
const memberAna: NoticesViewer = { role: "member", architectId: "ana" };
const memberCarla: NoticesViewer = { role: "member", architectId: "carla" };
const memberWithoutArchitect: NoticesViewer = { role: "member", architectId: null };

const gatewayFor = (viewer: NoticesViewer) =>
  new InMemoryNoticesGateway(() => Promise.resolve(viewer));

describe("InMemoryNoticesGateway", () => {
  it("nasce com fixtures dos 5 eventTypes do contrato", async () => {
    const page = await gatewayFor(admin).notices({ status: "all" });
    const types = new Set(page.notices.map((item) => item.eventType));
    expect(types).toEqual(
      new Set([
        "pdi.item.dueSoon",
        "assessment.stalled",
        "evidence.awaitingReview",
        "assessment.completed",
        "mentoring.recorded",
      ]),
    );
  });

  it("ordena do mais recente para o mais antigo e respeita o limit", async () => {
    const page = await gatewayFor(admin).notices({ status: "all", limit: 3 });
    expect(page.notices).toHaveLength(3);
    const dates = page.notices.map((item) => item.occurredAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("status=unread devolve só não-lidos, mas unreadCount é sempre do conjunto inteiro", async () => {
    const gateway = gatewayFor(admin);
    const all = await gateway.notices({ status: "all" });
    const unread = await gateway.notices({ status: "unread" });
    expect(unread.notices.every((item) => item.readAt === null)).toBe(true);
    expect(unread.unreadCount).toBe(all.unreadCount);
    expect(all.notices.length).toBeGreaterThan(unread.notices.length);
  });

  it("unreadCount ignora limit: contagem do escopo, nunca da página (mutante pinado)", async () => {
    const gateway = gatewayFor(admin);
    const full = await gateway.notices({ status: "unread" });
    const page = await gateway.notices({ status: "unread", limit: 1 });
    expect(full.unreadCount).toBeGreaterThan(1);
    expect(page.notices).toHaveLength(1);
    expect(page.unreadCount).toBe(full.unreadCount);
  });

  it("marcar um aviso como lido reflete na próxima leitura e derruba o unreadCount", async () => {
    const gateway = gatewayFor(admin);
    const before = await gateway.notices({ status: "unread" });
    const first = before.notices[0];
    expect(first).toBeDefined();
    await gateway.markNoticeRead(first!.id);
    const after = await gateway.notices({ status: "unread" });
    expect(after.unreadCount).toBe(before.unreadCount - 1);
    expect(after.notices.some((item) => item.id === first!.id)).toBe(false);
  });

  it("marcar todos como lidos zera o unreadCount", async () => {
    const gateway = gatewayFor(admin);
    await gateway.markAllNoticesRead();
    const page = await gateway.notices({ status: "all" });
    expect(page.unreadCount).toBe(0);
    expect(page.notices.every((item) => item.readAt !== null)).toBe(true);
  });
});

describe("InMemoryNoticesGateway — recorte por papel (o mock É o servidor)", () => {
  it("member vê SÓ os próprios avisos — nunca um aviso do time sobre outra pessoa", async () => {
    const page = await gatewayFor(memberAna).notices({ status: "all" });
    expect(page.notices.length).toBeGreaterThan(0);
    expect(page.notices.every((item) => item.architectId === "ana")).toBe(true);
  });

  it("unreadCount do member conta só o escopo dele, não o do time", async () => {
    const anaPage = await gatewayFor(memberAna).notices({ status: "all" });
    const adminPage = await gatewayFor(admin).notices({ status: "all" });
    expect(anaPage.unreadCount).toBe(anaPage.notices.filter((item) => item.readAt === null).length);
    expect(anaPage.unreadCount).toBeLessThan(adminPage.unreadCount);
  });

  it("member de outra pessoa não herda avisos alheios pelo time em comum", async () => {
    const page = await gatewayFor(memberCarla).notices({ status: "all" });
    expect(page.notices.every((item) => item.architectId === "carla")).toBe(true);
  });

  it("member sem arquiteto vinculado não vê aviso nenhum", async () => {
    const page = await gatewayFor(memberWithoutArchitect).notices({ status: "all" });
    expect(page.notices).toEqual([]);
    expect(page.unreadCount).toBe(0);
  });

  it("lead vê os avisos do time; admin vê tudo", async () => {
    const leadPage = await gatewayFor(leadViewer).notices({ status: "all" });
    const adminPage = await gatewayFor(admin).notices({ status: "all" });
    expect(leadPage.notices.every((item) => item.teamId !== null)).toBe(true);
    expect(adminPage.notices.length).toBeGreaterThanOrEqual(leadPage.notices.length);
  });

  it("marcar todos como lidos respeita o recorte: o member não zera os avisos do time", async () => {
    let viewer = memberAna;
    const gateway = new InMemoryNoticesGateway(() => Promise.resolve(viewer));
    await gateway.markAllNoticesRead();
    const anaAfter = await gateway.notices({ status: "all" });
    expect(anaAfter.unreadCount).toBe(0);
    viewer = admin;
    const adminAfter = await gateway.notices({ status: "all" });
    expect(adminAfter.unreadCount).toBeGreaterThan(0);
  });
});
