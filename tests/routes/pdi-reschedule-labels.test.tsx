import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as PlansRoute } from "@/routes/development-plans";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * F3/Grupo 2, item 3 — label órfão no diálogo de reprogramação do PDI.
 *
 * "Prazo atual" era um `<label>` copiado do campo vizinho ("Novo prazo"), mas
 * não rotula controle nenhum: o valor ao lado é texto somente leitura. Um
 * `<label>` sem controle é ruído no leitor de tela (e no clique: não foca
 * nada), e deixa o valor sem relação programática com a legenda que o nomeia.
 *
 * O par legenda/valor somente leitura é uma descrição, não um rótulo de
 * formulário — e é assim que precisa chegar na árvore de acessibilidade.
 */

const fetchMock = vi.fn();

const PlansPage = PlansRoute.options.component as () => ReactNode;

async function abrirDialogoDeReprogramacao(): Promise<HTMLElement> {
  renderWithApp(<PlansPage />);
  await screen.findByText("Evoluir IAM");
  fireEvent.click(screen.getAllByRole("button", { name: "Reprogramar" })[0]!);
  return screen.getByRole("dialog");
}

describe("PDI — diálogo de reprogramação sem label órfão", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock);
    window.history.pushState({}, "", "?architectId=ana");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("expõe o prazo atual como descrição, com a legenda ligada ao valor", async () => {
    const dialogo = within(await abrirDialogoDeReprogramacao());

    expect(dialogo.getByRole("term").textContent).toBe("Prazo atual");
    expect(dialogo.getByRole("definition").textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("não deixa nenhum `<label>` do diálogo sem controle associado", async () => {
    const dialogo = await abrirDialogoDeReprogramacao();

    const labels = Array.from(dialogo.querySelectorAll("label"));
    expect(labels.length).toBeGreaterThan(0);
    const orfaos = labels.filter((label) => {
      const alvo = label.htmlFor
        ? dialogo.querySelector(`#${label.htmlFor}`)
        : label.querySelector("input, select, textarea");
      return alvo === null;
    });
    expect(orfaos.map((label) => label.textContent)).toEqual([]);
  });

  it("mantém o campo de novo prazo rotulado", async () => {
    const dialogo = within(await abrirDialogoDeReprogramacao());

    expect(dialogo.getByLabelText("Novo prazo")).toBeTruthy();
    expect(dialogo.getByLabelText("Motivo da reprogramação")).toBeTruthy();
  });
});
