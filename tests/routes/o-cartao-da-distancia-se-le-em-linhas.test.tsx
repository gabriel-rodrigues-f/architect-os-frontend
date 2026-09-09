import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de o-selo-de-distancia-nao-sai-do-cartao: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to: _to, ...rest }: ComponentProps<"a"> & { to?: string }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as PlansRoute } from "@/routes/development-plans";
import { Route as NeedsRoute } from "@/routes/training-needs";
import type { AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Dono, 2026-09-09, com duas capturas: *"bug visual em PDI. O texto da
 * capacidade está quase impossível de ler. Você está organizando por colunas.
 * Eu sugiro organizar por linhas. O mais importante é eu conseguir visualizar
 * o nome da capacidade elegantemente e confortavelmente."*
 *
 * O conserto da manhã (`o-selo-de-distancia-nao-sai-do-cartao`) parou o
 * VAZAMENTO pondo o selo e o nome lado a lado, o selo com `shrink-0` e o nome
 * com `min-w-0`. Parar o vazamento criou este defeito: numa coluna de 320 px o
 * selo fica com a largura que precisa e sobram 76 px para o nome, que desce em
 * tiras de três ou quatro letras. Consertar o sintoma dentro do mesmo arranjo
 * não bastava — a ordem agora é o ARRANJO.
 *
 * Em jsdom não há layout, então o que se afirma aqui é a CONDIÇÃO que produz o
 * arranjo (a medida real está no comentário de `CompetencyGapCard`):
 *
 *  1. o nome e o selo não dividem mais uma linha — são linhas diferentes de
 *     uma grade, e o nome ATRAVESSA as duas colunas, então mede o cartão
 *     inteiro; o selo mora na coluna da direita da PRIMEIRA linha;
 *  2. o nome vem PRIMEIRO no cartão, que é a ordem em que o leitor de tela
 *     deve ouvi-lo, mesmo com o selo desenhado acima dele;
 *  3. ao lado do selo está o "?" da casa (`HelpPopover`) — o mesmo gatilho que
 *     abre no hover, no foco e no clique — com a explicação da distância;
 *  4. a descrição, quando a tela tem uma, fica entre o nome e a ação;
 *  5. a ação fecha o cartão, esticada à largura inteira pelo bloco que a veste
 *     (`grid` estica o único filho), e não por um `w-full` que cada tela
 *     precisaria lembrar de escrever.
 *
 * E o que já era regra continua: o nome NUNCA é truncado.
 */

const fetchMock = vi.fn();

const PlansPage = PlansRoute.options.component as () => ReactNode;
const NeedsPage = NeedsRoute.options.component as () => ReactNode;

function classesOf(element: Element | null | undefined): string {
  return element?.className ?? "";
}

interface CartaoDaDistancia {
  card: HTMLElement;
  cabecalho: Element;
  name: Element;
  badge: HTMLElement;
  linhas: Element[];
}

/** O cartão é o item de lista que carrega o selo; as linhas são os filhos dele. */
function firstDistanceCardIn(cardTitle: string): CartaoDaDistancia {
  const section = screen.getByText(cardTitle).closest("section");
  if (!section) throw new Error(`cartão "${cardTitle}" não encontrado`);
  const badge = within(section as HTMLElement).getAllByText(/^Distância \d+ · /)[0];
  if (!badge) throw new Error("nenhum selo de distância no cartão");
  const card = badge.closest("li");
  if (!card) throw new Error("selo de distância fora de um item de lista");
  const cabecalho = card.children[0];
  if (!cabecalho) throw new Error("cartão sem a primeira linha");
  const name = cabecalho.children[0];
  if (!name) throw new Error("primeira linha sem o nome da competência");
  return { card, cabecalho, name, badge, linhas: [...card.children] };
}

/** O "?" do selo — procurado só onde ele é o assunto, para o resto falhar pelo próprio motivo. */
const ajudaDoSelo = (card: HTMLElement): HTMLElement =>
  within(card).getByRole("button", { name: /^Como ler Distância \d+ · / });

const settingRecord = (key: string, value: string | number) => ({
  key,
  value,
  valueType: typeof value === "number" ? "int" : "enum",
  scope: "operational",
  description: null,
  updatedAt: "2026-08-26T00:00:00Z",
  updatedBy: null,
});

/** A fixture tem duas pessoas na mesma distância: o limiar 2 as torna coletivas. */
const thresholdTwoRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/settings")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({
        settings: [
          settingRecord("cycle.cadence", "SEMIANNUAL"),
          settingRecord("career.minimumQualifiedFloor", 3),
          settingRecord("training.collectiveInterventionThreshold", 2),
        ],
      })
    : undefined;

const stateWithoutPaths: AppState = { ...fixtureState, learningPaths: [] };

const abrirPdi = async () => {
  mockAppFetch(fetchMock, {});
  window.history.pushState({}, "", "?professionalId=bruno");
  renderWithApp(<PlansPage />);
  await screen.findByText("Maiores distâncias");
};

const abrirCapacitacao = async () => {
  mockAppFetch(fetchMock, { state: stateWithoutPaths, routes: [thresholdTwoRoute] });
  renderWithApp(<NeedsPage />);
  await screen.findByText("Treinamentos Recomendados para o Time");
};

describe("o cartão da distância se lê em linhas", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("PDI: o nome atravessa as duas colunas — o selo não divide linha com ele", async () => {
    await abrirPdi();

    const { cabecalho, name, badge } = firstDistanceCardIn("Maiores distâncias");

    expect(name.tagName).toBe("P");
    expect(name.contains(badge)).toBe(false);
    expect(classesOf(cabecalho)).toContain("grid");
    expect(classesOf(name)).toContain("col-span-2");
    expect(classesOf(name)).toContain("row-start-2");
    expect(classesOf(badge.parentElement)).toContain("row-start-1");
    expect(classesOf(name)).not.toContain("flex-1");
  });

  it("PDI: o nome vem primeiro no cartão, e continua inteiro", async () => {
    await abrirPdi();

    const { cabecalho, name, badge } = firstDistanceCardIn("Maiores distâncias");

    expect([...cabecalho.children].indexOf(name)).toBeLessThan(
      [...cabecalho.children].findIndex((filho) => filho.contains(badge)),
    );
    expect(classesOf(name)).toContain("break-words");
    expect(classesOf(name)).not.toContain("truncate");
    expect(name.textContent).not.toContain("…");
  });

  it("PDI: o '?' ao lado do selo abre a explicação da distância no ponteiro", async () => {
    await abrirPdi();
    const user = userEvent.setup();

    const { card, badge } = firstDistanceCardIn("Maiores distâncias");
    const help = ajudaDoSelo(card);
    expect(badge.nextElementSibling).toBe(help);

    await user.hover(help);

    const explicacao = await screen.findByRole("dialog");
    expect(explicacao.textContent).toContain("Distância 1 · Recomendado");
    expect(explicacao.textContent).toContain("Recomendado para desenvolvimento no curto prazo.");
  });

  it("PDI: 'Adicionar ao PDI' fecha o cartão, esticado à largura inteira", async () => {
    await abrirPdi();

    const { card, linhas } = firstDistanceCardIn("Maiores distâncias");
    const acao = within(card).getByRole("button", { name: /Adicionar ao PDI/ });
    const bloco = acao.parentElement;

    expect(bloco).toBe(linhas[linhas.length - 1]);
    expect(classesOf(bloco)).toContain("grid");
  });

  it("Treinamentos Recomendados para o Time: o mesmo arranjo, com a descrição no meio", async () => {
    await abrirCapacitacao();

    const { card, cabecalho, name, badge, linhas } = firstDistanceCardIn(
      "Treinamentos Recomendados para o Time",
    );

    expect(name.contains(badge)).toBe(false);
    expect(classesOf(cabecalho)).toContain("grid");
    expect(classesOf(name)).toContain("col-span-2");
    expect(ajudaDoSelo(card)).toBeTruthy();

    expect(linhas.indexOf(cabecalho)).toBe(0);
    expect(linhas[1]?.textContent).toContain("formato sugerido");
  });
});
