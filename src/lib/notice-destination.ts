import type { Notice } from "./gateways/notices.gateway";

/**
 * O DESTINO DE UM AVISO — a resposta a "clique para visualizar o quê?".
 *
 * O `link` do servidor é genérico por construção: ele conhece o EVENTO, não a
 * tela de quem lê. `assessment.completed` chegava como `/assessments` e
 * `mentoring.recorded` como `/mentoring`, então a linha do aviso de Ana
 * abria a avaliação de outra pessoa — a primeira da lista.
 *
 * O contexto que falta já viaja na própria linha (`professionalId`,
 * `teamId`), então o destino é derivável aqui, no navegador, sem contrato
 * novo. A tabela é do dono (2026-09-08):
 *
 *   assessment.completed  → a avaliação DAQUELA pessoa
 *   development-item.deadline-approaching → o PDI DAQUELA pessoa (fatia PRAZOS)
 *   mentoring.recorded    → Mentoria filtrada NAQUELA pessoa
 *   digest.daily          → a própria tela de Avisos
 *   support.access-opened → a ficha da pessoa
 *   team-transfer.*       → as pendências de transferência (o link do servidor)
 *
 * O `link` continua sendo a RESERVA, e é ela que responde por tudo o que não
 * está na tabela — tipo novo do contrato inclusive, que é extensível. Sem
 * contexto (`professionalId` nulo) a regra também devolve a reserva, em vez
 * de montar uma rota quebrada.
 */
export type NoticeContext = Pick<Notice, "eventType" | "link" | "professionalId" | "teamId">;

/** A regra de UM tipo de evento — a estratégia que sabe montar aquele destino. */
abstract class NoticeDestinationRule {
  constructor(readonly eventType: string) {}

  addresses(eventType: string): boolean {
    return this.eventType === eventType;
  }

  /** O destino, ou `null` quando falta contexto — aí quem decide é a reserva. */
  abstract resolve(notice: NoticeContext): string | null;
}

/** O destino que não depende de contexto nenhum: a tela é sempre a mesma. */
class FixedDestinationRule extends NoticeDestinationRule {
  constructor(
    eventType: string,
    private readonly pathname: string,
  ) {
    super(eventType);
  }

  resolve(): string {
    return this.pathname;
  }
}

/**
 * O destino endereçado a UMA pessoa. `param` nulo põe o id no caminho
 * (`/professionals/ana`); com nome, o id vai na busca da tela
 * (`/assessments?professionalId=ana`), que é como `/assessments` e
 * `/mentoring` já leem o filtro inicial delas.
 */
class PersonDestinationRule extends NoticeDestinationRule {
  constructor(
    eventType: string,
    private readonly pathname: string,
    private readonly param: string | null,
  ) {
    super(eventType);
  }

  resolve(notice: NoticeContext): string | null {
    const professionalId = notice.professionalId;
    if (professionalId === null || professionalId === "") return null;
    const id = encodeURIComponent(professionalId);
    return this.param === null ? `${this.pathname}/${id}` : `${this.pathname}?${this.param}=${id}`;
  }
}

export class NoticeDestination {
  private readonly rules: readonly NoticeDestinationRule[] = [
    new PersonDestinationRule("assessment.completed", "/assessments", "professionalId"),
    new PersonDestinationRule("mentoring.recorded", "/mentoring", "menteeId"),
    new FixedDestinationRule("digest.daily", "/notices"),
    new PersonDestinationRule("support.access-opened", "/professionals", null),
    /*
     * Fatia PRAZOS: o aviso de prazo chega à pessoa E a quem a lidera, e o
     * `link` do servidor é o genérico `/development-plans`. Sem esta regra,
     * quem lidera três pessoas abriria o PDI da primeira da lista — o mesmo
     * defeito que esta tabela nasceu para consertar.
     */
    new PersonDestinationRule(
      "development-item.deadline-approaching",
      "/development-plans",
      "professionalId",
    ),
  ];

  of(notice: NoticeContext): string {
    const rule = this.rules.find((candidate) => candidate.addresses(notice.eventType));
    return rule?.resolve(notice) ?? notice.link;
  }
}

export const defaultNoticeDestination = new NoticeDestination();
