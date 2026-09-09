import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de training-needs-threshold.test.tsx: `<Link>` exige RouterProvider real. */
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
 * Dono, 2026-09-09, com captura: *"o nível da distância está excedendo o
 * bloco que o comporta"*. Em PDI > Maiores Distâncias o selo
 * "Distância 1 · Recomendado" saía do cartão pela direita.
 *
 * A CAUSA não é o selo: é a linha. O selo é um `Chip`, e chip nasce
 * `whitespace-nowrap` — a largura mínima dele é o texto inteiro. Ao lado dele
 * o nome da competência era um `<p>` sem `min-w-0`, e um item de flex sem
 * `min-w-0` também não encolhe abaixo da própria palavra mais longa. Os dois
 * irmãos se recusam a encolher, a soma passa da coluna (320 px no PDI) e o
 * que sobra vaza para fora do cartão.
 *
 * A RÉGUA DO DONO, e é ela que estes testes afirmam: o selo cabe, o nome
 * INTEIRO continua legível — nada de `truncate`, ele já reprovou nome de
 * competência cortado — e nada sai do cartão. Em jsdom não há layout, então
 * o que se afirma é a condição que produz o layout: o selo NÃO encolhe
 * (`shrink-0`), porque ele é a parte que precisa caber inteira, e o nome
 * quebra a palavra longa em vez de vazar (`break-words`).
 *
 * O ARRANJO mudou na mesma tarde (`o-cartao-da-distancia-se-le-em-linhas`):
 * pôr os dois lado a lado parou o vazamento mas deixou o nome com as sobras
 * de uma coluna de 320 px. Agora o selo sai do fluxo para dentro do bloco do
 * nome. A régua deste arquivo sobreviveu à troca — ela é sobre o que não pode
 * acontecer, não sobre como o arranjo o evita —, e é por isso que ela continua
 * aqui: o próximo arranjo também vai ter de passar por ela.
 */

const fetchMock = vi.fn();

const PlansPage = PlansRoute.options.component as () => ReactNode;
const NeedsPage = NeedsRoute.options.component as () => ReactNode;

function classesOf(element: Element | null | undefined): string {
  return element?.className ?? "";
}

/** A seção carrega o título; a linha é a grade que hospeda o nome e o selo. */
function rowOfFirstGapBadgeIn(cardTitle: string): {
  row: Element;
  name: Element;
  badge: Element;
} {
  const card = screen.getByText(cardTitle).closest("section");
  if (!card) throw new Error(`cartão "${cardTitle}" não encontrado`);
  const badge = within(card as HTMLElement).getAllByText(/^Distância \d+ · /)[0];
  if (!badge) throw new Error("nenhum selo de distância no cartão");
  const row = badge.parentElement?.parentElement;
  if (!row) throw new Error("selo de distância sem linha");
  const name = [...row.children].find((child) => !child.contains(badge));
  if (!name) throw new Error("linha do selo sem o nome da competência");
  return { row, name, badge };
}

const settingRecord = (key: string, value: string | number) => ({
  key,
  value,
  valueType: typeof value === "number" ? "int" : "enum",
  scope: "operational",
  description: null,
  updatedAt: "2026-08-26T00:00:00Z",
  updatedBy: null,
});

/** A fixture tem duas pessoas com a mesma lacuna: o limiar 2 as torna coletivas. */
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

describe("o selo de distância cabe no cartão, e o nome inteiro fica legível", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("PDI > Maiores distâncias: o nome quebra em vez de vazar, e o selo não encolhe", async () => {
    mockAppFetch(fetchMock, {});
    window.history.pushState({}, "", "?professionalId=bruno");
    renderWithApp(<PlansPage />);
    await screen.findByText("Maiores distâncias");

    const { name, badge } = rowOfFirstGapBadgeIn("Maiores distâncias");

    expect(classesOf(name)).toContain("break-words");
    expect(classesOf(name)).not.toContain("truncate");
    expect(classesOf(badge)).toContain("shrink-0");
  });

  it("PDI > Maiores distâncias: o nome da competência aparece inteiro", async () => {
    mockAppFetch(fetchMock, {});
    window.history.pushState({}, "", "?professionalId=bruno");
    renderWithApp(<PlansPage />);
    await screen.findByText("Maiores distâncias");

    const { name } = rowOfFirstGapBadgeIn("Maiores distâncias");

    expect(name.textContent?.trim().length).toBeGreaterThan(0);
    expect(name.textContent).not.toContain("…");
  });

  it("Treinamentos Recomendados para o Time: a mesma linha, a mesma régua", async () => {
    mockAppFetch(fetchMock, { state: stateWithoutPaths, routes: [thresholdTwoRoute] });
    renderWithApp(<NeedsPage />);
    await screen.findByText("Treinamentos Recomendados para o Time");

    const { name, badge } = rowOfFirstGapBadgeIn("Treinamentos Recomendados para o Time");

    expect(classesOf(name)).toContain("break-words");
    expect(classesOf(badge)).toContain("shrink-0");
  });
});
