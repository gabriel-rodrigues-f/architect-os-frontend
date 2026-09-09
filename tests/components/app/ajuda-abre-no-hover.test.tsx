import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardHelp, PageHelp, SectionHelp } from "@/components/app";
import { fixtureAssignedManagerUser } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * Dono (2026-09-09), literal: *"percebi algo no nosso botão de interrogação
 * ao lado direito do título: ele mostra para que aquela tela serve quando
 * clicamos. Está incorreto. Isso deve ocorrer em hover."*
 *
 * O que este arquivo guarda é o que o pedido NÃO diz e o desenho quebra se
 * esquecer: hover não existe no toque nem no teclado. Trocar o clique pelo
 * hover deixaria a explicação inalcançável no celular e para quem navega por
 * teclado — um defeito trocado por outro pior. Então o gatilho abre nas TRÊS
 * formas (ponteiro, foco, clique/toque) e a régua é a mesma do cartão do
 * filtro bloqueado: quem fecha é a saída do CONJUNTO gatilho+cartão, o Esc ou
 * o clique fora — nunca o mesmo gesto que acabou de abrir.
 *
 * Vale para as três ajudas da casa, porque são o mesmo gatilho: a da tela
 * (`PageHelp`), a do card do Painel (`CardHelp`) e a da seção (`SectionHelp`).
 */
const fetchMock = vi.fn();

const conteudoDaTela = {
  lead: {
    title: "Prioridades de Desenvolvimento",
    what: "As lacunas do time, em ordem.",
    comesFrom: "Das avaliações do ciclo.",
    nextStep: "Abra o PDI de quem está mais distante.",
  },
  member: {
    title: "Minhas Prioridades",
    what: "As suas lacunas, em ordem.",
    comesFrom: "Da sua avaliação do ciclo.",
    nextStep: "Converse com quem lidera você.",
  },
};

const montar = (tela: ReactNode) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user: fixtureAssignedManagerUser });
  return renderWithApp(tela);
};

/** A sessão chega por fetch: o gatilho só existe depois que a tela responde. */
const gatilhoDaTela = () =>
  screen.findByRole("button", { name: "Como usar Prioridades de Desenvolvimento" });

describe("a ajuda abre no hover, sem perder o toque nem o teclado", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o ponteiro sozinho abre a explicação — sem clique nenhum", async () => {
    montar(<PageHelp content={conteudoDaTela} />);
    const user = userEvent.setup();

    expect(screen.queryByRole("dialog")).toBeNull();
    await user.hover(await gatilhoDaTela());

    const ajuda = await screen.findByRole("dialog");
    expect(ajuda.textContent).toContain("Prioridades de Desenvolvimento");
    expect(ajuda.textContent).toContain("As lacunas do time, em ordem.");
    expect(ajuda.textContent).toContain("Das avaliações do ciclo.");
    expect(ajuda.textContent).toContain("Abra o PDI de quem está mais distante.");
  });

  it("o foco do teclado abre, e a ajuda não rouba o foco de quem chegou nela", async () => {
    montar(<PageHelp content={conteudoDaTela} />);

    (await gatilhoDaTela()).focus();

    await screen.findByRole("dialog");
    expect(document.activeElement).toBe(await gatilhoDaTela());
  });

  it("o clique continua abrindo — e não fecha o que o ponteiro abriu", async () => {
    montar(<PageHelp content={conteudoDaTela} />);
    const user = userEvent.setup();

    await user.hover(await gatilhoDaTela());
    const ajuda = await screen.findByRole("dialog");

    await user.click(await gatilhoDaTela());

    expect(screen.queryByRole("dialog")).toBe(ajuda);
  });

  /**
   * O TOQUE, que é o caso que o pedido do dono cria e não menciona. Um toque
   * dispara `pointerenter`, `click` e `pointerleave` em sequência — e nem
   * todo navegador de celular dá foco a um `<button>` tocado. Se o
   * `pointerleave` do próprio dedo fechasse, a explicação apareceria e
   * sumiria no mesmo toque, e a tela ficaria PIOR do que antes do pedido.
   */
  it("no toque, o dedo sai do botão e a explicação continua na tela", async () => {
    montar(<PageHelp content={conteudoDaTela} />);
    const gatilho = await gatilhoDaTela();

    fireEvent.pointerEnter(gatilho);
    fireEvent.click(gatilho);
    fireEvent.pointerLeave(gatilho);

    const ajuda = await screen.findByRole("dialog");
    await new Promise((pronto) => setTimeout(pronto, 20));
    expect(screen.queryByRole("dialog")).toBe(ajuda);
    expect(document.activeElement).not.toBe(gatilho);
  });

  it("sair do gatilho PARA a ajuda não fecha — senão não daria para ler o texto", async () => {
    montar(<PageHelp content={conteudoDaTela} />);
    const user = userEvent.setup();

    await user.hover(await gatilhoDaTela());
    const ajuda = await screen.findByRole("dialog");

    await user.hover(ajuda);

    expect(screen.queryByRole("dialog")).toBe(ajuda);
  });

  it("sair do conjunto fecha", async () => {
    montar(<PageHelp content={conteudoDaTela} />);
    const user = userEvent.setup();

    await user.hover(await gatilhoDaTela());
    await screen.findByRole("dialog");

    await user.unhover(await gatilhoDaTela());

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Enter leva o foco para dentro da ajuda, e o Esc devolve o foco ao gatilho sem reabrir", async () => {
    montar(<PageHelp content={conteudoDaTela} />);
    const user = userEvent.setup();

    (await gatilhoDaTela()).focus();
    await user.keyboard("{Enter}");

    const ajuda = await screen.findByRole("dialog");
    await waitFor(() => expect(ajuda.contains(document.activeElement)).toBe(true));

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(await gatilhoDaTela());
  });

  it("a régua é do gatilho, não da tela: o card do Painel abre no hover", async () => {
    montar(<CardHelp title="Profissionais" what="Quantas pessoas." how="Compare com o mês." />);
    const user = userEvent.setup();

    await user.hover(await screen.findByRole("button", { name: "Como ler Profissionais" }));

    expect((await screen.findByRole("dialog")).textContent).toContain("Quantas pessoas.");
  });

  it("a régua é do gatilho, não da tela: a ajuda de seção abre no hover", async () => {
    montar(<SectionHelp section="policy" />);
    const user = userEvent.setup();

    const gatilho = await screen.findByRole("button", { name: /^Como configurar / });
    await user.hover(gatilho);

    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
