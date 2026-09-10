import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, API_URL } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { AssistantTimedOutError, GenerationProfileChoice } from "@/lib/assistants";
import { HttpPersonAssistantsGateway } from "@/lib/gateways/person-assistants.gateway";
import { HttpWorkAssistantsGateway } from "@/lib/gateways/work-assistants.gateway";

/**
 * Onda 39, fatia `ia-na-tela` — as OITO leituras de apoio do backend, do lado
 * de cá.
 *
 * O que estes testes fixam é o que nenhuma tela consegue afirmar sozinha:
 *
 *  1. a URL de cada operação, incluindo a querystring. `agenda` e
 *     `competencyId` são obrigatórios no servidor; perdê-los na montagem vira
 *     400 em produção e uma tela que "não gera" sem dizer por quê;
 *  2. o PERFIL DE GERAÇÃO viaja, e o padrão é **Moderado** — pedido literal
 *     do dono. O padrão mora numa classe, não num valor inicial de `useState`
 *     espalhado por duas telas;
 *  3. o TEMPO-LIMITE existe e tem nome próprio. O `ApiClient` da casa não tem
 *     nenhum, e uma rota de IA é a única da aplicação que pode demorar
 *     minutos: sem isto o botão fica girando para sempre e a regra 19 do
 *     pedido ("timeout tratado") não teria como ser cumprida na tela;
 *  4. a queda do provedor NÃO é a mesma coisa nos dois lados, e a diferença é
 *     do backend: os assistentes da PESSOA devolvem 200 com `narration: null`
 *     e um aviso em `narrationUnavailable` (ADR-0087), enquanto os do
 *     TRABALHO devolvem 503 com a mensagem do serviço (ADR-0088). Quem lê
 *     estas duas afirmações sabe por que as telas tratam as duas quedas de
 *     jeitos diferentes.
 */
const fetchMock = vi.fn();

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const conselho = {
  subject: "assunto",
  suggestion: true,
  notice: "Isto é uma sugestão.",
  facts: ["um fato"],
  absences: ["learningPath"],
  narration: "parágrafo",
  narrationUnavailable: null,
};

const pessoas = (timeoutMs?: number) =>
  new HttpPersonAssistantsGateway(new ApiClient(API_URL), timeoutMs);

const trabalho = (timeoutMs?: number) =>
  new HttpWorkAssistantsGateway(new ApiClient(API_URL), timeoutMs);

const urlDaChamada = (indice = 0): URL => {
  const chamada = fetchMock.mock.calls[indice];
  expect(chamada).toBeDefined();
  return new URL(String(chamada![0]));
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({ data: conselho }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assistentes da pessoa — a URL de cada operação de negócio", () => {
  /*
   * AQUI MORAVAM os dois casos de `prepareOneOnOne` — a rota que ela lia e o
   * selo de procedência que chegava com ela. A operação saiu do gateway em
   * 2026-09-09, com a IA da tela de Mentoria e 1:1.
   */
  it("o roteiro de PDI leva só o perfil de geração — a pauta morreu com o roteiro de 1:1", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { ...conselho, profile: "methodical", outline: ["A"] } }),
    );
    await geraRoteiro("methodical");
    expect(urlDaChamada().pathname).toBe("/api/v1/professionals/ana/session-script");
    expect(urlDaChamada().searchParams.has("agenda")).toBe(false);
    expect(urlDaChamada().searchParams.get("profile")).toBe("methodical");
  });

  it("o padrão do perfil de geração é Moderado — pedido literal do dono", async () => {
    expect(GenerationProfileChoice.DEFAULT).toBe("moderate");
    expect(GenerationProfileChoice.NAMES).toEqual(["empirical", "moderate", "methodical"]);
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { ...conselho, profile: "moderate", outline: ["A"] } }),
    );
    await geraRoteiro(GenerationProfileChoice.DEFAULT);
    expect(urlDaChamada().searchParams.get("profile")).toBe("moderate");
  });

  it("a recomendação de PDI carrega a competência escolhida", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: {
          ...conselho,
          distance: {
            competencyId: "c1",
            competencyName: "Domain Modeling",
            capabilityName: "Design",
            currentLevel: 2,
            requiredLevel: 4,
            distance: 2,
          },
        },
      }),
    );
    await pessoas().recommendDevelopmentPlanItem({ professionalId: "ana", competencyId: "c1" });
    expect(urlDaChamada().pathname).toBe(
      "/api/v1/professionals/ana/development-plan-recommendation",
    );
    expect(urlDaChamada().searchParams.get("competencyId")).toBe("c1");
  });

  /**
   * DONO, 2026-09-10 — o campo `readiness` carregava o VEREDITO e morreu com
   * a elegibilidade. A garantia que sobrevive é a mesma, sobre o que ficou:
   * com a IA fora do ar, os FATOS medidos continuam chegando.
   */
  it("a explicação da prontidão devolve os fatos medidos mesmo sem narração", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: {
          ...conselho,
          narration: null,
          narrationUnavailable: "A sugestão está indisponível.",
        },
      }),
    );
    const lido = await pessoas().explainCareerReadiness("ana");
    expect(lido.narration).toBeNull();
    expect(lido.narrationUnavailable).toBe("A sugestão está indisponível.");
    expect(lido.facts).toEqual(["um fato"]);
  });
});

describe("assistentes do trabalho — a URL e a recusa do serviço", () => {
  it("o aviso de estagnação é da pessoa", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { subject: "s", signals: [], requiresAttention: false, alert: null } }),
    );
    await trabalho().alertAboutStagnation("ana");
    expect(urlDaChamada().pathname).toBe("/api/v1/professionals/ana/stagnation-alert");
  });

  it("sem sinal de estagnação o aviso é nulo e nada foi pedido ao provedor", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { subject: "s", signals: ["dois ciclos"], requiresAttention: false, alert: null },
      }),
    );
    const lido = await trabalho().alertAboutStagnation("ana");
    expect(lido.requiresAttention).toBe(false);
    expect(lido.alert).toBeNull();
    expect(lido.signals).toEqual(["dois ciclos"]);
  });

  /**
   * A FRONTEIRA DE 2026-09-09: num 5xx a frase do serviço NÃO chega à tela.
   * A daqui narrava o guarda interno da casa ("recusada por citar o número X,
   * que não saiu da apuração"). O `status` e o `code` continuam no objeto —
   * eles é que fazem a tela escolher o que desenhar —, a frase é que morre.
   */
  it("a queda do provedor chega como 503 sem a frase do serviço, com status e code intactos", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          message: "A leitura em linguagem natural está indisponível no momento.",
          code: "WORK_ASSISTANCE_UNAVAILABLE",
        },
        503,
      ),
    );
    const falha = await trabalho()
      .alertAboutStagnation("ana")
      .catch((erro: unknown) => erro);
    expect(falha).toBeInstanceOf(ApiError);
    expect((falha as ApiError).status).toBe(503);
    expect((falha as ApiError).code).toBe("WORK_ASSISTANCE_UNAVAILABLE");
    expect((falha as ApiError).message).not.toContain("indisponível");
    expect((falha as ApiError).message).toBe(
      "Não é possível acessar a aplicação agora. Entre em contato com um administrador.",
    );
  });
});

describe("tempo-limite — a única rota da casa que pode demorar minutos", () => {
  it("o provedor que não responde vira AssistantTimedOutError, não espera infinita", async () => {
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const falha = await pessoas(5)
      .writeSessionScript({ professionalId: "ana", profile: "moderate" })
      .catch((erro: unknown) => erro);
    expect(falha).toBeInstanceOf(AssistantTimedOutError);
  });

  it("o assistente do trabalho tem o mesmo tempo-limite — é a mesma classe", async () => {
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const falha = await trabalho(5)
      .alertAboutStagnation("ana")
      .catch((erro: unknown) => erro);
    expect(falha).toBeInstanceOf(AssistantTimedOutError);
  });

  it("a resposta que chega a tempo não é confundida com tempo esgotado", async () => {
    const lido = await geraRoteiroCom("moderate", 5_000);
    expect(lido.notice).toBe("Isto é uma sugestão.");
  });
});

async function geraRoteiro(profile: "empirical" | "moderate" | "methodical"): Promise<void> {
  await pessoas().writeSessionScript({ professionalId: "ana", profile });
}

async function geraRoteiroCom(
  profile: "empirical" | "moderate" | "methodical",
  timeoutMs?: number,
): ReturnType<HttpPersonAssistantsGateway["writeSessionScript"]> {
  fetchMock.mockResolvedValue(jsonResponse({ data: { ...conselho, profile, outline: ["A"] } }));
  return pessoas(timeoutMs).writeSessionScript({ professionalId: "ana", profile });
}
