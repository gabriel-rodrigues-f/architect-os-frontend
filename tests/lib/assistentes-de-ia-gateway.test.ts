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
  it("preparar a 1:1 lê a rota da pessoa, sem querystring", async () => {
    await pessoas().prepareOneOnOne("ana");
    expect(urlDaChamada().pathname).toBe("/api/v1/architects/ana/one-on-one-preparation");
    expect(urlDaChamada().search).toBe("");
  });

  it("o roteiro leva a pauta e o perfil de geração escolhido", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { ...conselho, agenda: "development-plan", profile: "methodical", outline: ["A"] },
      }),
    );
    await geraRoteiro("development-plan", "methodical");
    expect(urlDaChamada().pathname).toBe("/api/v1/architects/ana/session-script");
    expect(urlDaChamada().searchParams.get("agenda")).toBe("development-plan");
    expect(urlDaChamada().searchParams.get("profile")).toBe("methodical");
  });

  it("o padrão do perfil de geração é Moderado — pedido literal do dono", async () => {
    expect(GenerationProfileChoice.DEFAULT).toBe("moderate");
    expect(GenerationProfileChoice.NAMES).toEqual(["empirical", "moderate", "methodical"]);
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { ...conselho, agenda: "one-on-one", profile: "moderate", outline: ["A"] },
      }),
    );
    await geraRoteiro("one-on-one", GenerationProfileChoice.DEFAULT);
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
    await pessoas().recommendDevelopmentPlanItem({ architectId: "ana", competencyId: "c1" });
    expect(urlDaChamada().pathname).toBe("/api/v1/architects/ana/development-plan-recommendation");
    expect(urlDaChamada().searchParams.get("competencyId")).toBe("c1");
  });

  it("a explicação da prontidão devolve o veredito determinístico junto", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: {
          ...conselho,
          narration: null,
          narrationUnavailable: "A sugestão está indisponível.",
          readiness: {
            currentCareerLevel: "Pleno",
            nextCareerLevel: "Sênior",
            eligible: false,
            qualifiedCapabilityCount: 2,
            minimumQualifiedCapabilities: 3,
          },
        },
      }),
    );
    const lido = await pessoas().explainCareerReadiness("ana");
    expect(lido.readiness?.eligible).toBe(false);
    expect(lido.narration).toBeNull();
    expect(lido.narrationUnavailable).toBe("A sugestão está indisponível.");
    expect(lido.facts).toEqual(["um fato"]);
  });
});

describe("assistentes do trabalho — a URL e a recusa do serviço", () => {
  const apuracao = { subject: "assunto", observations: ["apurado"], reading: "leitura" };

  it("a leitura de apoio à revisão é da evidência", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: apuracao }));
    await trabalho().assistEvidenceReview("ev-1");
    expect(urlDaChamada().pathname).toBe("/api/v1/evidences/ev-1/review-assistance");
  });

  it("a calibração e o aviso de estagnação são da pessoa", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: apuracao }));
    await trabalho().assistAssessmentCalibration("ana");
    expect(urlDaChamada().pathname).toBe("/api/v1/architects/ana/calibration-assistance");

    fetchMock.mockResolvedValue(
      jsonResponse({ data: { subject: "s", signals: [], requiresAttention: false, alert: null } }),
    );
    fetchMock.mockClear();
    await trabalho().alertAboutStagnation("ana");
    expect(urlDaChamada().pathname).toBe("/api/v1/architects/ana/stagnation-alert");
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

  it("a curadoria do catálogo não fala de pessoa nenhuma", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: apuracao }));
    await trabalho().reviewCatalogQuality();
    expect(urlDaChamada().pathname).toBe("/api/v1/capabilities/quality-review");
  });

  it("a queda do provedor chega como 503 com a mensagem DO SERVIÇO", async () => {
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
      .reviewCatalogQuality()
      .catch((erro: unknown) => erro);
    expect(falha).toBeInstanceOf(ApiError);
    expect((falha as ApiError).status).toBe(503);
    expect((falha as ApiError).code).toBe("WORK_ASSISTANCE_UNAVAILABLE");
    expect((falha as ApiError).message).toContain("indisponível");
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
      .prepareOneOnOne("ana")
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
      .reviewCatalogQuality()
      .catch((erro: unknown) => erro);
    expect(falha).toBeInstanceOf(AssistantTimedOutError);
  });

  it("a resposta que chega a tempo não é confundida com tempo esgotado", async () => {
    const lido = await pessoas(5_000).prepareOneOnOne("ana");
    expect(lido.notice).toBe("Isto é uma sugestão.");
  });
});

async function geraRoteiro(
  agenda: "one-on-one" | "development-plan",
  profile: "empirical" | "moderate" | "methodical",
): Promise<void> {
  await pessoas().writeSessionScript({ architectId: "ana", agenda, profile });
}
