import type { ApiClient } from "../api-client";
import {
  assistantsAvailabilityResponseSchema,
  stagnationAlertResponseSchema,
} from "../api-schemas";
import { AssistantCall } from "../assistants";

/**
 * ADR-0088 do backend, do lado da tela — os assistentes que apoiam o
 * TRABALHO. Eram três; desde 2026-09-10 (ADR-0103 do backend) é UM: o aviso de
 * que alguém requer atenção. A leitura de apoio à calibração e a leitura de
 * apoio à curadoria do catálogo saíram do produto a pedido do dono, e com elas
 * saiu o read model `WorkAssistance` que as duas publicavam.
 *
 * A queda do provedor AQUI é 503 com a mensagem do serviço: a tela já desenha
 * o determinístico por conta própria, então perder a resposta inteira não
 * apaga nada do que o sistema calculou. Quem consome isto mostra a mensagem do
 * serviço e segue operando.
 */
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

/**
 * O que a casa TEM para oferecer, perguntado antes de oferecer.
 *
 * Sem provedor de linguagem natural, "Verificar sinais" só tem um
 * destino possível — e a tela não pode descobrir isso sozinha: a escolha do
 * provedor mora no servidor, e ler variável de ambiente no navegador seria
 * mover a decisão para o lado errado da porta. Por isso a tela PERGUNTA.
 */
export interface AssistantsAvailability {
  naturalLanguageReading: boolean;
}

export interface WorkAssistantsGateway {
  naturalLanguageReadingAvailability(): Promise<AssistantsAvailability>;
  alertAboutStagnation(professionalId: string): Promise<StagnationAlert>;
}

export class HttpWorkAssistantsGateway implements WorkAssistantsGateway {
  private readonly call: AssistantCall;

  constructor(
    private readonly client: ApiClient,
    timeoutMs?: number,
  ) {
    this.call = new AssistantCall(client, timeoutMs);
  }

  /**
   * Sem `AssistantCall`: não há provedor no caminho desta pergunta, então não
   * há tempo-limite de geração a impor. Ela é uma leitura de configuração, e
   * responde em milissegundos ou não responde.
   */
  naturalLanguageReadingAvailability = (): Promise<AssistantsAvailability> =>
    this.client
      .request<unknown>("/assistants/availability")
      .then((data) => assistantsAvailabilityResponseSchema.parse(data));

  alertAboutStagnation = (professionalId: string): Promise<StagnationAlert> =>
    this.call.read(`/professionals/${professionalId}/stagnation-alert`, (data) =>
      stagnationAlertResponseSchema.parse(data),
    );
}
