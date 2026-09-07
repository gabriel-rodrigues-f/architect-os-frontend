import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `estrangulamento-perfil.test.tsx`: `Route.useParams()` exige árvore montada. */
vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import type { AppState } from "@/lib/api";
import type { Architect } from "@/lib/domain";
import { fixtureAssignedManagerUser, fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch } from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

/**
 * FATIA `inativo-some` — a contrapartida da regra "inativo some": nenhum
 * seletor oferece a ficha de quem foi desativado, mas o link da tela Time
 * (o único lugar que ainda lista inativos) continua abrindo. Chegando ali —
 * por esse link ou por URL colada —, a tela AVISA que a pessoa está
 * desativada e aponta o caminho de volta, em vez de desenhá-la como se
 * fosse do time ativo.
 */

const fetchMock = vi.fn();

const raquel: Architect = {
  id: "raquel",
  name: "Raquel Marangoni",
  role: "Pleno",
  yearsAsArchitect: 5,
  specialization: "",
  email: "raquel@company.com",
  active: false,
  version: 1,
};

const comInativa: AppState = {
  ...fixtureState,
  architects: [...fixtureState.architects, raquel],
};

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

describe("ficha de quem está desativado avisa e aponta para Time", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: comInativa,
      routes: [careerLevelsRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra o aviso de desativado, com o caminho para Time", async () => {
    renderCareerFile(<ProfilePage />, { architectId: "raquel" });

    const aviso = await screen.findByRole("status");
    expect(aviso.textContent).toMatch(/desativad/);
    expect(aviso.querySelector("a")?.getAttribute("href")).toBe("/team");
  });

  it("a ficha de quem está ativo não mostra aviso nenhum", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: { ...comInativa, architects: fixtureState.architects },
      routes: [careerLevelsRoute],
    });
    renderCareerFile(<ProfilePage />, { architectId: "raquel" });

    await screen.findByText(/não encontrado|Ana Martins|Bruno Almeida/);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
