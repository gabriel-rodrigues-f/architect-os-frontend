import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, API_URL } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { apiPath } from "@/lib/api-path";
import { HttpNoticesGateway } from "@/lib/gateways/notices.gateway";

/**
 * A onda 24 ligou o `HttpNoticesGateway` no container de produção, e a partir
 * daí a Central e o sino leem do servidor. A QUERYSTRING que ele monta nunca
 * foi afirmada por teste nenhum: `status`, `limit` e `before` só existiam na
 * implementação. Trocar `filter.status` por `"all"` fixo — ou perder o
 * `before` — deixa o filtro "Não lidos" e a paginação quebrados EM SILÊNCIO,
 * porque a tela continua desenhando a lista que voltou.
 *
 * Estes testes olham a URL que sai no `fetch`, não o que o gateway devolve:
 * é o único lugar onde o contrato de leitura da Central fica visível do lado
 * do cliente. E o caminho de ERRO entra junto — até aqui a rede do PRD-02 só
 * conhecia o caminho feliz.
 */
const fetchMock = vi.fn();

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const paginaVazia = { data: { notices: [], unreadCount: 0 } };

const gatewayComInterceptador = (interceptar: (error: ApiError) => void = () => {}) =>
  new HttpNoticesGateway(new ApiClient(API_URL, interceptar));

const gateway = () => gatewayComInterceptador();

const urlDaChamada = (indice = 0): URL => {
  const chamada = fetchMock.mock.calls[indice];
  expect(chamada).toBeDefined();
  return new URL(String(chamada![0]));
};

const metodoDaChamada = (indice = 0): string => {
  const chamada = fetchMock.mock.calls[indice];
  expect(chamada).toBeDefined();
  return String((chamada![1] as RequestInit | undefined)?.method ?? "GET");
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(paginaVazia));
  vi.stubGlobal("fetch", fetchMock);
});

describe("HttpNoticesGateway — a querystring da leitura é contrato", () => {
  it("o filtro 'Não lidos' viaja como status=unread", async () => {
    await gateway().notices({ status: "unread" });
    expect(urlDaChamada().searchParams.get("status")).toBe("unread");
  });

  it("o filtro 'Todos' viaja como status=all — os dois valores chegam distintos", async () => {
    await gateway().notices({ status: "all" });
    expect(urlDaChamada().searchParams.get("status")).toBe("all");
  });

  it("a rota é /notices sob o prefixo da API, sem caminho inventado", async () => {
    await gateway().notices({ status: "all" });
    expect(urlDaChamada().pathname).toBe(apiPath("/notices"));
    expect(metodoDaChamada()).toBe("GET");
  });

  it("o limite do sino viaja como limit — é ele que corta a página", async () => {
    await gateway().notices({ status: "all", limit: 5 });
    expect(urlDaChamada().searchParams.get("limit")).toBe("5");
  });

  it("sem limite declarado, a chave limit não vai — nem vazia, nem 'undefined'", async () => {
    await gateway().notices({ status: "all" });
    expect(urlDaChamada().searchParams.has("limit")).toBe(false);
  });

  it("o cursor da paginação viaja como before, com o instante intacto", async () => {
    const cursor = "2026-08-29T12:00:00.000Z";
    await gateway().notices({ status: "unread", limit: 5, before: cursor });
    const query = urlDaChamada().searchParams;
    expect(query.get("before")).toBe(cursor);
    expect(query.get("status")).toBe("unread");
    expect(query.get("limit")).toBe("5");
  });

  it("sem cursor declarado, a chave before não vai — a primeira página não pede corte", async () => {
    await gateway().notices({ status: "unread" });
    expect(urlDaChamada().searchParams.has("before")).toBe(false);
  });

  it("cursor com fuso não perde o sinal de mais — escapado uma vez, volta cru", async () => {
    const cursor = "2026-08-29T12:00:00.000+03:00";
    await gateway().notices({ status: "all", before: cursor });
    expect(urlDaChamada().searchParams.get("before")).toBe(cursor);
  });
});

describe("HttpNoticesGateway — o que volta do servidor", () => {
  it("carimba a origem como dado da organização, não como demonstração", async () => {
    fetchMock.mockResolvedValue(jsonResponse(paginaVazia));
    const page = await gateway().notices({ status: "all" });
    expect(page.dataOrigin).toBe("organization");
  });

  it("a contagem de não lidos é a do servidor, não a da página que voltou", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: {
          notices: [
            {
              id: "aviso-1",
              eventType: "assessment.stalled",
              title: "Avaliação parada",
              link: "/assessments",
              occurredAt: "2026-08-29T12:00:00.000Z",
              readAt: null,
              architectId: "demo-ana-martins",
              teamId: "time-real",
            },
          ],
          unreadCount: 7,
        },
      }),
    );
    const page = await gateway().notices({ status: "unread", limit: 1 });
    expect(page.notices).toHaveLength(1);
    expect(page.unreadCount).toBe(7);
  });

  it("payload fora do contrato é recusado — a tela não recebe forma desconhecida", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { notices: [{ id: 1 }] } }));
    await expect(gateway().notices({ status: "all" })).rejects.toThrow();
  });
});

describe("HttpNoticesGateway — o caminho de erro", () => {
  it("falha do servidor vira ApiError com o código e o status que vieram", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "INTERNAL", message: "Falha ao ler avisos" }, 500),
    );
    const failure = await gateway()
      .notices({ status: "unread" })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(500);
    expect((failure as ApiError).code).toBe("INTERNAL");
  });

  it("sessão morta na leitura de avisos chega ao interceptador da política de sessão", async () => {
    const interceptadas: ApiError[] = [];
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "SESSION_REVOKED", message: "Sessão revogada" }, 401),
    );
    await gatewayComInterceptador((error) => interceptadas.push(error))
      .notices({ status: "all" })
      .catch(() => undefined);
    expect(interceptadas.map((error) => error.code)).toEqual(["SESSION_REVOKED"]);
    expect(interceptadas[0]!.status).toBe(401);
  });

  it("rede fora do ar não vira página vazia — a leitura rejeita", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(gateway().notices({ status: "all" })).rejects.toThrow(ApiError);
  });
});

describe("HttpNoticesGateway — as escritas endereçam o aviso certo", () => {
  it("marcar um aviso como lido bate em /notices/<id>/read, com POST", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await gateway().markNoticeRead("aviso-42");
    expect(urlDaChamada().pathname).toBe(apiPath("/notices/aviso-42/read"));
    expect(metodoDaChamada()).toBe("POST");
  });

  it("marcar um aviso NÃO cai na rota de marcar todos", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await gateway().markNoticeRead("aviso-42");
    expect(urlDaChamada().pathname).not.toBe(apiPath("/notices/read-all"));
  });

  it("marcar todos bate em /notices/read-all, com POST e sem destinatário no corpo", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await gateway().markAllNoticesRead();
    expect(urlDaChamada().pathname).toBe(apiPath("/notices/read-all"));
    expect(metodoDaChamada()).toBe("POST");
    expect((fetchMock.mock.calls[0]![1] as RequestInit).body).toBe("{}");
  });

  it("falha ao marcar como lido rejeita — o sino não pode dar a leitura por feita", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: "NOT_FOUND", message: "x" }, 404));
    await expect(gateway().markNoticeRead("aviso-42")).rejects.toThrow(ApiError);
  });
});
