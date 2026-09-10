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
    wording: { subjectName: "Ana Martins" },
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

  /**
   * FATIA PRAZOS, item 3 — o aviso de prazo do PDI chega à pessoa E a quem a
   * lidera, e o `link` do servidor é o genérico `/development-plans`. Quem
   * lidera três pessoas abriria o PDI da primeira da lista.
   */
  it("development-item.deadline-approaching leva ao PDI DAQUELA pessoa", () => {
    expect(destino.of(notice({ eventType: "development-item.deadline-approaching" }))).toBe(
      "/development-plans?professionalId=ana",
    );
  });

  it("sem a pessoa no contexto, o aviso de prazo volta ao link do servidor", () => {
    expect(
      destino.of(
        notice({ eventType: "development-item.deadline-approaching", professionalId: null }),
      ),
    ).toBe("/link-do-servidor");
  });

  /**
   * Dono (2026-09-09): *"recebi a notificação 'Resumo do dia: 2 novidades
   * sobre Débora Quintela'. Todavia, ao clicar, ele me leva para a tela de
   * notificações, não para a tela em que eu deveria ver as novidades sobre o
   * profissional."* O resumo é agrupado POR PESSOA (o backend agrupa o dia
   * por `subject_professional_id`) e junta naturezas diferentes — avaliação,
   * 1:1, prazo de PDI —, então o destino é a FICHA dela, onde todas cabem, e
   * não a tela de UMA delas.
   */
  it("digest.daily leva à ficha da pessoa de quem o resumo fala", () => {
    expect(destino.of(notice({ eventType: "digest.daily" }))).toBe("/professionals/ana");
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

  it("os tipos que dependem da pessoa voltam ao link quando professionalId é nulo", () => {
    for (const eventType of [
      "assessment.completed",
      "mentoring.recorded",
      "support.access-opened",
      "digest.daily",
    ]) {
      expect(destino.of(notice({ eventType, professionalId: null })), eventType).toBe(
        "/link-do-servidor",
      );
    }
  });

  it("resumo sem a pessoa no contexto volta ao link do servidor — a caixa de Avisos", () => {
    expect(
      destino.of(notice({ eventType: "digest.daily", professionalId: null, link: "/notices" })),
    ).toBe("/notices");
  });

  it("o id da pessoa viaja escapado — não monta querystring por concatenação crua", () => {
    expect(destino.of(notice({ eventType: "assessment.completed", professionalId: "a b&c" }))).toBe(
      "/assessments?professionalId=a%20b%26c",
    );
  });
});
