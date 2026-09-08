import type { ApiClient } from "../api-client";
import {
  careerReadinessAdviceResponseSchema,
  developmentPlanAdviceResponseSchema,
  oneOnOnePreparationResponseSchema,
  sessionScriptAdviceResponseSchema,
} from "../api-schemas";
import { AssistantCall, type GenerationProfileName, type WrittenByPerson } from "../assistants";

/**
 * ADR-0087 do backend, do lado da tela — os assistentes que falam SOBRE UMA
 * PESSOA.
 *
 * Quatro operações de negócio, quatro nomes de negócio, nunca um `ask(tipo)`:
 * preparar o 1:1, recomendar um item de PDI, explicar a prontidão e
 * escrever o roteiro de PDI são coisas diferentes, feitas em telas
 * diferentes, por quem tem alcances diferentes.
 *
 * A queda do provedor aqui NÃO é erro de HTTP: o backend responde 200 com
 * `narration: null` e a frase de indisponibilidade em `narrationUnavailable`,
 * porque estas rotas são as donas do conteúdo determinístico (os fatos, a
 * distância, o veredito) e um 503 apagaria da tela o que o sistema calculou
 * sozinho. Por isso o campo viaja no tipo, e toda tela que consome isto
 * desenha os fatos antes de olhar a narração.
 */
export interface PersonAdvice {
  subject: string;
  suggestion: true;
  notice: string;
  facts: string[];
  /**
   * ADR-0093 — o que uma PESSOA escreveu, ao lado dos fatos e nunca dentro
   * deles. `facts` é o que o sistema apurou; isto é o que alguém digitou num
   * formulário, e a tela desenha os dois sob rótulos diferentes porque a
   * diferença entre eles é de CONFIANÇA, não de origem.
   */
  written: WrittenByPerson[];
  absences: string[];
  narration: string | null;
  narrationUnavailable: string | null;
}

/**
 * A preparação do 1:1 (dono, 2026-09-07): liturgia → resumo do perfil → SWOT
 * na narração, com o perfil com que foi gerada e o selo de procedência que o
 * roteiro de 1:1 tinha — é ela que pode virar sessão registrada.
 */
export interface OneOnOnePreparation extends PersonAdvice {
  profile: GenerationProfileName;
  scriptProvenance: string;
}

/** O roteiro de PDI — a única pauta que sobrou. */
export interface SessionScriptAdvice extends PersonAdvice {
  profile: GenerationProfileName;
  outline: string[];
}

export interface CareerReadinessVerdict {
  currentCareerLevel: string | null;
  nextCareerLevel: string | null;
  eligible: boolean | null;
  qualifiedCapabilityCount: number;
  minimumQualifiedCapabilities: number | null;
}

export interface CareerReadinessAdvice extends PersonAdvice {
  readiness: CareerReadinessVerdict | null;
}

export interface SelectedDistance {
  competencyId: string;
  competencyName: string;
  capabilityName: string | null;
  currentLevel: number;
  requiredLevel: number | null;
  distance: number | null;
}

export interface DevelopmentPlanAdvice extends PersonAdvice {
  distance: SelectedDistance;
}

/** Preparação do 1:1 e roteiro de PDI pedem a mesma coisa: a pessoa e o perfil. */
export interface ProfiledAdviceRequest {
  professionalId: string;
  profile: GenerationProfileName;
}

export interface DevelopmentPlanRecommendationRequest {
  professionalId: string;
  competencyId: string;
}

export interface PersonAssistantsGateway {
  prepareOneOnOne(request: ProfiledAdviceRequest): Promise<OneOnOnePreparation>;
  writeSessionScript(request: ProfiledAdviceRequest): Promise<SessionScriptAdvice>;
  explainCareerReadiness(professionalId: string): Promise<CareerReadinessAdvice>;
  recommendDevelopmentPlanItem(
    request: DevelopmentPlanRecommendationRequest,
  ): Promise<DevelopmentPlanAdvice>;
}

export class HttpPersonAssistantsGateway implements PersonAssistantsGateway {
  private readonly call: AssistantCall;

  constructor(client: ApiClient, timeoutMs?: number) {
    this.call = new AssistantCall(client, timeoutMs);
  }

  prepareOneOnOne = ({
    professionalId,
    profile,
  }: ProfiledAdviceRequest): Promise<OneOnOnePreparation> =>
    this.call.read(
      AssistantCall.resourceOf(`/professionals/${professionalId}/one-on-one-preparation`, {
        profile,
      }),
      (data) => oneOnOnePreparationResponseSchema.parse(data),
    );

  writeSessionScript = ({
    professionalId,
    profile,
  }: ProfiledAdviceRequest): Promise<SessionScriptAdvice> =>
    this.call.read(
      AssistantCall.resourceOf(`/professionals/${professionalId}/session-script`, { profile }),
      (data) => sessionScriptAdviceResponseSchema.parse(data),
    );

  explainCareerReadiness = (professionalId: string): Promise<CareerReadinessAdvice> =>
    this.call.read(`/professionals/${professionalId}/career-readiness-explanation`, (data) =>
      careerReadinessAdviceResponseSchema.parse(data),
    );

  recommendDevelopmentPlanItem = ({
    professionalId,
    competencyId,
  }: DevelopmentPlanRecommendationRequest): Promise<DevelopmentPlanAdvice> =>
    this.call.read(
      AssistantCall.resourceOf(`/professionals/${professionalId}/development-plan-recommendation`, {
        competencyId,
      }),
      (data) => developmentPlanAdviceResponseSchema.parse(data),
    );
}
