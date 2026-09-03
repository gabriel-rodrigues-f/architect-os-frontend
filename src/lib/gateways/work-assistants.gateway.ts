import type { ApiClient } from "../api-client";
import { stagnationAlertResponseSchema, workAssistanceResponseSchema } from "../api-schemas";
import { AssistantCall } from "../assistants";

/**
 * ADR-0088 do backend, do lado da tela — os assistentes que apoiam o
 * TRABALHO: a revisão de uma evidência, a calibração de uma avaliação, o
 * aviso de que alguém requer atenção e a curadoria do catálogo.
 *
 * Dois campos, e a separação é o produto: `observations` é o que o sistema
 * APUROU por consulta e continua verdadeiro com o provedor no chão; `reading`
 * é a interpretação, e é a única parte que a IA escreve. Nenhum deles tem
 * campo de veredito — nada aqui aprova, rejeita, nota ou classifica.
 *
 * Ao contrário dos assistentes da pessoa, a queda do provedor AQUI é 503 com
 * a mensagem do serviço: as telas destes quatro já desenham o determinístico
 * por conta própria (a evidência, a avaliação, a matriz), então perder a
 * resposta inteira não apaga nada do que o sistema calculou. Quem consome
 * isto mostra a mensagem do serviço e segue operando.
 */
export interface WorkAssistance {
  subject: string;
  observations: string[];
  reading: string;
}

/**
 * IA-05 — o aviso de estagnação tem forma própria porque pode não haver o que
 * avisar. `requiresAttention` é determinístico e é a palavra que o dono
 * escolheu: "Requer atenção". Quando é falso, `alert` é nulo e o provedor
 * sequer foi chamado.
 */
export interface StagnationAlert {
  subject: string;
  signals: string[];
  requiresAttention: boolean;
  alert: string | null;
}

export interface WorkAssistantsGateway {
  assistEvidenceReview(evidenceId: string): Promise<WorkAssistance>;
  assistAssessmentCalibration(architectId: string): Promise<WorkAssistance>;
  alertAboutStagnation(architectId: string): Promise<StagnationAlert>;
  reviewCatalogQuality(): Promise<WorkAssistance>;
}

export class HttpWorkAssistantsGateway implements WorkAssistantsGateway {
  private readonly call: AssistantCall;

  constructor(client: ApiClient, timeoutMs?: number) {
    this.call = new AssistantCall(client, timeoutMs);
  }

  assistEvidenceReview = (evidenceId: string): Promise<WorkAssistance> =>
    this.call.read(`/evidences/${evidenceId}/review-assistance`, (data) =>
      workAssistanceResponseSchema.parse(data),
    );

  assistAssessmentCalibration = (architectId: string): Promise<WorkAssistance> =>
    this.call.read(`/architects/${architectId}/calibration-assistance`, (data) =>
      workAssistanceResponseSchema.parse(data),
    );

  alertAboutStagnation = (architectId: string): Promise<StagnationAlert> =>
    this.call.read(`/architects/${architectId}/stagnation-alert`, (data) =>
      stagnationAlertResponseSchema.parse(data),
    );

  reviewCatalogQuality = (): Promise<WorkAssistance> =>
    this.call.read("/capabilities/quality-review", (data) =>
      workAssistanceResponseSchema.parse(data),
    );
}
