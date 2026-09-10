import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { Route as CatalogPolicyRoute } from "@/routes/catalog-policy";
import { fixtureAdminUser } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 37, item 5 — o "?" das duas telas conta a regra NOVA. Ajuda que
 * descreve a regra velha é pior que ajuda nenhuma: ela ensina errado, e o
 * dono não tem como saber qual das duas está desatualizada.
 *
 * O que mudou e precisa aparecer: a capacidade nasce fundada com as
 * competências que a definem; "Pronta" é do mínimo até o máximo (não mais de
 * 1); o nome de competência é único em toda a aplicação; e a régua do time
 * aceita mínimo ZERO.
 *
 * O piso da régua (2026-09-10): a regra 12 do dono (`papeis-2026-09-06.md`,
 * 2026-09-08) tirou o mínimo — *"apenas vamos remover a regra de que 3 é o
 * mínimo. Não haverá mais valor mínimo."* — e a regra 19 confirmou que o
 * piso zero continua valendo. O código já obedecia
 * (`QualifiedCapabilityMinimum.FLOOR === 0`, e o campo nasce com `min={0}`);
 * quem continuou contando a regra velha foi a AJUDA, que dizia "o menor
 * mínimo da régua é 1". Uma fatia de layout portou a frase verbatim de
 * propósito, para não consertar conteúdo fora do escopo dela. Aqui ela é o
 * escopo: ajuda que ensina a regra revogada é pior que ajuda nenhuma.
 */

const fetchMock = vi.fn();
const MatrixPage = MatrixRoute.options.component as () => ReactNode;
const CatalogPolicyPage = CatalogPolicyRoute.options.component as () => ReactNode;

/**
 * Revisão de papéis (dono, 2026-09-05, D1): a Matriz e o Catálogo são do
 * sistema — quem os abre é o admin; a Política de Progressão é regida pelo
 * gerente com vínculo, e o ? dela precisa contar a regra a ele.
 */
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const entrarComo = (user: typeof fixtureAdminUser) =>
  mockAppFetch(fetchMock, { user, routes: [careerLevelsRoute] });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("o ? da Matriz conta como a capacidade nasce e o que a deixa pronta", () => {
  it("fala da fundação, do intervalo e da unicidade do nome", async () => {
    entrarComo(fixtureAdminUser);
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(
      screen.getByRole("button", { name: "Como usar Catálogo de Competências" }),
    );

    const ajuda = await screen.findByRole("dialog");
    expect(ajuda.textContent).toMatch(/nasce com as competências/i);
    expect(ajuda.textContent).toMatch(/mínimo/i);
    expect(ajuda.textContent).toMatch(/não se repete/i);
    expect(ajuda.textContent).not.toMatch(/de 1 até o máximo/i);
  });
});

/**
 * Onda do GRUPO (dono, 2026-09-10): os dois grupos viraram TELAS — Curadoria do Catálogo e
 * Elegibilidade —, e o `?` deles subiu para o cabeçalho da página com o mesmo
 * texto. A regra que a ajuda conta não mudou; mudou onde se clica.
 */
describe("o ? das fatias de configuração conta o intervalo e o piso da régua", () => {
  it("a Curadoria do Catálogo explica que pronta é do mínimo ao máximo (para o admin)", async () => {
    entrarComo(fixtureAdminUser);
    renderWithApp(<CatalogPolicyPage />);
    await screen.findByRole("heading", { level: 1, name: "Curadoria do Catálogo" });

    await userEvent.click(screen.getByRole("button", { name: "Como usar Curadoria do Catálogo" }));

    const ajuda = await screen.findByRole("dialog");
    expect(ajuda.textContent).toMatch(/mínimo/i);
    expect(ajuda.textContent).not.toMatch(/de 1 até esse máximo/i);
  });
});
