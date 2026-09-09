import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { ContextScope } from "@/lib/context-scope";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * O DEFEITO QUE TRAVOU O DONO (2026-09-09): *"um 404 de UMA rota derrubou
 * três telas de uma vez"*.
 *
 * O `ConnectionError` desenhava a tela de queda — a corrida de carreira, a
 * mesma que aparece quando o backend está desligado — para QUALQUER falha de
 * consulta. Um 404 de uma rota, um 403 de um recurso que a pessoa não alcança,
 * uma fatia que ainda não existe no serviço: tudo virava "o serviço caiu",
 * e a aplicação inteira sumia por causa de uma leitura.
 *
 * A régua, que é a mesma da `ServiceOutage`: a tela de queda é para quando a
 * aplicação NÃO CONSEGUE FALAR com a casa — não houve resposta, ou a casa
 * respondeu que não consegue responder (5xx). 404 e 403 são RESPOSTAS
 * legítimas: a casa falou, e o que ela disse é assunto da tela que perguntou.
 */
const fetchMock = vi.fn();

/** O marcador estável da tela de queda, com a corrida de carreira. */
const TELA_DE_QUEDA = "service-outage";

const rotaQueResponde =
  (caminho: string, status: number, code = "SEJA_QUAL_FOR"): FetchRoute =>
  (href) =>
    href.endsWith(apiPath(caminho))
      ? jsonResponse({ code, message: "detalhe da casa" }, status)
      : undefined;

const rotaSemResposta =
  (caminho: string): FetchRoute =>
  (href) => {
    if (!href.endsWith(apiPath(caminho))) return undefined;
    throw new TypeError("Failed to fetch");
  };

function desenharComFalhaEm(rota: FetchRoute) {
  mockAppFetch(fetchMock, { state: fixtureState, routes: [rota] });
  renderWithApp(
    <ContextScope contexts={["plans"]}>
      <p>o conteúdo da tela</p>
    </ContextScope>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("uma rota que RECUSA não é o serviço caindo", () => {
  for (const [nome, status] of [
    ["404 — a rota respondeu que não achou", 404],
    ["403 — a rota respondeu que a pessoa não alcança", 403],
    ["409 — a rota respondeu que alguém mudou o registro antes", 409],
  ] as const) {
    it(`${nome}: nada de corrida de carreira, e a falha fica contida`, async () => {
      desenharComFalhaEm(rotaQueResponde("/plans", status));

      const aviso = await screen.findByRole("alert", undefined, { timeout: 5000 });
      expect(aviso.textContent ?? "").not.toBe("");
      expect(screen.queryByTestId(TELA_DE_QUEDA)).toBeNull();
      expect(screen.queryByRole("img", { name: /Corrida de carreira|Career run/ })).toBeNull();
    });
  }

  it("a recusa não repete a frase que o SERVIÇO escreveu", async () => {
    desenharComFalhaEm(rotaQueResponde("/plans", 404));

    await screen.findByRole("alert", undefined, { timeout: 5000 });
    expect(document.body.textContent ?? "").not.toContain("detalhe da casa");
  });
});

describe("a casa muda ou fora do ar continua sendo a tela de queda", () => {
  it("500: o serviço respondeu que não consegue responder — a corrida entra", async () => {
    desenharComFalhaEm(rotaQueResponde("/plans", 500));

    expect(await screen.findByTestId(TELA_DE_QUEDA, undefined, { timeout: 5000 })).toBeTruthy();
  });

  /**
   * O 503 é sobrecarregado: ele diz "a casa caiu" e também "a leitura em
   * linguagem natural não veio". Quem separa os dois é o CÓDIGO — o banco
   * fora do ar é queda; um 503 que a tela não reconhece fica contido, porque
   * trocar a aplicação inteira pelo jogo é o erro mais caro dos dois.
   */
  it("503 do banco fora do ar: a corrida entra", async () => {
    desenharComFalhaEm(rotaQueResponde("/plans", 503, "DATABASE_UNAVAILABLE"));

    expect(await screen.findByTestId(TELA_DE_QUEDA, undefined, { timeout: 5000 })).toBeTruthy();
  });

  it("503 de uma capacidade à parte NÃO troca a tela pelo jogo", async () => {
    desenharComFalhaEm(rotaQueResponde("/plans", 503, "AI_NARRATION_UNAVAILABLE"));

    await screen.findByRole("alert", undefined, { timeout: 5000 });
    expect(screen.queryByTestId(TELA_DE_QUEDA)).toBeNull();
  });

  it("sem resposta nenhuma (o fetch rejeitou): a corrida entra", async () => {
    desenharComFalhaEm(rotaSemResposta("/plans"));

    expect(await screen.findByTestId(TELA_DE_QUEDA, undefined, { timeout: 5000 })).toBeTruthy();
  });
});
