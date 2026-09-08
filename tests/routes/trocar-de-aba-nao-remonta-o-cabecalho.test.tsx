import { cleanup, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import { apiPath } from "@/lib/api-path";
import { Route as EvolutionRoute } from "@/routes/professionals.$professionalId.evolution";
import { Route as ProfileRoute } from "@/routes/professionals.$professionalId.index";
import { Route as RoadmapRoute } from "@/routes/professionals.$professionalId.roadmap";
import { fixtureAssignedManagerUser, fixtureState, fixtureSupportUser } from "../helpers/fixtures";
import { goToTab, renderCareerFile } from "../helpers/ficha";
import { careerLevelsRoute, jsonResponse, mockAppFetch } from "../helpers/render-app";

/**
 * [FA-08] — a rota-pai da ficha é o layout: guarda, passe de suporte,
 * `ContextScope` e o cabeçalho fixo existem UMA vez. Antes, cada aba
 * reconstruía a mesma composição e o "cabeçalho imóvel" (referência FIAP,
 * §2 item 7) dependia de cada aba montar igual — trocar de aba desmontava e
 * remontava o bloco inteiro.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;
const EvolutionPage = EvolutionRoute.options.component as () => ReactNode;
const RoadmapPage = RoadmapRoute.options.component as () => ReactNode;

/** O `POST /evolution/professional` vazio — a Evolução abre sem série nenhuma. */
const evolutionRoute = (href: string) =>
  href.endsWith(apiPath("/evolution/professional"))
    ? jsonResponse({
        professional: { id: "ana", name: "Ana Martins", careerLevelName: null },
        summary: {
          coverage: { covered: 0, total: 0 },
          initialAverage: null,
          currentAverage: null,
          averageDelta: null,
          improved: 0,
          stable: 0,
          regressed: 0,
          mentoringCount: 0,
          assessmentCount: 0,
        },
        capabilitySeries: [],
        competencySeries: [],
        events: [],
        snapshots: [],
        comparisons: [],
      })
    : undefined;

describe("trocar de aba não remonta o cabeçalho da ficha", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: fixtureState,
      routes: [careerLevelsRoute, evolutionRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o bloco fixo e as abas são os MESMOS nós do DOM antes e depois de ir da Visão geral ao Roteiro e à Evolução", async () => {
    renderCareerFile(<ProfilePage />);
    const titulo = await screen.findByRole("heading", { level: 1, name: "Ana Martins" });
    const bloco = titulo.closest("[data-pinned]");
    expect(bloco).not.toBeNull();
    const abas = screen.getByText("Roteiro").closest("nav");
    expect(abas).not.toBeNull();

    goToTab("roadmap", <RoadmapPage />);
    expect(await screen.findByRole("heading", { level: 1, name: /Roteiro/ })).toBeTruthy();
    expect(document.querySelector("[data-pinned]")).toBe(bloco);
    expect(screen.getByText("Roteiro").closest("nav")).toBe(abas);
    expect(screen.getByText("Roteiro").getAttribute("aria-current")).toBe("page");

    goToTab("evolution", <EvolutionPage />);
    expect(await screen.findByRole("heading", { level: 1, name: /Evolução/ })).toBeTruthy();
    expect(document.querySelector("[data-pinned]")).toBe(bloco);
    expect(screen.getByText("Evolução").getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Roteiro").getAttribute("aria-current")).toBeNull();
  });

  it("o título da aba é publicado DENTRO do bloco fixo — a aba não desenha cabeçalho próprio", async () => {
    renderCareerFile(<RoadmapPage />, { tab: "roadmap" });
    const titulo = await screen.findByRole("heading", { level: 1, name: /Roteiro/ });
    expect(titulo.closest("[data-pinned]")).not.toBeNull();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it("URL direta de uma aba pede o motivo ao suporte — a guarda mora na rota-pai", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureSupportUser,
      state: fixtureState,
      routes: [careerLevelsRoute, evolutionRoute],
    });
    renderCareerFile(<EvolutionPage />, { tab: "evolution" });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.queryByRole("heading", { level: 1, name: /Evolução/ })).toBeNull();
  });
});
