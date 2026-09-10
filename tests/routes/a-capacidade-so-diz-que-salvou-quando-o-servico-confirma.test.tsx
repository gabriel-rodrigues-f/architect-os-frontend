import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError, dismiss: vi.fn() },
  Toaster: () => null,
}));

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * A MESMA RÉGUA DA CASA, na porta do Catálogo — o QUARTO lugar.
 *
 * `saveEditingCapability()` chamava `viewModel.renameCapability()` — `void`,
 * dispara e esquece, porque `updateCapability` é gravação otimista — e na
 * sequência acendia o aviso verde E fechava o editor. As duas afirmações no
 * clique: a frase dizendo "atualizada" e o diálogo que some, que para quem
 * está na frente da tela é o sistema dizendo "gravei". Com o servidor
 * recusando, a pessoa via as duas coisas do mesmo jeito, e só depois o
 * rollback devolvia o nome antigo à lista.
 *
 * A régua está escrita no `removeItem` do view-model do PDI: *"Otimista:
 * `onConfirmed` roda quando o serviço confirma — o aviso de sucesso vai lá,
 * não no clique."* É o mesmo desenho do selo "Salvo" do PDI, do diálogo de
 * Ciclos (`7b2d816`) e do salvar de Trilhas (`6f030bf`) — sem caminho novo.
 *
 * A frase é a da casa, com o `messageCode` que o serviço já publica neste
 * PATCH (`catalog.capability.update.success`) e que ninguém lia — a chave
 * `msg.catalog.capability.update.success` já existia nas duas línguas.
 */

const fetchMock = vi.fn();

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const CAPACIDADE = fixtureState.capabilities[0]!;
const NOME_NOVO = `${CAPACIDADE.name} revisada`;

const ehEdicaoDaCapacidade = (href: string, init?: RequestInit) =>
  init?.method === "PATCH" && href.includes(`${apiPath("/capabilities")}/${CAPACIDADE.id}`);

const recusa: FetchRoute = (href, init) =>
  ehEdicaoDaCapacidade(href, init)
    ? jsonResponse({ error: "Conflict", message: "Capacidade alterada por outra pessoa." }, 409)
    : undefined;

/** O envelope de sucesso do serviço: `{ data, message: { code } }`. */
const confirma: FetchRoute = (href, init) =>
  ehEdicaoDaCapacidade(href, init)
    ? jsonResponse({
        data: { ...CAPACIDADE, name: NOME_NOVO },
        message: { code: "catalog.capability.update.success" },
      })
    : undefined;

/** Instala o mock com a edição REPRESADA — a resposta só chega quando soltar. */
function represaAEdicao(): () => void {
  let soltar = () => {};
  const respondido = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    state: fixtureState,
    routes: [confirma, careerLevelsRoute],
  });
  const semLatencia = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const resposta = (await semLatencia(url, init)) as Response;
    if (ehEdicaoDaCapacidade(String(url), init)) await respondido;
    return resposta;
  });
  return () => soltar();
}

function edicoesDaCapacidade(): unknown[] {
  return fetchMock.mock.calls.filter(([url, init]) =>
    ehEdicaoDaCapacidade(String(url), init as RequestInit | undefined),
  );
}

/** O editor está aberto enquanto o botão "Salvar" dele estiver na tela. */
const editorAberto = () => screen.queryByRole("button", { name: "Salvar" }) !== null;

const salvar = () => screen.getByRole("button", { name: "Salvar" });

/**
 * Abre a edição da capacidade e MUDA o nome — sem alteração pendente não há o
 * que salvar, e o botão fica desabilitado (é a guarda do segundo clique).
 */
async function abreEdicaoEMudaONome(): Promise<void> {
  renderWithApp(<MatrixPage />);
  await screen.findByText(CAPACIDADE.name);
  fireEvent.click(screen.getByRole("button", { name: `Editar ${CAPACIDADE.name}` }));
  const nome = await screen.findByLabelText("Nome");
  fireEvent.change(nome, { target: { value: NOME_NOVO } });
}

describe("Catálogo — a tela só diz que salvou a capacidade quando o serviço confirma", () => {
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

  it("não avisa nem fecha o editor enquanto a resposta da edição não chega", async () => {
    const respondido = represaAEdicao();
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());
    await waitFor(() => expect(edicoesDaCapacidade()).toHaveLength(1));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(editorAberto()).toBe(true);
    respondido();
  });

  it("mantém o editor aberto quando o serviço recusa — e mostra a recusa", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [recusa, careerLevelsRoute],
    });
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(editorAberto()).toBe(true);
  });

  it("fecha o editor e avisa que atualizou quando o serviço confirma", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [confirma, careerLevelsRoute],
    });
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());

    // O `waitFor` espera o FECHAR (que o código antigo também fazia, na hora);
    // a asserção do aviso fica FORA dele, senão a falha vira "Test timed out"
    // e esconde "esperava a frase, não veio chamada nenhuma".
    await waitFor(() => expect(editorAberto()).toBe(false));
    expect(toastSuccess).toHaveBeenCalledWith(`Capacidade ${NOME_NOVO} atualizada`);
  });

  /**
   * A PORTA QUE O CONSERTO ABRE, e a tranca que a fecha.
   *
   * No código antigo o editor fechava no clique, então não havia segundo
   * envio possível. Deixá-lo aberto até a resposta abre essa porta. A tranca
   * não é um `saving` local — esse ficaria preso em `true` na recusa e
   * travaria a nova tentativa. É a mesma tranca de Ciclos e de Trilhas:
   * derivada do ESTADO. A gravação otimista já pôs o nome novo na capacidade
   * antes da resposta, então não há mais nada pendente para salvar e o botão
   * se desabilita sozinho; se o serviço recusar, o rollback devolve o nome
   * antigo, a alteração volta a ficar pendente e a pessoa tenta de novo.
   */
  it("não aceita um segundo envio enquanto a resposta da edição não chega", async () => {
    const respondido = represaAEdicao();
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());
    await waitFor(() => expect(edicoesDaCapacidade()).toHaveLength(1));

    // Fora do `waitFor`: se o editor tiver fechado no clique, a falha é
    // "não achei o botão Salvar", e não um "Test timed out" que não conta nada.
    expect(salvar()).toHaveProperty("disabled", true);
    fireEvent.click(salvar());
    expect(edicoesDaCapacidade()).toHaveLength(1);
    respondido();
  });

  it("devolve o botão Salvar quando o serviço recusa, para a pessoa tentar de novo", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [recusa, careerLevelsRoute],
    });
    await abreEdicaoEMudaONome();

    fireEvent.click(salvar());

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(editorAberto()).toBe(true);
    await waitFor(() => expect(salvar()).toHaveProperty("disabled", false));
  });

  /** A tecla Enter é o MESMO caminho do botão — não pode escapar da tranca. */
  it("o Enter no campo do nome passa pela mesma porta do botão", async () => {
    const respondido = represaAEdicao();
    await abreEdicaoEMudaONome();

    fireEvent.keyDown(screen.getByLabelText("Nome"), { key: "Enter" });
    await waitFor(() => expect(edicoesDaCapacidade()).toHaveLength(1));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(editorAberto()).toBe(true);
    fireEvent.keyDown(screen.getByLabelText("Nome"), { key: "Enter" });
    expect(edicoesDaCapacidade()).toHaveLength(1);
    respondido();
  });
});
