import type { ApiClient } from "../api-client";
import {
  careerReadinessAdviceResponseSchema,
  developmentPlanAdviceResponseSchema,
  personAdviceResponseSchema,
  sessionScriptAdviceResponseSchema,
} from "../api-schemas";
import { AssistantCall, type GenerationProfileName, type SessionAgenda } from "../assistants";

/**
 * ADR-0087 do backend, do lado da tela — os assistentes que falam SOBRE UMA
 * PESSOA.
 *
 * Quatro operações de negócio, quatro nomes de negócio, nunca um `ask(tipo)`:
 * preparar uma 1:1, recomendar um item de PDI, explicar a prontidão e
 * escrever um roteiro são coisas diferentes, feitas em telas diferentes, por
 * quem tem alcances diferentes.
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
  absences: string[];
  narration: string | null;
  narrationUnavailable: string | null;
}

export interface SessionScriptAdvice extends PersonAdvice {
  agenda: SessionAgenda;
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

export interface SessionScriptRequest {
  architectId: string;
  agenda: SessionAgenda;
  profile: GenerationProfileName;
}

export interface DevelopmentPlanRecommendationRequest {
  architectId: string;
  competencyId: string;
}

export interface PersonAssistantsGateway {
  prepareOneOnOne(architectId: string): Promise<PersonAdvice>;
  writeSessionScript(request: SessionScriptRequest): Promise<SessionScriptAdvice>;
  explainCareerReadiness(architectId: string): Promise<CareerReadinessAdvice>;
  recommendDevelopmentPlanItem(
    request: DevelopmentPlanRecommendationRequest,
  ): Promise<DevelopmentPlanAdvice>;
}

export class HttpPersonAssistantsGateway implements PersonAssistantsGateway {
  private readonly call: AssistantCall;

  constructor(client: ApiClient, timeoutMs?: number) {
    this.call = new AssistantCall(client, timeoutMs);
  }

  prepareOneOnOne = (architectId: string): Promise<PersonAdvice> =>
    this.call.read(`/architects/${architectId}/one-on-one-preparation`, (data) =>
      personAdviceResponseSchema.parse(data),
    );

  writeSessionScript = ({
    architectId,
    agenda,
    profile,
  }: SessionScriptRequest): Promise<SessionScriptAdvice> =>
    this.call.read(
      AssistantCall.resourceOf(`/architects/${architectId}/session-script`, { agenda, profile }),
      (data) => sessionScriptAdviceResponseSchema.parse(data),
    );

  explainCareerReadiness = (architectId: string): Promise<CareerReadinessAdvice> =>
    this.call.read(`/architects/${architectId}/career-readiness-explanation`, (data) =>
      careerReadinessAdviceResponseSchema.parse(data),
    );

  recommendDevelopmentPlanItem = ({
    architectId,
    competencyId,
  }: DevelopmentPlanRecommendationRequest): Promise<DevelopmentPlanAdvice> =>
    this.call.read(
      AssistantCall.resourceOf(`/architects/${architectId}/development-plan-recommendation`, {
        competencyId,
      }),
      (data) => developmentPlanAdviceResponseSchema.parse(data),
    );
}
