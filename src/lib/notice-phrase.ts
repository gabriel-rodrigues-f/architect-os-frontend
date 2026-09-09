import type { MessageKey } from "./i18n";

/**
 * A FRASE DE UM AVISO — a resposta a "o que este aviso diz, no idioma de quem
 * está lendo?".
 *
 * Dono, 2026-09-08, com a captura da tela em inglês mostrando "Mentoria
 * registrada para…": *"as notificações não estão sendo traduzidas para inglês
 * no idioma inglês"*. A causa era de contrato: o TÍTULO era composto no
 * backend (`NoticeHeadline`), em português, e viajava pronto no campo `title`.
 * A tela só exibia — nenhum idioma alcançava aquele texto.
 *
 * O servidor passou a mandar o TIPO do evento e as PEÇAS (`wording`), e a
 * frase nasce aqui, com o dicionário da pessoa. É o mesmo desenho de
 * `NoticeDestination`, e de propósito: uma regra por tipo de evento, uma
 * reserva para o tipo que a tela ainda não conhece — o contrato do
 * `eventType` é extensível, e um tipo novo do backend não pode virar tela
 * quebrada.
 *
 * As peças que faltam NÃO viram texto vazio: cada regra decide entre a frase
 * com nome e a frase sem nome, ou empresta "alguém"/"outro time" do próprio
 * dicionário. A degradação era do backend e era em português; ela mudou de
 * lado junto com a frase.
 */
export interface NoticeWording {
  subjectName?: string | undefined;
  actorName?: string | undefined;
  fromTeamName?: string | undefined;
  toTeamName?: string | undefined;
  tally?: number | undefined;
}

/** O mínimo que a frase precisa de um aviso: o tipo e as peças. */
export interface PhrasableNotice {
  eventType: string;
  wording: NoticeWording;
}

/** O `t` do `useI18n`, sem arrastar o React para dentro da política. */
export type NoticeTranslate = (key: MessageKey, params?: Record<string, string | number>) => string;

/** A regra de UM tipo de evento — a estratégia que sabe montar aquela frase. */
abstract class NoticePhraseRule {
  constructor(readonly eventType: string) {}

  addresses(eventType: string): boolean {
    return this.eventType === eventType;
  }

  abstract sentenceOf(wording: NoticeWording, t: NoticeTranslate): string;

  /** As chaves que esta regra pode pedir ao dicionário — a catraca as confere. */
  abstract messageKeys(): readonly MessageKey[];
}

/**
 * A frase que muda de FORMA quando não há nome: "Mentoria registrada para
 * Ana" e "Uma mentoria foi registrada" são duas sentenças, não uma com um
 * buraco. Em inglês a diferença é ainda maior, e é por isso que as duas
 * moram no dicionário em vez de saírem de uma concatenação.
 */
class SubjectPhraseRule extends NoticePhraseRule {
  constructor(
    eventType: string,
    private readonly named: MessageKey,
    private readonly anonymous: MessageKey,
  ) {
    super(eventType);
  }

  sentenceOf(wording: NoticeWording, t: NoticeTranslate): string {
    const pessoa = wording.subjectName;
    return pessoa === undefined || pessoa === "" ? t(this.anonymous) : t(this.named, { pessoa });
  }

  messageKeys(): readonly MessageKey[] {
    return [this.named, this.anonymous];
  }
}

/**
 * A frase que também CONCORDA NÚMERO. Português e inglês fazem plural em
 * lugares diferentes da sentença ("Falta 1 dia" × "1 day"), então a escolha é
 * de chave, nunca de sufixo montado em código — quatro chaves, e cada idioma
 * escreve as quatro do jeito dele.
 */
class TallyPhraseRule extends NoticePhraseRule {
  constructor(
    eventType: string,
    private readonly namedOne: MessageKey,
    private readonly namedMany: MessageKey,
    private readonly anonymousOne: MessageKey,
    private readonly anonymousMany: MessageKey,
  ) {
    super(eventType);
  }

  sentenceOf(wording: NoticeWording, t: NoticeTranslate): string {
    const contagem = wording.tally ?? 0;
    const uma = contagem === 1;
    const pessoa = wording.subjectName;
    if (pessoa === undefined || pessoa === "") {
      return t(uma ? this.anonymousOne : this.anonymousMany, { n: contagem });
    }
    return t(uma ? this.namedOne : this.namedMany, { n: contagem, pessoa });
  }

  messageKeys(): readonly MessageKey[] {
    return [this.namedOne, this.namedMany, this.anonymousOne, this.anonymousMany];
  }
}

/**
 * A frase da transferência de time (dono, 2026-09-06): quem pediu, de quem, de
 * onde, para onde. Aqui a forma é uma só e o que falta é substituído — a
 * pessoa pode ter sido esquecida, o time renomeado e a conta apagada, e a
 * frase continua fazendo sentido com "alguém" e "outro time".
 */
class TeamTransferPhraseRule extends NoticePhraseRule {
  private static readonly SOMEONE: MessageKey = "notices.phrase.someone";

  private static readonly SOME_TEAM: MessageKey = "notices.phrase.someTeam";

  constructor(
    eventType: string,
    private readonly sentence: MessageKey,
  ) {
    super(eventType);
  }

  sentenceOf(wording: NoticeWording, t: NoticeTranslate): string {
    const alguem = t(TeamTransferPhraseRule.SOMEONE);
    const outroTime = t(TeamTransferPhraseRule.SOME_TEAM);
    return t(this.sentence, {
      autor: wording.actorName ?? alguem,
      pessoa: wording.subjectName ?? alguem,
      origem: wording.fromTeamName ?? outroTime,
      destino: wording.toTeamName ?? outroTime,
    });
  }

  messageKeys(): readonly MessageKey[] {
    return [this.sentence, TeamTransferPhraseRule.SOMEONE, TeamTransferPhraseRule.SOME_TEAM];
  }
}

/** A frase que não depende de peça nenhuma — a saudação do primeiro acesso. */
class FixedPhraseRule extends NoticePhraseRule {
  constructor(
    eventType: string,
    private readonly sentence: MessageKey,
  ) {
    super(eventType);
  }

  sentenceOf(_wording: NoticeWording, t: NoticeTranslate): string {
    return t(this.sentence);
  }

  messageKeys(): readonly MessageKey[] {
    return [this.sentence];
  }
}

export class NoticePhrase {
  /**
   * A RESERVA. O `eventType` é contrato extensível: o backend estreia um tipo
   * e a tela aprende a frase dele depois. Sem esta linha, o dia da estreia
   * seria uma linha em branco no sino.
   */
  private readonly fallback = new SubjectPhraseRule(
    "",
    "notices.phrase.fallback",
    "notices.phrase.fallback.anonymous",
  );

  private readonly rules: readonly NoticePhraseRule[] = [
    new SubjectPhraseRule(
      "assessment.completed",
      "notices.phrase.assessment.completed",
      "notices.phrase.assessment.completed.anonymous",
    ),
    new SubjectPhraseRule(
      "assessment.stalled",
      "notices.phrase.assessment.stalled",
      "notices.phrase.assessment.stalled.anonymous",
    ),
    new SubjectPhraseRule(
      "mentoring.recorded",
      "notices.phrase.mentoring.recorded",
      "notices.phrase.mentoring.recorded.anonymous",
    ),
    new SubjectPhraseRule(
      "support.access-opened",
      "notices.phrase.support.access-opened",
      "notices.phrase.support.access-opened.anonymous",
    ),
    new TallyPhraseRule(
      "digest.daily",
      "notices.phrase.digest.daily.one",
      "notices.phrase.digest.daily.many",
      "notices.phrase.digest.daily.one.anonymous",
      "notices.phrase.digest.daily.many.anonymous",
    ),
    new TallyPhraseRule(
      "development-item.deadline-approaching",
      "notices.phrase.development-item.deadline-approaching.one",
      "notices.phrase.development-item.deadline-approaching.many",
      "notices.phrase.development-item.deadline-approaching.one.anonymous",
      "notices.phrase.development-item.deadline-approaching.many.anonymous",
    ),
    new TeamTransferPhraseRule("team-transfer.requested", "notices.phrase.team-transfer.requested"),
    new TeamTransferPhraseRule("team-transfer.approved", "notices.phrase.team-transfer.approved"),
    new TeamTransferPhraseRule("team-transfer.refused", "notices.phrase.team-transfer.refused"),
    new FixedPhraseRule("welcome.first-access", "notices.phrase.welcome.first-access"),
  ];

  of(notice: PhrasableNotice, t: NoticeTranslate): string {
    const rule = this.rules.find((candidate) => candidate.addresses(notice.eventType));
    return (rule ?? this.fallback).sentenceOf(notice.wording, t);
  }

  /** Os tipos que esta política sabe dizer — a catraca da decoração pergunta a ela. */
  phrasedEventTypes(): string[] {
    return this.rules.map((rule) => rule.eventType);
  }

  /** Toda chave que a política pode pedir, sem repetir — para a catraca do dicionário. */
  messageKeys(): MessageKey[] {
    return [...new Set([...this.rules, this.fallback].flatMap((rule) => rule.messageKeys()))];
  }
}

export const defaultNoticePhrase = new NoticePhrase();
