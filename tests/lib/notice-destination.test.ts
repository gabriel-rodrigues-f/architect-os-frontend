import { describe, expect, it } from "vitest";

import type { Notice } from "@/lib/gateways/notices.gateway";
import { defaultNoticeDestination, NoticeDestination } from "@/lib/notice-destination";

/**
 * O DESTINO DE UM AVISO É DO CONTEXTO, não do texto do servidor.
 *
 * Até esta fatia toda linha ia para o `link` que o backend mandou, e o link
 * era o mesmo para todo mundo: `assessment.completed` de qualquer pessoa
 * levava a `/assessments` sem dizer de QUEM, e `mentoring.recorded` levava à
 * Mentoria da primeira pessoa da lista. Quem clicava caía na tela certa
 * olhando para outra pessoa.
 *
 * A tabela abaixo é a do dono (2026-09-08), e é ela que este teste guarda —
 * inclusive a reserva: sem contexto (`professionalId` nulo), o destino volta
 * a ser o `link` do servidor, nunca uma rota quebrada.
 */
function notice(overrides: Partial<Notice>): Notice {
  return {
    id: "notice-1",
    eventType: "assessment.completed",
    title: "Avaliação de Ana Martins foi concluída",
    link: "/link-do-servidor",
    occurredAt: "2026-08-28T09:00:00.000Z",
    readAt: null,
    professionalId: "ana",
    teamId: "time-da-ana",
    ...overrides,
  };
}

describe("NoticeDestination — a tabela inteira do dono", () => {
  const destino = new NoticeDestination();

  it("assessment.completed leva à avaliação DAQUELA pessoa", () => {
    expect(destino.of(notice({ eventType: "assessment.completed" }))).toBe(
      "/assessments?professionalId=ana",
    );
  });

  it("mentoring.recorded leva à Mentoria filtrada NAQUELA pessoa", () => {
    expect(destino.of(notice({ eventType: "mentoring.recorded" }))).toBe("/mentoring?menteeId=ana");
  });

  it("digest.daily leva à própria tela de Avisos", () => {
    expect(destino.of(notice({ eventType: "digest.daily" }))).toBe("/notices");
  });

  it("support.access-opened leva à ficha da pessoa", () => {
    expect(destino.of(notice({ eventType: "support.access-opened" }))).toBe("/professionals/ana");
  });

  it("os três team-transfer.* continuam no link do servidor — as pendências, como hoje", () => {
    for (const eventType of [
      "team-transfer.requested",
      "team-transfer.approved",
      "team-transfer.refused",
    ]) {
      expect(destino.of(notice({ eventType, link: "/team" })), eventType).toBe("/team");
    }
  });

  it("eventType desconhecido não inventa rota: cai no link do servidor", () => {
    expect(destino.of(notice({ eventType: "futuro.evento.qualquer" }))).toBe("/link-do-servidor");
  });
});

describe("sem contexto, o link do servidor é a reserva", () => {
  const destino = defaultNoticeDestination;

  it("os três tipos que dependem da pessoa voltam ao link quando professionalId é nulo", () => {
    for (const eventType of [
      "assessment.completed",
      "mentoring.recorded",
      "support.access-opened",
    ]) {
      expect(destino.of(notice({ eventType, professionalId: null })), eventType).toBe(
        "/link-do-servidor",
      );
    }
  });

  it("digest.daily não depende de contexto nenhum", () => {
    expect(destino.of(notice({ eventType: "digest.daily", professionalId: null }))).toBe(
      "/notices",
    );
  });

  it("o id da pessoa viaja escapado — não monta querystring por concatenação crua", () => {
    expect(destino.of(notice({ eventType: "assessment.completed", professionalId: "a b&c" }))).toBe(
      "/assessments?professionalId=a%20b%26c",
    );
  });
});
