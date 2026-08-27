import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as LearningRoute } from "@/routes/learning-paths";
import type { AppState } from "@/lib/api";
import { fixtureState } from "../helpers/fixtures";
import { type FetchRoute, jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * F3/Grupo 1 — perda de digitação nas trilhas de aprendizagem.
 *
 * Três rascunhos locais eram sincronizados por efeito a partir da prop do
 * servidor (`LearningPathItemRow`: título e horas; `ProgressControl`:
 * progresso). Qualquer valor novo vindo do servidor sobrescrevia — em silêncio
 * — o que a pessoa estava editando.
 *
 * Trilha não tem `version` em nenhum ponto do contrato (`api-schemas.ts`,
 * `LearningPath`/`LearningPathItem`/`LearningItemProgress`), então não existe
 * sinal de "sua edição foi superada": a sessão de edição vale enquanto a linha
 * estiver montada, e o remount continua sendo por `key={item.id}` — quem muda
 * é o item, não o conteúdo.
 *
 * O caminho reproduzido é o do próprio app (ver `store-remote-error.test.tsx`):
 * gravação otimista recusada → `cache.invalidate()` → revalidação de
 * `/api/v1/state` → a prop volta ao valor confirmado pelo servidor. Como a perda é
 * uma corrida, o PATCH fica represado até o teste soltar.
 */

const fetchMock = vi.fn();

const LearningPage = LearningRoute.options.component as () => ReactNode;

const TRILHA = fixtureState.learningPaths[0]!;
const ITEM_IAM = TRILHA.items[0]!;
const ITEM_OAUTH = TRILHA.items[1]!;
const PROGRESSO_OAUTH = TRILHA.progress[1]!;

/**
 * Marcador de sincronismo: a revalidação atribui a trilha também ao Bruno.
 * É renderizado direto da prop (checkbox de atribuição no diálogo, linha nova
 * na tela), sem passar por rascunho local nenhum — logo não depende do
 * comportamento sob teste.
 */
const BRUNO = fixtureState.architects[1]!;

function estadoRevalidado(): AppState {
  return {
    ...fixtureState,
    learningPaths: fixtureState.learningPaths.map((path) => ({
      ...path,
      assignedTo: [...path.assignedTo, BRUNO.id],
    })),
  };
}

function statePorChamada(...respostas: AppState[]): FetchRoute {
  let chamadas = 0;
  return (href) => {
    if (!href.endsWith(apiPath("/state"))) return undefined;
    const resposta = respostas[Math.min(chamadas, respostas.length - 1)]!;
    chamadas += 1;
    return jsonResponse(resposta);
  };
}

/** Instala o mock e devolve o gatilho que solta a resposta do PATCH represado. */
function mockComPatchRepresado(): () => void {
  let soltar = () => {};
  const patchRespondido = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  mockAppFetch(fetchMock, {
    routes: [
      (href, init) =>
        init?.method === "PATCH" && href.includes(apiPath("/learning-paths/"))
          ? jsonResponse({ error: "Conflict", message: "Não foi possível salvar agora." }, 409)
          : undefined,
      statePorChamada(fixtureState, estadoRevalidado()),
    ],
  });
  const semLatencia = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const resposta = (await semLatencia(url, init)) as Response;
    if (init?.method === "PATCH") await patchRespondido;
    return resposta;
  });
  return soltar;
}

function patchesDaTrilha(): unknown[] {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      (init as RequestInit | undefined)?.method === "PATCH" &&
      String(url).includes(apiPath("/learning-paths/")),
  );
}

async function abrirEdicaoDaTrilha(): Promise<void> {
  await screen.findByText(TRILHA.name);
  fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
  await screen.findByLabelText(`Título de ${ITEM_IAM.title}`);
}

describe("Trilhas — edição em andamento não é sobrescrita pelo servidor", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mantém o título em digitação quando a revalidação devolve o título anterior", async () => {
    const soltarPatch = mockComPatchRepresado();
    renderWithApp(<LearningPage />);
    await abrirEdicaoDaTrilha();

    // 1. Escreve e sai do campo: grava otimista e sobe o PATCH, que fica represado.
    const titulo = screen.getByLabelText(`Título de ${ITEM_IAM.title}`) as HTMLInputElement;
    fireEvent.change(titulo, { target: { value: `${ITEM_IAM.title} revisado` } });
    fireEvent.blur(titulo);
    await waitFor(() => expect(patchesDaTrilha()).toHaveLength(1));

    // 2. Volta ao campo e continua escrevendo, sem sair.
    const emDigitacao = `${ITEM_IAM.title} revisado v2`;
    fireEvent.change(titulo, { target: { value: emDigitacao } });

    // 3. O servidor recusa; a revalidação chega e é renderizada.
    soltarPatch();
    await waitFor(() =>
      expect((screen.getByLabelText(BRUNO.name) as HTMLInputElement).checked).toBe(true),
    );

    // 4. O que estava sendo digitado sobrevive.
    expect((screen.getByLabelText(`Título de ${ITEM_IAM.title}`) as HTMLInputElement).value).toBe(
      emDigitacao,
    );
  });

  it("mantém as horas em digitação quando a revalidação devolve as horas anteriores", async () => {
    const soltarPatch = mockComPatchRepresado();
    renderWithApp(<LearningPage />);
    await abrirEdicaoDaTrilha();

    const horas = screen.getByLabelText(`Horas de ${ITEM_IAM.title}`) as HTMLInputElement;
    fireEvent.change(horas, { target: { value: "12" } });
    fireEvent.blur(horas);
    await waitFor(() => expect(patchesDaTrilha()).toHaveLength(1));

    fireEvent.change(horas, { target: { value: "16" } });

    soltarPatch();
    await waitFor(() =>
      expect((screen.getByLabelText(BRUNO.name) as HTMLInputElement).checked).toBe(true),
    );

    expect((screen.getByLabelText(`Horas de ${ITEM_IAM.title}`) as HTMLInputElement).value).toBe(
      "16",
    );
  });

  it("mantém o progresso em arrasto quando a revalidação devolve o progresso anterior", async () => {
    const soltarPatch = mockComPatchRepresado();
    renderWithApp(<LearningPage />);

    await screen.findByText(TRILHA.name);
    fireEvent.click(screen.getByLabelText(`Expandir ${TRILHA.name}`));
    const slider = (await screen.findByLabelText(
      `Progresso de Ana Martins em ${ITEM_OAUTH.title}`,
    )) as HTMLInputElement;
    expect(slider.value).toBe(String(PROGRESSO_OAUTH.progress));

    // 1. Arrasta e solta: grava otimista e sobe o PATCH, que fica represado.
    fireEvent.change(slider, { target: { value: "60" } });
    fireEvent.mouseUp(slider);
    await waitFor(() => expect(patchesDaTrilha()).toHaveLength(1));

    // 2. Recomeça o arrasto e ainda não soltou.
    fireEvent.change(slider, { target: { value: "80" } });

    // 3. O servidor recusa; a revalidação chega e é renderizada (Bruno entra na trilha).
    soltarPatch();
    await screen.findByLabelText(`Progresso de ${BRUNO.name} em ${ITEM_OAUTH.title}`);

    // 4. A posição em que a pessoa está arrastando sobrevive.
    expect(
      (screen.getByLabelText(`Progresso de Ana Martins em ${ITEM_OAUTH.title}`) as HTMLInputElement)
        .value,
    ).toBe("80");
  });
});
