import { ApiError, UserFacingError, type RefusalWording } from "./api-errors";
import type { MessageKey } from "./i18n";

/**
 * A FRASE DE UMA RECUSA — a resposta a "o que este 'não' diz, no idioma de
 * quem está lendo?".
 *
 * Dono, 2026-09-08, com a captura da tela em inglês: *"as notificações não
 * estão sendo traduzidas para inglês no idioma inglês; aproveite e faça uma
 * varredura do que pode ter ficado de fora"*. Os avisos foram consertados
 * primeiro (`NoticePhrase`); a varredura devolveu o item maior, e ele é a
 * RECUSA.
 *
 * O mecanismo estava medido: `ApiFailureReading` só cala o serviço no status 0
 * e acima de 500 — então 400, 401, 403, 404, 409, 412 e 428 imprimiam
 * `body.message` literal. E `body.message` é escrito pelo backend, que só
 * escreve pt-BR: "profissional não encontrado" chegava assim ao navegador de
 * quem escolheu inglês, e nenhum dicionário alcançava aquele texto, porque ele
 * nascia do outro lado do fio.
 *
 * O conserto é o mesmo desenho de `success-envelope` e `NoticePhrase`, e é de
 * propósito que seja o mesmo — o produto não ganha um segundo caminho para a
 * mesma coisa: **o servidor manda o código e as peças; a tela compõe a
 * frase**. Uma regra por código, uma reserva para o código que a tela ainda
 * não conhece, e a chave escolhida pela PEÇA quando a sentença muda de forma.
 *
 * O "não encontrado" é o caso que ensina por que a escolha é de CHAVE, e não
 * de interpolação: em português a frase concorda em gênero com o recurso
 * ("profissional não encontrado" × "capacidade não encontradA"), e o servidor
 * colava sempre o masculino — "capacidade não encontrado" era o que a casa
 * publicava. Uma frase por recurso acerta os dois idiomas de uma vez, sem
 * ninguém montar sufixo em código. É a mesma lição que o plural deu na fatia
 * dos avisos ("Falta 1 dia" × "Faltam N dias"), aplicada a outra concordância.
 *
 * **A política diz "não sei" em vez de inventar.** Quando o código não é
 * conhecido, `sentenceOf` devolve `null` e quem chamou decide — hoje, mostrar
 * a frase do serviço. É essa dívida que
 * `tests/architecture/a-recusa-fala-o-idioma-de-quem-le.test.ts` conta, e é
 * por ela que a catraca desce a cada fatia.
 */
export type RefusalTranslate = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;

/** O mínimo que a frase precisa de uma recusa: o código e as peças. */
export interface PhrasableRefusal {
  code?: string | undefined;
  wording?: RefusalWording | undefined;
}

/** A regra de UM código de recusa — a estratégia que sabe montar aquela frase. */
abstract class RefusalPhraseRule {
  constructor(readonly code: string) {}

  addresses(code: string): boolean {
    return this.code === code;
  }

  abstract keyOf(wording: RefusalWording | undefined): MessageKey;

  /** As chaves que esta regra pode pedir ao dicionário — a catraca as confere. */
  abstract messageKeys(): readonly MessageKey[];
}

/** A recusa cuja frase não depende de peça nenhuma — o dialeto do framework. */
class FixedRefusalRule extends RefusalPhraseRule {
  constructor(
    code: string,
    private readonly sentence: MessageKey,
  ) {
    super(code);
  }

  keyOf(): MessageKey {
    return this.sentence;
  }

  messageKeys(): readonly MessageKey[] {
    return [this.sentence];
  }
}

/**
 * A recusa cuja frase muda de FORMA conforme o recurso: uma frase por recurso,
 * porque "Não encontramos este profissional" e "Não encontramos esta
 * capacidade" concordam diferente em português, e em inglês pedem artigos
 * diferentes. O recurso que a tela ainda não conhece cai na reserva — o
 * `entity` é contrato extensível, e um recurso novo do backend não pode virar
 * chave crua na tela.
 */
class ResourceRefusalRule extends RefusalPhraseRule {
  constructor(
    code: string,
    private readonly byResource: Readonly<Record<string, MessageKey>>,
    private readonly fallback: MessageKey,
  ) {
    super(code);
  }

  keyOf(wording: RefusalWording | undefined): MessageKey {
    const resource = wording?.entity;
    if (resource === undefined) return this.fallback;
    return this.byResource[resource] ?? this.fallback;
  }

  messageKeys(): readonly MessageKey[] {
    return [...Object.values(this.byResource), this.fallback];
  }
}

/**
 * Os recursos que a casa sabe recusar por ausência, e a frase de cada um.
 *
 * A lista é o espelho de `RefusedEntity` no backend, e a correspondência é por
 * CHAVE — nunca por rótulo. Duas chaves podem cair na mesma frase quando o
 * servidor diz a mesma coisa de dois jeitos (`cycle` e `developmentCycle`):
 * quem colapsa é a tela, porque mexer no rótulo do fio mudaria o corpo que a
 * casa publica hoje.
 */
const NOT_FOUND_BY_RESOURCE: Readonly<Record<string, MessageKey>> = {
  professional: "refusal.notFound.professional",
  mentoredProfessional: "refusal.notFound.professional",
  person: "refusal.notFound.person",
  user: "refusal.notFound.user",
  team: "refusal.notFound.team",
  teamMembership: "refusal.notFound.teamMembership",
  teamLevelRule: "refusal.notFound.teamLevelRule",
  teamTransferRequest: "refusal.notFound.teamTransferRequest",
  careerLevel: "refusal.notFound.careerLevel",
  cycle: "refusal.notFound.cycle",
  developmentCycle: "refusal.notFound.cycle",
  capability: "refusal.notFound.capability",
  competency: "refusal.notFound.competency",
  competencies: "refusal.notFound.competencies",
  competencyDistance: "refusal.notFound.competencyDistance",
  assessment: "refusal.notFound.assessment",
  assessmentItem: "refusal.notFound.assessmentItem",
  assessmentItemForCompetency: "refusal.notFound.assessmentItem",
  assessmentComment: "refusal.notFound.assessmentComment",
  assessmentOrCareerLevel: "refusal.notFound.assessment",
  portfolioCapability: "refusal.notFound.portfolioCapability",
  developmentPlan: "refusal.notFound.developmentPlan",
  developmentPlanItem: "refusal.notFound.developmentPlanItem",
  learningPath: "refusal.notFound.learningPath",
  learningPathItem: "refusal.notFound.learningPathItem",
  mentoringSession: "refusal.notFound.mentoringSession",
  notice: "refusal.notFound.notice",
  appSetting: "refusal.notFound.appSetting",
  textTemplate: "refusal.notFound.textTemplate",
  vocabularyItem: "refusal.notFound.vocabularyItem",
  declaredQuery: "refusal.notFound.declaredQuery",
};

export class RefusalPhrase {
  private readonly rules: readonly RefusalPhraseRule[] = [
    /**
     * O 404 — a recusa de maior alcance da casa: 44 classes do backend
     * publicam este código, e depois da regra 18 ele carrega "não existe" e
     * "não é seu" ao mesmo tempo, de propósito. Uma frase por recurso, e a
     * mesma frase para as duas famílias: é isso que fecha o oráculo do lado
     * de cá.
     */
    new ResourceRefusalRule("NOT_FOUND", NOT_FOUND_BY_RESOURCE, "error.notFound"),

    /**
     * O vínculo é a única ausência da casa com código próprio: ela É um "não
     * encontrado" (404, herda `EntityNotFoundError`) mas publica
     * `TEAM_MEMBERSHIP_NOT_ASSIGNED`, então a peça `entity` não a alcança. A
     * frase é a mesma do recurso — o que muda é por onde a política chega até
     * ela.
     */
    new FixedRefusalRule("TEAM_MEMBERSHIP_NOT_ASSIGNED", "refusal.notFound.teamMembership"),

    /**
     * O DIALETO DO FRAMEWORK. Nenhuma destas nasce de regra de negócio: são
     * as recusas que o Fastify e o Zod produzem antes de a casa ser chamada,
     * e todas alcançam qualquer rota de qualquer tela.
     */
    new FixedRefusalRule("VALIDATION_ERROR", "refusal.validation"),
    new FixedRefusalRule("MALFORMED_REQUEST_BODY", "refusal.malformedBody"),
    new FixedRefusalRule("EMPTY_REQUEST_BODY", "refusal.emptyBody"),
    new FixedRefusalRule("REQUEST_BODY_REQUIRED", "refusal.emptyBody"),
    new FixedRefusalRule("CONTENT_LENGTH_MISMATCH", "refusal.malformedBody"),
    new FixedRefusalRule("CONTENT_TYPE_REQUIRED", "refusal.malformedBody"),
    new FixedRefusalRule("UNSUPPORTED_MEDIA_TYPE", "refusal.unsupportedMediaType"),
    new FixedRefusalRule("MALFORMED_REQUEST_URL", "error.notFound"),
    new FixedRefusalRule("ROUTE_NOT_FOUND", "error.notFound"),
    new FixedRefusalRule("REQUEST_URL_TOO_LONG", "error.notFound"),
    new FixedRefusalRule("REQUEST_BODY_TOO_LARGE", "refusal.bodyTooLarge"),
    new FixedRefusalRule("RATE_LIMIT_EXCEEDED", "refusal.tooManyRequests"),
    new FixedRefusalRule("AUTH_IP_RATE_LIMIT_EXCEEDED", "refusal.tooManyRequests"),
    new FixedRefusalRule("REQUEST_ERROR", "error.undefined"),

    /**
     * O DIALETO DO BANCO. Os quatro códigos de constraint que o tradutor de
     * Postgres promove a recusa. A frase deles nomeava o registro e o
     * identificador; aqui ela diz o que a pessoa pode fazer, e o nome da
     * constraint fica onde sempre esteve — no log.
     */
    new FixedRefusalRule("FK_VIOLATION", "refusal.referencedRecordMissing"),
    new FixedRefusalRule("UNIQUE_VIOLATION", "refusal.duplicateRecord"),
    new FixedRefusalRule("REQUIRED_FIELD_MISSING", "refusal.requiredFieldMissing"),
    new FixedRefusalRule("CHECK_VIOLATION", "refusal.invalidValue"),
  ];

  /**
   * A chave da frase, ou `null` quando a política não conhece o código.
   * `null` é resposta, não omissão: quem chama mostra a frase do serviço, e a
   * catraca de dívida conta quantos códigos ainda dependem disso.
   */
  keyOf(refusal: PhrasableRefusal): MessageKey | null {
    const code = refusal.code;
    if (code === undefined) return null;
    const rule = this.rules.find((candidate) => candidate.addresses(code));
    return rule === undefined ? null : rule.keyOf(refusal.wording);
  }

  /** A frase pronta, no idioma de quem lê — ou `null`, quando não há frase nossa. */
  sentenceOf(failure: unknown, t: RefusalTranslate): string | null {
    if (!(failure instanceof ApiError)) return null;
    const key = this.keyOf(failure);
    return key === null ? null : t(key);
  }

  /** Os códigos que esta política sabe dizer — a catraca da dívida pergunta a ela. */
  phrasedCodes(): string[] {
    return this.rules.map((rule) => rule.code);
  }

  /** Toda chave que a política pode pedir, sem repetir — para a catraca do dicionário. */
  messageKeys(): MessageKey[] {
    return [...new Set(this.rules.flatMap((rule) => rule.messageKeys()))];
  }
}

export const defaultRefusalPhrase = new RefusalPhrase();

/**
 * A FRASE DE UMA MUTAÇÃO RECUSADA, e a ordem em que ela é escolhida.
 *
 * Nasce porque o `MutationRunner` é construído em dois lugares (`store.tsx` e
 * `context-scope.tsx`) e os dois precisavam da mesma escolha — a régua da casa
 * é que o que serve a dois lugares vira componente, não cópia.
 *
 * A ordem: a frase NOSSA primeiro, composta no idioma de quem lê; a do serviço
 * enquanto não temos a nossa (é ela que a catraca de dívida conta); e, para o
 * que não é recusa do serviço — um defeito deste lado —, a frase geral da casa,
 * que também mora no dicionário. Nenhuma delas é literal de TS: a reserva era
 * `MUTATION_FALLBACK_ERROR_MESSAGE`, escrita em português dentro do
 * `store.tsx`, e quem lia em inglês recebia português no toast de toda mutação
 * que falhava por defeito nosso.
 */
export class MutationRefusal {
  static readonly FALLBACK: MessageKey = "mutation.refused";

  static sentenceOf(failure: unknown, t: RefusalTranslate): string {
    const nossa = defaultRefusalPhrase.sentenceOf(failure, t);
    if (nossa !== null) return nossa;
    return failure instanceof UserFacingError ? failure.message : t(MutationRefusal.FALLBACK);
  }
}
