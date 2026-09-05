import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContextScope } from "@/lib/context-scope";
import { apiPath } from "@/lib/api-path";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Ressalva herdada: o `resource` do `ConnectionError` era mutante VIVO — o
 * único consumidor dele é o diagnóstico de desenvolvimento, e nenhum teste o
 * olhava. Pior que não pinado: ele MENTIA. O `ContextScope` renderizava a
 * tela de falha sem dizer o que falhou, e o padrão do componente era
 * `/api/v1/state` — a rota do blob que o estrangulamento tirou dessas telas
 * (e que hoje não existe mais). Quem depurava uma falha em `plans` era
 * mandado investigar `/state`.
 *
 * Duas mudanças prendem isso:
 *   - `resource` deixou de ter padrão. Quem mostra a falha é obrigado a
 *     dizer o que falhou, então nenhum padrão pode voltar a mentir;
 *   - o `ContextScope` nomeia o CONTEXTO que falhou, e não uma rota HTTP
 *     copiada do gateway — é a palavra do domínio, e é a única fonte que ele
 *     já tem em mãos (sem literal novo em lugar nenhum).
 */
const fetchMock = vi.fn();

const TELA_DE_FALHA = "Não foi possível acessar o serviço";

const rotaQueFalha =
  (caminho: string): FetchRoute =>
  (href) =>
    href.endsWith(apiPath(caminho))
      ? jsonResponse({ code: "INTERNAL", message: "x" }, 500)
      : undefined;

let diagnostico: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  diagnostico = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const linhasDeDiagnostico = (): string[] =>
  diagnostico.mock.calls.map((argumentos) => String(argumentos[0]));

describe("a tela de falha diz QUAL leitura falhou, não a rota do blob antigo", () => {
  it("falha em plans nomeia plans — nunca /state", async () => {
    mockAppFetch(fetchMock, { state: fixtureState, routes: [rotaQueFalha("/plans")] });
    renderWithApp(
      <ContextScope contexts={["plans"]}>
        <p>conteúdo</p>
      </ContextScope>,
    );
    await screen.findByText(TELA_DE_FALHA, undefined, { timeout: 5000 });
    const diagnosticos = linhasDeDiagnostico().filter((linha) =>
      linha.includes("falha ao carregar"),
    );
    expect(diagnosticos.some((linha) => linha.includes("plans"))).toBe(true);
    expect(diagnosticos.some((linha) => linha.includes("state"))).toBe(false);
  });

  it("falha em evidences nomeia evidences — o rótulo acompanha o que quebrou", async () => {
    mockAppFetch(fetchMock, { state: fixtureState, routes: [rotaQueFalha("/evidences")] });
    renderWithApp(
      <ContextScope contexts={["evidences"]}>
        <p>conteúdo</p>
      </ContextScope>,
    );
    await screen.findByText(TELA_DE_FALHA, undefined, { timeout: 5000 });
    const diagnosticos = linhasDeDiagnostico().filter((linha) =>
      linha.includes("falha ao carregar"),
    );
    expect(diagnosticos.some((linha) => linha.includes("evidences"))).toBe(true);
    expect(diagnosticos.some((linha) => linha.includes("plans"))).toBe(false);
  });

  it("entre vários contextos, o nomeado é o que falhou, não o primeiro pedido", async () => {
    mockAppFetch(fetchMock, { state: fixtureState, routes: [rotaQueFalha("/evidences")] });
    renderWithApp(
      <ContextScope contexts={["architects", "plans", "evidences"]}>
        <p>conteúdo</p>
      </ContextScope>,
    );
    await screen.findByText(TELA_DE_FALHA, undefined, { timeout: 5000 });
    const diagnosticos = linhasDeDiagnostico().filter((linha) =>
      linha.includes("falha ao carregar"),
    );
    expect(diagnosticos.some((linha) => linha.includes("evidences"))).toBe(true);
    expect(diagnosticos.some((linha) => linha.includes("architects"))).toBe(false);
  });
});
