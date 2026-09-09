import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapabilityHeatmap } from "@/components/app/CapabilityHeatmap";
import { SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { createSelectors } from "@/lib/selectors";
import { fixtureAdminUser, fixtureState } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * Dono (2026-09-08), Prontidão > Mapa de Calor: *"cada coluna de capacidade
 * ganha uma setinha que ordena a tabela por aquela coluna, crescente e
 * decrescente"*. A ordenação por cabeçalho já existia em "Risco de
 * Concentração" e em "Usuários" — o mapa reusa o MESMO `SortableHeader` e o
 * mesmo par `TableOrder`, em vez de escrever a terceira.
 *
 * A coluna continua mostrando a SIGLA da capacidade, e o nome inteiro segue
 * ao alcance: é ele que nomeia o botão ("Ordenar por Cloud Architecture") e
 * é ele que o balão devolve no ponteiro e no teclado ([F-02]).
 *
 * A sonda é a fixture: em "Cloud Architecture", Ana tem média 4 e Bruno 2,5.
 */
const fetchMock = vi.fn();

const renderMapa = () => {
  mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState });
  const sel = createSelectors(fixtureState);
  renderWithApp(
    <CapabilityHeatmap
      professionals={fixtureState.professionals}
      capabilities={fixtureState.capabilities}
      capabilityAveragesFor={sel.capabilityAverages}
    />,
    { contexts: SELECTOR_CONTEXTS },
  );
};

const pessoasNaOrdem = () =>
  screen.getAllByRole("rowheader").map((linha) => linha.textContent?.trim());

const cabecalhoDe = (capacidade: string) =>
  screen.getByRole("button", { name: `Ordenar por ${capacidade}` });

describe("Mapa de Calor — cada capacidade ordena a tabela", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    renderMapa();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("toda coluna de capacidade tem a setinha que ordena por ela", async () => {
    await screen.findByText("Ana Martins");

    for (const capacidade of fixtureState.capabilities) {
      expect(cabecalhoDe(capacidade.name)).toBeTruthy();
    }
  });

  it("o primeiro clique ordena crescente: o menor nível da coluna vem primeiro", async () => {
    await screen.findByText("Ana Martins");
    expect(pessoasNaOrdem()).toEqual(["Ana Martins", "Bruno Almeida"]);

    await userEvent.click(cabecalhoDe("Cloud Architecture"));

    expect(pessoasNaOrdem()).toEqual(["Bruno Almeida", "Ana Martins"]);
  });

  it("o segundo clique inverte para decrescente", async () => {
    await screen.findByText("Ana Martins");

    await userEvent.click(cabecalhoDe("Cloud Architecture"));
    await userEvent.click(cabecalhoDe("Cloud Architecture"));

    expect(pessoasNaOrdem()).toEqual(["Ana Martins", "Bruno Almeida"]);
  });

  it("o cabeçalho diz a direção a quem lê por leitor de tela", async () => {
    await screen.findByText("Ana Martins");
    const coluna = () => cabecalhoDe("Cloud Architecture").closest("th") as HTMLElement;

    expect(coluna().getAttribute("aria-sort")).toBe("none");

    await userEvent.click(cabecalhoDe("Cloud Architecture"));
    expect(coluna().getAttribute("aria-sort")).toBe("ascending");

    await userEvent.click(cabecalhoDe("Cloud Architecture"));
    expect(coluna().getAttribute("aria-sort")).toBe("descending");
  });

  it("ordenar por uma coluna solta a outra — uma coluna por vez", async () => {
    await screen.findByText("Ana Martins");

    await userEvent.click(cabecalhoDe("Cloud Architecture"));
    await userEvent.click(cabecalhoDe("Security"));

    expect(cabecalhoDe("Cloud Architecture").closest("th")?.getAttribute("aria-sort")).toBe("none");
    expect(cabecalhoDe("Security").closest("th")?.getAttribute("aria-sort")).toBe("ascending");
  });

  it("a coluna continua mostrando a sigla, com o nome inteiro no botão", async () => {
    await screen.findByText("Ana Martins");

    const coluna = cabecalhoDe("Cloud Architecture").closest("th") as HTMLElement;
    expect(coluna.textContent).toContain("Cloud");
    expect(coluna.textContent).not.toContain("Cloud Architecture");
  });
});
