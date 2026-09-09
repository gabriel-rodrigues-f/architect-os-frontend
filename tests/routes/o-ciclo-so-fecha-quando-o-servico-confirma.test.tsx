import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError, dismiss: vi.fn() },
  Toaster: () => null,
}));

import { Route as CyclesRoute } from "@/routes/cycles";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * A MESMA RÉGUA DA CASA, na porta dos Ciclos.
 *
 * O `save()` do `CycleDialog` chamava `store.addCycle` / `store.updateCycle` —
 * ambos `void`, dispara e esquece — e fechava o diálogo na sequência. Fechar
 * é a afirmação: para quem está na frente da tela, o diálogo que some é o
 * sistema dizendo "pronto, gravei". Com o servidor recusando, ele sumia
 * igual, e a linha do ciclo desaparecia da lista logo depois, no rollback.
 *
 * As chaves de sucesso já existiam nas duas línguas desde o envelope de
 * mensagens (`msg.cycle.create.success`, `msg.cycle.update.success`) e não
 * tinham consumidor nenhum no frontend — o serviço publicava o código e
 * ninguém escutava.
 *
 * A confirmação chega pelo `onConfirmed` do `MutationRunner`, o mesmo seio que
 * o `removePlanItem` já usava, e o aviso é o da casa (`useSuccessToast` com o
 * `messageCode` da resposta).
 */

const fetchMock = vi.fn();

const CyclesPage = CyclesRoute.options.component as () => ReactNode;

const ROTA_DOS_CICLOS = apiPath("/cycles");

const ehCriacao = (href: string, init?: RequestInit) =>
  init?.method === "POST" && href.includes(ROTA_DOS_CICLOS);

const ehEdicao = (href: string, init?: RequestInit) =>
  init?.method === "PATCH" && href.includes(`${ROTA_DOS_CICLOS}/`);

const recusa = (href: string, init?: RequestInit) =>
  ehCriacao(href, init) || ehEdicao(href, init)
    ? jsonResponse({ error: "Conflict", message: "Ciclo alterado por outra pessoa." }, 409)
    : undefined;

/** O envelope de sucesso do serviço: `{ data, message: { code } }`. */
const confirma =
  (code: string): FetchRoute =>
  (href, init) =>
    ehCriacao(href, init) || ehEdicao(href, init)
      ? jsonResponse(
          {
            data: { id: "2027-h1", name: "2027 H1", start: "2027-01-01", end: "2027-06-30" },
            message: { code },
          },
          ehCriacao(href, init) ? 201 : 200,
        )
      : undefined;

/** Instala o mock com a escrita REPRESADA — a resposta só chega quando soltar. */
function represaAEscrita(): () => void {
  let soltar = () => {};
  const respondido = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    routes: [confirma("cycle.create.success")],
  });
  const semLatencia = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const resposta = (await semLatencia(url, init)) as Response;
    if (ehCriacao(String(url), init)) await respondido;
    return resposta;
  });
  return () => soltar();
}

/** O diálogo está aberto enquanto o botão "Salvar" dele estiver na tela. */
const dialogoAberto = () => screen.queryByRole("button", { name: "Salvar" }) !== null;

async function abreCadastro(): Promise<void> {
  renderWithApp(<CyclesPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Cadastrar Ciclo" }));
  await screen.findByRole("button", { name: "Salvar" });
}

async function abreEdicao(): Promise<void> {
  renderWithApp(<CyclesPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Editar 2026 H1" }));
  await screen.findByRole("button", { name: "Salvar" });
}

describe("Ciclos — o diálogo só fecha quando o serviço confirma", () => {
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

  /**
   * REDE, não vermelho provado: no código antigo o diálogo fechava no clique,
   * então não havia segundo envio possível. Deixar o diálogo aberto abre essa
   * porta, e este teste mede o que fecha ela — a guarda de duplicidade que já
   * existia. A escrita otimista põe o ciclo novo na lista ANTES da resposta,
   * `duplicate` vira verdadeiro e o botão desabilita sozinho enquanto a
   * resposta não chega. Se alguém trocar a escrita otimista por uma esperada,
   * este teste cai e a porta precisa de outra tranca.
   */
  it("não aceita um segundo envio enquanto a resposta do cadastro não chega", async () => {
    const respondido = represaAEscrita();
    await abreCadastro();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true),
    );
    respondido();
  });

  it("mantém o diálogo de cadastro aberto quando o serviço recusa — e mostra a recusa", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [recusa] });
    await abreCadastro();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(dialogoAberto()).toBe(true);
  });

  it("fecha o diálogo de cadastro e avisa que criou quando o serviço confirma", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [confirma("cycle.create.success")] });
    await abreCadastro();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    // O `waitFor` espera o FECHAR (que o código antigo também fazia, na hora);
    // a asserção do aviso fica FORA dele, senão a falha vira "Test timed out"
    // e esconde "esperava a frase, não veio chamada nenhuma".
    await waitFor(() => expect(dialogoAberto()).toBe(false));
    expect(toastSuccess).toHaveBeenCalledWith("Ciclo criado.");
  });

  it("mantém o diálogo de edição aberto quando o serviço recusa", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [recusa] });
    await abreEdicao();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(dialogoAberto()).toBe(true);
  });

  it("fecha o diálogo de edição e avisa que atualizou quando o serviço confirma", async () => {
    mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [confirma("cycle.update.success")] });
    await abreEdicao();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(dialogoAberto()).toBe(false));
    expect(toastSuccess).toHaveBeenCalledWith("Ciclo atualizado.");
  });
});
