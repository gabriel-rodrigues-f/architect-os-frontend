import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import { Route as ProfileRoute } from "@/routes/professionals.$professionalId.index";
import type { AppState } from "@/lib/api";
import type { MentoringSession } from "@/lib/domain";
import { fixtureAssignedManagerUser, fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch } from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

/**
 * O CARTÃO "MENTORIAS" DA FICHA MOSTRA O QUE A 1:1 GUARDA.
 *
 * A única linha de conteúdo do cartão era `{s.actions}`. Quando "Decisões" e
 * "Ações" morreram do produto inteiro (dono, 2026-09-09), ela saiu e nada
 * tomou o lugar: sobravam tema e o carimbo "data · duração · mentor" — um
 * cartão que conta que a conversa ACONTECEU e não conta NADA do que nela se
 * disse.
 *
 * Decisão de produto (dono, 2026-09-09): `notes` toma o lugar, que é o bloco
 * único que a 1:1 passou a ter. Este teste é a rede dessa decisão — e a rede
 * de que o campo morto não volta pela porta dos fundos, junto.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

const AS_NOTAS = "Revisamos o particionamento e ficou combinado o ADR até sexta.";

const conversa: MentoringSession = {
  id: "m-ana-1",
  mentor: "Gabriel Rodrigues",
  mentorUserId: "u-manager",
  menteeId: "ana",
  date: "2026-08-01",
  durationMin: 45,
  topic: "Particionamento",
  notes: AS_NOTAS,
};

const comAConversa: AppState = { ...fixtureState, mentoringSessions: [conversa] };

describe("o cartão de Mentorias da ficha mostra as Notas da 1:1", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: comAConversa,
      routes: [careerLevelsRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a sessão listada traz tema, carimbo e as Notas", async () => {
    renderCareerFile(<ProfilePage />, { tab: "overview", professionalId: "ana" });

    expect(await screen.findByText("Particionamento")).toBeTruthy();
    expect(screen.getByText(/01\/08\/2026 · 45 min · mentor/)).toBeTruthy();
    expect(screen.getByText(AS_NOTAS)).toBeTruthy();
  });
});
