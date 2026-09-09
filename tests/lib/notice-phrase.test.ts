import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import pt from "@/locales/pt.json";
import { interpolate, type MessageKey } from "@/lib/i18n";
import { NoticePhrase, type NoticeWording } from "@/lib/notice-phrase";

/**
 * A FRASE DO AVISO É COMPOSTA NA TELA (dono, 2026-09-08).
 *
 * Ele mandou a captura da tela em inglês mostrando "Mentoria registrada
 * para…" e escreveu: "as notificações não estão sendo traduzidas para inglês
 * no idioma inglês". A causa era de contrato: o título vinha pronto, em
 * português, do backend (`NoticeHeadline`), e a tela só o exibia — nenhum
 * idioma alcançava aquele texto.
 *
 * Agora o servidor manda o TIPO e as PEÇAS, e quem monta a sentença é este
 * objeto. Por isso os testes daqui rodam a MESMA frase nos dois dicionários:
 * uma chave que exista só em português volta a ser o defeito de origem.
 */
const dicionario =
  (arquivo: Record<string, string>) =>
  (key: MessageKey, params?: Record<string, string | number>) =>
    interpolate(arquivo[key] ?? key, params);

const emPortugues = dicionario(pt as unknown as Record<string, string>);
const emIngles = dicionario(en as unknown as Record<string, string>);

const frase = new NoticePhrase();

const aviso = (eventType: string, wording: NoticeWording = {}) => ({ eventType, wording });

describe("a frase do aviso fala o idioma de quem lê", () => {
  it("avaliação concluída: com nome, nos dois idiomas", () => {
    const registro = aviso("assessment.completed", { subjectName: "Ana Martins" });

    expect(frase.of(registro, emPortugues)).toBe("Avaliação de Ana Martins foi concluída");
    expect(frase.of(registro, emIngles)).toBe("Assessment for Ana Martins was completed");
  });

  it("mentoria registrada — a frase da captura do dono — muda de idioma", () => {
    const registro = aviso("mentoring.recorded", { subjectName: "Bruno Almeida" });

    expect(frase.of(registro, emPortugues)).toBe("Mentoria registrada para Bruno Almeida");
    expect(frase.of(registro, emIngles)).toBe("Mentoring recorded for Bruno Almeida");
  });

  it("sem o nome da pessoa, a frase muda de FORMA — não vira 'undefined'", () => {
    const registro = aviso("mentoring.recorded");

    expect(frase.of(registro, emPortugues)).toBe("Uma mentoria foi registrada");
    expect(frase.of(registro, emIngles)).toBe("A mentoring session was recorded");
  });

  it("o resumo do dia concorda número em cada idioma", () => {
    expect(frase.of(aviso("digest.daily", { subjectName: "Ana", tally: 1 }), emPortugues)).toBe(
      "Resumo do dia: 1 novidade sobre Ana",
    );
    expect(frase.of(aviso("digest.daily", { subjectName: "Ana", tally: 3 }), emPortugues)).toBe(
      "Resumo do dia: 3 novidades sobre Ana",
    );
    expect(frase.of(aviso("digest.daily", { tally: 3 }), emIngles)).toBe(
      "Daily summary: 3 updates",
    );
  });

  it("o prazo do PDI concorda no singular — 'Falta 1 dia', nunca 'Faltam 1 dias'", () => {
    const um = aviso("development-item.deadline-approaching", {
      subjectName: "Ana Martins",
      tally: 1,
    });
    const cinco = aviso("development-item.deadline-approaching", {
      subjectName: "Ana Martins",
      tally: 5,
    });

    expect(frase.of(um, emPortugues)).toBe(
      "Falta 1 dia para o prazo de um compromisso do PDI de Ana Martins",
    );
    expect(frase.of(cinco, emPortugues)).toBe(
      "Faltam 5 dias para o prazo de um compromisso do PDI de Ana Martins",
    );
  });

  it("transferência de time: quem agiu, de quem, de onde, para onde", () => {
    const pedido = aviso("team-transfer.requested", {
      subjectName: "Ana Martins",
      actorName: "Gustavo Dados",
      fromTeamName: "Dados",
      toTeamName: "Plataforma",
    });

    expect(frase.of(pedido, emPortugues)).toBe(
      "Gustavo Dados pediu a transferência de Ana Martins de Dados para Plataforma",
    );
    expect(frase.of(pedido, emIngles)).toBe(
      "Gustavo Dados requested Ana Martins's transfer from Dados to Plataforma",
    );
  });

  /** A degradação que era do backend passou a ser da tela — e por isso é traduzida. */
  it("sem peça nenhuma, a transferência degrada para 'alguém'/'outro time' no idioma certo", () => {
    const pedido = aviso("team-transfer.requested");

    expect(frase.of(pedido, emPortugues)).toBe(
      "alguém pediu a transferência de alguém de outro time para outro time",
    );
    expect(frase.of(pedido, emIngles)).toBe(
      "someone requested someone's transfer from another team to another team",
    );
  });

  it("a saudação de primeiro acesso é a frase que o dono escreveu", () => {
    expect(frase.of(aviso("welcome.first-access"), emPortugues)).toBe(
      "Seja bem-vindo(a) ao Synapse!",
    );
    expect(frase.of(aviso("welcome.first-access"), emIngles)).toBe("Welcome to Synapse!");
  });

  /**
   * O contrato do `eventType` é EXTENSÍVEL: o backend pode estrear um tipo
   * antes de a tela aprender a frase dele. A reserva existe para esse dia — e
   * ela também é traduzida.
   */
  it("tipo que a tela ainda não conhece cai na reserva, com e sem nome", () => {
    expect(frase.of(aviso("coisa.nova", { subjectName: "Ana" }), emPortugues)).toBe(
      "Novo aviso sobre Ana",
    );
    expect(frase.of(aviso("coisa.nova"), emPortugues)).toBe("Novo aviso");
    expect(frase.of(aviso("coisa.nova"), emIngles)).toBe("New notice");
  });

  it("toda chave que a política usa existe nos DOIS dicionários", () => {
    const faltando = frase
      .messageKeys()
      .filter((chave) => !(chave in pt) || !(chave in en))
      .sort();

    expect(faltando).toEqual([]);
  });
});
