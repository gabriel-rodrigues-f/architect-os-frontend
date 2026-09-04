import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "@/lib/api-client";
import { SESSION_ENDING_CODES as PRODUCTION_CODES, SessionPolicy } from "@/lib/session-policy";

/**
 * ONDA3/FE4, item 1 — a política de sessão saiu de dentro do transporte para
 * um interceptor explícito. O redirect para o login casa CÓDIGO **e** STATUS:
 * errar a grafia de um dos três códigos, ou soltar o casamento com o 401,
 * prende quem usa o produto numa sessão morta — erro atrás de erro, sem
 * nunca voltar ao login. Nenhum teste de backend denuncia isso.
 *
 * Este arquivo foi escrito ANTES da extração e as asserções abaixo não
 * mudaram durante ela: é a rede de segurança do refactor, não a sua foto
 * depois de pronto.
 */

const fetchMock = vi.fn();

function errorResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const SESSION_ENDING_CODES = ["AUTHENTICATION_REQUIRED", "SESSION_INVALID", "SESSION_REVOKED"];

describe("política de sessão — 401 + código encerra a sessão", () => {
  let endSession: ReturnType<typeof vi.fn>;
  let policy: SessionPolicy;
  let client: ApiClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    endSession = vi.fn();
    policy = new SessionPolicy();
    client = new ApiClient("http://api.local", (error) => policy.reviewFailure(error));
    policy.whenSessionEnded(endSession);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a lista de códigos de produção é exatamente estes três", () => {
    expect([...PRODUCTION_CODES]).toEqual(SESSION_ENDING_CODES);
  });

  for (const code of SESSION_ENDING_CODES) {
    it(`401 com ${code} encerra a sessão`, async () => {
      fetchMock.mockResolvedValue(errorResponse({ code, message: "Sessão inválida." }, 401));
      await client.request("/state").catch(() => undefined);
      expect(endSession).toHaveBeenCalledTimes(1);
    });

    it(`${code} fora do 401 não encerra a sessão`, async () => {
      fetchMock.mockResolvedValue(errorResponse({ code, message: "Proibido." }, 403));
      await client.request("/state").catch(() => undefined);
      expect(endSession).not.toHaveBeenCalled();
    });
  }

  it("503 DATABASE_UNAVAILABLE não encerra a sessão — o contrato que atravessa os dois repositórios", async () => {
    fetchMock.mockResolvedValue(
      errorResponse(
        {
          code: "DATABASE_UNAVAILABLE",
          message: "Banco de dados temporariamente indisponível. Tente novamente em instantes.",
        },
        503,
      ),
    );

    await client.request("/state").catch(() => undefined);

    expect(endSession).not.toHaveBeenCalled();
  });

  it("401 de erro de negócio (INVALID_CURRENT_PASSWORD) não encerra a sessão", async () => {
    fetchMock.mockResolvedValue(
      errorResponse({ code: "INVALID_CURRENT_PASSWORD", message: "Senha atual incorreta" }, 401),
    );
    await client.request("/auth/change-password", { method: "POST" }).catch(() => undefined);
    expect(endSession).not.toHaveBeenCalled();
  });

  it("401 sem código nenhum não encerra a sessão", async () => {
    fetchMock.mockResolvedValue(errorResponse({ message: "Sem sessão." }, 401));
    await client.request("/auth/me").catch(() => undefined);
    expect(endSession).not.toHaveBeenCalled();
  });

  it("401 com corpo ilegível não encerra a sessão", async () => {
    fetchMock.mockResolvedValue(new Response("<html>gateway</html>", { status: 401 }));
    await client.request("/state").catch(() => undefined);
    expect(endSession).not.toHaveBeenCalled();
  });

  for (const nearMiss of ["session_invalid", "SESSION_EXPIRED", "SESSION_REVOKE", "UNAUTHORIZED"]) {
    it(`401 com o código parecido "${nearMiss}" não encerra a sessão`, async () => {
      fetchMock.mockResolvedValue(
        errorResponse({ code: nearMiss, message: "Não autorizado" }, 401),
      );
      await client.request("/state").catch(() => undefined);
      expect(endSession).not.toHaveBeenCalled();
    });
  }

  it("sucesso não encerra a sessão", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await client.request("/state");
    expect(endSession).not.toHaveBeenCalled();
  });

  it("desregistrar o handler para de encerrar a sessão", async () => {
    policy.whenSessionEnded(null);
    fetchMock.mockResolvedValue(errorResponse({ code: "SESSION_REVOKED" }, 401));
    await client.request("/state").catch(() => undefined);
    expect(endSession).not.toHaveBeenCalled();
  });

  it("a exportação de PDF também encerra a sessão em 401 SESSION_REVOKED", async () => {
    fetchMock.mockResolvedValue(errorResponse({ code: "SESSION_REVOKED" }, 401));
    await client.requestBlob("/reports/evolution.pdf", {}).catch(() => undefined);
    expect(endSession).toHaveBeenCalledTimes(1);
  });
});

/**
 * ONDA 41 — a segunda recusa que a política precisa reconhecer: a marca do
 * primeiro acesso. A sessão continua VÁLIDA (é 403, não 401) e encerrá-la
 * mandaria de volta ao login quem só precisa trocar a senha; ignorá-la
 * desenharia "você não tem permissão" para quem tem, e não daria à pessoa
 * nada que ela pudesse fazer a respeito.
 */
describe("política de sessão — 403 PASSWORD_CHANGE_REQUIRED leva à troca, não ao login", () => {
  let endSession: ReturnType<typeof vi.fn>;
  let requirePasswordChange: ReturnType<typeof vi.fn>;
  let policy: SessionPolicy;
  let client: ApiClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    endSession = vi.fn();
    requirePasswordChange = vi.fn();
    policy = new SessionPolicy();
    client = new ApiClient("http://api.local", (error) => policy.reviewFailure(error));
    policy.whenSessionEnded(endSession);
    policy.whenPasswordChangeRequired(requirePasswordChange);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("403 com a marca pede a troca e NÃO encerra a sessão", async () => {
    fetchMock.mockResolvedValue(
      errorResponse(
        {
          code: SessionPolicy.PASSWORD_CHANGE_REQUIRED_CODE,
          message: "Troque a sua senha para continuar.",
        },
        403,
      ),
    );

    await client.request("/state").catch(() => undefined);

    expect(requirePasswordChange).toHaveBeenCalledTimes(1);
    expect(endSession).not.toHaveBeenCalled();
  });

  it("403 de permissão comum não pede troca nenhuma", async () => {
    fetchMock.mockResolvedValue(errorResponse({ code: "FORBIDDEN", message: "Proibido." }, 403));
    await client.request("/state").catch(() => undefined);
    expect(requirePasswordChange).not.toHaveBeenCalled();
  });

  it("a marca fora do 403 não pede troca — o casamento é código E status", async () => {
    fetchMock.mockResolvedValue(
      errorResponse({ code: SessionPolicy.PASSWORD_CHANGE_REQUIRED_CODE }, 401),
    );
    await client.request("/state").catch(() => undefined);
    expect(requirePasswordChange).not.toHaveBeenCalled();
  });

  it("desregistrar o handler para de pedir a troca", async () => {
    policy.whenPasswordChangeRequired(null);
    fetchMock.mockResolvedValue(
      errorResponse({ code: SessionPolicy.PASSWORD_CHANGE_REQUIRED_CODE }, 403),
    );
    await client.request("/state").catch(() => undefined);
    expect(requirePasswordChange).not.toHaveBeenCalled();
  });
});
