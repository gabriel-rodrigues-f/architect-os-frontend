import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { Route as SettingsRoute } from "@/routes/settings";
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
 * aceita mínimo 1.
 */

const fetchMock = vi.fn();
const MatrixPage = MatrixRoute.options.component as () => ReactNode;
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [careerLevelsRoute] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("o ? da Matriz conta como a capacidade nasce e o que a deixa pronta", () => {
  it("fala da fundação, do intervalo e da unicidade do nome", async () => {
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByRole("button", { name: "Como usar Matriz de Competências" }));

    const ajuda = await screen.findByRole("dialog");
    expect(ajuda.textContent).toMatch(/nasce com as competências/i);
    expect(ajuda.textContent).toMatch(/mínimo/i);
    expect(ajuda.textContent).toMatch(/não se repete/i);
    expect(ajuda.textContent).not.toMatch(/de 1 até o máximo/i);
  });
});

describe("o ? das Configurações conta o intervalo e o piso da régua", () => {
  it("o Catálogo explica que pronta é do mínimo ao máximo", async () => {
    renderWithApp(<SettingsPage />);
    await screen.findByText("Vocabulários");

    await userEvent.click(screen.getByRole("button", { name: "Como configurar Catálogo" }));

    const ajuda = await screen.findByRole("dialog");
    expect(ajuda.textContent).toMatch(/mínimo/i);
    expect(ajuda.textContent).not.toMatch(/de 1 até esse máximo/i);
  });

  it("a Política de Progressão explica que o mínimo da régua pode ser 1", async () => {
    renderWithApp(<SettingsPage />);
    await screen.findByText("Vocabulários");

    await userEvent.click(
      screen.getByRole("button", { name: "Como configurar Política de Progressão" }),
    );

    const ajuda = await screen.findByRole("dialog");
    expect(ajuda.textContent).toMatch(/mínimo da régua é 1/i);
  });
});
