import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError, dismiss: vi.fn() },
  Toaster: () => null,
}));

import { Route as LearningRoute } from "@/routes/learning-paths";
import { apiPath } from "@/lib/api-path";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * A MESMA RÉGUA DA CASA, na porta das Trilhas — o TERCEIRO lugar.
 *
 * O `saveDetails()` do `EditPathDialog` chamava `vm.updateDetails(path, ...)`
 * — `void`, dispara e esquece, porque `updateLearningPath` é gravação
 * otimista — e na sequência acendia o aviso verde E fechava o diálogo. As
 * duas afirmações no clique: a frase dizendo "atualizada" e o diálogo que
 * some, que para quem está na frente da tela é o sistema dizendo "gravei".
 * Com o servidor recusando, a pessoa via as duas coisas do mesmo jeito.
 *
 * A régua está escrita no `removeItem` do view-model do PDI: *"Otimista:
 * `onConfirmed` roda quando o serviço confirma — o aviso de sucesso vai lá,
 * não no clique."* É o mesmo seio de Ciclos (`ee05c75`), sem caminho novo.
 *
 * A frase é a da casa, com o `messageCode` que o serviço já publica neste
 * PATCH (`learningPath.update.success`) e que ninguém lia — a chave
 * `msg.learningPath.update.success` existia nas duas línguas.
 */

const fetchMock = vi.fn();

const LearningPage = LearningRoute.options.component as () => ReactNode;

const TRILHA = fixtureState.learningPaths[0]!;
const NOME_NOVO = `${TRILHA.name} revisada`;

const ehEdicaoDaTrilha = (href: string, init?: RequestInit) =>
  init?.method === "PATCH" && href.includes(`${apiPath("/learning-paths")}/${TRILHA.id}`);

const recusa: FetchRoute = (href, init) =>
  ehEdicaoDaTrilha(href, init)
    ? jsonResponse({ error: "Conflict", message: "Trilha alterada por outra pessoa." }, 409)
    : undefined;

/** O envelope de sucesso do serviço: `{ data, message: { code } }`. */
const confirma: FetchRoute = (href, init) =>
  ehEdicaoDaTrilha(href, init)
    ? jsonResponse({
        data: { ...TRILHA, name: NOME_NOVO },
        message: { code: "learningPath.update.success" },
      })
    : undefined;

/** Instala o mock com a edição REPRESADA — a resposta só chega quando soltar. */
function represaAEdicao(): () => void {
  let soltar = () => {};
  const respondido = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  mockAppFetch(fetchMock, { routes: [confirma] });
  const semLatencia = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const resposta = (await semLatencia(url, init)) as Response;
    if (ehEdicaoDaTrilha(String(url), init)) await respondido;
    return resposta;
  });
  return () => soltar();
}

function edicoesDaTrilha(): unknown[] {
  return fetchMock.mock.calls.filter(([url, init]) =>
    ehEdicaoDaTrilha(String(url), init as RequestInit | undefined),
  );
}

/** O diálogo está aberto enquanto o botão "Salvar" dele estiver na tela. */
const dialogoAberto = () => screen.queryByRole("button", { name: "Salvar" }) !== null;

const salvar = () => screen.getByRole("button", { name: "Salvar" });

/**
 * Abre a edição da trilha e MUDA o nome — sem alteração pendente não há o que
 * salvar, e o botão fica desabilitado (é a guarda do segundo clique).
 */
async function abreEdicaoEMudaONome(): Promise<void> {
  renderWithApp(<LearningPage />);
  await screen.findByText(TRILHA.name);
  fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
  const nome = await screen.findByLabelText("Nome");
  fireEvent.change(nome, { target: { value: NOME_NOVO } });
}

describe("Trilhas — a tela só diz que salvou quando o serviço confirma", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("não avisa nem fecha o diálogo enquanto a resposta da edição não chega", async () => {
    const respondido = represaAEdicao();
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());
    await waitFor(() => expect(edicoesDaTrilha()).toHaveLength(1));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(dialogoAberto()).toBe(true);
    respondido();
  });

  it("mantém o diálogo aberto quando o serviço recusa — e mostra a recusa", async () => {
    mockAppFetch(fetchMock, { routes: [recusa] });
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(dialogoAberto()).toBe(true);
  });

  it("fecha o diálogo e avisa que atualizou quando o serviço confirma", async () => {
    mockAppFetch(fetchMock, { routes: [confirma] });
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());

    // O `waitFor` espera o FECHAR (que o código antigo também fazia, na hora);
    // a asserção do aviso fica FORA dele, senão a falha vira "Test timed out"
    // e esconde "esperava a frase, não veio chamada nenhuma".
    await waitFor(() => expect(dialogoAberto()).toBe(false));
    expect(toastSuccess).toHaveBeenCalledWith(`Trilha ${NOME_NOVO} atualizada`);
  });

  /**
   * A PORTA QUE O CONSERTO ABRE, e a tranca que a fecha.
   *
   * No código antigo o diálogo fechava no clique, então não havia segundo
   * envio possível. Deixá-lo aberto até a resposta abre essa porta. A tranca
   * não é um `saving` local — esse ficaria presa em `true` na recusa e
   * travaria a nova tentativa. É a mesma tranca de Ciclos: derivada do
   * ESTADO. A gravação otimista já pôs o nome novo na trilha antes da
   * resposta, então não há mais nada pendente para salvar e o botão se
   * desabilita sozinho; se o serviço recusar, o rollback devolve o nome
   * antigo, a alteração volta a ficar pendente e a pessoa pode tentar de novo.
   */
  it("não aceita um segundo envio enquanto a resposta da edição não chega", async () => {
    const respondido = represaAEdicao();
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());
    await waitFor(() => expect(edicoesDaTrilha()).toHaveLength(1));

    // Fora do `waitFor`: se o diálogo tiver fechado no clique, a falha é
    // "não achei o botão Salvar", e não um "Test timed out" que não conta nada.
    expect(salvar()).toHaveProperty("disabled", true);
    fireEvent.click(salvar());
    expect(edicoesDaTrilha()).toHaveLength(1);
    respondido();
  });

  it("devolve o botão Salvar quando o serviço recusa, para a pessoa tentar de novo", async () => {
    mockAppFetch(fetchMock, { routes: [recusa] });
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(dialogoAberto()).toBe(true);
    await waitFor(() => expect(salvar()).toHaveProperty("disabled", false));
  });
});
